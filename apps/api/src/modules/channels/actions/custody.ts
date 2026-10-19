/**
 * Kdo má položku a od kdy (pro MCP/kanály). Čistá funkce – vstupem jsou už
 * načtená data (poslední pohyb, jména), výstup je bez interních id.
 */
export type CustodyType = 'loan' | 'assignment' | 'handover' | 'service' | 'move' | null;

export interface CustodyInfo {
  /** Kdo/kde položku právě má (osoba, místo nebo kontejner). */
  holder: { type: 'person' | 'location' | 'asset'; name: string | null } | null;
  /** Jakým pohybem se tam dostala: výpůjčka, přidělení, předávka, servis… */
  custodyType: CustodyType;
  /** Od kdy (ISO) – čas posledního pohybu. */
  since: string | null;
  /** Vrátit do (ISO) a čitelně (cs, Europe/Prague). */
  dueAt: string | null;
  dueDate: string | null;
  overdue: boolean;
  /** „Patří do“ – domovské místo. */
  belongsTo: string | null;
}

export interface CustodyInput {
  currentHolderType: 'person' | 'location' | 'asset' | null;
  currentHolderId: string | null;
  homeLocationId: string | null;
  dueAt: Date | null;
}

const MOVE_TO_CUSTODY: Record<string, CustodyType> = {
  loan: 'loan',
  assign: 'assignment',
  handover: 'handover',
  service_out: 'service',
  move: 'move',
};

export function formatDueDate(d: Date): string {
  return new Intl.DateTimeFormat('cs-CZ', {
    timeZone: 'Europe/Prague',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).format(d);
}

export function buildCustody(
  asset: CustodyInput,
  lastMove: { type: string; createdAt: Date } | null,
  names: { person: Map<string, string>; location: Map<string, string>; asset: Map<string, string> },
  now: Date = new Date(),
): CustodyInfo {
  const t = asset.currentHolderType;
  const id = asset.currentHolderId;
  const atHome = t === 'location' && id === asset.homeLocationId;
  const holder = t && id ? { type: t, name: names[t].get(id) ?? null } : null;
  const custodyType = atHome || !lastMove ? null : (MOVE_TO_CUSTODY[lastMove.type] ?? null);
  return {
    holder,
    custodyType,
    since: lastMove && !atHome ? lastMove.createdAt.toISOString() : null,
    dueAt: asset.dueAt ? asset.dueAt.toISOString() : null,
    dueDate: asset.dueAt ? formatDueDate(asset.dueAt) : null,
    overdue: !!asset.dueAt && !atHome && asset.dueAt.getTime() < now.getTime(),
    belongsTo: asset.homeLocationId ? (names.location.get(asset.homeLocationId) ?? null) : null,
  };
}
