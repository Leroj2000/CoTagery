import type { SpecItem } from './entities/asset-spec.entity';

export const MAX_SPEC_ITEMS = 40;

/**
 * Očistí a omezí specifikace z AI callbacku: pole {label,value}, oříznuté délky,
 * bez prázdných, max {@link MAX_SPEC_ITEMS} položek. Čistá funkce – testovatelná.
 */
export function sanitizeSpecs(raw: unknown): SpecItem[] {
  if (!Array.isArray(raw)) return [];
  const out: SpecItem[] = [];
  for (const it of raw) {
    if (!it || typeof it !== 'object') continue;
    const rec = it as Record<string, unknown>;
    const label = String(rec.label ?? '').trim().slice(0, 120);
    const value = String(rec.value ?? '').trim().slice(0, 400);
    if (label && value) out.push({ label, value });
    if (out.length >= MAX_SPEC_ITEMS) break;
  }
  return out;
}

export interface SpecFetchPayload {
  specId: string;
  assetId: string;
  tenantId: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  callbackUrl: string;
}

/**
 * Sestaví payload pro n8n webhook, který má AI cestou dohledat technické
 * specifikace položky a callbacknout je zpět jako pole {label,value}.
 */
export function buildSpecPayload(input: {
  specId: string;
  assetId: string;
  tenantId: string;
  name: string;
  manufacturer?: string | null;
  model?: string | null;
  callbackBaseUrl: string;
}): SpecFetchPayload {
  const base = input.callbackBaseUrl.replace(/\/+$/, '');
  return {
    specId: input.specId,
    assetId: input.assetId,
    tenantId: input.tenantId,
    name: input.name,
    manufacturer: input.manufacturer ?? null,
    model: input.model ?? null,
    callbackUrl: `${base}/api/v1/specs/webhook/callback`,
  };
}
