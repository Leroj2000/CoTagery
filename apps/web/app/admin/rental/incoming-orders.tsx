'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Inbox, Loader2 } from 'lucide-react';

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
  renterNote: string | null;
  paymentVs: string;
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

type Action = { action: string; label: string; primary?: boolean; danger?: boolean };

/** Akce nabídnuté podle stavu (mapuje na POST …/transition). */
function actionsFor(status: string): Action[] {
  switch (status) {
    case 'awaiting_payment':
      return [
        { action: 'confirm_payment', label: 'Potvrdit platbu', primary: true },
        { action: 'cancel', label: 'Zrušit', danger: true },
      ];
    case 'paid':
    case 'confirmed':
      return [
        { action: 'pickup', label: 'Předat věc', primary: true },
        { action: 'cancel', label: 'Zrušit', danger: true },
      ];
    case 'picked_up':
      return [{ action: 'return', label: 'Přijmout vrácení', primary: true }];
    case 'returned':
      return [{ action: 'complete', label: 'Dokončit', primary: true }];
    default:
      return [];
  }
}

function money(v: string, currency: string): string {
  return `${Number(v).toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} ${currency}`;
}

/** Příchozí objednávky půjčovny + akce lifecyclu (EPIC-19 F3). */
export function IncomingOrders({ orders }: { orders: OwnerOrder[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(o: OwnerOrder, action: string): Promise<void> {
    const body: { action: string; depositReturned?: string } = { action };
    if (action === 'return') {
      const def = o.depositAmount;
      const input = window.prompt(
        `Kolik z kauce (${money(o.depositAmount, o.currency)}) vrátit nájemci? Zbytek = sražená škoda.`,
        def,
      );
      if (input === null) return;
      body.depositReturned = input.trim() || def;
    } else if (action === 'cancel' && !window.confirm('Opravdu zrušit objednávku?')) {
      return;
    }
    setBusy(o.id);
    setError(null);
    try {
      const res = await fetch(`/api/rental-orders/${o.id}/transition`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        router.refresh();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      setError(data.message ?? 'Akce selhala.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Inbox size={16} /> Příchozí objednávky
        {orders.length > 0 && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{orders.length}</span>
        )}
      </div>
      {error && <p className="mb-3 text-xs text-red-600">{error}</p>}
      {orders.length === 0 ? (
        <p className="text-sm text-slate-400">Zatím žádné objednávky.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((o) => {
            const s = STATUS_LABEL[o.status] ?? { label: o.status, cls: 'bg-slate-100 text-slate-600' };
            const actions = actionsFor(o.status);
            return (
              <div key={o.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900">{o.listingTitle}</div>
                    <div className="text-xs text-slate-400">
                      {o.assetName} · VS {o.paymentVs}
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}>{s.label}</span>
                </div>
                <div className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                  <div className="text-slate-600">
                    {o.renterName} <span className="text-xs text-slate-400">({o.renterEmail})</span>
                  </div>
                  <div className="text-slate-600 sm:text-right">
                    {o.startsAt.slice(0, 10)} – {o.endsAt.slice(0, 10)}{' '}
                    <span className="text-xs text-slate-400">({o.days} dní)</span>
                  </div>
                </div>
                {o.renterNote && (
                  <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">„{o.renterNote}"</p>
                )}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <span className="text-base font-semibold text-slate-900">{money(o.total, o.currency)}</span>
                  <div className="flex gap-2">
                    {actions.map((a) => (
                      <button
                        key={a.action}
                        onClick={() => act(o, a.action)}
                        disabled={busy === o.id}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50 ${
                          a.primary
                            ? 'bg-brand-600 text-white hover:bg-brand-700'
                            : a.danger
                              ? 'border border-red-200 text-red-600 hover:bg-red-50'
                              : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {busy === o.id && a.primary && <Loader2 size={14} className="animate-spin" />}
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
