import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { LessThan, Repository } from 'typeorm';
import { TenantContextService } from '../../core/tenancy/tenant-context.service';
import { STORAGE, type StoragePort } from '../../core/storage/storage.port';
import { Asset } from './entities/asset.entity';
import { AssetManual } from './entities/asset-manual.entity';
import { ManualFetchService } from './manual-fetch.service';
import { normalizeSource, validateManualFile } from './manuals.logic';

export interface AddManualInput {
  buffer: Buffer;
  mime: string;
  filename?: string;
  source?: string;
}

export interface FetchAiResult {
  manual: AssetManual;
  configured: boolean;
}

/** Doplnění souboru k manuálu z AI callbacku (binárka nebo stažení z fileUrl). */
export interface CompleteManualInput {
  buffer: Buffer;
  mime: string;
  sourceUrl?: string | null;
}

@Injectable()
export class ManualsService {
  private readonly logger = new Logger(ManualsService.name);

  constructor(
    private readonly context: TenantContextService,
    @Inject(STORAGE) private readonly storage: StoragePort,
    private readonly fetcher: ManualFetchService,
  ) {}

  private repo(): Repository<AssetManual> {
    return this.context.manager.getRepository(AssetManual);
  }

  /** Jak dlouho smí AI stahování viset ve `fetching`, než ho pojistka překlopí. */
  private static readonly FETCH_TIMEOUT_MS = 5 * 60 * 1000;

  /** Manuály položky, nejnovější první. Cestou překlopí zaseknuté `fetching`. */
  async list(assetId: string): Promise<AssetManual[]> {
    await this.expireStaleFetching(assetId);
    return this.repo().find({ where: { assetId }, order: { createdAt: 'DESC' } });
  }

  /**
   * Pojistka: řádky, které visí ve `fetching` déle než timeout (n8n nezavolal
   * callback – např. workflow spadl bez failed-callbacku), překlopí na `failed`
   * se srozumitelným důvodem. Volá se lazy při čtení seznamu.
   */
  private async expireStaleFetching(assetId: string): Promise<void> {
    const cutoff = new Date(Date.now() - ManualsService.FETCH_TIMEOUT_MS);
    const stale = await this.repo().find({
      where: { assetId, status: 'fetching', createdAt: LessThan(cutoff) },
    });
    if (stale.length === 0) return;
    const asset = await this.context.manager.getRepository(Asset).findOne({ where: { id: assetId } });
    const reason = this.failureReasonFor(asset, true);
    for (const m of stale) {
      m.status = 'failed';
      m.failureReason = reason;
    }
    await this.repo().save(stale);
  }

  /**
   * Srozumitelný důvod selhání. Když položce chybí výrobce i model, AI nemá dost
   * podkladů → to je nejčastější příčina; jinak obecná hláška (příp. timeout).
   */
  private failureReasonFor(
    asset: Pick<Asset, 'manufacturer' | 'model'> | null,
    timedOut: boolean,
  ): string {
    if (!asset?.manufacturer && !asset?.model) {
      return 'Dostupný manuál nenalezen – o položce je příliš málo detailů (doplňte výrobce a model).';
    }
    return timedOut
      ? 'Stažení manuálu se nezdařilo (vypršel čas).'
      : 'Dostupný manuál nenalezen.';
  }

  /** Upload souboru nebo fotky z kamery (stejný endpoint, jiný `source`). */
  async add(assetId: string, input: AddManualInput): Promise<AssetManual> {
    await this.assertAsset(assetId);

    const size = input.buffer.length;
    const err = validateManualFile(input.mime, size);
    if (err) throw new BadRequestException(err);

    const source = normalizeSource(input.source);
    const key = this.storageKey(assetId);
    await this.storage.put(key, input.buffer, input.mime);

    return this.repo().save(
      this.repo().create({
        tenantId: this.context.tenantId,
        assetId,
        title: this.deriveTitle(input.filename, input.mime, source),
        fileKey: key,
        mime: input.mime,
        sizeBytes: size,
        source,
        sourceUrl: null,
        status: 'ready',
      }),
    );
  }

  /** Stream souboru manuálu (jako media file). */
  async file(manualId: string): Promise<{ buffer: Buffer; mime: string }> {
    const manual = await this.repo().findOne({ where: { id: manualId } });
    if (!manual || !manual.fileKey) throw new NotFoundException('Manuál nemá soubor');
    return {
      buffer: await this.storage.get(manual.fileKey),
      mime: manual.mime ?? 'application/octet-stream',
    };
  }

