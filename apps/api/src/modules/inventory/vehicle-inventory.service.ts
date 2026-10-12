import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { And, In, IsNull, LessThan, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { TenantContextService } from '../../core/tenancy/tenant-context.service';
import { AuditService } from '../../core/rbac/audit.service';
import { Location } from '../../core/domain/entities/location.entity';
import { Person } from '../../core/domain/entities/person.entity';
import { Asset } from '../asset/entities/asset.entity';
import { Category } from '../asset/entities/category.entity';
import { MeterReading } from '../asset/entities/meter-reading.entity';
import { AssetPurchase } from '../asset/entities/asset-purchase.entity';
import { ServiceRecord } from '../asset/entities/service-record.entity';
import { MaintenanceService } from '../asset/maintenance.service';
import { MAINTENANCE_TEMPLATES } from '../asset/maintenance.logic';
import { isIsoDate } from '../asset/purchase.logic';
import { InventoryCheck } from './entities/inventory-check.entity';
import {
  kmDiff,
  mostUrgent,
  odometerAtPurchase,
  previousReading,
  periodBounds,
  periodReadings,
  planState,
  pragueDay,
  type VehicleInventoryRow,
} from './vehicle-inventory.logic';
import type { RecordVehicleDto, StartVehicleInventoryDto } from './dto/inventory.dto';

const SERVICE_KIND_LABELS: Record<ServiceRecord['kind'], string> = {
  service: 'Servis',
  inspection: 'Revize',
  calibration: 'Kalibrace',
  repair: 'Oprava',
  warranty_claim: 'Reklamace (záruka)',
};

const PLAN_TITLES = new Map(
  [...MAINTENANCE_TEMPLATES.vehicle, ...MAINTENANCE_TEMPLATES.machine].map((p) => [
    p.code,
    p.title,
  ]),
);

/**
 * Inventura vozidel – sepsání stavu (tachometr, ujeté km, servis) všech nebo
 * jednoho vozidla k období od–do. Vozidlo = položka v kategorii druhu „Vozidlo".
 * Během inventury jde zapsat aktuální stav tachometru (běžný odečet položky)
 * a poznámku; uzavření stav zmrazí.
 */
@Injectable()
export class VehicleInventoryService {
  constructor(
    private readonly context: TenantContextService,
    private readonly maintenance: MaintenanceService,
    private readonly audit: AuditService,
  ) {}

  private repo<T extends object>(entity: { new (): T }): Repository<T> {
    return this.context.manager.getRepository(entity);
  }

  /** Vozidla firmy (bez vyřazených). */
  async vehicles(): Promise<Asset[]> {
    const categories = await this.repo(Category).find({ where: { equipmentKind: 'vehicle' } });
    if (!categories.length) return [];
    const assets = await this.repo(Asset).find({
      where: { categoryId: In(categories.map((c) => c.id)), status: Not('retired') },
    });
    // Řazení česky (DB collation dá „Š" za „Z").
    return assets.sort((a, b) => a.name.localeCompare(b.name, 'cs'));
  }

  async start(dto: StartVehicleInventoryDto): Promise<InventoryCheck> {
    const { periodFrom, periodTo } = dto;
    if (!isIsoDate(periodFrom) || !isIsoDate(periodTo))
      throw new BadRequestException('Neplatné datum období');
    if (periodFrom > periodTo) throw new BadRequestException('Začátek období je až po jeho konci');
    if (periodFrom > pragueDay(new Date()))
      throw new BadRequestException('Období nemůže začínat v budoucnu');

    const all = await this.vehicles();
    let ids: string[];
    if (dto.assetId) {
      if (!all.some((a) => a.id === dto.assetId))
        throw new BadRequestException('Položka není vozidlo (kategorie druhu „Vozidlo")');
      ids = [dto.assetId];
    } else {
      if (!all.length)
        throw new BadRequestException(
          'Žádná vozidla – nastav u kategorie druh „Vozidlo" (Kategorie).',
        );
      ids = all.map((a) => a.id);
    }

    const repo = this.repo(InventoryCheck);
    const saved = await repo.save(
      repo.create({
        tenantId: this.context.tenantId,
        kind: 'vehicle',
        subjectType: 'asset',
        subjectId: dto.assetId ?? null,
        locationId: null,
        status: 'open',
        expectedAssetIds: ids,
        periodFrom,
        periodTo,
        vehicleNotes: {},
        vehicleRows: null,
      }),
    );
    await this.audit.record({
      action: 'inventory.vehicle.start',
      targetType: 'inventory',
      targetId: saved.id,
      after: { periodFrom, periodTo, vehicles: ids.length },
    });
    return saved;
  }

  /** Stav vozidel – u uzavřené zmrazený, u probíhající spočítaný teď. */
  async rows(check: InventoryCheck): Promise<VehicleInventoryRow[]> {
    if (check.status === 'closed' && check.vehicleRows) return check.vehicleRows;
    return this.compute(check);
  }

  private async compute(check: InventoryCheck): Promise<VehicleInventoryRow[]> {
    const { start, end, reference, referenceDay } = periodBounds(
      check.periodFrom!,
      check.periodTo!,
    );
    const ids = check.expectedAssetIds;
    if (!ids.length) return [];
    const byId = new Map(
      (await this.repo(Asset).find({ where: { id: In(ids) } })).map((a) => [a.id, a]),
    );
    const assets = ids.map((id) => byId.get(id)).filter((a): a is Asset => !!a);
    const summaries = await this.maintenance.summariesAt(assets, reference);
    const readings = await this.repo(MeterReading).find({
      where: { assetId: In(ids), deletedAt: IsNull(), observedAt: LessThan(end) },
    });
    const services = await this.repo(ServiceRecord).find({
      where: { assetId: In(ids), performedAt: And(MoreThanOrEqual(start), LessThan(end)) },
      order: { performedAt: 'ASC' },
    });
    const purchases = new Map(
      (await this.repo(AssetPurchase).find({ where: { assetId: In(ids) } })).map((p) => [
        p.assetId,
        p,
      ]),
    );
    const locations = await this.repo(Location).find();
    const people = await this.repo(Person).find();
    const holderName = new Map<string, string>([
      ...locations.map((l) => [l.id, l.name] as [string, string]),
      ...people.map((p) => [p.id, p.name] as [string, string]),
    ]);

    return assets.map((a) => {
      const own = readings.filter((r) => r.assetId === a.id);
      const { start: first, end: last } = periodReadings(own, start, end);
      const odometer = last?.value ?? null;
      const previous = previousReading(own, last);
      const atPurchase = odometerAtPurchase(own, purchases.get(a.id) ?? null);
      const plans = (summaries.get(a.id)?.plans ?? []).map((p) =>
        planState(p, odometer, referenceDay),
      );
      return {
        assetId: a.id,
        name: a.name,
        registrationPlate: a.registrationPlate,
        inventoryNumber: a.inventoryNumber,
        serialNumber: a.serialNumber,
        category: a.category,
        holder: a.currentHolderId ? (holderName.get(a.currentHolderId) ?? null) : null,
        odometerStart: first?.value ?? null,
        odometerStartAt: first?.observedAt.toISOString() ?? null,
        odometerEnd: odometer,
        odometerEndAt: last?.observedAt.toISOString() ?? null,
        distance: kmDiff(last?.value, first?.value),
        previousOdometer: previous?.value ?? null,
        previousOdometerAt: previous?.observedAt.toISOString() ?? null,
        distanceSincePrevious: kmDiff(last?.value, previous?.value),
        odometerAtPurchase: atPurchase?.value ?? null,
        odometerAtPurchaseSource: atPurchase?.source ?? null,
        distanceSincePurchase: kmDiff(last?.value, atPurchase?.value),
        plans,
        next: mostUrgent(plans),
        servicesInPeriod: services
          .filter((s) => s.assetId === a.id && s.performedAt)
          .map((s) => ({
            performedOn: pragueDay(s.performedAt!),
            title: (s.planCode && PLAN_TITLES.get(s.planCode)) || SERVICE_KIND_LABELS[s.kind],
            meterValue: s.meterValue,
            provider: s.provider,
          })),
        note: check.vehicleNotes?.[a.id] ?? null,
      };
    });
  }

  /**
   * Zápis během inventury: stav tachometru (nový odečet položky – jen pokud
   * období končí dnes nebo později) a/nebo poznámka k vozidlu.
   */
  async record(check: InventoryCheck, assetId: string, dto: RecordVehicleDto): Promise<void> {
    if (check.status !== 'open') throw new BadRequestException('Inventura je uzavřená');
    if (!check.expectedAssetIds.includes(assetId))
      throw new NotFoundException('Vozidlo není v této inventuře');
    if (dto.odometer != null) {
      if (check.periodTo! < pragueDay(new Date()))
        throw new BadRequestException(
          'Období inventury už skončilo – stav tachometru se zapisuje k dnešku. Zapiš ho v detailu vozidla.',
        );
      await this.maintenance.addReading(assetId, { value: dto.odometer });
    }
    if (dto.note !== undefined) {
      const notes = { ...(check.vehicleNotes ?? {}) };
      const text = dto.note?.trim();
      if (text) notes[assetId] = text;
      else delete notes[assetId];
      await this.repo(InventoryCheck).update({ id: check.id }, { vehicleNotes: notes });
    }
  }

  /** Uzavře inventuru vozidel a zmrazí stav. */
  async close(check: InventoryCheck): Promise<void> {
    if (check.status === 'closed') return;
    const rows = await this.compute(check);
    check.status = 'closed';
    check.closedAt = new Date();
    check.vehicleRows = rows;
    // Počty pro seznam inventur: vozidla / po servisu / bez stavu tachometru.
    check.foundCount = rows.length;
    check.missingCount = rows.filter((r) => r.next?.status === 'overdue').length;
    check.unexpectedCount = rows.filter((r) => r.odometerEnd == null).length;
    await this.repo(InventoryCheck).save(check);
    await this.audit.record({
      action: 'inventory.vehicle.close',
      targetType: 'inventory',
      targetId: check.id,
      after: { vehicles: rows.length, overdue: check.missingCount },
    });
  }
}
