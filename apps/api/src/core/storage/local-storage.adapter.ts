import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { StoragePort } from './storage.port';

/** Lokální filesystem adaptér pro vývoj. Produkce používá R2/S3 adaptér (ADR-0008). */
export class LocalStorageAdapter implements StoragePort {
  constructor(private readonly basePath: string) {}

  private resolveKey(key: string): string {
    return resolve(join(this.basePath, key));
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

  url(key: string): string {
    return `/media/${key}`;
  }
}
