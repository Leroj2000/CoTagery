import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantContextService } from '../../core/tenancy/tenant-context.service';
import { Asset } from './entities/asset.entity';
import { AssetTire } from './entities/asset-tire.entity';
import type { CreateTireDto, UpdateTireDto } from './dto/tire.dto';

const AXLE_ORDER = { front: 0, rear: 1, all: 2 } as const;

/**
 * Výběr řádků pro přezutí (čistá funkce): řádky sady `setLabel` → mounted=true,
 * ostatní namontované → false. Vrací jen změněné řádky.
 */
export function planMount(rows: AssetTire[], setLabel: string): AssetTire[] {
  if (!rows.some((r) => r.setLabel === setLabel)) {
    throw new NotFoundException('Sada pneumatik neexistuje');
  }
  const changed: AssetTire[] = [];
  for (const r of rows) {
    const next = r.setLabel === setLabel;
    if (r.mounted !== next) {
      r.mounted = next;
      changed.push(r);
    }
  }
  return changed;
}

/** Pneumatiky položky (sady × nápravy) včetně přezutí. */
@Injectable()
export class TiresService {
  constructor(private readonly context: TenantContextService) {}

  private repo(): Repository<AssetTire> {
    return this.context.manager.getRepository(AssetTire);
  }

  async list(assetId: string): Promise<AssetTire[]> {
    await this.assertAsset(assetId);
    const rows = await this.repo().find({ where: { assetId } });
    return rows.sort(
      (a, b) =>
        Number(b.mounted) - Number(a.mounted) ||
        a.setLabel.localeCompare(b.setLabel, 'cs') ||
        AXLE_ORDER[a.axle] - AXLE_ORDER[b.axle],
    );
  }

  async create(assetId: string, dto: CreateTireDto): Promise<AssetTire> {
    await this.assertAsset(assetId);
    const row = this.repo().create({
      ...dto,
      tenantId: this.context.tenantId ?? undefined,
      assetId,
      axle: dto.axle ?? 'all',
      construction: dto.construction ?? 'R',
      quantity: dto.quantity ?? 4,
      setLabel: dto.setLabel.trim(),
    });
    const saved = await this.repo().save(row);
    // Nový řádek namontované sady: ostatní sady se sundají (jen jedna na kolech).
    if (saved.mounted) await this.mount(assetId, saved.setLabel);
    return saved;
  }

  async update(assetId: string, tireId: string, dto: UpdateTireDto): Promise<AssetTire> {
    const row = await this.getRow(assetId, tireId);
    if (dto.setLabel !== undefined) dto.setLabel = dto.setLabel.trim();
    if (dto.setLabel === '') throw new BadRequestException('Název sady nesmí být prázdný');
    Object.assign(row, dto);
    return this.repo().save(row);
  }

  async remove(assetId: string, tireId: string): Promise<{ deleted: true }> {
    const row = await this.getRow(assetId, tireId);
    await this.repo().remove(row);
    return { deleted: true };
  }

  /** Přezutí na sadu `setLabel`; vrací aktuální seznam. */
  async mount(assetId: string, setLabel: string): Promise<AssetTire[]> {
    await this.assertAsset(assetId);
    const rows = await this.repo().find({ where: { assetId } });
    const changed = planMount(rows, setLabel.trim());
    if (changed.length) await this.repo().save(changed);
    return this.list(assetId);
  }

  private async getRow(assetId: string, tireId: string): Promise<AssetTire> {
    const row = await this.repo().findOne({ where: { id: tireId, assetId } });
    if (!row) throw new NotFoundException('Pneumatiky nenalezeny');
    return row;
  }

  private async assertAsset(assetId: string): Promise<void> {
    const asset = await this.context.manager
      .getRepository(Asset)
      .findOne({ where: { id: assetId }, select: { id: true } });
    if (!asset) throw new NotFoundException('Položka neexistuje');
  }
}
