import { Logger } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import type { StoragePort } from './storage.port';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Firma z klíče souboru (`<druh>/<tenantId>/…`), jinak `null`. */
export function tenantFromKey(key: string): string | null {
  const second = key.split('/')[1];
  return second && UUID_RE.test(second) ? second : null;
}

/** Kontrola kvóty před uložením (vyhodí výjimku, když se soubor nevejde). */
export type StorageQuotaCheck = (tenantId: string, bytes: number) => Promise<void>;

/**
 * Úložiště s evidencí souborů (EPIC-20): každý `put` zapíše klíč, firmu a velikost
 * do `storage_objects`, `del` ho označí jako smazaný. Nad tím se počítá využití
 * úložiště firmy a vynucuje limit předplatného (`storage_mb`). Konkrétní driver
 * (lokální disk, R2/S3) se nemění.
 */
export class TrackingStorage implements StoragePort {
  private readonly logger = new Logger(TrackingStorage.name);
  private quota: StorageQuotaCheck | null = null;

  constructor(
    private readonly inner: StoragePort,
    private readonly dataSource: DataSource,
  ) {}

  /** Kontrolu kvóty registruje modul předplatného (bez cyklické závislosti modulů). */
  setQuotaCheck(check: StorageQuotaCheck): void {
    this.quota = check;
  }

  async put(key: string, data: Buffer, contentType?: string): Promise<{ key: string }> {
    const tenantId = tenantFromKey(key);
    if (tenantId && this.quota) await this.quota(tenantId, data.length);
    const res = await this.inner.put(key, data, contentType);
    await this.record(key, tenantId, data.length, contentType ?? null);
    return res;
  }

  get(key: string): Promise<Buffer> {
    return this.inner.get(key);
  }

  async del(key: string): Promise<void> {
    await this.inner.del(key);
    await this.dataSource
      .query(
        `UPDATE storage_objects SET deleted_at = now() WHERE key = $1 AND deleted_at IS NULL`,
        [key],
      )
      .catch((e: Error) => this.logger.warn(`Evidence smazání ${key} selhala: ${e.message}`));
  }

  url(key: string): string {
    return this.inner.url(key);
  }

  size(key: string): Promise<number | null> {
    return this.inner.size ? this.inner.size(key) : Promise.resolve(null);
  }

  /** Zápis do evidence; chyba evidence nesmí shodit nahrání (soubor už je uložený). */
  async record(
    key: string,
    tenantId: string | null,
    sizeBytes: number,
    contentType: string | null,
  ): Promise<void> {
    await this.dataSource
      .query(
        `INSERT INTO storage_objects (key, tenant_id, size_bytes, content_type)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (key) DO UPDATE SET size_bytes = EXCLUDED.size_bytes,
           content_type = EXCLUDED.content_type, deleted_at = NULL, updated_at = now()`,
        [key, tenantId, sizeBytes, contentType],
      )
      .catch((e: Error) => this.logger.warn(`Evidence souboru ${key} selhala: ${e.message}`));
  }
}
