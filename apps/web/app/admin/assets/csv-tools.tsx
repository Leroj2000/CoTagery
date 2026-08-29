'use client';

import { useActionState, useRef, useState } from 'react';
import { Download, Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { importAssetsCsv } from '../actions';
import type { ActionState } from '../action-form';

/** Export (odkaz na BFF) + import CSV (načte soubor a pošle text server action). */
export function CsvTools() {
  const [state, action, pending] = useActionState<ActionState, FormData>(importAssetsCsv, null);
  const [fileName, setFileName] = useState('');
  const csvRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    if (csvRef.current) csvRef.current.value = text;
  }

  const btn =
    'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50';

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input ref={csvRef} type="hidden" name="csv" />
      <a href="/api/assets-export" className={btn}>
        <Download size={15} /> Export CSV
      </a>
      <label
        className={`cursor-pointer ${btn}`}
        title="Sloupce: name (povinné), category, manufacturer, model, serialNumber, inventoryNumber, homeLocation. Kategorie a místa se dohledají podle názvu nebo založí."
      >
        <Upload size={15} /> {fileName || 'Vybrat CSV…'}
        <input type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
      </label>
      <button
        type="submit"
        disabled={pending || !fileName}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-40"
      >
        {pending && <Loader2 size={14} className="animate-spin" />}
        {pending ? 'Importuji…' : 'Import CSV'}
      </button>
      {state?.error && (
        <span className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle size={13} /> {state.error}
        </span>
      )}
      {state?.ok && (
        <span className="flex items-center gap-1 text-xs text-emerald-600">
          <CheckCircle2 size={13} /> {state.message}
        </span>
      )}
    </form>
  );
}
