import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { In, IsNull, Not, Repository } from 'typeorm';
import { TenantContextService } from '../../core/tenancy/tenant-context.service';
import { AuditService } from '../../core/rbac/audit.service';
import { AssetService } from './asset.service';
import { Asset } from './entities/asset.entity';
import { Category } from './entities/category.entity';
import { ServiceRecord } from './entities/service-record.entity';
import { MeterReading } from './entities/meter-reading.entity';
import { MaintenanceRule } from './entities/maintenance-rule.entity';
import {
  MAINTENANCE_TEMPLATES,
  calculateMaintenance,
  type EquipmentKind,
  type MaintenanceStatus,
} from './maintenance.logic';
import type {
  AddMeterReadingDto,
  CompleteMaintenanceDto,
  UpdateMaintenanceRuleDto,
} from './dto/maintenance.dto';

export interface MaintenancePlanView {
  code: string;
  title: string;
  description: string;
  intervalUnits: number;
  intervalMonths: number | null;
  lastService: ServiceRecord | null;
  nextMeter: number | null;
  nextDueAt: Date | null;
  status: MaintenanceStatus;
}

export interface MaintenanceSummary {
  kind: EquipmentKind;
  unit: 'km' | 'mth' | null;
  currentReading: MeterReading | null;
  readings: MeterReading[];
  plans: MaintenancePlanView[];
  history: ServiceRecord[];
}

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly context: TenantContextService,
    private readonly assets: AssetService,
    private readonly audit: AuditService,
  ) {}

  private repo<T extends object>(entity: { new (): T }): Repository<T> {
    return this.context.manager.getRepository(entity);
  }

  private async kindOf(asset: Asset): Promise<EquipmentKind> {
    if (!asset.categoryId) return 'general';
    const category = await this.repo(Category).findOne({ where: { id: asset.categoryId } });
    return category?.equipmentKind ?? 'general';
  }

  private template(kind: EquipmentKind, code: string) {
    return kind === 'general'
      ? undefined
      : MAINTENANCE_TEMPLATES[kind].find((plan) => plan.code === code);
  }

  private buildSummary(
    kind: EquipmentKind,
    readings: MeterReading[],
    rules: MaintenanceRule[],
    services: ServiceRecord[],
  ): MaintenanceSummary {
    const currentReading = readings[0] ?? null;
    if (kind === 'general')
      return { kind, unit: null, currentReading, readings, plans: [], history: [] };
    const rulesByCode = new Map(rules.map((rule) => [rule.code, rule]));
    const plans = MAINTENANCE_TEMPLATES[kind].map((template) => {
      const override = rulesByCode.get(template.code);
      const intervalUnits = override?.intervalUnits ?? template.intervalUnits;
      const intervalMonths = override ? override.intervalMonths : template.intervalMonths;
      const description = override?.description ?? template.description;
      const lastService =
        services
          .filter((record) => record.planCode === template.code && record.performedAt)
          .sort(
            (a, b) =>
              b.performedAt!.getTime() - a.performedAt!.getTime() ||
              b.createdAt.getTime() - a.createdAt.getTime(),
          )[0] ?? null;
      const due = calculateMaintenance(
        { intervalUnits, intervalMonths },
        lastService,
        currentReading?.value ?? null,
      );
      return {
        code: template.code,
        title: template.title,
        description,
        intervalUnits,
        intervalMonths,
        lastService,
        ...due,
      };
    });
    return {
      kind,
      unit: kind === 'vehicle' ? 'km' : 'mth',
      currentReading,
      readings,
      plans,
      history: services
        .filter((service) => service.planCode && service.performedAt)
        .sort((a, b) => b.performedAt!.getTime() - a.performedAt!.getTime()),
    };
  }

  async summary(assetId: string): Promise<MaintenanceSummary> {
    const asset = await this.assets.get(assetId);
    const kind = await this.kindOf(asset);
    const [readings, rules, services] = await Promise.all([
      this.repo(MeterReading).find({
        where: { assetId, deletedAt: IsNull() },
        order: { observedAt: 'DESC', createdAt: 'DESC' },
      }),
      this.repo(MaintenanceRule).find({ where: { assetId } }),
      this.repo(ServiceRecord).find({ where: { assetId, planCode: Not(IsNull()) } }),
    ]);
    return this.buildSummary(kind, readings, rules, services);
  }

  private async classifiedAsset(
    assetId: string,
  ): Promise<{ asset: Asset; kind: 'vehicle' | 'machine' }> {
    const asset = await this.assets.get(assetId);
    const kind = await this.kindOf(asset);
    if (kind === 'general')
      throw new BadRequestException('Položka musí mít kategorii Vozidlo nebo Stroj.');
    return { asset, kind };
  }

  async addReading(assetId: string, dto: AddMeterReadingDto): Promise<MeterReading> {
    const { kind } = await this.classifiedAsset(assetId);
    if (kind === 'vehicle' && !Number.isInteger(dto.value))
      throw new BadRequestException('Stav kilometrů musí být celé číslo.');
    await this.context.manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `asset-meter:${this.context.tenantId}:${assetId}`,
    ]);
    const previous = await this.repo(MeterReading).findOne({
      where: { assetId, deletedAt: IsNull() },
      order: { observedAt: 'DESC', createdAt: 'DESC' },
    });
    if (previous && dto.value < previous.value)
      throw new BadRequestException('Nový stav měřidla nesmí být nižší než poslední odečet.');
    const latestService = await this.repo(ServiceRecord).findOne({
      where: { assetId, planCode: Not(IsNull()), meterValue: Not(IsNull()) },
      order: { meterValue: 'DESC' },
    });
    if (latestService?.meterValue != null && dto.value < latestService.meterValue)
      throw new BadRequestException('Stav měřidla nesmí být nižší než poslední servisní odečet.');
    const reading = await this.repo(MeterReading).save(
      this.repo(MeterReading).create({
        tenantId: this.context.tenantId,
        assetId,
        value: dto.value,
        observedAt: new Date(),
        deletedAt: null,
      }),
    );
    await this.audit.record({
      action: 'asset.meter_reading_added',
      targetType: 'asset',
      targetId: assetId,
      after: { readingId: reading.id, value: reading.value },
    });
    return reading;
  }

  async deleteReading(assetId: string, readingId: string): Promise<void> {
    await this.assets.get(assetId);
    await this.context.manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `asset-meter:${this.context.tenantId}:${assetId}`,
    ]);
    const reading = await this.repo(MeterReading).findOne({
      where: { id: readingId, assetId, deletedAt: IsNull() },
    });
    if (!reading) throw new NotFoundException('Odečet neexistuje.');
    reading.deletedAt = new Date();
    await this.repo(MeterReading).save(reading);
    await this.audit.record({
      action: 'asset.meter_reading_deleted',
      targetType: 'asset',
      targetId: assetId,
      before: { readingId, value: reading.value },
    });
  }

  async updateRule(assetId: string, code: string, dto: UpdateMaintenanceRuleDto) {
    const { kind } = await this.classifiedAsset(assetId);
    if (!this.template(kind, code)) throw new NotFoundException('Servisní interval neexistuje.');
    const repo = this.repo(MaintenanceRule);
    let rule = await repo.findOne({ where: { assetId, code } });
    if (!rule) rule = repo.create({ tenantId: this.context.tenantId, assetId, code });
    rule.intervalUnits = dto.intervalUnits;
    rule.intervalMonths = dto.intervalMonths ?? null;
    rule.description = dto.description.trim();
    if (!rule.description) throw new BadRequestException('Vyplň popis intervalu.');
    const saved = await repo.save(rule);
    await this.audit.record({
      action: 'asset.maintenance_rule_updated',
      targetType: 'asset',
      targetId: assetId,
      after: { code, intervalUnits: saved.intervalUnits, intervalMonths: saved.intervalMonths },
    });
    return saved;
  }

  async complete(assetId: string, dto: CompleteMaintenanceDto): Promise<ServiceRecord> {
    const { kind } = await this.classifiedAsset(assetId);
    if (kind === 'vehicle' && !Number.isInteger(dto.meterValue))
      throw new BadRequestException('Stav kilometrů musí být celé číslo.');
    if (!this.template(kind, dto.planCode))
      throw new NotFoundException('Servisní interval neexistuje.');
    const performedAt = new Date(dto.performedAt);
    if (!Number.isFinite(performedAt.getTime()) || performedAt > new Date())
      throw new BadRequestException('Datum servisu musí být platné a nesmí být v budoucnu.');
    const repo = this.repo(ServiceRecord);
    const previous = await repo.findOne({
      where: { assetId, planCode: dto.planCode, performedAt: Not(IsNull()) },
      order: { performedAt: 'DESC' },
    });
    if (
      previous?.performedAt &&
      performedAt >= previous.performedAt &&
      previous.meterValue != null &&
      dto.meterValue < previous.meterValue
    )
      throw new BadRequestException('Stav při novém servisu nesmí klesnout oproti předchozímu.');
    const record = await repo.save(
      repo.create({
        tenantId: this.context.tenantId,
        assetId,
        kind: 'service',
        planCode: dto.planCode,
        meterValue: dto.meterValue,
        performedAt,
        nextDueAt: null,
        provider: dto.provider?.trim() || null,
        note: dto.note?.trim() || null,
        cost: null,
      }),
    );
    await this.audit.record({
      action: 'asset.maintenance_completed',
      targetType: 'asset',
      targetId: assetId,
      after: { planCode: dto.planCode, meterValue: dto.meterValue, performedAt: dto.performedAt },
    });
    return record;
  }

  async due(): Promise<
    { assetId: string; assetName: string; unit: 'km' | 'mth'; plan: MaintenancePlanView }[]
  > {
    const assets = await this.assets.maintenanceCandidates();
    if (!assets.length) return [];
    const ids = assets.map((asset) => asset.id);
    const categoryIds = [
      ...new Set(assets.map((asset) => asset.categoryId).filter((id): id is string => !!id)),
    ];
    const [categories, readings, rules, services] = await Promise.all([
      this.repo(Category).find({ where: { id: In(categoryIds) } }),
      this.repo(MeterReading).find({
        where: { assetId: In(ids), deletedAt: IsNull() },
        order: { observedAt: 'DESC', createdAt: 'DESC' },
      }),
      this.repo(MaintenanceRule).find({ where: { assetId: In(ids) } }),
      this.repo(ServiceRecord).find({ where: { assetId: In(ids), planCode: Not(IsNull()) } }),
    ]);
    const kindByCategory = new Map(
      categories.map((category) => [category.id, category.equipmentKind]),
    );
    const group = <T extends { assetId: string }>(items: T[]): Map<string, T[]> => {
      const result = new Map<string, T[]>();
      for (const item of items) {
        const bucket = result.get(item.assetId) ?? [];
        bucket.push(item);
        result.set(item.assetId, bucket);
      }
      return result;
    };
    const readingsByAsset = group(readings);
    const rulesByAsset = group(rules);
    const servicesByAsset = group(services);
    return assets.flatMap((asset) => {
      const kind = kindByCategory.get(asset.categoryId ?? '') ?? 'general';
      const summary = this.buildSummary(
        kind,
        readingsByAsset.get(asset.id) ?? [],
        rulesByAsset.get(asset.id) ?? [],
        servicesByAsset.get(asset.id) ?? [],
      );
      if (!summary.unit) return [];
      return summary.plans
        .filter(
          (plan) =>
            plan.status === 'soon' || plan.status === 'overdue' || plan.status === 'need_reading',
        )
        .map((plan) => ({ assetId: asset.id, assetName: asset.name, unit: summary.unit!, plan }));
    });
  }
}
