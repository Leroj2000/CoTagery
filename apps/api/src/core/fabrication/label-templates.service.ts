import { BadRequestException, Injectable } from '@nestjs/common';
import {
  DEFAULT_LABEL_FORMAT,
  LABEL_FORMATS,
  defaultLabelTemplate,
  findLabelFormat,
  normalizeLabelCells,
  type LabelTemplate,
} from '@tagery/shared';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { Tenant } from '../domain/entities/tenant.entity';
import { LabelTemplateEntity } from './label-template.entity';

export interface LabelTemplatesView {
  /** Formát, který se předvybere při tisku. */
  defaultFormat: string;
  /** Šablona pro každý formát z katalogu (uložená, jinak výchozí). */
  templates: (LabelTemplate & { custom: boolean })[];
}

/** Šablony štítků firmy (editor štítků). Scope přes tenant_id z JWT + RLS. */
@Injectable()
export class LabelTemplatesService {
  constructor(private readonly context: TenantContextService) {}

  private repo() {
    return this.context.manager.getRepository(LabelTemplateEntity);
  }

  private tenantId(): string {
    return this.context.tenantId!;
  }

  private requireFormat(formatKey: string): void {
    if (!findLabelFormat(formatKey)) throw new BadRequestException('Neznámý formát štítku.');
  }

  async list(): Promise<LabelTemplatesView> {
    const tenantId = this.tenantId();
    const [rows, tenant] = await Promise.all([
      this.repo().find({ where: { tenantId } }),
      this.context.manager.getRepository(Tenant).findOne({ where: { id: tenantId } }),
    ]);
    const saved = new Map(rows.map((r) => [r.formatKey, r]));
    const templates = LABEL_FORMATS.map((f) => {
      const row = saved.get(f.key);
      if (!row) return { ...defaultLabelTemplate(f.key), custom: false };
      // Uložená data znovu normalizujeme – šablona z DB nesmí rozbít tisk.
      try {
        return { formatKey: f.key, cells: normalizeLabelCells(row.cells), custom: true };
      } catch {
        return { ...defaultLabelTemplate(f.key), custom: false };
      }
    });
    const preferred = tenant?.settings?.labelDefaultFormat;
    const defaultFormat =
      typeof preferred === 'string' && findLabelFormat(preferred) ? preferred : DEFAULT_LABEL_FORMAT;
    return { defaultFormat, templates };
  }

  async save(formatKey: string, cells: unknown): Promise<LabelTemplatesView> {
    this.requireFormat(formatKey);
    let normalized;
    try {
      normalized = normalizeLabelCells(cells);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    if (normalized.length === 0) throw new BadRequestException('Šablona musí mít aspoň jednu buňku.');
    const tenantId = this.tenantId();
    const repo = this.repo();
    const existing = await repo.findOne({ where: { tenantId, formatKey } });
    if (existing) {
      existing.cells = normalized;
      await repo.save(existing);
    } else {
      await repo.save(repo.create({ tenantId, formatKey, cells: normalized }));
    }
    return this.list();
  }

  /** Vrátí formát na výchozí šablonu (smaže uloženou). */
  async reset(formatKey: string): Promise<LabelTemplatesView> {
    this.requireFormat(formatKey);
    await this.repo().delete({ tenantId: this.tenantId(), formatKey });
    return this.list();
  }

  async setDefaultFormat(formatKey: string): Promise<LabelTemplatesView> {
    this.requireFormat(formatKey);
    const repo = this.context.manager.getRepository(Tenant);
    const tenant = await repo.findOne({ where: { id: this.tenantId() } });
    if (tenant) {
      tenant.settings = { ...tenant.settings, labelDefaultFormat: formatKey };
      await repo.save(tenant);
    }
    return this.list();
  }
}
