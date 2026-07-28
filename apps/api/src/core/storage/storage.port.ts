/** Injection token pro úložiště médií. */
export const STORAGE = Symbol('STORAGE');

/**
 * Abstrakce úložiště médií (ADR-0008). Lokálně filesystem; v produkci Cloudflare R2 / S3.
 * Doménový kód (Gallery, Fabrication) závisí jen na tomto rozhraní, ne na konkrétním provideru.
 */
export interface StoragePort {
  put(key: string, data: Buffer, contentType?: string): Promise<{ key: string }>;
  get(key: string): Promise<Buffer>;
  url(key: string): string;
}
