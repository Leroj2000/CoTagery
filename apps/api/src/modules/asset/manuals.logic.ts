import { createHmac, timingSafeEqual } from 'node:crypto';

/** Povolené MIME typy manuálu: PDF + obrázky (foto z kamery, scany). */
export const MANUAL_MAX_BYTES = 25 * 1024 * 1024; // 25 MB

/** Je MIME přijatelné pro manuál (PDF nebo obrázek)? */
export function isAllowedManualMime(mime: string): boolean {
  return mime === 'application/pdf' || mime.startsWith('image/');
}

/**
 * Ověří soubor manuálu (MIME + velikost). Vrací chybovou hlášku (česky) nebo
 * null, když je vše v pořádku. Čistá funkce – testovatelná bez Nestu.
 */
export function validateManualFile(mime: string, sizeBytes: number): string | null {
  if (!isAllowedManualMime(mime)) {
    return 'Nepodporovaný typ souboru (povoleno PDF a obrázky)';
  }
  if (sizeBytes <= 0) return 'Prázdný soubor';
  if (sizeBytes > MANUAL_MAX_BYTES) {
    return `Soubor je příliš velký (max ${Math.floor(MANUAL_MAX_BYTES / (1024 * 1024))} MB)`;
  }
  return null;
}

/**
 * Ověří STAŽENÝ obsah manuálu (z AI callbacku). Skutečné PDF pozná podle magic
 * bytes `%PDF-` (ne podle content-type, který AI/server může nastavit špatně),
 * obrázek podle content-type. Chrání před tím, že AI vrátí odkaz na HTML stránku
 * „ke stažení" místo přímého PDF. Vrací `{ mime }` nebo `{ error }`.
 */
export function validateDownloadedManual(
  buffer: Buffer,
  contentType: string | null,
): { mime: string } | { error: string } {
  const isPdf =
    buffer.length >= 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-';
  if (isPdf) {
    const err = validateManualFile('application/pdf', buffer.length);
    return err ? { error: err } : { mime: 'application/pdf' };
  }
  const ct = (contentType ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  if (ct.startsWith('image/')) {
    const err = validateManualFile(ct, buffer.length);
    return err ? { error: err } : { mime: ct };
  }
  return { error: 'odkaz nevede na přímé PDF ani obrázek (nejspíš webová stránka)' };
}

/** Odvodí zdroj manuálu z volitelného vstupu (default upload). */
export function normalizeSource(raw: string | undefined): 'upload' | 'camera' {
  return raw === 'camera' ? 'camera' : 'upload';
}

export interface ManualFetchPayload {
  manualId: string;
  assetId: string;
  tenantId: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  callbackUrl: string;
}

/**
 * Sestaví payload pro n8n webhook, který má AI cestou najít a stáhnout oficiální
 * PDF manuál dle výrobce/modelu. n8n po dokončení zavolá `callbackUrl`.
 */
export function buildFetchPayload(input: {
  manualId: string;
  assetId: string;
  tenantId: string;
  name: string;
  manufacturer?: string | null;
  model?: string | null;
  callbackBaseUrl: string;
}): ManualFetchPayload {
  const base = input.callbackBaseUrl.replace(/\/+$/, '');
  return {
    manualId: input.manualId,
    assetId: input.assetId,
    tenantId: input.tenantId,
    name: input.name,
    manufacturer: input.manufacturer ?? null,
    model: input.model ?? null,
    callbackUrl: `${base}/api/v1/manuals/webhook/callback`,
  };
}

/** HMAC-SHA256 hex podpis payloadu (sdílené tajemství s n8n). */
export function signManualPayload(rawBody: string, secret: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

/** Ověření podpisu callbacku v konstantním čase. */
export function verifyManualSignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  const expected = signManualPayload(rawBody, secret);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature ?? '', 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
