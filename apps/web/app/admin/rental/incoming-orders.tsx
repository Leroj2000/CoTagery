import { Inbox } from 'lucide-react';

export interface OwnerOrder {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  days: number;
  rentAmount: string;
  depositAmount: string;
  total: string;
  currency: string;
  listingTitle: string;
  assetName: string;
  renterName: string;
  renterEmail: string;
  createdAt: string;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  awaiting_payment: { label: 'Čeká na platbu', cls: 'bg-amber-50 text-amber-700' },
  paid: { label: 'Zaplaceno', cls: 'bg-emerald-50 text-emerald-700' },
  confirmed: { label: 'Potvrzeno', cls: 'bg-emerald-50 text-emerald-700' },
  picked_up: { label: 'Vyzvednuto', cls: 'bg-sky-50 text-sky-700' },
  returned: { label: 'Vráceno', cls: 'bg-slate-100 text-slate-600' },
  completed: { label: 'Dokončeno', cls: 'bg-slate-100 text-slate-600' },
  cancelled: { label: 'Zrušeno', cls: 'bg-red-50 text-red-600' },
  expired: { label: 'Vypršelo', cls: 'bg-red-50 text-red-600' },
};

function money(v: string, currency: string): string {
  return `${Number(v).toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} ${currency}`;
}

/** Příchozí objednávky půjčovny (EPIC-19 F2, read-only; lifecycle přijde ve F3). */
export function IncomingOrders({ orders }: { orders: OwnerOrder[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Inbox size={16} /> Příchozí objednávky
        {orders.length > 0 && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{orders.length}</span>
        )}
      </div>
      {orders.length === 0 ? (
        <p className="text-sm text-slate-400">Zatím žádné objednávky.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-2 pr-3 font-medium">Věc / inzerát</th>
                <th className="py-2 pr-3 font-medium">Nájemce</th>
                <th className="py-2 pr-3 font-medium">Termín</th>
                <th className="py-2 pr-3 font-medium">Stav</th>
                <th className="py-2 pl-3 text-right font-medium">Celkem</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const s = STATUS_LABEL[o.status] ?? { label: o.status, cls: 'bg-slate-100 text-slate-600' };
                return (
                  <tr key={o.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5 pr-3">
                      <div className="font-medium text-slate-900">{o.listingTitle}</div>
                      <div className="text-xs text-slate-400">{o.assetName}</div>
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="text-slate-700">{o.renterName}</div>
                      <div className="text-xs text-slate-400">{o.renterEmail}</div>
                    </td>
                    <td className="py-2.5 pr-3 text-slate-600">
                      {o.startsAt.slice(0, 10)} – {o.endsAt.slice(0, 10)}
                      <span className="text-xs text-slate-400"> ({o.days} dní)</span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}>{s.label}</span>
                    </td>
                    <td className="py-2.5 pl-3 text-right font-medium text-slate-900">
                      {money(o.total, o.currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
