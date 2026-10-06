'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, X, Loader2 } from 'lucide-react';
import type { ActionState } from '../action-form';
import { updateLocation } from '../actions';
import {
  LOCATION_CATEGORIES,
  LOCATION_TYPES_BY_CATEGORY,
  categoryOfType,
  typeOptionsFor,
} from './location-types';

const selCls =
  'rounded border border-slate-300 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none';
const inpCls =
  'w-36 rounded border border-slate-300 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none';

/**
 * Inline editace místa s dvoukrokovým výběrem typu (kategorie → typ). Mřížku
 * u regálu/skříně řeší samostatný panel „Mřížka" v místě (nezdvojujeme ji zde).
 */
export function EditLocationForm({
  id,
  name,
  type,
  address,
  parentId,
  parentOptions,
}: {
  id: string;
  name: string;
  type: string;
  address: string | null;
  parentId: string | null;
  parentOptions: { value: string; label: string; type?: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateLocation, null);
  const [category, setCategory] = useState(categoryOfType(type));
  const [curType, setCurType] = useState(type);

  useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state?.ok, router]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
      >
        <Pencil size={12} /> Upravit
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="type" value={curType} />

      <label className="flex flex-col gap-0.5 text-[11px] text-slate-500">
        Název
        <input name="name" defaultValue={name} className={inpCls} />
      </label>

      <label className="flex flex-col gap-0.5 text-[11px] text-slate-500">
        Kategorie
        <select
          value={category}
          onChange={(e) => {
            const c = e.target.value;
            setCategory(c);
            setCurType((LOCATION_TYPES_BY_CATEGORY[c] ?? [])[0]?.value ?? curType);
          }}
          className={selCls}
        >
          {LOCATION_CATEGORIES.filter((c) => type !== 'access_point' || c.value === 'access').map(
            (c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ),
          )}
        </select>
      </label>

      {type !== 'access_point' && (
        <label className="flex flex-col gap-0.5 text-[11px] text-slate-500">
          Typ
          <select value={curType} onChange={(e) => setCurType(e.target.value)} className={selCls}>
            {typeOptionsFor(category, type).map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="flex flex-col gap-0.5 text-[11px] text-slate-500">
        Adresa
        <input name="address" defaultValue={address ?? ''} className={inpCls} />
      </label>

      <label className="flex flex-col gap-0.5 text-[11px] text-slate-500">
        Nadřazené
        <select
          name="parentId"
          defaultValue={parentId ?? ''}
          required={type === 'access_point'}
          className={selCls}
        >
          {parentOptions
            .filter(
              (o) =>
                o.value !== id &&
                (type !== 'access_point' ||
                  (o.value && !['box', 'shelf', 'rack', 'cabinet', 'cell'].includes(o.type ?? ''))),
            )
            .map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
        </select>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {pending && <Loader2 size={12} className="animate-spin" />} Uložit
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
      >
        <X size={12} /> Zrušit
      </button>
      {state?.error && <span className="w-full text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
