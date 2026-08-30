'use client';

import { useActionState, useState } from 'react';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { createAsset } from '../actions';
import type { ActionState } from '../action-form';

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10';

interface Opt {
  value: string;
  label: string;
}

/**
 * Formulář „Nová věc" s inline vytvořením kategorie: v rozbalovacím menu je
 * volba „➕ Nová kategorie…", po které se ukáže pole na název – kategorie se
 * založí rovnou při vytvoření věci (Server Action `createAsset`).
 */
export function AssetForm({
  categories,
  locations,
}: {
  categories: Opt[];
  locations: Opt[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createAsset, null);
  const [category, setCategory] = useState('');
  const [idMode, setIdMode] = useState('');

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Název" required>
          <input name="name" required placeholder="Aku vrtačka Makita" className={inputCls} />
        </Field>

        <Field label="Kategorie">
          <select
            name="categoryId"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={inputCls}
          >
            <option value="">— bez kategorie —</option>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
            <option value="__new__">➕ Nová kategorie…</option>
          </select>
        </Field>

        {category === '__new__' && (
          <Field label="Název nové kategorie" required>
            <input name="newCategory" required placeholder="Elektrické nářadí" className={inputCls} />
          </Field>
        )}

        <Field label="Výrobce">
          <input name="manufacturer" placeholder="Makita" className={inputCls} />
        </Field>
        <Field label="Sériové číslo">
          <input name="serialNumber" className={inputCls} />
        </Field>
        <Field label="Patří do (home)">
          <select name="homeLocationId" className={inputCls} defaultValue="">
            <option value="">— žádné —</option>
            {locations.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Kontejner (může obsahovat položky)">
          <select name="canContainAssets" className={inputCls} defaultValue="false">
            <option value="false">Ne</option>
            <option value="true">Ano (dodávka, kufr…)</option>
          </select>
        </Field>
      </div>

      {/* Identifikátor (QR/NFC) rovnou při vytvoření – volitelné. */}
      <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Identifikátor">
            <select
              name="idMode"
              value={idMode}
              onChange={(e) => setIdMode(e.target.value)}
              className={inputCls}
            >
              <option value="">— nepřidávat —</option>
              <option value="generate">Vygenerovat nový</option>
              <option value="adopt">Adoptovat vlastní kód</option>
            </select>
          </Field>

          {idMode !== '' && (
            <Field label="Typ">
              <select name="carrierType" className={inputCls} defaultValue="qr">
                <option value="qr">QR kód</option>
                <option value="nfc">NFC</option>
              </select>
            </Field>
          )}

          {idMode === 'adopt' && (
            <>
              <Field label="Externí kód" required>
                <input
                  name="externalCode"
                  required
                  placeholder="EAN / URL / vlastní kód"
                  className={inputCls}
                />
              </Field>
              <Field label="Typ kódu">
                <select name="externalScheme" className={inputCls} defaultValue="">
                  <option value="">— automaticky —</option>
                  <option value="ean13">EAN-13</option>
                  <option value="url">URL</option>
                  <option value="custom">Vlastní</option>
                </select>
              </Field>
            </>
          )}
        </div>
        {idMode === 'adopt' && (
          <p className="mt-2 text-xs text-slate-400">
            Uloží cizí kód jako alias rozpoznatelný interním skenerem a vytvoří k němu náš
            vlastní identifikátor pro veřejný resolver.
          </p>
        )}
      </div>

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
          {pending ? 'Ukládám…' : 'Vytvořit položku'}
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
