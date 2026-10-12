/**
 * Inventura vozidel – čistá logika (bez DB). Jde o sepsání stavu vozidel
 * k období od–do (kalendářní dny v Praze, včetně):
 * - tachometr na začátku = poslední odečet před začátkem období (jinak první
 *   v období), na konci = poslední odečet do konce období,
 * - servis = nejbližší servisní interval k referenčnímu dni (konec období,
 *   nejpozději dnešek): km a dny do servisu, záporné = po servisu.
 */
import type { MaintenanceStatus } from '../asset/maintenance.logic';

export interface VehiclePlanState {
  code: string;
  title: string;
  status: MaintenanceStatus;
  nextMeter: number | null;
  /** Záporné = po servisu. */
  kmToService: number | null;
  /** YYYY-MM-DD. */
  nextDueOn: string | null;
  /** Záporné = po termínu. */
  daysToService: number | null;
  lastServiceOn: string | null;
  lastServiceMeter: number | null;
}

export interface VehicleServiceInPeriod {
  performedOn: string;
  title: string;
  meterValue: number | null;
  provider: string | null;
}

export interface VehicleInventoryRow {
  assetId: string;
  name: string;
  /** SPZ (u zmrazených řádků ze starší verze chybí). */
  registrationPlate?: string | null;
  inventoryNumber: string | null;
  serialNumber: string | null;
  category: string | null;
  holder: string | null;
  odometerStart: number | null;
  /** ISO čas odečtu. */
  odometerStartAt: string | null;
  odometerEnd: number | null;
  odometerEndAt: string | null;
  /** Ujeto za období (konec − začátek). */
  distance: number | null;
  /** Odečet před posledním (u zmrazených řádků ze starší verze chybí). */
  previousOdometer?: number | null;
  previousOdometerAt?: string | null;
  /** Ujeto od předchozího záznamu (poslední − předposlední odečet). */
  distanceSincePrevious?: number | null;
  /** Stav tachometru při pořízení a jak byl určen. */
  odometerAtPurchase?: number | null;
  odometerAtPurchaseSource?: PurchaseOdometerSource | null;
  /** Ujeto od pořízení (poslední odečet − stav při pořízení). */
  distanceSincePurchase?: number | null;
  plans: VehiclePlanState[];
  next: VehiclePlanState | null;
  servicesInPeriod: VehicleServiceInPeriod[];
  note: string | null;
}

export const SERVICE_STATUS_LABELS: Record<MaintenanceStatus, string> = {
  not_started: 'Bez záznamu servisu',
  need_reading: 'Chybí stav tachometru',
  ok: 'V pořádku',
  soon: 'Blíží se',
  overdue: 'Po servisu',
};

const TZ = 'Europe/Prague';

/** Datum YYYY-MM-DD v Praze. */
export function pragueDay(d: Date): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(d);
}

/** Posun Prahy proti UTC v minutách v daném okamžiku. */
function pragueOffsetMinutes(at: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** Půlnoc dne `day` (YYYY-MM-DD) v Praze jako okamžik. */
export function pragueMidnight(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d);
  return new Date(utc - pragueOffsetMinutes(new Date(utc)) * 60000);
}

export function addDaysIso(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromDay: string, toDay: string): number {
  return Math.round(
    (Date.parse(`${toDay}T00:00:00Z`) - Date.parse(`${fromDay}T00:00:00Z`)) / 86_400_000,
  );
}

/** Hranice období: [start, end) jako okamžiky; reference = konec období, nejpozději teď. */
export function periodBounds(
  from: string,
  to: string,
  now = new Date(),
): { start: Date; end: Date; reference: Date; referenceDay: string } {
  const start = pragueMidnight(from);
  const end = pragueMidnight(addDaysIso(to, 1));
  const reference = end.getTime() <= now.getTime() ? new Date(end.getTime() - 1) : now;
  return { start, end, reference, referenceDay: pragueDay(reference) };
}

export interface Reading {
  value: number;
  observedAt: Date;
}

