'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Loader2, Tag } from 'lucide-react';
import type { PersonCategory } from '../../lib/types';

/** Správa číselníku kategorií osob – přidání/mazání (podsekce v „Lidé"). */
export function PersonCategoriesManager({ categories }: { categories: PersonCategory[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    const res = await fetch('/api/person-categories', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    });
    setBusy(false);
    if (res.ok) {
      setName('');
      router.refresh();
    } else {
      setError(res.status === 409 ? 'Kategorie už existuje.' : 'Přidání se nepovedlo.');
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/person-categories/${id}`, { method: 'DELETE' });
    if (res.ok) router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {categories.length === 0 && (
          <span className="text-sm text-slate-400">Zatím žádné kategorie.</span>
        )}
        {categories.map((c) => (
          <span
            key={c.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 py-1 pl-3 pr-1.5 text-sm text-slate-700"
          >
            <Tag size={12} className="text-slate-400" />
            {c.name}
            <button
              onClick={() => remove(c.id)}
              aria-label={`Smazat ${c.name}`}
              className="rounded-full p-0.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
            >
              <X size={13} />
            </button>
          </span>
        ))}
      </div>

      <form onSubmit={add} className="flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nová kategorie (např. Subdodavatel, VIP…)"
          className="w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10"
        />
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Přidat
        </button>
      </form>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
