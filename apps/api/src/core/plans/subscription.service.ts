import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, EntityManager } from 'typeorm';
import {
  ENTITLEMENT_KEYS,
  TRIAL_PLAN_KEY,
  type EntitlementKey,
  type EntitlementLock,
  type LimitKey,
  type PlanDefinition,
  type PlanLimits,
  type SubscriptionStatus,
} from '@tagery/shared';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { AuthzService } from '../rbac/authz.service';
import {
  addDays,
  addMonthsClamped,
  allowedEntitlements,
  effectivePlanKey,
  entitlementLock,
  extendSubscription,
  pragueToday,
  resolveLimits,
  sanitizeEntitlementOverrides,
  sanitizeLimits,
  settleSubscription,
  type EntitlementOverride,
  type SubscriptionState,
} from './plans.logic';

export interface PlatformSettings {
  trialDays: number;
  graceDays: number;
  invoiceDueDays: number;
  vatPayer: boolean;
  vatRate: number;
  supplier: {
    name: string;
    ico: string;
    dic: string;
    address: string;
    email: string;
    iban: string;
    bankAccount?: string;
  };
}

export interface BillingDetails {
  name?: string;
  ico?: string;
  dic?: string;
  address?: string;
  email?: string;
}

export interface TenantSubscription {
  tenantId: string;
  planKey: string;
  status: SubscriptionStatus;
  periodStart: string | null;
  periodEnd: string | null;
  billingPeriod: 'month' | 'year' | 'custom';
  priceAmount: number | null;
  currency: string;
  paymentMethod: 'manual' | 'card';
  limitOverrides: PlanLimits;
  entitlementOverrides: Record<string, EntitlementOverride>;
  billingDetails: BillingDetails;
  cancelAtPeriodEnd: boolean;
  note: string | null;
  updatedAt: string;
}

export interface EntitlementView {
  key: EntitlementKey;
  allowed: boolean;
  inPlan: boolean;
  override: EntitlementOverride | null;
  lock: EntitlementLock;
}

export interface SubscriptionOverview {
  subscription: TenantSubscription;
  plan: PlanDefinition;
  /** Úroveň, podle které se teď řídí moduly a limity (pozastaveno = Free). */
  effectivePlan: PlanDefinition;
  limits: Record<LimitKey, number | null>;
  entitlements: EntitlementView[];
  /** Dní do konce období/zkušební doby (záporné = po konci); bez konce `null`. */
  daysLeft: number | null;
  graceDays: number;
}

export interface SubscriptionEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
  actorUserId: string | null;
  actorName: string | null;
  createdAt: string;
}

export interface SubscriptionPatch {
  planKey?: string;
  status?: SubscriptionStatus;
  periodStart?: string | null;
  periodEnd?: string | null;
  billingPeriod?: 'month' | 'year' | 'custom';
  priceAmount?: number | null;
  cancelAtPeriodEnd?: boolean;
  note?: string | null;
  billingDetails?: BillingDetails;
  limitOverrides?: unknown;
  entitlementOverrides?: unknown;
}

const SUB_COLUMNS = `tenant_id, plan_key, status,
  to_char(period_start,'YYYY-MM-DD') AS period_start, to_char(period_end,'YYYY-MM-DD') AS period_end,
  billing_period, price_amount, currency, payment_method, limit_overrides, entitlement_overrides,
  billing_details, cancel_at_period_end, note, updated_at`;

const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

function mapPlan(r: Record<string, unknown>): PlanDefinition {
  return {
    key: String(r.key),
    name: String(r.name),
    description: (r.description as string | null) ?? null,
    sortOrder: Number(r.sort_order),
    priceMonth: r.price_month == null ? null : Number(r.price_month),
    priceYear: r.price_year == null ? null : Number(r.price_year),
    currency: String(r.currency),
    entitlements: (r.entitlements as EntitlementKey[]) ?? [],
    limits: (r.limits as PlanLimits) ?? {},
    isPublic: r.is_public === true,
  };
}

