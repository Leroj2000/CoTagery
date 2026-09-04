'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Tag, Loader2 } from 'lucide-react';
import type { PersonCategory } from '../../lib/types';

/**
 * Zaškrtávací (many-to-many) editace kategorií u řádku (osoba/uživatel). Klik na
 * checkbox uloží celou novou sadu přes BFF `endpoint` (PATCH {categoryIds}) a
 * obnoví stránku.
 */
export function CategoryMultiEdit({
  endpoint,
  categories,
  value,
  disabled,
}: {
  endpoint: string;
  categories: PersonCategory[];
  value: string[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<string[]>(value);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setSel(value), [value]);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const byId = new Map(categories.map((c) => [c.id, c.name]));
  const label =
    sel.length === 0
      ? 'Bez kategorie'
      : sel.map((id) => byId.get(id)).filter(Boolean).join(', ');

  async function toggle(id: string) {
    const next = sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id];
    setSel(next);
    setBusy(true);
    const res = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ categoryIds: next }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else setSel(value); // rollback
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex max-w-[220px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 shadow-sm transition hover:border-brand-300 disabled:opacity-50"
      >
        <Tag size={12} className="shrink-0 text-slate-400" />
        <span className={`truncate ${sel.length === 0 ? 'text-slate-400' : ''}`}>{label}</span>
        {busy ? <Loader2 size={12} className="shrink-0 animate-spin" /> : <ChevronDown size={12} className="shrink-0 text-slate-400" />}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 max-h-64 w-56 overflow-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-elevate">
          {categories.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-slate-400">Zatím žádné kategorie.</p>
          ) : (
            categories.map((c) => (
              <label
                key={c.id}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={sel.includes(c.id)}
                  onChange={() => toggle(c.id)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                {c.name}
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}
