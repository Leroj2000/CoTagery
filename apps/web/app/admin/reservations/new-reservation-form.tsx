'use client';

import { useActionState, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import type { PlaceNode } from '../../lib/location-path';
import type { ActionState } from '../action-form';
import { createReservation } from '../actions';
import {
  CategorySelect,
  LocationSelect,
  makeAssetFilter,
  type AssetFacet,
  type FilterOption,
} from './reservation-filters';

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10';

/** Nový požadavek: výběr položky zúžený kategorií a skladem. */
export function NewReservationForm({
  assets,
  categories,
  locations,
  places,
  people,
  defaultRequestedById,
}: {
  assets: AssetFacet[];
  categories: FilterOption[];
  locations: FilterOption[];
  places: PlaceNode[];
  people: FilterOption[];
  /** Osoba přihlášeného uživatele (předvyplněný žadatel); prázdné = není propojená. */
  defaultRequestedById: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createReservation,
    null,
  );
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [assetId, setAssetId] = useState('');
  const matches = useMemo(() => makeAssetFilter(places), [places]);
  const options = assets.filter((a) => matches(a, category, location));
  // Vybraná položka vypadla z filtru → výběr se zruší.
  const selected = options.some((a) => a.id === assetId) ? assetId : '';

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kategorie">
          <CategorySelect
            options={categories}
            value={category}
            onChange={setCategory}
            className={inputCls}
          />
        </Field>
        <Field label="Sklad (domovské místo)">
          <LocationSelect
            options={locations}
            value={location}
            onChange={setLocation}
            className={inputCls}
          />
        </Field>
        <Field label={`Položka (${options.length})`} required>
          <select
            name="assetId"
            required
            value={selected}
            onChange={(e) => setAssetId(e.target.value)}
            className={inputCls}
          >
            <option value="">
              {options.length ? '— vyber položku —' : 'Žádná položka neodpovídá filtru'}
            </option>
            {options.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Žadatel">
          <select name="requestedById" className={inputCls} defaultValue={defaultRequestedById}>
            <option value="">— nikdo —</option>
            {people.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          {!defaultRequestedById && (
            <span className="text-xs text-slate-400">
              Tvůj účet není propojený s osobou v Lidé – vyber žadatele ručně.
            </span>
          )}
        </Field>
        <Field label="Od" required>
          <input name="fromAt" type="datetime-local" required className={inputCls} />
        </Field>
        <Field label="Do" required>
          <input name="toAt" type="datetime-local" required className={inputCls} />
        </Field>
        <Field label="Účel">
          <input name="purpose" className={inputCls} />
        </Field>
      </div>

      {state?.error && (
        <p className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-100">
          <AlertCircle size={15} /> {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-100">
          <CheckCircle2 size={15} /> {state.message ?? 'Uloženo.'}
        </p>
      )}
      <div>
        <button
          type="submit"
          disabled={pending || !selected}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
        >
          {pending && <Loader2 size={15} className="animate-spin" />}
          {pending ? 'Ukládám…' : 'Vytvořit požadavek'}
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
