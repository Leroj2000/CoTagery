'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2, Plus, Eye, Trash2, Pencil, Globe, EyeOff } from 'lucide-react';

export interface Listing {
  id: string;
  assetId: string;
  status: 'draft' | 'published' | 'paused' | 'archived';
  title: string;
  slug: string;
  currency: string;
  pricePerDay: string;
  pricePerHour: string | null;
  pricePerWeek: string | null;
  depositAmount: string;
  minDays: number;
  maxDays: number | null;
  description: string | null;
  terms: string | null;
}

interface AssetOpt {
  id: string;
  name: string;
}

const input =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10';

const empty = {
  assetId: '',
  title: '',
  pricePerDay: '',
  pricePerHour: '',
  pricePerWeek: '',
  depositAmount: '',
  minDays: '1',
  maxDays: '',
  description: '',
  terms: '',
};

export function RentalManager({
  listings,
  assets,
  tenantSlug,
  canManage,
}: {
  listings: Listing[];
  assets: AssetOpt[];
  tenantSlug: string | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState({ ...empty });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: string): void {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function startEdit(l: Listing): void {
    setEditingId(l.id);
    setForm({
      assetId: l.assetId,
      title: l.title,
      pricePerDay: l.pricePerDay,
      pricePerHour: l.pricePerHour ?? '',
      pricePerWeek: l.pricePerWeek ?? '',
      depositAmount: l.depositAmount,
      minDays: String(l.minDays),
      maxDays: l.maxDays != null ? String(l.maxDays) : '',
      description: l.description ?? '',
      terms: l.terms ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function reset(): void {
    setEditingId(null);
    setForm({ ...empty });
    setError(null);
  }

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!editingId && !form.assetId) return setError('Vyber položku.');
    if (!form.pricePerDay || Number.isNaN(Number(form.pricePerDay)))
      return setError('Zadej cenu za den.');
    setBusy('save');
    const body = {
      assetId: form.assetId || undefined,
      title: form.title || undefined,
      pricePerDay: form.pricePerDay,
      pricePerHour: form.pricePerHour || undefined,
      pricePerWeek: form.pricePerWeek || undefined,
      depositAmount: form.depositAmount || '0',
      minDays: Number(form.minDays) || 1,
      maxDays: form.maxDays ? Number(form.maxDays) : undefined,
      description: form.description || undefined,
      terms: form.terms || undefined,
    };
    try {
      const res = await fetch(
        editingId ? `/api/rental-listings/${editingId}` : '/api/rental-listings',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        setError('Uložení selhalo.');
        return;
      }
      reset();
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function act(id: string, path: string, method = 'POST'): Promise<void> {
    setBusy(id);
    try {
      const res = await fetch(`/api/rental-listings/${id}${path}`, { method });
      if (res.ok) router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {canManage && (
        <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">
            {editingId ? 'Upravit inzerát' : 'Nový inzerát'}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {!editingId && (
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-xs font-medium text-slate-600">Položka</span>
                <select className={input} value={form.assetId} onChange={(e) => set('assetId', e.target.value)}>
                  <option value="">– vyber položku –</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-xs font-medium text-slate-600">Název (nepovinné, default = název položky)</span>
              <input className={input} value={form.title} onChange={(e) => set('title', e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Cena / den (Kč) *</span>
              <input className={input} inputMode="decimal" value={form.pricePerDay} onChange={(e) => set('pricePerDay', e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Kauce (Kč)</span>
              <input className={input} inputMode="decimal" value={form.depositAmount} onChange={(e) => set('depositAmount', e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Cena / hodina (nepovinné)</span>
              <input className={input} inputMode="decimal" value={form.pricePerHour} onChange={(e) => set('pricePerHour', e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Cena / týden (nepovinné)</span>
              <input className={input} inputMode="decimal" value={form.pricePerWeek} onChange={(e) => set('pricePerWeek', e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Min. dní</span>
              <input className={input} inputMode="numeric" value={form.minDays} onChange={(e) => set('minDays', e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Max. dní (nepovinné)</span>
              <input className={input} inputMode="numeric" value={form.maxDays} onChange={(e) => set('maxDays', e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-xs font-medium text-slate-600">Popis</span>
              <textarea className={input} rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-xs font-medium text-slate-600">Podmínky zapůjčení</span>
              <textarea className={input} rows={2} value={form.terms} onChange={(e) => set('terms', e.target.value)} />
            </label>
          </div>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={busy === 'save'} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
              {busy === 'save' ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              {editingId ? 'Uložit změny' : 'Vytvořit inzerát'}
            </button>
            {editingId && (
              <button type="button" onClick={reset} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
                Zrušit
              </button>
            )}
          </div>
        </form>
      )}

      <div className="flex flex-col gap-3">
        {listings.length === 0 ? (
          <p className="text-sm text-slate-400">Zatím žádné inzeráty.</p>
        ) : (
          listings.map((l) => {
            const published = l.status === 'published';
            return (
              <div key={l.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-slate-900">{l.title}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${published ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {published ? 'Publikováno' : 'Koncept'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {Number(l.pricePerDay).toLocaleString('cs-CZ')} {l.currency}/den
                    {Number(l.depositAmount) > 0 && ` · kauce ${Number(l.depositAmount).toLocaleString('cs-CZ')} ${l.currency}`}
                  </p>
                </div>
                {published && tenantSlug && (
                  <a href={`/pujcovna/${tenantSlug}/${l.slug}`} target="_blank" rel="noreferrer" title="Zobrazit veřejně" className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50">
                    <Eye size={15} />
                  </a>
                )}
                {canManage && (
                  <>
                    <button onClick={() => act(l.id, published ? '/unpublish' : '/publish')} disabled={busy === l.id} title={published ? 'Skrýt' : 'Publikovat'} className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                      {busy === l.id ? <Loader2 size={15} className="animate-spin" /> : published ? <EyeOff size={15} /> : <Globe size={15} />}
                    </button>
                    <button onClick={() => startEdit(l)} title="Upravit" className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => { if (confirm('Smazat inzerát?')) act(l.id, '', 'DELETE'); }} title="Smazat" className="rounded-lg border border-slate-300 p-2 text-red-600 hover:bg-slate-50">
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
