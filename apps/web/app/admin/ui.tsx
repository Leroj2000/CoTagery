import type { ReactNode } from 'react';

/** Karta se sekcí (nadpis + volitelná akce/popis). Server-safe. */
export function Section({
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
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="mb-4 flex items-start justify-between gap-3">
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

/** Hlavička stránky s ikonou, popisem a volitelnou akcí. */
export function PageHeader({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {icon && (
          <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            {icon}
          </span>
        )}
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/** Statistická dlaždice na dashboard. */
export function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
        {icon && (
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            {icon}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </div>
  );
}

/** Prázdný stav v kartě. */
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-400">
      {children}
    </div>
  );
}

/** Tabulka se zebra řádky a hover. `rows` je pole polí buněk. */
export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  if (rows.length === 0) {
    return <EmptyState>Zatím žádné záznamy.</EmptyState>;
  }
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-[11px] font-medium uppercase tracking-wide text-slate-400">
            {head.map((h) => (
              <th key={h} className="px-3 py-2.5">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/70">
              {cells.map((c, j) => (
                <td key={j} className="px-3 py-2.5 align-middle text-slate-700">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type BadgeTone = 'neutral' | 'brand' | 'green' | 'red' | 'amber' | 'slate';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-600 ring-slate-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
};

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: BadgeTone }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

/** Badge s tónem odvozeným od stavu (active/expired/…). */
export function StatusBadge({ status }: { status: string }) {
  const tone: BadgeTone =
    status === 'active' || status === 'paid'
      ? 'green'
      : status === 'expired' || status === 'canceled' || status === 'cancelled' || status === 'past_due'
        ? 'red'
        : status === 'suspended' || status === 'trialing' || status === 'incomplete' || status === 'open'
          ? 'amber'
          : 'slate';
  return <Badge tone={tone}>{status}</Badge>;
}

export function Mono({ children }: { children: ReactNode }) {
  return <span className="font-mono text-xs text-slate-500">{children}</span>;
}
