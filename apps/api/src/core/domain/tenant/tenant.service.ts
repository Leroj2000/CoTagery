import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { Repository } from 'typeorm';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { STORAGE, type StoragePort } from '../../storage/storage.port';
import { Tenant } from '../entities/tenant.entity';
import type { UpdateTenantDto } from './dto/tenant.dto';

/** Tenant pro klienta: místo interního klíče loga jen příznak. */
export type TenantView = Tenant & { hasLogo: boolean };

/** Načtené logo firmy pro vložení do QR. */
export interface TenantLogo {
  buffer: Buffer;
  /** Poměr stran šířka / výška. */
  aspect: number;
}

/** Max. rozměr uloženého loga (delší strana) – víc není pro QR/štítek potřeba. */
const LOGO_MAX_PX = 512;

/**
 * Nastavení aktuálního tenanta (EPIC-03). Tabulka `tenants` není RLS-scoped
 * (je to sám tenant), proto scope explicitně přes `context.tenantId` z JWT –
 * nikdy z URL/body (kritické pravidlo).
 */
@Injectable()
export class TenantService {
  constructor(
    private readonly context: TenantContextService,
    @Inject(STORAGE) private readonly storage: StoragePort,
  ) {}

  private repo(): Repository<Tenant> {
    return this.context.manager.getRepository(Tenant);
  }

  async current(): Promise<Tenant> {
    const tenant = await this.repo().findOne({ where: { id: this.context.tenantId } });
    if (!tenant) throw new NotFoundException('Tenant neexistuje');
    return tenant;
  }

  async view(): Promise<TenantView> {
    const tenant = await this.current();
    return { ...tenant, hasLogo: !!(await this.logoKey()) };
  }

  async update(dto: UpdateTenantDto): Promise<TenantView> {
    const tenant = await this.current();
    if (dto.name !== undefined) tenant.name = dto.name;
    if (dto.networkListed !== undefined) tenant.networkListed = dto.networkListed;
    if (dto.brandingDomain !== undefined) tenant.brandingDomain = dto.brandingDomain || null;
    // Nastavení se slučují (nepřepisují), aby dílčí změna nesmazala ostatní klíče.
    if (dto.settings !== undefined) tenant.settings = { ...tenant.settings, ...dto.settings };
    await this.repo().save(tenant);
    return this.view();
  }

  // --- Logo firmy (PNG do středu QR kódů) ---

  /** Interní klíč loga (sloupec je `select: false`, proto explicitní dotaz). */
  private async logoKey(): Promise<string | null> {
    const row = await this.repo()
      .createQueryBuilder('t')
      .select('t.id')
      .addSelect('t.logoFileKey')
      .where('t.id = :id', { id: this.context.tenantId })
      .getOne();
    return row?.logoFileKey ?? null;
  }

  private async setLogoKey(key: string | null): Promise<void> {
    await this.repo().update({ id: this.context.tenantId }, { logoFileKey: key });
  }

  /**
   * Nahraje/nahradí logo. Přijímá jen PNG (ověřeno z obsahu, ne jen z MIME),
   * normalizuje: ořízne průhledné okraje, zmenší na max. 512 px a uloží jako PNG.
   */
  async setLogo(buffer: Buffer): Promise<TenantView> {
    let processed: Buffer;
    try {
      const meta = await sharp(buffer, { failOn: 'none' }).metadata();
      if (meta.format !== 'png') throw new BadRequestException('Logo musí být ve formátu PNG.');
      processed = await sharp(buffer, { failOn: 'none' })
        .trim({ threshold: 0 })
        .resize(LOGO_MAX_PX, LOGO_MAX_PX, { fit: 'inside', withoutEnlargement: true })
        .png({ compressionLevel: 9 })
        .toBuffer();
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('Logo se nepodařilo zpracovat (poškozený nebo nepodporovaný PNG).');
    }
    const key = `tenants/${this.context.tenantId}/logo/${randomUUID()}.png`;
    await this.storage.put(key, processed, 'image/png');
    const oldKey = await this.logoKey();
    await this.setLogoKey(key);
    if (oldKey) await this.storage.del(oldKey).catch(() => undefined);
    return this.view();
  }

  async deleteLogo(): Promise<TenantView> {
    const oldKey = await this.logoKey();
    if (oldKey) {
      await this.setLogoKey(null);
      await this.storage.del(oldKey).catch(() => undefined);
    }
    return this.view();
  }

  /** PNG loga, nebo `null`, když firma logo nemá. */
  async logo(): Promise<TenantLogo | null> {
    const key = await this.logoKey();
    if (!key) return null;
    const buffer = await this.storage.get(key).catch(() => null);
    if (!buffer) return null;
    const meta = await sharp(buffer).metadata();
    const aspect = meta.width && meta.height ? meta.width / meta.height : 1;
    return { buffer, aspect };
  }
}
