import { createHash, randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantContextService } from '../../core/tenancy/tenant-context.service';
import { STORAGE, type StoragePort } from '../../core/storage/storage.port';
import { WebhookService } from '../../core/webhooks/webhook.service';
import { Tenant } from '../../core/domain/entities/tenant.entity';
import { Asset } from './entities/asset.entity';
import { AssetMedia } from './entities/asset-media.entity';

const DEFAULT_MAX_MEDIA_PER_EVENT = 5;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AddMediaInput {
  buffer: Buffer;
  mime: string;
  movementId?: string;
  phase?: AssetMedia['phase'];
  caption?: string;
  capturedBy?: string;
}

@Injectable()
export class MediaService {
  constructor(
    private readonly context: TenantContextService,
    @Inject(STORAGE) private readonly storage: StoragePort,
    private readonly webhooks: WebhookService,
  ) {}

  private repo(): Repository<AssetMedia> {
    return this.context.manager.getRepository(AssetMedia);
  }

  /** Časová osa médií věci (skrytá se nevrací), nejnovější první. */
  list(assetId: string): Promise<AssetMedia[]> {
    return this.repo().find({
      where: { assetId, hidden: false },
      order: { capturedAt: 'DESC' },
    });
  }

  /** Maximální počet médií na jednu událost (pohyb) – nastavení tenanta. */
  private async maxPerEvent(): Promise<number> {
    const tenant = await this.context.manager
      .getRepository(Tenant)
      .findOne({ where: { id: this.context.tenantId } });
    const v = Number(tenant?.settings?.maxMediaPerEvent);
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : DEFAULT_MAX_MEDIA_PER_EVENT;
  }

  async add(assetId: string, input: AddMediaInput): Promise<AssetMedia> {
    await this.assertAsset(assetId);

    // Limit počtu médií na nedotknutelnou událost (pohyb).
    if (input.movementId) {
      const count = await this.repo().count({
        where: { assetId, movementId: input.movementId, hidden: false },
      });
      const max = await this.maxPerEvent();
      if (count >= max) {
        throw new BadRequestException(`U této události je limit ${max} médií`);
      }
    }

    const kind: AssetMedia['kind'] = input.mime.startsWith('video/')
      ? 'video'
      : input.mime.startsWith('image/')
        ? 'photo'
        : 'document';
    const key = `asset-media/${this.context.tenantId}/${assetId}/${randomUUID()}`;
    await this.storage.put(key, input.buffer, input.mime);
    const sha256 = createHash('sha256').update(input.buffer).digest('hex');

    const media = await this.repo().save(
      this.repo().create({
        tenantId: this.context.tenantId,
        assetId,
        movementId: input.movementId ?? null,
        phase: input.phase ?? 'general',
        kind,
        fileKey: key,
        mime: input.mime,
        caption: input.caption ?? null,
        sha256,
        capturedAt: new Date(),
        capturedBy: input.capturedBy && UUID_RE.test(input.capturedBy) ? input.capturedBy : null,
      }),
    );

    await this.webhooks.emit('media.added', {
      assetId,
      mediaId: media.id,
      phase: media.phase,
      movementId: media.movementId,
    });
    return media;
  }

  async file(mediaId: string): Promise<{ buffer: Buffer; mime: string }> {
    const media = await this.repo().findOne({ where: { id: mediaId, hidden: false } });
    if (!media) throw new NotFoundException('Médium neexistuje');
    return { buffer: await this.storage.get(media.fileKey), mime: media.mime };
  }

  /** „Smazání" = skrytí (soubor ani auditní stopa se nemažou). */
  async hide(mediaId: string): Promise<void> {
    const media = await this.repo().findOne({ where: { id: mediaId } });
    if (!media) throw new NotFoundException('Médium neexistuje');
    media.hidden = true;
    await this.repo().save(media);
  }

  private async assertAsset(assetId: string): Promise<void> {
    const asset = await this.context.manager.getRepository(Asset).findOne({ where: { id: assetId } });
    if (!asset) throw new NotFoundException('Položka neexistuje');
  }
}
