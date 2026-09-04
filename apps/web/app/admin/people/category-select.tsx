'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PersonCategory } from '../../lib/types';

/**
 * Inline výběr kategorie u řádku (osoba nebo uživatel). Změna se uloží přes BFF
 * `endpoint` (PATCH {categoryId}) a stránka se obnoví.
 */
export function CategorySelect({
  endpoint,
  categories,
  value,
  disabled,
}: {
  endpoint: string;
  categories: PersonCategory[];
  value: string | null;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [val, setVal] = useState(value ?? '');
  const [busy, setBusy] = useState(false);

  async function change(next: string) {
    setVal(next);
    setBusy(true);
    const res = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ categoryId: next || null }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else setVal(value ?? ''); // rollback
  }

  return (
    <select
      value={val}
      disabled={disabled || busy}
      onChange={(e) => change(e.target.value)}
      className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 shadow-sm focus:border-brand-500 focus:outline-none disabled:opacity-50"
    >
      <option value="">— bez kategorie —</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
