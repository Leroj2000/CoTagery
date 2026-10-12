/**
 * Předplatné firem – čistá logika (bez DB): životní cyklus, efektivní úroveň,
 * moduly/funkce a limity, prodloužení, fakturační částky. Data jsou `YYYY-MM-DD`
 * (kalendářní dny v Praze).
 */
import {
  ENTITLEMENT_KEYS,
  FALLBACK_PLAN_KEY,
  LIMIT_KEYS,
  type EntitlementKey,
  type EntitlementLock,
  type LimitKey,
  type PlanLimits,
  type SubscriptionStatus,
} from '@tagery/shared';

export interface SubscriptionState {
  planKey: string;
  status: SubscriptionStatus;
  periodStart: string | null;
  /** Konec zaplaceného období / zkušební doby (včetně); `null` = bez konce. */
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface PlanLike {
  key: string;
  entitlements: string[];
  limits: PlanLimits;
}

export type EntitlementOverride = 'enabled' | 'disabled';

export function addDays(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addMonthsClamped(day: string, months: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const target = m - 1 + months;
  const year = y + Math.floor(target / 12);
  const month = ((target % 12) + 12) % 12;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * Přechod stavu k dnešku. Vrací nový stav, nebo `null` když se nic nemění.
 * - zkušební doba po konci → Free (aktivní, bez konce),
 * - aktivní po konci období → po splatnosti (nebo zrušeno, když se ruší ke konci),
 * - po splatnosti déle než `graceDays` → pozastaveno.
 */
export function nextSubscriptionState(
  s: SubscriptionState,
  today: string,
  graceDays: number,
): SubscriptionState | null {
  const ended = s.periodEnd != null && today > s.periodEnd;
  if (s.status === 'trialing' && ended) {
    return {
      planKey: FALLBACK_PLAN_KEY,
      status: 'active',
      periodStart: today,
      periodEnd: null,
      cancelAtPeriodEnd: false,
    };
  }
  if (s.status === 'active' && ended) {
    if (s.cancelAtPeriodEnd) return { ...s, status: 'canceled' };
    return {
      ...s,
      status: daysBetween(s.periodEnd!, today) > graceDays ? 'suspended' : 'past_due',
    };
  }
  if (s.status === 'past_due') {
    if (!ended) return { ...s, status: 'active' };
    if (daysBetween(s.periodEnd!, today) > graceDays) return { ...s, status: 'suspended' };
  }
  return null;
}

/** Stav po všech přechodech (např. po dlouhém výpadku jobu). */
export function settleSubscription(
  s: SubscriptionState,
  today: string,
  graceDays: number,
): SubscriptionState {
  let cur = s;
  for (let i = 0; i < 5; i++) {
    const next = nextSubscriptionState(cur, today, graceDays);
    if (!next) break;
    cur = next;
  }
  return cur;
}

/** Úroveň, podle které se řídí moduly a limity (pozastavené/zrušené = Free). */
export function effectivePlanKey(s: Pick<SubscriptionState, 'planKey' | 'status'>): string {
  return s.status === 'suspended' || s.status === 'canceled' ? FALLBACK_PLAN_KEY : s.planKey;
}

/**
 * Prodloužení o `days` dní: od konce období (i po splatnosti – navazuje), bez
 * konce od dneška. Pozastavené/po splatnosti/zrušené se po prodloužení přes
 * dnešek znovu aktivuje; zkušební doba zůstává zkušební.
 */
export function extendSubscription(
  s: SubscriptionState,
  days: number,
  today: string,
): SubscriptionState {
  const base = s.periodEnd ?? today;
  const periodEnd = addDays(base, days);
  if (periodEnd < today) return { ...s, periodEnd };
  return {
    ...s,
    periodEnd,
    status: s.status === 'trialing' ? 'trialing' : 'active',
    cancelAtPeriodEnd: s.status === 'canceled' ? false : s.cancelAtPeriodEnd,
  };
}

/** Má firma modul/funkci k dispozici (úroveň ⊕ výjimka superadmina)? */
export function entitlementAllowed(
  key: string,
  plan: PlanLike | null,
  overrides: Record<string, EntitlementOverride | undefined>,
): boolean {
  const o = overrides[key];
  if (o === 'enabled') return true;
  if (o === 'disabled') return false;
  return !!plan?.entitlements.includes(key);
}

export function entitlementLock(
  key: string,
  plan: PlanLike | null,
  overrides: Record<string, EntitlementOverride | undefined>,
): EntitlementLock {
  if (overrides[key] === 'disabled') return 'disabled_by_platform';
  return entitlementAllowed(key, plan, overrides) ? null : 'not_in_plan';
}

export function allowedEntitlements(
  plan: PlanLike | null,
  overrides: Record<string, EntitlementOverride | undefined>,
): Record<EntitlementKey, boolean> {
  return Object.fromEntries(
    ENTITLEMENT_KEYS.map((k) => [k, entitlementAllowed(k, plan, overrides)]),
  ) as Record<EntitlementKey, boolean>;
}

/**
 * Efektivní limity: výjimka firmy (i `null` = neomezeno) má přednost před
 * úrovní; chybějící hodnota = neomezeno.
 */
export function resolveLimits(
  plan: PlanLike | null,
  overrides: PlanLimits,
): Record<LimitKey, number | null> {
  return Object.fromEntries(
    LIMIT_KEYS.map((k) => {
      if (Object.prototype.hasOwnProperty.call(overrides, k)) return [k, overrides[k] ?? null];
      const v = plan?.limits[k];
      return [k, v == null ? null : v];
    }),
  ) as Record<LimitKey, number | null>;
}

/** Očistí limity z UI/JSON: jen známé klíče, celé nezáporné číslo nebo null. */
export function sanitizeLimits(raw: unknown): PlanLimits {
  const out: PlanLimits = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const k of LIMIT_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(raw, k)) continue;
    const v = (raw as Record<string, unknown>)[k];
    if (v === null) out[k] = null;
    else if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 10_000_000) out[k] = v;
    else throw new Error(`Neplatný limit ${k}`);
  }
  return out;
}

