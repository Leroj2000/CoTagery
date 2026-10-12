import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Repository } from 'typeorm';
import {
  INTERNAL_LOCATION_TYPES,
  SYSTEM_LOCATION_TYPES,
  mergeLocationTypes,
  type LocationCategory,
  type LocationTypeDef,
} from '@tagery/shared';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { AuditService } from '../../rbac/audit.service';
import { LocationTypeRow } from '../entities/location-type.entity';
import { Location } from '../entities/location.entity';

export interface LocationTypeView extends LocationTypeDef {
  /** Počet míst tohoto typu (smazat lze jen nepoužitý vlastní typ). */
  usage: number;
}

export interface CreateLocationTypeInput {
  name: string;
  category: LocationCategory;
  grid?: boolean;
}

export interface UpdateLocationTypeInput {
  name?: string | null;
  category?: LocationCategory;
  grid?: boolean;
  hidden?: boolean;
  sortOrder?: number | null;
}

const SYSTEM_KEYS = new Set(SYSTEM_LOCATION_TYPES.map((t) => t.key));

function slug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);
}

/**
 * Typy míst firmy: systémové (přejmenovat / skrýt) + vlastní (`c_…`). Typ místa
 * se ukládá jako klíč do `locations.type`; existující místa o typ nepřijdou –
 * skrytý typ jen nejde vybrat pro nové místo.
 */
@Injectable()
export class LocationTypesService {
  constructor(
    private readonly context: TenantContextService,
    private readonly audit: AuditService,
  ) {}

  private repo(): Repository<LocationTypeRow> {
    return this.context.manager.getRepository(LocationTypeRow);
  }

  /** Efektivní typy firmy (sekvenčně – jeden query runner). */
  async types(): Promise<LocationTypeDef[]> {
    const rows = await this.repo().find();
    return mergeLocationTypes(rows);
  }

  async list(): Promise<LocationTypeView[]> {
    const types = await this.types();
    const counts = (await this.context.manager.query(
      `SELECT type, count(*)::int AS n FROM locations GROUP BY type`,
    )) as { type: string; n: number }[];
    const byType = new Map(counts.map((c) => [c.type, c.n]));
    return types.map((t) => ({ ...t, usage: byType.get(t.key) ?? 0 }));
  }

  /**
   * Ověří typ pro nové / upravené místo. Skrytý typ projde jen tehdy, když ho
   * místo už má (`current`) – úprava jiných údajů ho nesmí shodit.
   */
  async assertSelectable(key: string, current?: string | null): Promise<void> {
    if (key === current) return;
    const t = (await this.types()).find((x) => x.key === key);
    if (!t) throw new BadRequestException(`Neznámý typ místa: ${key}`);
    if (t.hidden) throw new BadRequestException(`Typ místa „${t.name}" je skrytý`);
  }

  async create(input: CreateLocationTypeInput): Promise<LocationTypeView[]> {
    const name = input.name?.trim();
    if (!name) throw new BadRequestException('Vyplň název typu.');
    if (name.length > 60) throw new BadRequestException('Název je příliš dlouhý.');
    if (!['place', 'storage'].includes(input.category))
      throw new BadRequestException('Neplatná kategorie.');
    const existing = await this.types();
    if (existing.some((t) => t.name.toLowerCase() === name.toLowerCase()))
      throw new BadRequestException('Typ s tímto názvem už existuje.');
    const key = `c_${slug(name) || 'typ'}_${randomBytes(2).toString('hex')}`;
    const maxOrder = Math.max(0, ...existing.map((t) => t.sortOrder));
    const repo = this.repo();
    await repo.save(
      repo.create({
        tenantId: this.context.tenantId,
        key,
        name,
        category: input.category,
        grid: input.grid ?? false,
        hidden: false,
        sortOrder: maxOrder + 10,
      }),
    );
    await this.audit.record({
      action: 'location_type.created',
      targetType: 'location_type',
      targetId: key,
      after: { name, category: input.category, grid: input.grid ?? false },
    });
    return this.list();
  }

  async update(key: string, input: UpdateLocationTypeInput): Promise<LocationTypeView[]> {
    if (INTERNAL_LOCATION_TYPES[key]) throw new BadRequestException('Interní typ nelze upravit.');
    const isSystem = SYSTEM_KEYS.has(key);
    const repo = this.repo();
    let row = await repo.findOne({ where: { key } });
    if (!row && !isSystem) throw new NotFoundException('Typ místa neexistuje');
    if (isSystem && (input.category !== undefined || input.grid !== undefined))
      throw new BadRequestException('U systémového typu lze měnit jen název, pořadí a skrytí.');
    if (!row)
      row = repo.create({
        tenantId: this.context.tenantId,
        key,
        name: null,
        category: null,
        grid: null,
        hidden: false,
        sortOrder: null,
      });
    const before = { ...row };
    if (input.name !== undefined) {
      const name = input.name?.trim() || null;
      if (!isSystem && !name) throw new BadRequestException('Vyplň název typu.');
      if (name && name.length > 60) throw new BadRequestException('Název je příliš dlouhý.');
      if (
        name &&
        (await this.types()).some(
          (t) => t.key !== key && t.name.toLowerCase() === name.toLowerCase(),
        )
      )
        throw new BadRequestException('Typ s tímto názvem už existuje.');
      row.name = name;
    }
    if (input.category !== undefined) {
      if (!['place', 'storage'].includes(input.category))
        throw new BadRequestException('Neplatná kategorie.');
      row.category = input.category;
    }
    if (input.grid !== undefined) row.grid = input.grid;
    if (input.hidden !== undefined) row.hidden = input.hidden;
    if (input.sortOrder !== undefined) row.sortOrder = input.sortOrder;
    await repo.save(row);
    await this.audit.record({
      action: 'location_type.updated',
      targetType: 'location_type',
      targetId: key,
      before: { name: before.name, hidden: before.hidden },
      after: { name: row.name, hidden: row.hidden, category: row.category, grid: row.grid },
    });
    return this.list();
  }

  /** Smaže vlastní typ (jen nepoužitý); systémový vrátí do výchozího stavu. */
  async remove(key: string): Promise<LocationTypeView[]> {
    const repo = this.repo();
    if (SYSTEM_KEYS.has(key)) {
      await repo.delete({ key });
    } else {
      const row = await repo.findOne({ where: { key } });
      if (!row) throw new NotFoundException('Typ místa neexistuje');
      const used = await this.context.manager
        .getRepository(Location)
        .count({ where: { type: key as Location['type'] } });
      if (used > 0)
        throw new BadRequestException(
          `Typ používá ${used} míst – nejdřív jim změň typ, nebo ho jen skryj.`,
        );
      await repo.delete({ key });
    }
    await this.audit.record({
      action: 'location_type.removed',
      targetType: 'location_type',
      targetId: key,
    });
    return this.list();
  }
}
