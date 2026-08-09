import type { ModuleType } from '@tagery/shared';

export interface Resolution {
  carrierId: string;
  tenantId: string;
  objectId: string | null;
  carrierType: string;
  carrierStatus: string;
  moduleType: ModuleType | null;
  objectStatus: string | null;
  validFrom: string | null;
  validTo: string | null;
  primaryUrl: string | null;
  slug: string | null;
}

/** Nepřiřazený předgenerovaný nosič (pool) – ještě nemá objekt. */
export function isUnassigned(r: Resolution): boolean {
  return r.objectId === null;
}

/** Je nosič + objekt aktivní a v platnosti? (ADR-0002 validace na hot path) */
export function isActiveResolution(r: Resolution, now: number = Date.now()): boolean {
  if (r.objectStatus !== 'active' || r.carrierStatus !== 'active') return false;
  if (r.validFrom && new Date(r.validFrom).getTime() > now) return false;
  if (r.validTo && new Date(r.validTo).getTime() < now) return false;
  return true;
}