export function sanitizeEntitlementOverrides(raw: unknown): Record<string, EntitlementOverride> {
  const out: Record<string, EntitlementOverride> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!(ENTITLEMENT_KEYS as string[]).includes(k)) throw new Error(`Neznámý modul ${k}`);
    if (v === 'enabled' || v === 'disabled') out[k] = v;
    else if (v != null) throw new Error(`Neplatná výjimka modulu ${k}`);
  }
  return out;
}

/** Zbývá pod limitem pro `adding` nových? */
export function withinLimit(limit: number | null, used: number, adding = 1): boolean {
  return limit == null || used + adding <= limit;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Částky faktury z ceny bez DPH (neplátce = bez DPH). */
export function invoiceAmounts(
  net: number,
  vat: { payer: boolean; rate: number },
): { amountNet: number; vatRate: number | null; amountVat: number; amountGross: number } {
  const amountNet = round2(net);
  if (!vat.payer) return { amountNet, vatRate: null, amountVat: 0, amountGross: amountNet };
  const amountVat = round2((amountNet * vat.rate) / 100);
  return { amountNet, vatRate: vat.rate, amountVat, amountGross: round2(amountNet + amountVat) };
}

/** Další číslo faktury v roce: `2026` + pořadí na 4 místa (`20260001`). */
export function nextInvoiceNumber(year: number, existing: string[]): string {
  const prefix = String(year);
  const max = existing
    .filter((n) => n.startsWith(prefix) && n.length === prefix.length + 4)
    .map((n) => Number(n.slice(prefix.length)))
    .filter((n) => Number.isFinite(n))
    .reduce((a, b) => Math.max(a, b), 0);
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

/** Dnešek v Praze. */
export function pragueToday(now = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague' }).format(now);
}
