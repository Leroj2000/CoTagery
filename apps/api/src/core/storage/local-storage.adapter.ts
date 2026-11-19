import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve, sep } from 'node:path';
import type { StoragePort } from './storage.port';

/** Lokální filesystem adaptér pro vývoj. Produkce používá R2/S3 adaptér (ADR-0008). */
export class LocalStorageAdapter implements StoragePort {
  constructor(private readonly basePath: string) {}

  /**
   * Klíč musí zůstat uvnitř `basePath` (BACKLOG SEC-02). Klíče dnes skládá server
   * z UUID, ale adaptér to vynucuje sám, aby budoucí chyba nevedla k path traversal.
   */
  private resolveKey(key: string): string {
    if (!key || key.includes('\0') || isAbsolute(key) || key.split(/[\\/]/).includes('..')) {
      throw new Error(`Neplatný klíč úložiště: ${JSON.stringify(key)}`);
    }
    const root = resolve(this.basePath);
    const path = resolve(root, key);
    if (path !== root && !path.startsWith(root + sep)) {
      throw new Error(`Klíč úložiště míří mimo úložiště: ${JSON.stringify(key)}`);
    }
    return path;
  }

  async put(key: string, data: Buffer): Promise<{ key: string }> {
    const path = this.resolveKey(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
    return { key };
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.resolveKey(key));
  }

  async del(key: string): Promise<void> {
    try {
      await unlink(this.resolveKey(key));
    } catch (err) {
      // Neexistující soubor není chyba (idempotentní mazání).
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }

  async size(key: string): Promise<number | null> {
    try {
      return (await stat(this.resolveKey(key))).size;
    } catch {
      return null;
    }
  }

  url(key: string): string {
    return `/media/${key}`;
  }
}