function mapSub(r: Record<string, unknown>): TenantSubscription {
  return {
    tenantId: String(r.tenant_id),
    planKey: String(r.plan_key),
    status: r.status as SubscriptionStatus,
    periodStart: (r.period_start as string | null) ?? null,
    periodEnd: (r.period_end as string | null) ?? null,
    billingPeriod: r.billing_period as TenantSubscription['billingPeriod'],
    priceAmount: r.price_amount == null ? null : Number(r.price_amount),
    currency: String(r.currency),
    paymentMethod: r.payment_method as TenantSubscription['paymentMethod'],
    limitOverrides: (r.limit_overrides as PlanLimits) ?? {},
    entitlementOverrides: (r.entitlement_overrides as Record<string, EntitlementOverride>) ?? {},
    billingDetails: (r.billing_details as BillingDetails) ?? {},
    cancelAtPeriodEnd: r.cancel_at_period_end === true,
    note: (r.note as string | null) ?? null,
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Předplatné firem vůči Tagery (EPIC-20 v2, ADR-0009). Úrovně a předplatné jsou
 * platformní tabulky bez RLS (zapisuje platform-admin); efektivní stav modulů se
 * promítá do `organization_modules.allowed` (pod RLS firmy), který čte authz guard.
 * Přechody stavu (konec zkušební doby, splatnost) se vyhodnocují líně při čtení
 * a hodinovým během přes všechny firmy.
 */
@Injectable()
export class SubscriptionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SubscriptionService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly context: TenantContextService,
    private readonly authz: AuthzService,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.sweep().catch(() => undefined), SWEEP_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  // --- Úrovně ---

  async plans(): Promise<PlanDefinition[]> {
    const rows = await this.dataSource.query(
      `SELECT * FROM platform_plans ORDER BY sort_order, key`,
    );
    return (rows as Record<string, unknown>[]).map(mapPlan);
  }

  async plan(key: string): Promise<PlanDefinition> {
    const rows = await this.dataSource.query(`SELECT * FROM platform_plans WHERE key = $1`, [key]);
    if (!rows.length) throw new NotFoundException(`Úroveň ${key} neexistuje`);
    return mapPlan(rows[0]);
  }

  /** Úprava úrovně; firmy na ní se hned přepočítají. */
  async updatePlan(
    key: string,
    patch: Partial<Omit<PlanDefinition, 'key'>>,
    actorUserId: string | null,
  ): Promise<PlanDefinition> {
    const current = await this.plan(key);
    let limits = current.limits;
    if (patch.limits !== undefined) {
      try {
        limits = sanitizeLimits(patch.limits);
      } catch (e) {
        throw new BadRequestException((e as Error).message);
      }
    }
    let entitlements = current.entitlements;
    if (patch.entitlements !== undefined) {
      const unknown = patch.entitlements.filter((k) => !ENTITLEMENT_KEYS.includes(k));
      if (unknown.length) throw new BadRequestException(`Neznámý modul: ${unknown.join(', ')}`);
      entitlements = [...new Set(patch.entitlements)];
    }
    const price = (v: number | null | undefined, cur: number | null) => {
      if (v === undefined) return cur;
      if (v !== null && (!Number.isFinite(v) || v < 0))
        throw new BadRequestException('Neplatná cena');
      return v;
    };
    await this.dataSource.query(
      `UPDATE platform_plans SET name=$2, description=$3, price_month=$4, price_year=$5,
         entitlements=$6, limits=$7, is_public=$8, sort_order=$9, updated_at=now() WHERE key=$1`,
      [
        key,
        patch.name?.trim() || current.name,
        patch.description !== undefined ? patch.description?.trim() || null : current.description,
        price(patch.priceMonth, current.priceMonth),
        price(patch.priceYear, current.priceYear),
        entitlements,
        JSON.stringify(limits),
        patch.isPublic ?? current.isPublic,
        patch.sortOrder ?? current.sortOrder,
      ],
    );
    await this.platformAudit(null, 'plan.updated', { planKey: key }, actorUserId);
    // Přepočet modulů firem, které se úrovní řídí.
    const tenants = (await this.dataSource.query(`SELECT tenant_id FROM tenant_subscriptions`)) as {
      tenant_id: string;
    }[];
    for (const t of tenants) await this.project(t.tenant_id);
    return this.plan(key);
  }

  // --- Nastavení platformy ---

  async settings(): Promise<PlatformSettings> {
    const rows = await this.dataSource.query(`SELECT data FROM platform_settings WHERE id = 1`);
    const d = (rows[0]?.data ?? {}) as Partial<PlatformSettings>;
    return {
      trialDays: Number(d.trialDays ?? 14),
      graceDays: Number(d.graceDays ?? 14),
      invoiceDueDays: Number(d.invoiceDueDays ?? 14),
      vatPayer: d.vatPayer === true,
      vatRate: Number(d.vatRate ?? 21),
      supplier: {
        name: '',
        ico: '',
        dic: '',
        address: '',
        email: '',
        iban: '',
        ...(d.supplier ?? {}),
      },
    };
  }

  async updateSettings(
    patch: Partial<PlatformSettings>,
    actorUserId: string | null,
  ): Promise<PlatformSettings> {
    const cur = await this.settings();
    const int = (v: unknown, min: number, max: number, name: string) => {
      if (v === undefined) return undefined;
      if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max)
        throw new BadRequestException(`Neplatná hodnota: ${name}`);
      return v;
    };
    const next: PlatformSettings = {
      trialDays: int(patch.trialDays, 0, 365, 'zkušební doba') ?? cur.trialDays,
      graceDays: int(patch.graceDays, 0, 365, 'odklad po splatnosti') ?? cur.graceDays,
      invoiceDueDays: int(patch.invoiceDueDays, 0, 120, 'splatnost') ?? cur.invoiceDueDays,
      vatPayer: patch.vatPayer ?? cur.vatPayer,
      vatRate: patch.vatRate ?? cur.vatRate,
      supplier: { ...cur.supplier, ...cleanSupplier(patch.supplier) },
    };
    if (next.vatRate < 0 || next.vatRate > 100) throw new BadRequestException('Neplatná sazba DPH');
    await this.dataSource.query(
      `UPDATE platform_settings SET data=$1, updated_at=now() WHERE id=1`,
      [JSON.stringify(next)],
    );
    await this.platformAudit(null, 'settings.updated', {}, actorUserId);
    return next;
  }

  // --- Předplatné firmy ---

  /** Předplatné firmy; chybí-li, založí zkušební. Líně vyhodnotí přechody stavu. */
  async get(tenantId: string): Promise<TenantSubscription> {
    let rows = await this.dataSource.query(
      `SELECT ${SUB_COLUMNS} FROM tenant_subscriptions WHERE tenant_id = $1`,
      [tenantId],
    );
    if (!rows.length) {
      await this.startTrial(tenantId);
      rows = await this.dataSource.query(
        `SELECT ${SUB_COLUMNS} FROM tenant_subscriptions WHERE tenant_id = $1`,
        [tenantId],
      );
    }
    const sub = mapSub(rows[0]);
    const settled = settleSubscription(sub, pragueToday(), (await this.settings()).graceDays);
    if (
      settled.status !== sub.status ||
      settled.planKey !== sub.planKey ||
      settled.periodEnd !== sub.periodEnd
    ) {
      await this.persistState(tenantId, sub, settled, 'lifecycle', null);
      return this.get(tenantId);
    }
    return sub;
  }

  /** Zkušební předplatné nové firmy (idempotentní). */
  async startTrial(tenantId: string): Promise<void> {
    const s = await this.settings();
    const today = pragueToday();
    const res = await this.dataSource.query(
      `INSERT INTO tenant_subscriptions (tenant_id, plan_key, status, period_start, period_end, billing_period, price_amount)
       VALUES ($1, $2, 'trialing', $3, $4, 'custom', 0)
       ON CONFLICT (tenant_id) DO NOTHING RETURNING tenant_id`,
      [tenantId, TRIAL_PLAN_KEY, today, addDays(today, Math.max(0, s.trialDays - 1))],
    );
    if (res.length) {
      await this.event(tenantId, 'trial_started', { days: s.trialDays }, null);
      await this.project(tenantId);
    }
  }

  async overview(tenantId: string): Promise<SubscriptionOverview> {
    const subscription = await this.get(tenantId);
    const plans = await this.plans();
    const byKey = new Map(plans.map((p) => [p.key, p]));
    const plan = byKey.get(subscription.planKey) ?? (await this.plan(subscription.planKey));
    const effectivePlan = byKey.get(effectivePlanKey(subscription)) ?? plan;
    const overrides = subscription.entitlementOverrides;
    return {
      subscription,
      plan,
      effectivePlan,
      limits: resolveLimits(effectivePlan, subscription.limitOverrides),
      entitlements: ENTITLEMENT_KEYS.map((key) => ({
        key,
        allowed: allowedEntitlements(effectivePlan, overrides)[key],
        inPlan: effectivePlan.entitlements.includes(key),
        override: overrides[key] ?? null,
        lock: entitlementLock(key, effectivePlan, overrides),
      })),
      daysLeft: subscription.periodEnd
        ? Math.round(
            (Date.parse(`${subscription.periodEnd}T00:00:00Z`) -
              Date.parse(`${pragueToday()}T00:00:00Z`)) /
              86_400_000,
          )
        : null,
      graceDays: (await this.settings()).graceDays,
    };
  }

  /** Změna předplatného superadminem (úroveň, stav, období, výjimky…). */
  async update(
    tenantId: string,
    patch: SubscriptionPatch,
    actorUserId: string | null,
  ): Promise<SubscriptionOverview> {
    const cur = await this.get(tenantId);
    for (const d of [patch.periodStart, patch.periodEnd]) {
      if (d && !DATE_RE.test(d)) throw new BadRequestException('Datum musí být RRRR-MM-DD');
    }
    let limitOverrides = cur.limitOverrides;
    let entitlementOverrides = cur.entitlementOverrides;
    try {
      if (patch.limitOverrides !== undefined) limitOverrides = sanitizeLimits(patch.limitOverrides);
      if (patch.entitlementOverrides !== undefined)
        entitlementOverrides = sanitizeEntitlementOverrides(patch.entitlementOverrides);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    const next = { ...cur };
    if (patch.planKey !== undefined && patch.planKey !== cur.planKey) {
      const plan = await this.plan(patch.planKey);
      next.planKey = plan.key;
      const billing = patch.billingPeriod ?? cur.billingPeriod;
      // Cena se při změně úrovně předvyplní z ceníku (snapshot), pokud není zadaná.
      if (patch.priceAmount === undefined)
        next.priceAmount =
          billing === 'year' ? plan.priceYear : billing === 'month' ? plan.priceMonth : null;
      if (plan.key === TRIAL_PLAN_KEY && patch.status === undefined) {
        next.status = 'trialing';
        if (patch.periodEnd === undefined) {
          const s = await this.settings();
          next.periodStart = pragueToday();
          next.periodEnd = addDays(pragueToday(), Math.max(0, s.trialDays - 1));
        }
      } else if (cur.status === 'trialing' && patch.status === undefined) {
        next.status = 'active';
      }
    }
    if (patch.status !== undefined) next.status = patch.status;
    if (patch.periodStart !== undefined) next.periodStart = patch.periodStart || null;
    if (patch.periodEnd !== undefined) next.periodEnd = patch.periodEnd || null;
    if (patch.billingPeriod !== undefined) next.billingPeriod = patch.billingPeriod;
    if (patch.priceAmount !== undefined) {
      if (
        patch.priceAmount !== null &&
        (!Number.isFinite(patch.priceAmount) || patch.priceAmount < 0)
      )
        throw new BadRequestException('Neplatná cena');
      next.priceAmount = patch.priceAmount;
    }
    if (patch.cancelAtPeriodEnd !== undefined) next.cancelAtPeriodEnd = patch.cancelAtPeriodEnd;
    if (patch.note !== undefined) next.note = patch.note?.trim() || null;
    if (patch.billingDetails !== undefined)
      next.billingDetails = { ...cur.billingDetails, ...patch.billingDetails };
    next.limitOverrides = limitOverrides;
    next.entitlementOverrides = entitlementOverrides;
    const datesChanged = patch.periodStart !== undefined || patch.periodEnd !== undefined;
    if (datesChanged && next.periodStart && next.periodEnd && next.periodEnd < next.periodStart)
      throw new BadRequestException('Konec období je před začátkem');

    await this.write(next);
    await this.event(tenantId, 'updated', diff(cur, next), actorUserId);
    await this.project(tenantId);
    // Hned vyhodnotí stav k dnešku (např. zadaný konec v minulosti → po splatnosti).
    return this.overview(tenantId);
  }

  /** Prodloužení o `days` dní (i po splatnosti – navazuje na konec období). */
  async extend(
    tenantId: string,
    days: number,
    actorUserId: string | null,
  ): Promise<SubscriptionOverview> {
    if (!Number.isInteger(days) || days < 1 || days > 3660)
      throw new BadRequestException('Počet dní musí být 1–3660');
    const cur = await this.get(tenantId);
    const next = extendSubscription(cur, days, pragueToday());
    await this.persistState(tenantId, cur, next, 'extended', actorUserId, { days });
    return this.overview(tenantId);
  }

  /** Zaplaceno do `periodEnd` (faktura) – nastaví období a aktivuje. */
  async markPaidUntil(
    tenantId: string,
    periodFrom: string | null,
    periodEnd: string,
    actorUserId: string | null,
    data: Record<string, unknown>,
  ): Promise<void> {
    const cur = await this.get(tenantId);
    const next: SubscriptionState = {
      ...cur,
      periodStart: cur.periodStart ?? periodFrom,
      periodEnd: cur.periodEnd && cur.periodEnd > periodEnd ? cur.periodEnd : periodEnd,
      status: 'active',
      cancelAtPeriodEnd: false,
    };
    // Zaplacená zkušební doba = přechod na skutečnou úroveň řeší superadmin úrovní.
    await this.persistState(tenantId, cur, next, 'paid', actorUserId, data);
  }

  /** Další období podle fakturačního cyklu (pro předvyplnění faktury). */
  nextPeriod(sub: TenantSubscription): { from: string; to: string } {
    const today = pragueToday();
    const from =
      sub.periodEnd && sub.periodEnd >= addDays(today, -60) ? addDays(sub.periodEnd, 1) : today;
    const months = sub.billingPeriod === 'year' ? 12 : 1;
    return { from, to: addDays(addMonthsClamped(from, months), -1) };
  }

  async events(tenantId: string, limit = 100): Promise<SubscriptionEvent[]> {
    const rows = await this.dataSource.query(
      `SELECT e.id, e.type, e.data, e.actor_user_id, u.name AS actor_name, e.created_at
         FROM tenant_subscription_events e LEFT JOIN users u ON u.id = e.actor_user_id
        WHERE e.tenant_id = $1 ORDER BY e.created_at DESC LIMIT $2`,
      [tenantId, limit],
    );
    return (rows as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      type: String(r.type),
      data: (r.data as Record<string, unknown>) ?? {},
      actorUserId: (r.actor_user_id as string | null) ?? null,
      actorName: (r.actor_name as string | null) ?? null,
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    }));
  }

  /** Hodinový běh: přechody stavu u všech firem (konec zkušební doby, splatnost). */
  async sweep(): Promise<number> {
    const rows = (await this.dataSource.query(
      `SELECT tenant_id FROM tenant_subscriptions
        WHERE status IN ('trialing','active','past_due') AND period_end IS NOT NULL
          AND period_end < $1::date`,
      [pragueToday()],
    )) as { tenant_id: string }[];
    for (const r of rows) {
      try {
        await this.get(r.tenant_id);
      } catch (e) {
        this.logger.warn(`Přechod předplatného ${r.tenant_id} selhal: ${(e as Error).message}`);
      }
    }
    return rows.length;
  }

  // --- Projekce do organization_modules ---

  /**
   * Zapíše `allowed` pro všechny řízené moduly/funkce firmy (úroveň ⊕ výjimka) a
   * invaliduje authz cache. Nové řádky mají volbu vlastníka `active`.
   */
  async project(tenantId: string): Promise<void> {
    const rows = await this.dataSource.query(
      `SELECT ${SUB_COLUMNS} FROM tenant_subscriptions WHERE tenant_id = $1`,
      [tenantId],
    );
    if (!rows.length) return;
    const sub = mapSub(rows[0]);
    const plan = await this.plan(effectivePlanKey(sub)).catch(() => null);
    const allowed = allowedEntitlements(plan, sub.entitlementOverrides);
    const keys = Object.keys(allowed);
    const values = keys.map((k) => allowed[k as EntitlementKey]);
    const write = (m: EntityManager) =>
      m.query(
        `INSERT INTO organization_modules (tenant_id, module_key, state, allowed)
         SELECT $1, k, 'active', a FROM unnest($2::text[], $3::boolean[]) AS t(k, a)
         ON CONFLICT (tenant_id, module_key) DO UPDATE SET allowed = EXCLUDED.allowed, updated_at = now()
           WHERE organization_modules.allowed IS DISTINCT FROM EXCLUDED.allowed`,
        [tenantId, keys, values],
      );
    if (this.context.tenantId === tenantId) await write(this.context.manager);
    else await this.context.runInTenant(tenantId, () => write(this.context.manager));
    this.authz.invalidateModules(tenantId);
  }

  // --- interní ---

  private async persistState(
    tenantId: string,
    cur: TenantSubscription,
    next: SubscriptionState,
    type: string,
    actorUserId: string | null,
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    const merged: TenantSubscription = {
      ...cur,
      ...next,
      priceAmount: next.planKey !== cur.planKey ? null : cur.priceAmount,
    };
    await this.write(merged);
    await this.event(tenantId, type, { ...extra, ...diff(cur, merged) }, actorUserId);
    if (effectivePlanKey(cur) !== effectivePlanKey(merged) || cur.planKey !== merged.planKey)
      await this.project(tenantId);
  }

  private async write(s: TenantSubscription): Promise<void> {
    await this.dataSource.query(
      `UPDATE tenant_subscriptions SET plan_key=$2, status=$3, period_start=$4, period_end=$5,
         billing_period=$6, price_amount=$7, limit_overrides=$8, entitlement_overrides=$9,
         billing_details=$10, cancel_at_period_end=$11, note=$12, updated_at=now()
       WHERE tenant_id=$1`,
      [
        s.tenantId,
        s.planKey,
        s.status,
        s.periodStart,
        s.periodEnd,
        s.billingPeriod,
        s.priceAmount,
        JSON.stringify(s.limitOverrides),
        JSON.stringify(s.entitlementOverrides),
        JSON.stringify(s.billingDetails),
        s.cancelAtPeriodEnd,
        s.note,
      ],
    );
  }

  async event(
    tenantId: string,
    type: string,
    data: Record<string, unknown>,
    actorUserId: string | null,
  ): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO tenant_subscription_events (tenant_id, type, data, actor_user_id) VALUES ($1,$2,$3,$4)`,
      [tenantId, type, JSON.stringify(data), actorUserId],
    );
  }

  private async platformAudit(
    tenantId: string | null,
    type: string,
    data: Record<string, unknown>,
    actorUserId: string | null,
  ): Promise<void> {
    this.logger.log(`${type} ${JSON.stringify(data)} (actor ${actorUserId ?? '-'})`);
    if (tenantId) await this.event(tenantId, type, data, actorUserId);
  }
}

const SUPPLIER_KEYS = ['name', 'ico', 'dic', 'address', 'email', 'iban', 'bankAccount'] as const;

/** Jen známé textové údaje dodavatele (IBAN bez mezer, velkými). */
function cleanSupplier(raw: unknown): Partial<PlatformSettings['supplier']> {
  const out: Partial<PlatformSettings['supplier']> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const k of SUPPLIER_KEYS) {
    const v = (raw as Record<string, unknown>)[k];
    if (typeof v !== 'string') continue;
    out[k] = k === 'iban' ? v.replace(/\s+/g, '').toUpperCase() : v.trim().slice(0, 300);
  }
  if (out.iban && !/^[A-Z]{2}[0-9A-Z]{13,32}$/.test(out.iban))
    throw new BadRequestException('Neplatný IBAN');
  return out;
}

/** Změněná pole (pro historii). */
function diff(a: TenantSubscription, b: TenantSubscription): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(b) as (keyof TenantSubscription)[]) {
    if (k === 'updatedAt' || k === 'tenantId') continue;
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out[k] = { from: a[k], to: b[k] };
  }
  return out;
}
