/**
 * Inventura – porovnání evidence s realitou (dokument §10, §35). Při startu se
 * zmrazí množina očekávaných assetů v lokaci (`expected`). Sken klasifikuje:
 * očekávaný → NALEZENO, neočekávaný → NAVÍC. Při uzavření se dopočte CHYBÍ
 * (očekávané, ale nenaskenované). Čistá logika – bez DB, plně testovatelná.
 */

export type ScanResult = 'found' | 'unexpected';

/** Klasifikace jednoho skenu vůči zmrazené množině očekávaných assetů. */
export function classifyScan(expected: ReadonlySet<string>, assetId: string): ScanResult {
  return expected.has(assetId) ? 'found' : 'unexpected';
}

export interface InventoryResult {
  found: string[];
  missing: string[];
  unexpected: string[];
  expectedCount: number;
}

/**
 * Vyhodnotí inventuru: z očekávané množiny a seznamu skenů spočítá
 * nalezeno / chybí / navíc. `scans` může obsahovat duplicity (deduplikují se).
 */
export function computeResult(
  expected: ReadonlySet<string>,
  scans: readonly string[],
): InventoryResult {
  const scanned = new Set(scans);
  const found: string[] = [];
  const unexpected: string[] = [];
  for (const id of scanned) {
    (expected.has(id) ? found : unexpected).push(id);
  }
  const missing = [...expected].filter((id) => !scanned.has(id));
  return { found, missing, unexpected, expectedCount: expected.size };
}
