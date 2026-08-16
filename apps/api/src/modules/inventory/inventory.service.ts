import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { In, Repository } from 'typeorm';
import { TenantContextService } from '../../core/tenancy/tenant-context.service';
import { Asset } from '../asset/entities/asset.entity';
import { DataCarrier } from '../../core/domain/entities/data-carrier.entity';
import { InventoryCheck } from './entities/inventory-check.entity';
import { InventoryScan } from './entities/inventory-scan.entity';
import { classifyScan, computeResult, type InventoryResult } from './inventory.logic';
import type { ScanInventoryDto, StartInventoryDto } from './dto/inventory.dto';

/** Detail inventury s vyřešenými assety (pro UI). */
export interface InventoryDetail {
  check: InventoryCheck;
  found: Asset[];
  missing: Asset[];
  unexpected: Asset[];
  scannedCount: number;
}

@Injectable()
export class InventoryService {
  constructor(private readonly context: TenantContextService) {}

  private repo<T extends object>(entity: { new (): T }): Repository<T> {
    return this.context.manager.getRepository(entity);
  }

  list(): Promise<InventoryCheck[]> {
    return this.repo(InventoryCheck).find({ order: { createdAt: 'DESC' }, take: 200 });
  }

  /** Spustí inventuru: zmrazí očekávané assety aktuálně přiřazené lokaci. */
  async start(dto: StartInventoryDto): Promise<InventoryCheck> {
    const expected = await this.repo(Asset).find({
      where: { currentHolderType: 'location', currentHolderId: dto.locationId },
    });
    const repo = this.repo(InventoryCheck);
    return repo.save(
      repo.create({
        tenantId: this.context.tenantId,
        locationId: dto.locationId,
        status: 'open',
        expectedAssetIds: expected.map((a) => a.id),
      }),
    );
  }

  private async getCheck(id: string): Promise<InventoryCheck> {
    const check = await this.repo(InventoryCheck).findOne({ where: { id } });
    if (!check) throw new NotFoundException('Inventura neexistuje');
    return check;
  }

  /** Naskenuje asset do inventury: klasifikuje found/unexpected (idempotentně). */
  async scan(checkId: string, dto: ScanInventoryDto): Promise<InventoryScan> {
    const check = await this.getCheck(checkId);
    if (check.status !== 'open') throw new BadRequestException('Inventura je uzavřená');

    let assetId = dto.assetId ?? null;
    if (!assetId && dto.publicCode) {
      const carrier = await this.repo(DataCarrier).findOne({ where: { publicCode: dto.publicCode } });
      if (!carrier?.digitalObjectId) throw new NotFoundException('Nosič nenalezen nebo nepřiřazený');
      const asset = await this.repo(Asset).findOne({ where: { digitalObjectId: carrier.digitalObjectId } });
      if (!asset) throw new NotFoundException('K nosiči není přiřazený asset');
      assetId = asset.id;
    }
    if (!assetId) throw new BadRequestException('Chybí assetId nebo publicCode');

    const scans = this.repo(InventoryScan);
    const existing = await scans.findOne({ where: { checkId, assetId } });
    if (existing) return existing;

    const result = classifyScan(new Set(check.expectedAssetIds), assetId);
    return scans.save(
      scans.create({ tenantId: this.context.tenantId, checkId, assetId, result }),
    );
  }

  /** Uzavře inventuru a spočítá výsledek (nalezeno/chybí/navíc). */
  async close(checkId: string): Promise<InventoryDetail> {
    const check = await this.getCheck(checkId);
    if (check.status === 'closed') return this.detail(checkId);

    const scans = await this.repo(InventoryScan).find({ where: { checkId } });
    const result = computeResult(new Set(check.expectedAssetIds), scans.map((s) => s.assetId));

    check.status = 'closed';
    check.closedAt = new Date();
    check.foundCount = result.found.length;
    check.missingCount = result.missing.length;
    check.unexpectedCount = result.unexpected.length;
    await this.repo(InventoryCheck).save(check);
    return this.detail(checkId);
  }

  /** Detail inventury s načtenými assety pro každou kategorii. */
  async detail(checkId: string): Promise<InventoryDetail> {
    const check = await this.getCheck(checkId);
    const scans = await this.repo(InventoryScan).find({ where: { checkId } });
    const result: InventoryResult = computeResult(
      new Set(check.expectedAssetIds),
      scans.map((s) => s.assetId),
    );

    const ids = [...new Set([...result.found, ...result.missing, ...result.unexpected])];
    const assets = ids.length ? await this.repo(Asset).find({ where: { id: In(ids) } }) : [];
    const byId = new Map(assets.map((a) => [a.id, a]));
    const pick = (list: string[]): Asset[] => list.map((id) => byId.get(id)).filter((a): a is Asset => !!a);

    return {
      check,
      found: pick(result.found),
      missing: pick(result.missing),
      unexpected: pick(result.unexpected),
      scannedCount: scans.length,
    };
  }
}
