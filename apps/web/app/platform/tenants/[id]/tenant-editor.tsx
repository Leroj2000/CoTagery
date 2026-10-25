'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarPlus, FileText, Loader2, Lock, Plus } from 'lucide-react';
import {
  PLAN_FEATURES,
  PLAN_LIMITS,
  PLAN_MODULES,
  SUBSCRIPTION_STATUS_LABELS,
  type LimitKey,
  type SubscriptionStatus,
} from '@tagery/shared';
import { Badge } from '../../../admin/ui';
import {
  EVENT_LABELS,
  INVOICE_STATUS,
  STATUS_TONE,
  fmtDay,
  fmtLimit,
  fmtMoney,
  type PlatformInvoice,
  type TenantDetail,
} from '../../../lib/platform';

const inputBase =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 disabled:bg-slate-50';
const inputCls = `${inputBase} w-full`;
const primaryBtn =
  'inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-50';
const secondaryBtn =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50';

const STATUSES = Object.keys(SUBSCRIPTION_STATUS_LABELS) as SubscriptionStatus[];
const EXTEND_PRESETS = [7, 14, 30, 90, 365];

/** Volání platform API přes BFF; chybu vrací jako text. */
async function call(path: string, method: 'POST' | 'PUT', body?: unknown): Promise<string | null> {
  const res = await fetch(`/api/platform/${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  if (res.ok) return null;
  const data = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  const msg = Array.isArray(data?.message) ? data?.message.join(', ') : data?.message;
  return msg || `Chyba ${res.status}`;
}

function addDays(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Čas v Praze, stejný na serveru i v prohlížeči (bez locale – žádný hydration rozdíl). */
function fmtDateTime(iso: string): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Prague',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return `${p.day}. ${p.month}. ${p.year} ${p.hour}:${p.minute}`;
}

function pragueToday(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague' }).format(new Date());
}

function Card({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {children}
      {hint && <span className="text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

function Feedback({ error, ok }: { error: string | null; ok?: string | null }) {
  if (error)
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-100">
        {error}
      </p>
    );
  if (ok) return <p className="text-sm text-emerald-700">{ok}</p>;
  return null;
}

/** Hook pro uložení se stavem (busy/chyba/úspěch) a obnovením stránky. */
function useSave() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  async function run(fn: () => Promise<string | null>, success = 'Uloženo.') {
    setBusy(true);
    setError(null);
    setOk(null);
    const err = await fn();
    setBusy(false);
    if (err) setError(err);
    else {
      setOk(success);
      router.refresh();
    }
  }
  return { busy, error, ok, run };
}

export function TenantEditor({ detail }: { detail: TenantDetail }) {
  return (
    <div className="flex flex-col gap-6">
      <SubscriptionCard detail={detail} />
      <LimitsCard detail={detail} />
      <EntitlementsCard detail={detail} />
      <InvoicesCard detail={detail} />
      <BillingDetailsCard detail={detail} />
      <HistoryCard detail={detail} />
    </div>
  );
}

// --- Předplatné ---

function SubscriptionCard({ detail }: { detail: TenantDetail }) {
  const { overview, plans, tenant } = detail;
  const s = overview.subscription;
  const [form, setForm] = useState({
    planKey: s.planKey,
    status: s.status,
    billingPeriod: s.billingPeriod,
    priceAmount: s.priceAmount == null ? '' : String(s.priceAmount),
    periodStart: s.periodStart ?? '',
    periodEnd: s.periodEnd ?? '',
    cancelAtPeriodEnd: s.cancelAtPeriodEnd,
    note: s.note ?? '',
  });
  const [days, setDays] = useState('30');
  const [priceTouched, setPriceTouched] = useState(false);
  const save = useSave();
  const extend = useSave();
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const plan = plans.find((p) => p.key === form.planKey);
  const daysNum = Number(days);
  const extendBase = s.periodEnd ?? pragueToday();
  const extendPreview =
    Number.isInteger(daysNum) && daysNum > 0 ? addDays(extendBase, daysNum) : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const price =
      form.priceAmount.trim() === '' ? null : Number(form.priceAmount.replace(',', '.'));
    if (price != null && !Number.isFinite(price)) return;
    // Mění se jen to, co se změnilo (změna úrovně předvyplní cenu a stav na serveru).
    const body: Record<string, unknown> = {};
    if (form.planKey !== s.planKey) body.planKey = form.planKey;
    if (form.status !== s.status) body.status = form.status;
    if (form.billingPeriod !== s.billingPeriod) body.billingPeriod = form.billingPeriod;
    // Cenu posílat jen při ruční změně – při změně úrovně ji jinak předvyplní ceník.
    if (priceTouched && price !== s.priceAmount) body.priceAmount = price;
    if ((form.periodStart || null) !== s.periodStart) body.periodStart = form.periodStart || null;
    if ((form.periodEnd || null) !== s.periodEnd) body.periodEnd = form.periodEnd || null;
    if (form.cancelAtPeriodEnd !== s.cancelAtPeriodEnd)
      body.cancelAtPeriodEnd = form.cancelAtPeriodEnd;
    if ((form.note || null) !== s.note) body.note = form.note || null;
    void save.run(() => call(`tenants/${tenant.id}/subscription`, 'PUT', body));
  }

  return (
    <Card
      title="Předplatné"
      description="Úroveň řídí moduly, funkce a limity. Změny se projeví hned."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-800">{overview.plan.name}</span>
          <Badge tone={STATUS_TONE[s.status]}>{SUBSCRIPTION_STATUS_LABELS[s.status]}</Badge>
          {overview.daysLeft != null && (
            <span className="text-xs text-slate-500">
              {overview.daysLeft >= 0
                ? `zbývá ${overview.daysLeft} dní`
                : `${-overview.daysLeft} dní po konci`}
            </span>
          )}
        </div>
      }
    >
      {overview.effectivePlan.key !== overview.plan.key && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
          Firma se teď řídí úrovní <strong>{overview.effectivePlan.name}</strong> (předplatné je{' '}
          {SUBSCRIPTION_STATUS_LABELS[s.status].toLowerCase()}). Prodloužením nebo změnou stavu se
          vrátí na {overview.plan.name}.
        </p>
      )}
      {s.status === 'past_due' && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
          Po splatnosti – po {overview.graceDays} dnech od konce období se předplatné pozastaví.
        </p>
      )}

      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Úroveň">
            <select
              className={inputCls}
              value={form.planKey}
              onChange={(e) => set('planKey', e.target.value)}
            >
              {plans.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Stav">
            <select
              className={inputCls}
              value={form.status}
              onChange={(e) => set('status', e.target.value as SubscriptionStatus)}
            >
              {STATUSES.map((st) => (
                <option key={st} value={st}>
                  {SUBSCRIPTION_STATUS_LABELS[st]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fakturace">
            <select
              className={inputCls}
              value={form.billingPeriod}
              onChange={(e) => set('billingPeriod', e.target.value as typeof form.billingPeriod)}
            >
              <option value="month">Měsíčně</option>
              <option value="year">Ročně</option>
              <option value="custom">Individuálně</option>
            </select>
          </Field>
          <Field
            label="Cena za období bez DPH (Kč)"
            hint={
              plan
                ? `Ceník ${plan.name}: ${fmtMoney(plan.priceMonth)} / měsíc, ${fmtMoney(plan.priceYear)} / rok`
                : undefined
            }
          >
            <input
              inputMode="decimal"
              className={inputCls}
              value={form.priceAmount}
              onChange={(e) => {
                setPriceTouched(true);
                set('priceAmount', e.target.value);
              }}
              placeholder="podle ceníku"
            />
          </Field>
          <Field label="Období od">
            <input
              type="date"
              className={inputCls}
              value={form.periodStart}
              onChange={(e) => set('periodStart', e.target.value)}
            />
          </Field>
          <Field label="Období do (včetně)" hint="Prázdné = bez konce">
            <input
              type="date"
              className={inputCls}
              value={form.periodEnd}
              onChange={(e) => set('periodEnd', e.target.value)}
            />
          </Field>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.cancelAtPeriodEnd}
            onChange={(e) => set('cancelAtPeriodEnd', e.target.checked)}
          />
          Zrušit ke konci období (pak firma přejde na Free)
        </label>
        <Field label="Interní poznámka (firma ji nevidí)">
          <textarea
            className={inputCls}
            rows={2}
            value={form.note}
            onChange={(e) => set('note', e.target.value)}
          />
        </Field>
        <Feedback error={save.error} ok={save.ok} />
        <div>
          <button type="submit" className={primaryBtn} disabled={save.busy}>
            {save.busy && <Loader2 size={15} className="animate-spin" />} Uložit předplatné
          </button>
        </div>
      </form>

      <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Prodloužit předplatné
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {EXTEND_PRESETS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(String(d))}
              className={`rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset ${
                daysNum === d
                  ? 'bg-brand-600 text-white ring-brand-600'
                  : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'
              }`}
            >
              {d} dní
            </button>
          ))}
          <input
            type="number"
            min={1}
            max={3660}
            className={`${inputBase} w-24`}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            aria-label="Počet dní"
          />
          <button
            type="button"
            className={secondaryBtn}
            disabled={extend.busy || !extendPreview}
            onClick={() =>
              void extend.run(
                () => call(`tenants/${tenant.id}/subscription/extend`, 'POST', { days: daysNum }),
                'Prodlouženo.',
              )
            }
          >
            {extend.busy ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <CalendarPlus size={15} />
            )}
            Prodloužit
          </button>
        </div>
        <p className="text-xs text-slate-500">
          {s.periodEnd
            ? `Navazuje na konec období ${fmtDay(s.periodEnd)}`
            : 'Bez konce období – počítá se od dneška'}
          {extendPreview && ` → nový konec ${fmtDay(extendPreview)}`}. Funguje i po splatnosti a u
          pozastaveného předplatného (vrátí ho do stavu Aktivní, zkušební doba zůstane zkušební).
        </p>
        <Feedback error={extend.error} ok={extend.ok} />
      </div>
    </Card>
  );
}

// --- Limity ---

function LimitsCard({ detail }: { detail: TenantDetail }) {
  const { overview, usage, tenant } = detail;
  const plan = overview.effectivePlan;
  const overrides = overview.subscription.limitOverrides;
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      PLAN_LIMITS.map((l) => {
        if (!Object.prototype.hasOwnProperty.call(overrides, l.key)) return [l.key, ''];
        const v = overrides[l.key];
        return [l.key, v == null ? 'unlimited' : String(v)];
      }),
    ),
  );
  const save = useSave();

  function submit() {
    const out: Record<string, number | null> = {};
    for (const l of PLAN_LIMITS) {
      const v = values[l.key].trim();
      if (v === '') continue;
      if (v === 'unlimited') out[l.key] = null;
      else {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 0) {
          void save.run(async () => `${l.label}: zadej celé číslo`);
          return;
        }
        out[l.key] = n;
      }
    }
    void save.run(() => call(`tenants/${tenant.id}/subscription`, 'PUT', { limitOverrides: out }));
  }

  return (
    <Card
      title="Využití a limity"
      description={`Podle úrovně ${plan.name}; výjimka platí jen pro tuto firmu. Prázdná výjimka = podle úrovně.`}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2 pr-3 font-medium">Limit</th>
              <th className="py-2 pr-3 font-medium">Úroveň</th>
              <th className="py-2 pr-3 font-medium">Výjimka</th>
              <th className="py-2 font-medium">Využito</th>
            </tr>
          </thead>
          <tbody>
            {PLAN_LIMITS.map((l) => {
              const u = usage.find((x) => x.key === l.key);
              const limit = overview.limits[l.key as LimitKey];
              const pct = limit ? Math.min(100, Math.round(((u?.used ?? 0) / limit) * 100)) : 0;
              const v = values[l.key];
              return (
                <tr key={l.key} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 pr-3 font-medium text-slate-800">{l.label}</td>
                  <td className="py-2.5 pr-3 text-slate-600">
                    {fmtLimit(plan.limits[l.key] ?? null)}
                  </td>
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2">
                      <input
                        inputMode="numeric"
                        className={`${inputBase} w-24`}
                        value={v === 'unlimited' ? '' : v}
                        disabled={v === 'unlimited'}
                        placeholder="—"
                        onChange={(e) => setValues((x) => ({ ...x, [l.key]: e.target.value }))}
                        aria-label={`Výjimka ${l.label}`}
                      />
                      <label className="inline-flex items-center gap-1 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={v === 'unlimited'}
                          onChange={(e) =>
                            setValues((x) => ({
                              ...x,
                              [l.key]: e.target.checked ? 'unlimited' : '',
                            }))
                          }
                        />
                        ∞
                      </label>
                    </div>
                  </td>
                  <td className="py-2.5">
                    <div className="flex min-w-[140px] flex-col gap-1">
                      <span
                        className={`text-xs ${limit != null && (u?.used ?? 0) >= limit ? 'font-semibold text-red-700' : 'text-slate-600'}`}
                      >
                        {(u?.used ?? 0).toLocaleString('cs-CZ')} / {fmtLimit(limit)}
                      </span>
                      {limit != null && (
                        <span className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <span
                            className={`block h-full ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-brand-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <Feedback error={save.error} ok={save.ok} />
        <div>
          <button type="button" className={primaryBtn} onClick={submit} disabled={save.busy}>
            {save.busy && <Loader2 size={15} className="animate-spin" />} Uložit výjimky limitů
          </button>
        </div>
      </div>
    </Card>
  );
}

