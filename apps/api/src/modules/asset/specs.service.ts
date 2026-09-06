import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantContextService } from '../../core/tenancy/tenant-context.service';
import { Asset } from './entities/asset.entity';
import { AssetSpec, type SpecItem } from './entities/asset-spec.entity';
import { ManualFetchService } from './manual-fetch.service';
import { sanitizeSpecs } from './specs.logic';

export interface FetchSpecResult {
  spec: AssetSpec | null;
  configured: boolean;
}

/**
 * Technické specifikace položky „přes AI" (dohledané z webu → tabulka na kartě).
 * Jeden set na položku (upsert). Sdílí webhook/n8n infrastrukturu s manuály přes
 * `ManualFetchService.dispatchSpec`; callback plní `specs`. Pojistka: zaseknuté
 * `fetching` se po 2 min překlopí na `failed`.
 */
@Injectable()
export class SpecsService {
  private static readonly FETCH_TIMEOUT_MS = 2 * 60 * 1000;

  constructor(
    private readonly context: TenantContextService,
    private readonly fetcher: ManualFetchService,
  ) {}

  private repo(): Repository<AssetSpec> {
    return this.context.manager.getRepository(AssetSpec);
  }

  /** Specifikace položky (nebo null); cestou překlopí zaseknuté `fetching`. */
  async get(assetId: string): Promise<AssetSpec | null> {
    const spec = await this.repo().findOne({ where: { assetId } });
    if (spec && spec.status === 'fetching' && this.isStale(spec)) {
      const asset = await this.getAsset(assetId);
      spec.status = 'failed';
      spec.failureReason = this.failureReasonFor(asset, true);
      return this.repo().save(spec);
    }
    return spec;
  }

  /** Spustí AI dohledání specifikací (upsert `fetching` + webhook). */
  async fetchAi(assetId: string): Promise<FetchSpecResult> {
    const asset = await this.assertAsset(assetId);

    if (!this.fetcher.isConfigured()) {
      return { spec: null, configured: false };
    }

    // Pre-check: bez výrobce i modelu nemá AI dost podkladů → hned `failed`.
    if (!asset.manufacturer && !asset.model) {
      return {
        spec: await this.upsert(assetId, {
          status: 'failed',
          specs: null,
          sourceUrl: null,
          failureReason: this.failureReasonFor(asset, false),
        }),
        configured: true,
      };
    }

    const spec = await this.upsert(assetId, {
      status: 'fetching',
      specs: null,
      sourceUrl: null,
      failureReason: null,
    });

    try {
      const res = await this.fetcher.dispatchSpec({
        specId: spec.id,
        assetId,
        tenantId: this.context.tenantId ?? '',
        name: asset.name,
        manufacturer: asset.manufacturer,
        model: asset.model,
      });
      if (!res.configured) return { spec: null, configured: false };
    } catch {
      spec.status = 'failed';
      spec.failureReason = this.failureReasonFor(asset, false);
      await this.repo().save(spec);
    }
    return { spec, configured: true };
  }

  /** Callback z n8n: uloží dohledané specifikace a přepne na `ready`. */
  async completeFromCallback(
    specId: string,
    rawSpecs: unknown,
    sourceUrl: string | null,
  ): Promise<void> {
    const spec = await this.repo().findOne({ where: { id: specId } });
    if (!spec) throw new NotFoundException('Specifikace neexistují');
    const items = sanitizeSpecs(rawSpecs);
    if (items.length === 0) {
      spec.status = 'failed';
      spec.failureReason = 'AI nevrátila žádné použitelné specifikace.';
    } else {
      spec.specs = items;
      spec.sourceUrl = sourceUrl;
      spec.status = 'ready';
      spec.failureReason = null;
    }
    await this.repo().save(spec);
  }

  /** Callback označí dohledání jako neúspěšné. */
  async markFailed(specId: string, reason?: string): Promise<void> {
    const spec = await this.repo().findOne({ where: { id: specId } });
    if (!spec) throw new NotFoundException('Specifikace neexistují');
    const asset = await this.getAsset(spec.assetId);
    spec.status = 'failed';
    spec.failureReason = reason?.trim() || this.failureReasonFor(asset, false);
    await this.repo().save(spec);
  }

  /** Upsert spec řádku položky (jeden set na položku). */
  private async upsert(assetId: string, patch: Partial<AssetSpec>): Promise<AssetSpec> {
    const existing = await this.repo().findOne({ where: { assetId } });
    const spec = existing ?? this.repo().create({ tenantId: this.context.tenantId, assetId });
    Object.assign(spec, patch);
    return this.repo().save(spec);
  }

  private isStale(spec: AssetSpec): boolean {
    return Date.now() - spec.updatedAt.getTime() > SpecsService.FETCH_TIMEOUT_MS;
  }

  private failureReasonFor(
    asset: Pick<Asset, 'manufacturer' | 'model'> | null,
    timedOut: boolean,
  ): string {
    if (!asset?.manufacturer && !asset?.model) {
      return 'Specifikace nenalezeny – o položce je příliš málo detailů (doplňte výrobce a model).';
    }
    return timedOut
      ? 'Dohledání specifikací se nezdařilo (vypršel čas).'
      : 'Specifikace se nepodařilo dohledat.';
  }

  private async getAsset(assetId: string): Promise<Asset | null> {
    return this.context.manager.getRepository(Asset).findOne({ where: { id: assetId } });
  }

  private async assertAsset(assetId: string): Promise<Asset> {
    const asset = await this.getAsset(assetId);
    if (!asset) throw new NotFoundException('Položka neexistuje');
    return asset;
  }
}

export type { SpecItem };
