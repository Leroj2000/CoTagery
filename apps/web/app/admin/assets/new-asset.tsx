'use client';

import { useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { AssetForm } from './asset-form';

interface Option {
  value: string;
  label: string;
}

/** Zabalené přidání položky: jen tlačítko „Nová položka", které rozbalí formulář. */
export function NewAssetPanel({
  categories,
  locations,
}: {
  categories: Option[];
  locations: Option[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
      >
        <Plus size={16} /> Nová položka
        <ChevronDown size={15} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <AssetForm categories={categories} locations={locations} />
        </div>
      )}
    </div>
  );
}
