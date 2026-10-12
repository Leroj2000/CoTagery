/** Předplatné firem (EPIC-20) – typy odpovědí API sdílené Platformou a Nastavením firmy. */
import type {
  EntitlementKey,
  EntitlementLock,
  LimitKey,
  PlanDefinition,
  PlanLimits,
  SubscriptionStatus,
} from '@tagery/shared';

export type { PlanDefinition, SubscriptionStatus };

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
  entitlementOverrides: Record<string, 'enabled' | 'disabled'>;
  billingDetails: { name?: string; ico?: string; dic?: string; address?: string; email?: string };
  cancelAtPeriodEnd: boolean;
  note: string | null;
  updatedAt: string;
}

export interface EntitlementView {
  key: EntitlementKey;
  allowed: boolean;
  inPlan: boolean;
  override: 'enabled' | 'disabled' | null;
  lock: EntitlementLock;
}

export interface SubscriptionOverview {
  subscription: TenantSubscription;
  plan: PlanDefinition;
  effectivePlan: PlanDefinition;
  limits: Record<LimitKey, number | null>;
  entitlements: EntitlementView[];
  daysLeft: number | null;
  graceDays: number;
}

export interface LimitUsage {
  key: LimitKey;
  limit: number | null;
  used: number;
}

export interface PlatformInvoice {
  id: string;
  number: string;
  variableSymbol: string;
  issuedOn: string;
  dueOn: string;
  periodFrom: string | null;
  periodTo: string | null;
  description: string;
  amountNet: number;
  vatRate: number | null;
  amountGross: number;
  currency: string;
  status: 'issued' | 'paid' | 'canceled';
  paidOn: string | null;
}

export interface SubscriptionEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
  actorName: string | null;
  createdAt: string;
}

export interface TenantSummary {
  id: string;
  name: string;
  type: string;
  slug: string | null;
  userCount: number;
  assetCount: number;
  createdAt: string;
  planKey: string | null;
  planName: string | null;
  subscriptionStatus: SubscriptionStatus | null;
  periodEnd: string | null;
}

export interface TenantDetail {
  tenant: {
    id: string;
    name: string;
    slug: string | null;
    type: string;
    createdAt: string;
    owner: { name: string; email: string } | null;
  };
  overview: SubscriptionOverview;
  usage: LimitUsage[];
  events: SubscriptionEvent[];
  invoices: PlatformInvoice[];
  invoiceDraft: {
    description: string;
    amountNet: number;
    periodFrom: string | null;
    periodTo: string | null;
    issuedOn: string;
    dueOn: string;
  };
  plans: PlanDefinition[];
  ownerStates: Record<string, 'active' | 'inactive'>;
}

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

/** Pohled firmy na vlastní předplatné (`GET /subscription`). */
export interface TenantSubscriptionView extends SubscriptionOverview {
  usage: LimitUsage[];
  invoices: PlatformInvoice[];
  publicPlans: PlanDefinition[];
  contact: { name: string; email: string };
}

export const STATUS_TONE: Record<
  SubscriptionStatus,
  'green' | 'amber' | 'red' | 'slate' | 'brand'
> = {
  trialing: 'brand',
  active: 'green',
  past_due: 'amber',
  suspended: 'red',
  canceled: 'slate',
};

export const INVOICE_STATUS: Record<PlatformInvoice['status'], string> = {
  issued: 'Vystavena',
  paid: 'Zaplacena',
  canceled: 'Stornována',
};

export const EVENT_LABELS: Record<string, string> = {
  migrated: 'Převedeno na předplatné',
  trial_started: 'Zahájena zkušební doba',
  updated: 'Upraveno',
  extended: 'Prodlouženo',
  lifecycle: 'Automatická změna stavu',
  paid: 'Zaplaceno',
  invoice_issued: 'Vystavena faktura',
  invoice_paid: 'Faktura zaplacena',
  invoice_canceled: 'Faktura stornována',
};

/** `YYYY-MM-DD` → `1. 3. 2026`. */
export function fmtDay(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d}. ${m}. ${y}`;
}

export function fmtMoney(n: number | null | undefined, currency = 'CZK'): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency }).format(n);
}

export function fmtLimit(n: number | null | undefined): string {
  return n == null ? '∞' : n.toLocaleString('cs-CZ');
}
