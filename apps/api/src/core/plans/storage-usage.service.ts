import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleInit,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { STORAGE, type StoragePort } from '../storage/storage.port';
import { TrackingStorage, tenantFromKey } from '../storage/tracking-storage';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { SubscriptionService } from './subscription.service';
import { PlanLimitReachedException } from './entitlements.service';

const MB = 1024 * 1024;

/** Sloupce s klíči souborů (doplnění evidence u souborů nahraných před jejím zavedením). */
const KEY_SOURCES: { table: string; column: string; rls: boolean }[] = [
  { table: 'tenants', column: 'logo_file_key', rls: false },
  { table: 'people', column: 'photo_file_key', rls: true },
  { table: 'assets', column: 'photo_key', rls: true },
  { table: 'asset_photos', column: 'file_key', rls: true },
  { table: 'asset_media', column: 'file_key', rls: true },
  { table: 'asset_manuals', column: 'file_key', rls: true },
  { table: 'asset_documents', column: 'file_key', rls: true },
  { table: 'upload_items', column: 'file_key', rls: true },
];

/** Bajty → MB zaokrouhlené nahoru na desetiny (využití se nepodhodnocuje). */
export function bytesToMb(bytes: number): number {
  return Math.ceil((bytes / MB) * 10) / 10;
}

/**
 * Využití úložiště firmy (EPIC-20): součet velikostí z evidence `storage_objects`,
 * kontrola limitu `storage_mb` před každým nahráním a jednorázové doplnění
 * evidence u souborů nahraných dřív (při startu API, idempotentně).
 */
@Injectable()
export class StorageUsageService implements OnModuleInit, OnApplicationBootstrap {
  private readonly logger = new Logger(StorageUsageService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(STORAGE) private readonly storage: StoragePort,
    private readonly context: TenantContextService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  onModuleInit(): void {
    if (this.storage instanceof TrackingStorage)
      this.storage.setQuotaCheck((tenantId, bytes) => this.assertFits(tenantId, bytes));
  }

  onApplicationBootstrap(): void {
    if (process.env.NODE_ENV === 'test') return;
    void this.backfill().catch((e: Error) =>
      this.logger.warn(`Doplnění evidence úložiště selhalo: ${e.message}`),
    );
  }

  async usedBytes(tenantId: string): Promise<number> {
    const rows = await this.dataSource.query(
      `SELECT COALESCE(sum(size_bytes), 0)::bigint AS n FROM storage_objects
        WHERE tenant_id = $1 AND deleted_at IS NULL`,
      [tenantId],
    );
    return Number(rows[0]?.n ?? 0);
  }

  /** 402, pokud se soubor nevejde do limitu úložiště předplatného. */
  async assertFits(tenantId: string, bytes: number): Promise<void> {
    const overview = await this.subscriptions.overview(tenantId);
    const limitMb = overview.limits.storage_mb;
    if (limitMb == null) return;
    const used = await this.usedBytes(tenantId);
    if (used + bytes > limitMb * MB)
      throw new PlanLimitReachedException(
        'storage_mb',
        limitMb,
        bytesToMb(used),
        overview.effectivePlan.name,
      );
  }

  /**
   * Doplní do evidence soubory, které v ní chybí (nahrané před zavedením evidence).
   * Klíče se čtou po firmách (tabulky mají RLS), velikost z úložiště.
   */
  async backfill(): Promise<number> {
    const keys = new Set<string>();
    const add = (rows: { k: string | null }[]) => {
      for (const r of rows) if (r.k) keys.add(r.k);
    };
    for (const src of KEY_SOURCES.filter((s) => !s.rls)) {
      add(await this.dataSource.query(`SELECT ${src.column} AS k FROM ${src.table}`));
    }
    const tenants = (await this.dataSource.query(`SELECT id FROM tenants`)) as { id: string }[];
    for (const t of tenants) {
      await this.context.runInTenant(t.id, async () => {
        for (const src of KEY_SOURCES.filter((s) => s.rls)) {
          add(
            await this.context.manager.query(
              `SELECT ${src.column} AS k FROM ${src.table} WHERE ${src.column} IS NOT NULL`,
            ),
          );
        }
      });
    }
    if (!keys.size) return 0;
    const known = new Set(
      (
        (await this.dataSource.query(`SELECT key FROM storage_objects WHERE key = ANY($1)`, [
          [...keys],
        ])) as { key: string }[]
      ).map((r) => r.key),
    );
    const missing = [...keys].filter((k) => !known.has(k));
    if (!missing.length || !(this.storage instanceof TrackingStorage)) return 0;
    let added = 0;
    for (const key of missing) {
      const size = await this.storage.size(key);
      if (size == null) continue; // soubor už na úložišti není
      await this.storage.record(key, tenantFromKey(key), size, null);
      added++;
    }
    if (added) this.logger.log(`Evidence úložiště doplněna o ${added} souborů`);
    return added;
  }
}