// --- Moduly a funkce ---

function EntitlementsCard({ detail }: { detail: TenantDetail }) {
  const { overview, tenant, ownerStates } = detail;
  const [overrides, setOverrides] = useState<Record<string, '' | 'enabled' | 'disabled'>>(() =>
    Object.fromEntries(overview.entitlements.map((e) => [e.key, e.override ?? ''])),
  );
  const save = useSave();
  const byKey = new Map(overview.entitlements.map((e) => [e.key, e]));

  function submit() {
    const out = Object.fromEntries(Object.entries(overrides).filter(([, v]) => v));
    void save.run(() =>
      call(`tenants/${tenant.id}/subscription`, 'PUT', { entitlementOverrides: out }),
    );
  }

  const group = (
    title: string,
    items: readonly { key: string; label: string; description: string }[],
  ) => (
    <div className="flex flex-col gap-1">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
        {items.map((m) => {
          const e = byKey.get(m.key as never);
          const o = overrides[m.key] ?? '';
          const allowed = o === 'enabled' ? true : o === 'disabled' ? false : !!e?.inPlan;
          const owner = ownerStates[m.key] ?? 'active';
          return (
            <li
              key={m.key}
              className="flex flex-col gap-2 px-3 py-2.5 md:flex-row md:items-center md:gap-3"
            >
              <div className="min-w-0 md:flex-1">
                <p className="text-sm font-medium text-slate-800">{m.label}</p>
                <p className="text-xs text-slate-500">{m.description}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 md:flex-nowrap md:gap-3">
                <span className="w-24 shrink-0 text-xs text-slate-500">
                  {e?.inPlan ? 'v úrovni ✔' : 'mimo úroveň'}
                </span>
                <select
                  className={`${inputBase} w-40`}
                  value={o}
                  onChange={(ev) =>
                    setOverrides((x) => ({
                      ...x,
                      [m.key]: ev.target.value as '' | 'enabled' | 'disabled',
                    }))
                  }
                  aria-label={`Výjimka ${m.label}`}
                >
                  <option value="">Podle úrovně</option>
                  <option value="enabled">Povolit</option>
                  <option value="disabled">Zakázat</option>
                </select>
                <span className="flex w-32 shrink-0 flex-col items-start gap-0.5">
                  {allowed ? (
                    <Badge tone="green">Povoleno</Badge>
                  ) : (
                    <Badge tone="slate">
                      <Lock size={11} className="mr-1" /> Zamčeno
                    </Badge>
                  )}
                  {allowed && (
                    <span className="text-xs text-slate-400">
                      firma: {owner === 'active' ? 'zapnuto' : 'vypnuto'}
                    </span>
                  )}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <Card
      title="Moduly a funkce"
      description="Povolené si vlastník firmy zapíná a vypíná v Nastavení; zamčené nevidí ani nezapne."
    >
      <div className="flex flex-col gap-5">
        {group('Funkce Tagery Věcí', PLAN_FEATURES)}
        {group('Rozšíření', PLAN_MODULES)}
        <Feedback error={save.error} ok={save.ok} />
        <div>
          <button type="button" className={primaryBtn} onClick={submit} disabled={save.busy}>
            {save.busy && <Loader2 size={15} className="animate-spin" />} Uložit moduly
          </button>
        </div>
      </div>
    </Card>
  );
}

// --- Faktury ---

function InvoicesCard({ detail }: { detail: TenantDetail }) {
  const { invoices, invoiceDraft, tenant } = detail;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    description: invoiceDraft.description,
    amountNet: String(invoiceDraft.amountNet),
    periodFrom: invoiceDraft.periodFrom ?? '',
    periodTo: invoiceDraft.periodTo ?? '',
    issuedOn: invoiceDraft.issuedOn,
    dueOn: invoiceDraft.dueOn,
  });
  const create = useSave();
  const action = useSave();
  const set = <K extends keyof typeof form>(k: K, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(form.amountNet.replace(',', '.'));
    void create.run(
      () =>
        call(`tenants/${tenant.id}/invoices`, 'POST', {
          description: form.description,
          amountNet: amount,
          periodFrom: form.periodFrom || null,
          periodTo: form.periodTo || null,
          issuedOn: form.issuedOn,
          dueOn: form.dueOn,
        }),
      'Faktura vystavena.',
    );
    setOpen(false);
  }

  function paid(inv: PlatformInvoice) {
    const extend =
      !!inv.periodTo &&
      confirm(
        `Označit fakturu ${inv.number} jako zaplacenou.\n\nProdloužit předplatné do ${fmtDay(inv.periodTo)}? (Zrušit = jen označit zaplaceno)`,
      );
    void action.run(() => call(`invoices/${inv.id}/paid`, 'POST', { extend }), 'Zaplaceno.');
  }

  function cancel(inv: PlatformInvoice) {
    if (!confirm(`Stornovat fakturu ${inv.number}?`)) return;
    void action.run(() => call(`invoices/${inv.id}/cancel`, 'POST'), 'Stornováno.');
  }

  return (
    <Card
      title="Faktury"
      description="Ruční platba převodem s QR kódem. Po zaplacení se předplatné prodlouží do konce fakturovaného období."
      action={
        !open && (
          <button type="button" className={secondaryBtn} onClick={() => setOpen(true)}>
            <Plus size={14} /> Vystavit fakturu
          </button>
        )
      }
    >
      {open && (
        <form onSubmit={submit} className="mb-4 flex flex-col gap-4 rounded-xl bg-slate-50 p-4">
          <Field label="Popis">
            <input
              className={inputCls}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              required
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Částka bez DPH (Kč)">
              <input
                inputMode="decimal"
                className={inputCls}
                value={form.amountNet}
                onChange={(e) => set('amountNet', e.target.value)}
                required
              />
            </Field>
            <Field label="Období od">
              <input
                type="date"
                className={inputCls}
                value={form.periodFrom}
                onChange={(e) => set('periodFrom', e.target.value)}
              />
            </Field>
            <Field label="Období do">
              <input
                type="date"
                className={inputCls}
                value={form.periodTo}
                onChange={(e) => set('periodTo', e.target.value)}
              />
            </Field>
            <Field label="Vystaveno">
              <input
                type="date"
                className={inputCls}
                value={form.issuedOn}
                onChange={(e) => set('issuedOn', e.target.value)}
                required
              />
            </Field>
            <Field label="Splatnost">
              <input
                type="date"
                className={inputCls}
                value={form.dueOn}
                onChange={(e) => set('dueOn', e.target.value)}
                required
              />
            </Field>
          </div>
          <div className="flex gap-2">
            <button type="submit" className={primaryBtn} disabled={create.busy}>
              {create.busy && <Loader2 size={15} className="animate-spin" />} Vystavit
            </button>
            <button type="button" className={secondaryBtn} onClick={() => setOpen(false)}>
              Zrušit
            </button>
          </div>
        </form>
      )}
      <Feedback error={create.error ?? action.error} ok={create.ok ?? action.ok} />
      {invoices.length === 0 ? (
        <p className="text-sm text-slate-400">Zatím žádné faktury.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-2 pr-3 font-medium">Číslo</th>
                <th className="py-2 pr-3 font-medium">Vystaveno</th>
                <th className="py-2 pr-3 font-medium">Období</th>
                <th className="py-2 pr-3 font-medium">Částka</th>
                <th className="py-2 pr-3 font-medium">Stav</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 pr-3">
                    <a
                      href={`/api/platform/invoices/${inv.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline"
                    >
                      <FileText size={13} /> {inv.number}
                    </a>
                  </td>
                  <td className="py-2.5 pr-3 text-slate-600">
                    {fmtDay(inv.issuedOn)}
                    <span className="block text-xs text-slate-400">
                      splatnost {fmtDay(inv.dueOn)}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-slate-600">
                    {inv.periodFrom ? `${fmtDay(inv.periodFrom)} – ${fmtDay(inv.periodTo)}` : '—'}
                  </td>
                  <td className="py-2.5 pr-3 font-medium">
                    {fmtMoney(inv.amountGross, inv.currency)}
                  </td>
                  <td className="py-2.5 pr-3">
                    <Badge
                      tone={
                        inv.status === 'paid'
                          ? 'green'
                          : inv.status === 'canceled'
                            ? 'slate'
                            : 'amber'
                      }
                    >
                      {INVOICE_STATUS[inv.status]}
                    </Badge>
                    {inv.paidOn && (
                      <span className="block text-xs text-slate-400">{fmtDay(inv.paidOn)}</span>
                    )}
                  </td>
                  <td className="py-2.5 text-right">
                    {inv.status === 'issued' && (
                      <span className="inline-flex gap-1.5">
                        <button
                          type="button"
                          className={secondaryBtn}
                          onClick={() => paid(inv)}
                          disabled={action.busy}
                        >
                          Zaplaceno
                        </button>
                        <button
                          type="button"
                          className="rounded-lg px-2 py-1.5 text-sm text-red-600 hover:bg-red-50"
                          onClick={() => cancel(inv)}
                          disabled={action.busy}
                        >
                          Storno
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// --- Fakturační údaje ---

function BillingDetailsCard({ detail }: { detail: TenantDetail }) {
  const b = detail.overview.subscription.billingDetails;
  const [form, setForm] = useState({
    name: b.name ?? detail.tenant.name,
    ico: b.ico ?? '',
    dic: b.dic ?? '',
    address: b.address ?? '',
    email: b.email ?? detail.tenant.owner?.email ?? '',
  });
  const save = useSave();
  const set = <K extends keyof typeof form>(k: K, v: string) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Card title="Fakturační údaje odběratele" description="Tisknou se na faktury této firmy.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save.run(() =>
            call(`tenants/${detail.tenant.id}/subscription`, 'PUT', { billingDetails: form }),
          );
        }}
        className="flex flex-col gap-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Název / jméno">
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
            />
          </Field>
          <Field label="E-mail pro faktury">
            <input
              className={inputCls}
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
            />
          </Field>
          <Field label="IČO">
            <input
              className={inputCls}
              value={form.ico}
              onChange={(e) => set('ico', e.target.value)}
            />
          </Field>
          <Field label="DIČ">
            <input
              className={inputCls}
              value={form.dic}
              onChange={(e) => set('dic', e.target.value)}
            />
          </Field>
        </div>
        <Field label="Adresa">
          <textarea
            className={inputCls}
            rows={2}
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
          />
        </Field>
        <Feedback error={save.error} ok={save.ok} />
        <div>
          <button type="submit" className={primaryBtn} disabled={save.busy}>
            {save.busy && <Loader2 size={15} className="animate-spin" />} Uložit údaje
          </button>
        </div>
      </form>
    </Card>
  );
}

// --- Historie ---

/** Krátký popis změn z dat události. */
function describe(data: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === 'object' && 'to' in (v as object)) {
      const to = (v as { to: unknown }).to;
      const label: Record<string, string> = {
        planKey: 'úroveň',
        status: 'stav',
        periodEnd: 'konec',
        periodStart: 'začátek',
        priceAmount: 'cena',
        billingPeriod: 'fakturace',
        limitOverrides: 'limity',
        entitlementOverrides: 'moduly',
        billingDetails: 'fakturační údaje',
        note: 'poznámka',
        cancelAtPeriodEnd: 'zrušení ke konci',
      };
      if (!label[k]) continue;
      const val =
        k === 'status' && typeof to === 'string'
          ? (SUBSCRIPTION_STATUS_LABELS as Record<string, string>)[to]
          : k === 'periodEnd' || k === 'periodStart'
            ? fmtDay(to as string | null)
            : typeof to === 'object'
              ? ''
              : String(to ?? '—');
      parts.push(val ? `${label[k]}: ${val}` : label[k]);
    } else if (k === 'days') parts.push(`o ${String(v)} dní`);
    else if (k === 'number') parts.push(`č. ${String(v)}`);
    else if (k === 'invoice') parts.push(`faktura ${String(v)}`);
  }
  return parts.join(', ');
}

function HistoryCard({ detail }: { detail: TenantDetail }) {
  return (
    <Card title="Historie předplatného">
      {detail.events.length === 0 ? (
        <p className="text-sm text-slate-400">Žádné záznamy.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-slate-100 text-sm">
          {detail.events.map((e) => (
            <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2">
              <span className="w-36 shrink-0 text-xs text-slate-400">
                {fmtDateTime(e.createdAt)}
              </span>
              <span className="font-medium text-slate-800">{EVENT_LABELS[e.type] ?? e.type}</span>
              <span className="text-slate-600">{describe(e.data)}</span>
              <span className="ml-auto text-xs text-slate-400">{e.actorName ?? 'systém'}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
