/** Základní URL API (resolver hot path běží mimo /api/v1 prefix). */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** Odpověď resolveru pro veřejný sken (`GET /r/{code}?format=json`). */
export interface MembershipCardScan {
  type: 'membership';
  card: {
    member: { name: string; email: string | null };
    tier: { name: string; level: number };
    status: string;
    validFrom: string;
    validTo: string;
    zoneKeys: string[];
    benefits: { kind: string; targetKey: string | null; value: string | null }[];
  } | null;
}

export interface ProductScan {
  type: 'product';
  product: Record<string, string | null> | null;
}

export interface UnassignedScan {
  status: 'unassigned';
  message: string;
}

export type ScanResult =
  | MembershipCardScan
  | ProductScan
  | UnassignedScan
  | Record<string, unknown>;

/** Načte resoluci kódu jako JSON. Vrací status i tělo pro rozlišení stavů. */
export async function fetchScan(
  code: string,
): Promise<{ status: number; body: ScanResult }> {
  const res = await fetch(`${API_URL}/r/${encodeURIComponent(code)}?format=json`, {
    headers: { accept: 'application/json' },
    cache: 'no-store',
  });
  const body = (await res.json().catch(() => ({}))) as ScanResult;
  return { status: res.status, body };
}
