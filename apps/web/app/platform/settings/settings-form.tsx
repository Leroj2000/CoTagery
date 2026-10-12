'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import type { PlatformSettings } from '../../lib/platform';

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10';

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {children}
      {hint && <span className="text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

export function SettingsForm({ settings }: { settings: PlatformSettings }) {
  const router = useRouter();
  const [s, setS] = useState({
    trialDays: String(settings.trialDays),
    graceDays: String(settings.graceDays),
    invoiceDueDays: String(settings.invoiceDueDays),
    vatPayer: settings.vatPayer,
    vatRate: String(settings.vatRate),
  });
  const [supplier, setSupplier] = useState({ bankAccount: '', ...settings.supplier });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch('/api/platform/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        trialDays: Number(s.trialDays),
        graceDays: Number(s.graceDays),
        invoiceDueDays: Number(s.invoiceDueDays),
        vatPayer: s.vatPayer,
        vatRate: Number(s.vatRate),
        supplier,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setMsg({ ok: true, text: 'Uloženo.' });
      router.refresh();
    } else {
      const data = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
      setMsg({
        ok: false,
        text: (Array.isArray(data?.message) ? data?.message.join(', ') : data?.message) ?? 'Chyba',
      });
    }
  }

  const sup = (k: keyof typeof supplier, label: string, hint?: string) => (
    <Field label={label} hint={hint}>
      <input
        className={inputCls}
        value={supplier[k] ?? ''}
        onChange={(e) => setSupplier((x) => ({ ...x, [k]: e.target.value }))}
      />
    </Field>
  );

  return (
    <form onSubmit={save} className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
        <h2 className="text-sm font-semibold text-slate-800">Předplatné</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Zkušební doba nové firmy (dní)">
            <input
              type="number"
              min={0}
              className={inputCls}
              value={s.trialDays}
              onChange={(e) => setS((x) => ({ ...x, trialDays: e.target.value }))}
            />
          </Field>
          <Field label="Odklad po splatnosti (dní)" hint="Pak se předplatné pozastaví (Free).">
            <input
              type="number"
              min={0}
              className={inputCls}
              value={s.graceDays}
              onChange={(e) => setS((x) => ({ ...x, graceDays: e.target.value }))}
            />
          </Field>
          <Field label="Splatnost faktur (dní)">
            <input
              type="number"
              min={0}
              className={inputCls}
              value={s.invoiceDueDays}
              onChange={(e) => setS((x) => ({ ...x, invoiceDueDays: e.target.value }))}
            />
          </Field>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
        <h2 className="text-sm font-semibold text-slate-800">Dodavatel na fakturách</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {sup('name', 'Název')}
          {sup('email', 'E-mail')}
          {sup('ico', 'IČO')}
          {sup('dic', 'DIČ')}
          {sup('iban', 'IBAN', 'Pro QR platbu, např. CZ65 0800 0000 1920 0014 5399')}
          {sup('bankAccount', 'Číslo účtu (volitelně)', 'Např. 19-2000145399/0800')}
        </div>
        <Field label="Adresa">
          <textarea
            className={inputCls}
            rows={2}
            value={supplier.address}
            onChange={(e) => setSupplier((x) => ({ ...x, address: e.target.value }))}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={s.vatPayer}
              onChange={(e) => setS((x) => ({ ...x, vatPayer: e.target.checked }))}
            />
            Plátce DPH
          </label>
          {s.vatPayer && (
            <Field label="Sazba DPH (%)">
              <input
                type="number"
                min={0}
                max={100}
                className={inputCls}
                value={s.vatRate}
                onChange={(e) => setS((x) => ({ ...x, vatRate: e.target.value }))}
              />
            </Field>
          )}
        </div>
      </section>

      {msg && (
        <p className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-red-700'}`}>{msg.text}</p>
      )}
      <div>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
        >
          {busy && <Loader2 size={15} className="animate-spin" />} Uložit nastavení
        </button>
      </div>
    </form>
  );
}
