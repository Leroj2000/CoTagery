'use client';

import { useActionState, useState } from 'react';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { createLocation } from '../actions';
import type { ActionState } from '../action-form';
import { LOCATION_CATEGORIES, LOCATION_TYPES_BY_CATEGORY, cellLabel } from './location-types';

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10';

const CATEGORIES = LOCATION_CATEGORIES;
const TYPES = LOCATION_TYPES_BY_CATEGORY;

/**
 * Zakládání místa dvoukrokově: kategorie (Místo / Úložný prostor) → konkrétní typ.
 * U úložného prostoru (Regál/Skříň) se rovnou zadá mřížka (řady × sloupce) s živým
 * náhledem; buňky se vygenerují při vytvoření.
 */
export function NewLocationForm({
  parentOptions,
}: {
  parentOptions: { value: string; label: string }[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createLocation, null);
  const [category, setCategory] = useState('place');
  const [type, setType] = useState('warehouse');
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);

  const isStorage = category === 'storage';

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Název" required>
          <input name="name" required placeholder="Sklad Praha" className={inputCls} />
        </Field>

        <Field label="Kategorie">
          <select
            value={category}
            onChange={(e) => {
              const c = e.target.value;
              setCategory(c);
              setType(TYPES[c][0].value);
            }}
            className={inputCls}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Typ">
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className={inputCls}
          >
            {TYPES[category].map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Nadřazené místo">
          <select name="parentId" className={inputCls} defaultValue="">
            {parentOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {isStorage && (
        <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-4">
          <p className="mb-3 text-sm font-medium text-slate-700">
            Rozdělení {type === 'cabinet' ? 'skříně' : 'regálu'} na police
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-slate-500">
              Řady (police)
              <input
                type="number"
                name="gridRows"
                min={1}
                max={26}
                value={rows}
                onChange={(e) => setRows(Math.max(1, Math.min(26, Number(e.target.value) || 1)))}
                className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
              />
            </label>
            <span className="pb-2 text-slate-400">×</span>
            <label className="flex flex-col gap-1 text-xs text-slate-500">
              Sloupce
              <input
                type="number"
                name="gridCols"
                min={1}
                max={26}
                value={cols}
                onChange={(e) => setCols(Math.max(1, Math.min(26, Number(e.target.value) || 1)))}
                className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
              />
            </label>
          </div>

          {/* Živý náhled mřížky (buňky se založí až při vytvoření). */}
          <div
            className="mt-3 grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(40px, 1fr))` }}
          >
            {Array.from({ length: rows }).flatMap((_, ri) =>
              Array.from({ length: cols }).map((__, ci) => (
                <span
                  key={`${ri}-${ci}`}
                  className="flex h-10 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-xs font-semibold text-slate-400"
                >
                  {cellLabel(ri + 1, ci + 1)}
                </span>
              )),
            )}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Náhled – {rows}×{cols} = {rows * cols} polic. Vygeneruje se při vytvoření.
          </p>
        </div>
      )}

      {state?.error && (
        <p className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle size={15} /> {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <CheckCircle2 size={15} /> {state.message}
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
        >
          {pending && <Loader2 size={15} className="animate-spin" />}
          {pending ? 'Vytvářím…' : 'Vytvořit místo'}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-slate-600">
        {label}
        {required && <span className="text-brand-600"> *</span>}
      </label>
      {children}
    </div>
  );
}
