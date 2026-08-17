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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <a
          href="/api/assets-export"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <Download size={15} /> Export CSV
        </a>
      </div>

      <form action={action} className="flex flex-col gap-3">
        <input ref={csvRef} type="hidden" name="csv" />
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">
            <Upload size={15} /> Vybrat CSV…
            <input type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
          </label>
          {fileName && <span className="text-xs text-slate-500">{fileName}</span>}
          <button
            type="submit"
            disabled={pending || !fileName}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-40"
          >
            {pending && <Loader2 size={14} className="animate-spin" />}
            {pending ? 'Importuji…' : 'Importovat'}
          </button>
        </div>
        <p className="text-xs text-slate-400">
          Sloupce: name (povinné), category, manufacturer, model, serialNumber, inventoryNumber,
          homeLocation. Kategorie a místa se dohledají podle názvu nebo založí.
        </p>
        {state?.error && (
          <p className="flex items-center gap-1.5 text-sm text-red-600">
            <AlertCircle size={15} /> {state.error}
          </p>
        )}
        {state?.ok && (
          <p className="flex items-center gap-1.5 text-sm text-emerald-600">
            <CheckCircle2 size={15} /> {state.message}
          </p>
        )}
      </form>
    </div>
  );
}
