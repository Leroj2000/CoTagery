'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Check, Copy } from 'lucide-react';

interface Created {
  tenant: { id: string; name: string; slug: string };
  owner: { email: string; name: string; tempPassword: string };
}

const input =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10';

const TYPES: { value: string; label: string }[] = [
  { value: 'mixed', label: 'Smíšená' },
  { value: 'retail', label: 'Retail' },
  { value: 'event', label: 'Eventy' },
  { value: 'rental', label: 'Půjčovna' },
  { value: 'home', label: 'Domácnost' },
];

/** Založení nové firmy platform-adminem – vrátí dočasné heslo OWNERa k předání. */
export function CreateTenant() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', type: 'mixed', ownerName: '', ownerEmail: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: string): void {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/platform/tenants', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError((data as { message?: string }).message ?? 'Založení selhalo.');
        return;
      }
      setCreated(data as Created);
      setForm({ name: '', type: 'mixed', ownerName: '', ownerEmail: '' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    const creds = `Firma: ${created.tenant.name}\nPřihlášení: ${created.owner.email}\nHeslo: ${created.owner.tempPassword}`;
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-800">
          <Check size={16} /> Firma „{created.tenant.name}" založena
        </div>
        <p className="text-sm text-emerald-800">
          Předej OWNERovi tyto přihlašovací údaje — <strong>heslo se zobrazí jen teď</strong>:
        </p>
        <div className="mt-3 rounded-lg border border-emerald-200 bg-white p-3 text-sm">
          <div>
            Přihlášení: <span className="font-medium">{created.owner.email}</span>
          </div>
          <div>
            Dočasné heslo: <span className="font-mono font-medium">{created.owner.tempPassword}</span>
          </div>
          <div className="text-xs text-slate-400">Veřejná stránka: /pujcovna/{created.tenant.slug}</div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => {
              navigator.clipboard?.writeText(creds);
              setCopied(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-50"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Zkopírováno' : 'Kopírovat údaje'}
          </button>
          <button
            onClick={() => {
              setCreated(null);
              setCopied(false);
            }}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Založit další
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <h3 className="mb-4 text-sm font-semibold text-slate-700">Nová firma</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Název firmy *</span>
          <input className={input} value={form.name} onChange={(e) => set('name', e.target.value)} required />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Typ</span>
          <select className={input} value={form.type} onChange={(e) => set('type', e.target.value)}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Jméno OWNERa *</span>
          <input className={input} value={form.ownerName} onChange={(e) => set('ownerName', e.target.value)} required />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">E-mail OWNERa *</span>
          <input type="email" className={input} value={form.ownerEmail} onChange={(e) => set('ownerEmail', e.target.value)} required />
        </label>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Založit firmu
      </button>
    </form>
  );
}
