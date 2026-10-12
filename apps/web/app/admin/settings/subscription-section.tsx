import { CheckCircle2, FileText, Mail } from 'lucide-react';
import {
  PLAN_FEATURES,
  PLAN_LIMITS,
  PLAN_MODULES,
  SUBSCRIPTION_STATUS_LABELS,
} from '@tagery/shared';
import { Badge, Section } from '../ui';
import {
  INVOICE_STATUS,
  STATUS_TONE,
  fmtDay,
  fmtLimit,
  fmtMoney,
  type TenantSubscriptionView,
} from '../../lib/platform';

const LABEL = new Map<string, string>(
  [...PLAN_FEATURES, ...PLAN_MODULES].map((m) => [m.key, m.label]),
);

/**
 * Nastavení → Předplatné (čtení): úroveň, platnost, využití limitů, co úroveň
 * obsahuje, faktury a kontakt pro změnu. Mění jen správce platformy Tagery.
 */
export function SubscriptionSection({
  view,
  canSeeInvoices,
}: {
  view: TenantSubscriptionView;
  canSeeInvoices: boolean;
}) {
  const s = view.subscription;
  const included = view.entitlements.filter((e) => e.allowed).map((e) => LABEL.get(e.key) ?? e.key);
  const mail = view.contact.email
    ? `mailto:${view.contact.email}?subject=${encodeURIComponent('Změna předplatného Tagery')}`
    : null;

  return (
    <Section
      title="Předplatné"
      description="Úroveň určuje dostupné funkce a limity. Změnu provádí správce Tagery."
      action={
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-800">{view.plan.name}</span>
          <Badge tone={STATUS_TONE[s.status]}>{SUBSCRIPTION_STATUS_LABELS[s.status]}</Badge>
        </span>
      }
    >
      <div className="flex flex-col gap-5">
        <p className="text-sm text-slate-600">
          {s.periodEnd ? (
            <>
              {s.status === 'trialing' ? 'Zkušební doba' : 'Zaplaceno'} do{' '}
              <strong>{fmtDay(s.periodEnd)}</strong>
              {view.daysLeft != null &&
                view.daysLeft >= 0 &&
                ` (zbývá ${view.daysLeft} ${view.daysLeft === 1 ? 'den' : view.daysLeft < 5 ? 'dny' : 'dní'})`}
              {s.status === 'trialing' && ' – potom přejdete na Free, data zůstanou.'}
            </>
          ) : (
            'Bez omezení doby platnosti.'
          )}
        </p>
        {view.effectivePlan.key !== view.plan.key && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
            Předplatné je {SUBSCRIPTION_STATUS_LABELS[s.status].toLowerCase()} – dočasně platí
            úroveň {view.effectivePlan.name}. Data zůstávají, jen nejde zakládat nad její limity.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PLAN_LIMITS.map((l) => {
            const u = view.usage.find((x) => x.key === l.key);
            const used = u?.used ?? 0;
            const limit = u?.limit ?? null;
            const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
            return (
              <div key={l.key} className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs text-slate-500">{l.label}</p>
                <p
                  className={`text-sm font-semibold ${limit != null && used >= limit ? 'text-red-700' : 'text-slate-800'}`}
                >
                  {used.toLocaleString('cs-CZ')} / {fmtLimit(limit)}
                </p>
                {limit != null && (
                  <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <span
                      className={`block h-full ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-brand-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {included.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Obsahuje
            </p>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700">
              {included.map((label) => (
                <li key={label} className="inline-flex items-center gap-1">
                  <CheckCircle2 size={14} className="text-emerald-600" /> {label}
                </li>
              ))}
            </ul>
          </div>
        )}

        {view.publicPlans.length > 0 && (
          <details className="rounded-xl border border-slate-200 px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium text-slate-700">
              Porovnání úrovní
            </summary>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                    <th className="py-2 pr-3 font-medium">Úroveň</th>
                    <th className="py-2 pr-3 font-medium">Cena / měsíc</th>
                    {PLAN_LIMITS.slice(0, 3).map((l) => (
                      <th key={l.key} className="py-2 pr-3 font-medium">
                        {l.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {view.publicPlans.map((p) => (
                    <tr
                      key={p.key}
                      className={`border-b border-slate-100 last:border-0 ${p.key === view.plan.key ? 'bg-brand-50/60' : ''}`}
                    >
                      <td className="py-2 pr-3 font-medium text-slate-800">{p.name}</td>
                      <td className="py-2 pr-3 text-slate-600">
                        {p.priceMonth == null ? 'individuálně' : fmtMoney(p.priceMonth)}
                      </td>
                      {PLAN_LIMITS.slice(0, 3).map((l) => (
                        <td key={l.key} className="py-2 pr-3 text-slate-600">
                          {fmtLimit(p.limits[l.key] ?? null)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}

        {mail && (
          <a
            href={mail}
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Mail size={15} /> Požádat o změnu předplatného
          </a>
        )}

        {canSeeInvoices && view.invoices.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Faktury
            </p>
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {view.invoices.map((inv) => (
                <li key={inv.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
                  <a
                    href={`/api/subscription/invoices/${inv.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline"
                  >
                    <FileText size={14} /> {inv.number}
                  </a>
                  <span className="text-slate-500">{fmtDay(inv.issuedOn)}</span>
                  <span className="font-medium">{fmtMoney(inv.amountGross, inv.currency)}</span>
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
                  {inv.status === 'issued' && (
                    <span className="text-xs text-slate-500">splatnost {fmtDay(inv.dueOn)}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Section>
  );
}
