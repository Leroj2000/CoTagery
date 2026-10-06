import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { In, Repository } from 'typeorm';
import { TenantContextService } from '../../core/tenancy/tenant-context.service';
import { WebhookService } from '../../core/webhooks/webhook.service';
import { DataCarriersService } from '../../core/domain/carriers/data-carriers.service';
import { AssetService } from '../asset/asset.service';
import { Asset } from '../asset/entities/asset.entity';
import { Location } from '../../core/domain/entities/location.entity';
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
  constructor(
    private readonly context: TenantContextService,
    private readonly webhooks: WebhookService,
    private readonly carriers: DataCarriersService,
    private readonly assets: AssetService,
  ) {}

  private repo<T extends object>(entity: { new (): T }): Repository<T> {
    return this.context.manager.getRepository(entity);
  }

  list(): Promise<InventoryCheck[]> {
    return this.repo(InventoryCheck).find({ order: { createdAt: 'DESC' }, take: 200 });
  }

  /** Spustí inventuru nad místem/osobou/kontejnerem: zmrazí očekávané assety. */
  async start(dto: StartInventoryDto): Promise<InventoryCheck> {
    const subjectType = dto.subjectType ?? 'location';
    const subjectId = dto.subjectId ?? dto.locationId;
    if (!subjectId) throw new BadRequestException('Chybí subjectId / locationId');
    if (subjectType === 'location') {
      const place = await this.repo(Location).findOne({ where: { id: subjectId } });
      if (!place) throw new NotFoundException('Místo neexistuje');
    }

    const expected = await this.repo(Asset).find({
      where: { currentHolderType: subjectType, currentHolderId: subjectId },
    });
    const repo = this.repo(InventoryCheck);
    return repo.save(
      repo.create({
        tenantId: this.context.tenantId,
        subjectType,
        subjectId,
        locationId: subjectType === 'location' ? subjectId : null,
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
  async scan(checkId: string, dto: ScanInventoryDto, actorUserId?: string): Promise<InventoryScan> {
    const check = await this.getCheck(checkId);
    if (check.status !== 'open') throw new BadRequestException('Inventura je uzavřená');

    let assetId = dto.assetId ?? null;
    if (!assetId && dto.publicCode) {
      // Interní skener: pozná náš public_code i adoptovaný externí kód (alias).
      const carrier = await this.carriers.findByCode(dto.publicCode);
      if (!carrier?.digitalObjectId)
        throw new NotFoundException('Identifikátor nenalezen nebo nepřiřazený');
      const asset = await this.repo(Asset).findOne({
        where: { digitalObjectId: carrier.digitalObjectId },
      });
      if (!asset) throw new NotFoundException('K identifikátoru není přiřazený asset');
      assetId = asset.id;
    }
    if (!assetId) throw new BadRequestException('Chybí assetId nebo publicCode');

    // Last Observation: každý fyzický sken = věc VIDĚNA na místě inventury.
    const locationId =
      check.locationId ?? (check.subjectType === 'location' ? check.subjectId : null);
    await this.assets.recordObservation(assetId, { source: 'inventory', locationId, actorUserId });

    const scans = this.repo(InventoryScan);
    const existing = await scans.findOne({ where: { checkId, assetId } });
    if (existing) return existing;

    const result = classifyScan(new Set(check.expectedAssetIds), assetId);
    return scans.save(scans.create({ tenantId: this.context.tenantId, checkId, assetId, result }));
  }

  /**
   * Reconcile „navíc" věci: přesune EVIDENCI (holder) do inventarizovaného místa
   * jako reálný auditní `move` (ne automaticky – jen na explicitní potvrzení).
   * Platí jen pro inventuru MÍSTA a věc klasifikovanou jako unexpected.
   */
  async reconcile(checkId: string, assetId: string): Promise<InventoryDetail> {
    const check = await this.getCheck(checkId);
    if (check.status !== 'open') throw new BadRequestException('Inventura je uzavřená');

    const locationId =
      check.locationId ?? (check.subjectType === 'location' ? check.subjectId : null);
    if (!locationId) throw new BadRequestException('Reconcile lze jen u inventury místa');

    const scan = await this.repo(InventoryScan).findOne({ where: { checkId, assetId } });
    if (!scan || scan.result !== 'unexpected') {
      throw new BadRequestException("Položka není mezi 'navíc'");
    }

    // Reálný pohyb (neměnný ledger + webhook) přes stejnou service jako běžný přesun.
    await this.assets.performMovement(assetId, {
      type: 'move',
      toType: 'location',
      toId: locationId,
    });
    return this.detail(checkId);
  }

  /** Uzavře inventuru a spočítá výsledek (nalezeno/chybí/navíc). */
  async close(checkId: string): Promise<InventoryDetail> {
    const check = await this.getCheck(checkId);
    if (check.status === 'closed') return this.detail(checkId);

    const scans = await this.repo(InventoryScan).find({ where: { checkId } });
    const result = computeResult(
      new Set(check.expectedAssetIds),
      scans.map((s) => s.assetId),
    );

    check.status = 'closed';
    check.closedAt = new Date();
    check.foundCount = result.found.length;
    check.missingCount = result.missing.length;
    check.unexpectedCount = result.unexpected.length;
    await this.repo(InventoryCheck).save(check);

    // Webhook jen při nesrovnalosti (chybí / navíc).
    if (result.missing.length > 0 || result.unexpected.length > 0) {
      await this.webhooks.emit('inventory.mismatch', {
        checkId: check.id,
        subjectType: check.subjectType,
        subjectId: check.subjectId,
        found: result.found.length,
        missing: result.missing.length,
        unexpected: result.unexpected.length,
      });
    }
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
    const pick = (list: string[]): Asset[] =>
      list.map((id) => byId.get(id)).filter((a): a is Asset => !!a);

    return {
      check,
      found: pick(result.found),
      missing: pick(result.missing),
      unexpected: pick(result.unexpected),
      scannedCount: scans.length,
    };
  }
}