/** Odečty tachometru pro začátek a konec období. */
export function periodReadings(
  readings: Reading[],
  start: Date,
  end: Date,
): { start: Reading | null; end: Reading | null } {
  const sorted = [...readings].sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime());
  const before = sorted.filter((r) => r.observedAt < start);
  const inside = sorted.filter((r) => r.observedAt >= start && r.observedAt < end);
  const first = before.at(-1) ?? inside[0] ?? null;
  const last = inside.at(-1) ?? before.at(-1) ?? null;
  return { start: first, end: last };
}

/** Odečet těsně před `last` (předchozí záznam). */
export function previousReading(readings: Reading[], last: Reading | null): Reading | null {
  if (!last) return null;
  const before = readings
    .filter((r) => r !== last && r.observedAt.getTime() <= last.observedAt.getTime())
    .sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime());
  return before.at(-1) ?? null;
}

/**
 * Jak byl určen stav při pořízení: `reading` = odečet do dne pořízení,
 * `new` = nová věc bez odečtu = 0 km, `first_after` = první odečet po
 * pořízení (použitá věc bez odečtu při koupi – odhad).
 */
export type PurchaseOdometerSource = 'reading' | 'new' | 'first_after';

/** Stav tachometru při pořízení; bez data pořízení `null`. */
export function odometerAtPurchase(
  readings: Reading[],
  purchase: { condition: 'new' | 'used'; purchasedOn: string | null } | null,
): { value: number; source: PurchaseOdometerSource } | null {
  if (!purchase?.purchasedOn) return null;
  const dayEnd = pragueMidnight(addDaysIso(purchase.purchasedOn, 1));
  const sorted = [...readings].sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime());
  const atPurchase = sorted.filter((r) => r.observedAt < dayEnd).at(-1);
  if (atPurchase) return { value: atPurchase.value, source: 'reading' };
  if (purchase.condition === 'new') return { value: 0, source: 'new' };
  const after = sorted.find((r) => r.observedAt >= dayEnd);
  return after ? { value: after.value, source: 'first_after' } : null;
}

/** Rozdíl stavů tachometru zaokrouhlený na desetiny, nikdy záporný. */
export function kmDiff(to: number | null | undefined, from: number | null | undefined) {
  return to != null && from != null ? Math.max(0, Math.round((to - from) * 10) / 10) : null;
}

const STATUS_RANK: Record<MaintenanceStatus, number> = {
  overdue: 0,
  soon: 1,
  need_reading: 2,
  ok: 3,
  not_started: 4,
};

/** Nejbližší servis: nejhorší stav, pak nejméně dní a km. */
export function mostUrgent(plans: VehiclePlanState[]): VehiclePlanState | null {
  const rank = (p: VehiclePlanState) => [
    STATUS_RANK[p.status],
    p.daysToService ?? Number.POSITIVE_INFINITY,
    p.kmToService ?? Number.POSITIVE_INFINITY,
  ];
  return (
    [...plans].sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
      return 0;
    })[0] ?? null
  );
}

/** Stav intervalu k referenčnímu dni z výsledku `calculateMaintenance`. */
export function planState(
  plan: {
    code: string;
    title: string;
    status: MaintenanceStatus;
    nextMeter: number | null;
    nextDueAt: Date | null;
    lastService: { performedAt: Date | null; meterValue: number | null } | null;
  },
  odometer: number | null,
  referenceDay: string,
): VehiclePlanState {
  const nextDueOn = plan.nextDueAt ? pragueDay(plan.nextDueAt) : null;
  return {
    code: plan.code,
    title: plan.title,
    status: plan.status,
    nextMeter: plan.nextMeter,
    kmToService:
      plan.nextMeter != null && odometer != null
        ? Math.round((plan.nextMeter - odometer) * 10) / 10
        : null,
    nextDueOn,
    daysToService: nextDueOn ? daysBetween(referenceDay, nextDueOn) : null,
    lastServiceOn: plan.lastService?.performedAt ? pragueDay(plan.lastService.performedAt) : null,
    lastServiceMeter: plan.lastService?.meterValue ?? null,
  };
}
