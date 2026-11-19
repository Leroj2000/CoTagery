/**
 * Report vytíženosti (BACKLOG ZAK-03) – čistá logika nad knihou pohybů.
 * Bez zakázek (DEC-03): „v použití“ = u osoby nebo na jiném místě než domovském.
 */
export type UsageState = 'use' | 'idle' | 'service' | 'gone';

export interface UtilMovement {
  type: string;
  toType: string | null;
  toId: string | null;
  at: Date;
}

export interface UtilizationInput {
  homeLocationId: string | null;
  createdAt: Date;
  /** Poslední pohyb před začátkem okna (stav na jeho začátku), nebo null. */
  before: UtilMovement | null;
  /** Pohyby v okně, vzestupně podle času. */
  movements: UtilMovement[];
}

export interface UtilizationResult {
  daysTracked: number;
  daysInUse: number;
  daysInService: number;
  utilizationPct: number;
  movementsInWindow: number;
  lastMovementAt: Date | null;
  /** Dní od posledního pohybu (nebo od založení). */
  daysSinceMovement: number;
  verdict: UtilizationVerdict;
}

export type UtilizationVerdict = 'overused' | 'idle' | 'ok' | 'new';

export const OVERUSED_PCT = 80;
export const IDLE_PCT = 5;
export const IDLE_MIN_DAYS = 60;
export const MIN_TRACKED_DAYS = 14;

const DAY = 24 * 60 * 60 * 1000;

export function stateAfter(m: UtilMovement | null, homeLocationId: string | null): UsageState {
  if (!m) return 'idle';
  if (m.type === 'dispose') return 'gone';
  if (m.type === 'service_out') return 'service';
  if (m.toType === 'person') return 'use';
  if (m.toType === 'location')
    return homeLocationId && m.toId === homeLocationId ? 'idle' : homeLocationId ? 'use' : 'idle';
  return 'idle';
}

export function verdictFor(
  pct: number,
  daysTracked: number,
  daysSinceMovement: number,
): UtilizationVerdict {
  if (daysTracked < MIN_TRACKED_DAYS) return 'new';
  if (pct >= OVERUSED_PCT) return 'overused';
  if (pct < IDLE_PCT && daysSinceMovement >= IDLE_MIN_DAYS) return 'idle';
  return 'ok';
}

export function computeUtilization(
  input: UtilizationInput,
  windowStart: Date,
  now: Date,
): UtilizationResult {
  const start = new Date(Math.max(windowStart.getTime(), input.createdAt.getTime()));
  let state = stateAfter(input.before, input.homeLocationId);
  let cursor = start.getTime();
  let tracked = 0;
  let use = 0;
  let service = 0;
  const add = (until: number): void => {
    const span = Math.max(0, until - cursor);
    if (state !== 'gone') tracked += span;
    if (state === 'use') use += span;
    if (state === 'service') service += span;
    cursor = Math.max(cursor, until);
  };
  for (const m of input.movements) {
    const t = Math.min(Math.max(m.at.getTime(), start.getTime()), now.getTime());
    add(t);
    state = stateAfter(m, input.homeLocationId);
  }
  add(now.getTime());
  const last = input.movements.at(-1)?.at ?? input.before?.at ?? null;
  const daysSinceMovement = Math.floor((now.getTime() - (last ?? input.createdAt).getTime()) / DAY);
  const pct = tracked > 0 ? Math.round((use / tracked) * 1000) / 10 : 0;
  const daysTracked = Math.round((tracked / DAY) * 10) / 10;
  return {
    daysTracked,
    daysInUse: Math.round((use / DAY) * 10) / 10,
    daysInService: Math.round((service / DAY) * 10) / 10,
    utilizationPct: pct,
    movementsInWindow: input.movements.length,
    lastMovementAt: last,
    daysSinceMovement,
    verdict: verdictFor(pct, daysTracked, daysSinceMovement),
  };
}