  async remove(manualId: string): Promise<void> {
    const manual = await this.repo().findOne({ where: { id: manualId } });
    if (!manual) throw new NotFoundException('Manuál neexistuje');
    if (manual.fileKey) {
      await this.storage.del(manual.fileKey).catch(() => undefined);
    }
    await this.repo().delete({ id: manualId });
  }

  /**
   * Spustí AI stažení: založí řádek `status='fetching'`, `source='ai'` a POSTne
   * na webhook. Když webhook není nakonfigurován, řádek nevzniká a vrací se
   * `configured=false` (UI ukáže „AI stahování není nakonfigurováno").
   */
  async fetchAi(assetId: string): Promise<FetchAiResult> {
    const asset = await this.assertAsset(assetId);

    if (!this.fetcher.isConfigured()) {
      // Nezakládej řádek – ať UI neukazuje trvale „hledám".
      return { manual: this.placeholder(assetId, asset), configured: false };
    }

    const manual = await this.repo().save(
      this.repo().create({
        tenantId: this.context.tenantId,
        assetId,
        title: this.deriveTitle(undefined, null, 'ai', asset),
        fileKey: null,
        mime: null,
        sizeBytes: null,
        source: 'ai',
        sourceUrl: null,
        status: 'fetching',
      }),
    );

    try {
      const res = await this.fetcher.dispatch({
        manualId: manual.id,
        assetId,
        tenantId: this.context.tenantId ?? '',
        name: asset.name,
        manufacturer: asset.manufacturer,
        model: asset.model,
      });
      if (!res.configured) {
        await this.repo().delete({ id: manual.id });
        return { manual: this.placeholder(assetId, asset), configured: false };
      }
    } catch {
      manual.status = 'failed';
      manual.failureReason = this.failureReasonFor(asset, false);
      await this.repo().save(manual);
    }
    return { manual, configured: true };
  }

  /**
   * Callback z n8n: doplní soubor k `fetching` manuálu a přepne na `ready`.
   * Běží mimo request kontext – volající (webhook controller) už nastavil
   * tenant kontext přes runInTenant.
   */
  async completeFromCallback(
    manualId: string,
    input: CompleteManualInput,
  ): Promise<AssetManual> {
    const manual = await this.repo().findOne({ where: { id: manualId } });
    if (!manual) throw new NotFoundException('Manuál neexistuje');

    const err = validateManualFile(input.mime, input.buffer.length);
    if (err) throw new BadRequestException(err);

    const key = this.storageKey(manual.assetId);
    await this.storage.put(key, input.buffer, input.mime);
    manual.fileKey = key;
    manual.mime = input.mime;
    manual.sizeBytes = input.buffer.length;
    manual.sourceUrl = input.sourceUrl ?? null;
    manual.status = 'ready';
    return this.repo().save(manual);
  }

  /** Callback označí stažení jako neúspěšné (nenalezeno). */
  async markFailed(manualId: string, reason?: string): Promise<void> {
    const manual = await this.repo().findOne({ where: { id: manualId } });
    if (!manual) throw new NotFoundException('Manuál neexistuje');
    const asset = await this.context.manager
      .getRepository(Asset)
      .findOne({ where: { id: manual.assetId } });
    manual.status = 'failed';
    manual.failureReason = reason?.trim() || this.failureReasonFor(asset, false);
    await this.repo().save(manual);
  }

  private storageKey(assetId: string): string {
    return `asset-manuals/${this.context.tenantId}/${assetId}/${randomUUID()}`;
  }

  private deriveTitle(
    filename: string | undefined,
    mime: string | null,
    source: 'upload' | 'camera' | 'ai',
    asset?: Asset,
  ): string {
    if (filename && filename.trim()) return filename.trim().slice(0, 200);
    if (source === 'camera') return 'Vyfocený manuál';
    if (source === 'ai') {
      const parts = [asset?.manufacturer, asset?.model].filter(Boolean);
      return parts.length ? `Manuál – ${parts.join(' ')}` : 'Manuál (AI)';
    }
    if (mime === 'application/pdf') return 'Manuál (PDF)';
    return 'Manuál';
  }

  /** Neuložený placeholder pro odpověď, když AI není nakonfigurováno. */
  private placeholder(assetId: string, asset: Asset): AssetManual {
    const m = new AssetManual();
    m.assetId = assetId;
    m.title = this.deriveTitle(undefined, null, 'ai', asset);
    m.source = 'ai';
    m.status = 'failed';
    m.fileKey = null;
    m.mime = null;
    m.sizeBytes = null;
    m.sourceUrl = null;
    return m;
  }

  private async assertAsset(assetId: string): Promise<Asset> {
    const asset = await this.context.manager
      .getRepository(Asset)
      .findOne({ where: { id: assetId } });
    if (!asset) throw new NotFoundException('Položka neexistuje');
    return asset;
  }
}
