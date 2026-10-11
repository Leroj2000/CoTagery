'use client';

import { useActionState } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import {
  EXPORT_DEFINITIONS,
  type ExportKind,
  type ExportOptionDef,
  type ExportSettings,
} from '@tagery/shared';
import type { ActionState } from '../action-form';
import { updateExportSettings } from '../actions';

/** Nastavení → Exporty: které sloupce a listy obsahují exporty do Excelu. */
export function ExportSettingsForm({
  settings,
  canEdit,
}: {
  settings: ExportSettings;
  canEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateExportSettings,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {(Object.keys(EXPORT_DEFINITIONS) as ExportKind[]).map((kind) => {
        const def = EXPORT_DEFINITIONS[kind];
        const sel = settings[kind];
        return (
          <fieldset key={kind} className="flex flex-col gap-3" disabled={!canEdit}>
            <legend className="mb-1">
              <span className="text-sm font-semibold text-slate-800">{def.title}</span>
              <span className="block text-xs text-slate-500">{def.description}</span>
            </legend>
            <Options
              title="Sloupce"
              name={(k) => `${kind}.col.${k}`}
              options={def.columns}
              checked={new Set(sel.columns)}
            />
            <Options
              title="Další listy"
              name={(k) => `${kind}.sheet.${k}`}
              options={def.sheets}
              checked={new Set(sel.sheets)}
            />
          </fieldset>
        );
      })}

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
      {canEdit && (
        <div>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
          >
            {pending && <Loader2 size={15} className="animate-spin" />}
            {pending ? 'Ukládám…' : 'Uložit exporty'}
          </button>
        </div>
      )}
    </form>
  );
}

function Options({
  title,
  name,
  options,
  checked,
}: {
  title: string;
  name: (key: string) => string;
  options: ExportOptionDef[];
  checked: Set<string>;
}) {
  if (!options.length) return null;
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
      <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((o) => (
          <label key={o.key} className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name={name(o.key)}
              defaultChecked={checked.has(o.key)}
              className="mt-0.5 rounded border-slate-300"
            />
            <span>
              {o.label}
              {o.help && <span className="block text-xs text-slate-400">{o.help}</span>}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
