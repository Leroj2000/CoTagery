'use client';

import { useActionState } from 'react';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export type ActionState = { ok?: boolean; error?: string; message?: string } | null;
export type ServerAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export interface Field {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'email' | 'url';
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  options?: { value: string; label: string }[];
}

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10';

/**
 * Generický formulář nad Server Action (běží server-side, čte httpOnly cookie).
 * Zobrazí chybu/úspěch z návratového stavu akce. Používá se pro create/invite.
 */
export function ActionForm({
  action,
  fields,
  submitLabel = 'Uložit',
  hidden,
}: {
  action: ServerAction;
  fields: Field[];
  submitLabel?: string;
  hidden?: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {hidden &&
        Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.name} className="flex flex-col gap-1.5">
            <label htmlFor={f.name} className="text-xs font-medium text-slate-600">
              {f.label}
              {f.required && <span className="text-brand-600"> *</span>}
            </label>
            {f.options ? (
              <select
                id={f.name}
                name={f.name}
                required={f.required}
                defaultValue={f.defaultValue}
                className={inputCls}
              >
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={f.name}
                name={f.name}
                type={f.type ?? 'text'}
                required={f.required}
                placeholder={f.placeholder}
                defaultValue={f.defaultValue}
                className={inputCls}
              />
            )}
          </div>
        ))}
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
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus:ring-4 focus:ring-brand-500/20 disabled:opacity-50"
        >
          {pending && <Loader2 size={15} className="animate-spin" />}
          {pending ? 'Ukládám…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
