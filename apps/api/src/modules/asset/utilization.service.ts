import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../core/tenancy/tenant-context.service';
import {
  computeUtilization,
  type UtilMovement,
  type UtilizationResult,
  type UtilizationVerdict,
} from './utilization.logic';

export interface AssetUtilization extends UtilizationResult {
  assetId: string;
  assetName: string;
  category: string | null;
}

export interface CategoryUtilization {
  category: string;
  assets: number;
  avgUtilizationPct: number;
  overused: number;
  idle: number;
}

export interface UtilizationReport {
  days: number;
  from: string;
  to: string;
  assets: AssetUtilization[];
  categories: CategoryUtilization[];
  totals: Record<UtilizationVerdict, number>;
}

const INACTIVE = ['retired', 'lost'];

interface MovementRow {
  asset_id: string;
  type: string;
  to_type: string | null;
  to_id: string | null;
  created_at: Date;
}

/** Report vytíženosti (BACKLOG ZAK-03) – tenant-scoped (RLS), jen čtení. */
@Injectable()
export class UtilizationService {
  constructor(private readonly context: TenantContextService) {}

  async report(days = 90, now = new Date()): Promise<UtilizationReport> {
    const windowStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const q = this.context.manager;
    const [assets, before, within] = await Promise.all([
      q.query(
        `SELECT a.id, a.name, COALESCE(c.name, a.category) AS category, a.home_location_id, a.created_at
           FROM assets a LEFT JOIN asset_categories c ON c.id = a.category_id
          WHERE a.status <> ALL($1::text[])
          ORDER BY a.name
          LIMIT 5000`,
        [INACTIVE],
      ) as Promise<
        {
          id: string;
          name: string;
          category: string | null;
          home_location_id: string | null;
          created_at: Date;
        }[]
      >,
      q.query(
        `SELECT DISTINCT ON (asset_id) asset_id, type, to_type, to_id, created_at
           FROM asset_movements WHERE created_at < $1
          ORDER BY asset_id, created_at DESC`,
        [windowStart],
      ) as Promise<MovementRow[]>,
      q.query(
        `SELECT asset_id, type, to_type, to_id, created_at
           FROM asset_movements WHERE created_at >= $1 AND created_at <= $2
          ORDER BY created_at ASC`,
        [windowStart, now],
      ) as Promise<MovementRow[]>,
    ]);
    const toMove = (r: MovementRow): UtilMovement => ({
      type: r.type,
      toType: r.to_type,
      toId: r.to_id,
      at: new Date(r.created_at),
    });
    const beforeBy = new Map(before.map((r) => [r.asset_id, toMove(r)]));
    const withinBy = new Map<string, UtilMovement[]>();
    for (const r of within) {
      const list = withinBy.get(r.asset_id) ?? [];
      list.push(toMove(r));
      withinBy.set(r.asset_id, list);
    }

    const rows: AssetUtilization[] = assets.map((a) => ({
      assetId: a.id,
      assetName: a.name,
      category: a.category,
      ...computeUtilization(
        {
          homeLocationId: a.home_location_id,
          createdAt: new Date(a.created_at),
          before: beforeBy.get(a.id) ?? null,
          movements: withinBy.get(a.id) ?? [],
        },
        windowStart,
        now,
      ),
    }));
    rows.sort(
      (x, y) => y.utilizationPct - x.utilizationPct || x.assetName.localeCompare(y.assetName),
    );

    const byCat = new Map<string, AssetUtilization[]>();
    for (const r of rows) {
      const key = r.category ?? 'Bez kategorie';
      byCat.set(key, [...(byCat.get(key) ?? []), r]);
    }
    const categories: CategoryUtilization[] = [...byCat.entries()]
      .map(([category, list]) => {
        const rated = list.filter((r) => r.verdict !== 'new');
        return {
          category,
          assets: list.length,
          avgUtilizationPct: rated.length
            ? Math.round((rated.reduce((s, r) => s + r.utilizationPct, 0) / rated.length) * 10) / 10
            : 0,
          overused: list.filter((r) => r.verdict === 'overused').length,
          idle: list.filter((r) => r.verdict === 'idle').length,
        };
      })
      .sort((a, b) => b.avgUtilizationPct - a.avgUtilizationPct);
    const totals: Record<UtilizationVerdict, number> = { overused: 0, idle: 0, ok: 0, new: 0 };
    for (const r of rows) totals[r.verdict]++;
    return {
      days,
      from: windowStart.toISOString(),
      to: now.toISOString(),
      assets: rows,
      categories,
      totals,
    };
  }
}
