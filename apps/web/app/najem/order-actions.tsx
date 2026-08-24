'use client';

import { useState } from 'react';
import { QrCode, AlertTriangle, Loader2, Check } from 'lucide-react';

interface Payment {
  iban: string;
  accountName: string | null;
  amount: string;
  currency: string;
  variableSymbol: string;
  message: string;
  spayd: string;
}

const btn =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50';

/** Akce nájemce nad objednávkou: platba (QR/SPAYD) + hlášení poškození (F3). */
export function RenterOrderActions({ orderId, status }: { orderId: string; status: string }) {
  const canPay = status === 'awaiting_payment';
  const canReport = ['picked_up', 'returned', 'completed'].includes(status);

  const [pay, setPay] = useState<Payment | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payErr, setPayErr] = useState<string | null>(null);

  const [reportOpen, setReportOpen] = useState(false);
  const [kind, setKind] = useState<'damage' | 'malfunction' | 'missing_part' | 'other'>('damage');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [reportErr, setReportErr] = useState<string | null>(null);
  const [reported, setReported] = useState(false);

  async function loadPayment(): Promise<void> {
    setPayOpen((o) => !o);
    if (pay) return;
    const res = await fetch(`/api/renter/orders/${orderId}/payment`);
    if (res.ok) setPay((await res.json()) as Payment);
    else setPayErr('Pokyny k platbě se nepodařilo načíst.');
  }

  async function submitReport(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!desc.trim()) return;
    setBusy(true);
    setReportErr(null);
    try {
      const res = await fetch(`/api/renter/orders/${orderId}/issue`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind, description: desc }),
      });
      if (res.ok) {
        setReported(true);
        setReportOpen(false);
        setDesc('');
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      setReportErr(data.message ?? 'Hlášení se nepodařilo odeslat.');
    } finally {
      setBusy(false);
    }
  }

  if (!canPay && !canReport && !reported) return null;

  const inputCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10';

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <div className="flex flex-wrap gap-2">
        {canPay && (
          <button onClick={loadPayment} className={btn}>
            <QrCode size={15} /> {payOpen ? 'Skrýt platbu' : 'Zaplatit (QR)'}
          </button>
        )}
        {canReport && !reported && (
          <button onClick={() => setReportOpen((o) => !o)} className={btn}>
            <AlertTriangle size={15} /> Nahlásit poškození
          </button>
        )}
        {reported && (
          <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
            <Check size={15} /> Poškození nahlášeno majiteli
          </span>
        )}
      </div>

      {canPay && payOpen && (
        <div className="mt-3 rounded-xl bg-slate-50 p-4">
          {payErr && <p className="text-xs text-red-600">{payErr}</p>}
          {pay ? (
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
              <img
                src={`/api/renter/orders/${orderId}/payment-qr`}
                alt="QR platba"
                width={160}
                height={160}
                className="rounded-lg border border-slate-200 bg-white p-2"
              />
              <div className="text-sm">
                <div className="text-slate-500">Naskenuj QR v bankovní aplikaci, nebo zaplať převodem:</div>
                <dl className="mt-2 space-y-1">
                  <div className="flex gap-2">
                    <dt className="w-24 text-slate-400">Účet (IBAN)</dt>
                    <dd className="font-medium text-slate-900">{pay.iban}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-24 text-slate-400">Částka</dt>
                    <dd className="font-medium text-slate-900">
                      {Number(pay.amount).toLocaleString('cs-CZ')} {pay.currency}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-24 text-slate-400">VS</dt>
                    <dd className="font-medium text-slate-900">{pay.variableSymbol}</dd>
                  </div>
                </dl>
                <p className="mt-2 text-xs text-slate-400">
                  Po zaplacení majitel platbu potvrdí – stav se změní na „Zaplaceno".
                </p>
              </div>
            </div>
          ) : (
            !payErr && <Loader2 size={16} className="animate-spin text-slate-400" />
          )}
        </div>
      )}

      {canReport && reportOpen && (
        <form onSubmit={submitReport} className="mt-3 rounded-xl bg-slate-50 p-4">
          <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
            <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={inputCls}>
              <option value="damage">Poškození</option>
              <option value="malfunction">Porucha</option>
              <option value="missing_part">Chybí část</option>
              <option value="other">Jiné</option>
            </select>
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Popiš, co se stalo…"
              className={inputCls}
              required
            />
          </div>
          {reportErr && <p className="mt-2 text-xs text-red-600">{reportErr}</p>}
          <button
            type="submit"
            disabled={busy}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy && <Loader2 size={15} className="animate-spin" />} Odeslat hlášení
          </button>
        </form>
      )}
    </div>
  );
}
