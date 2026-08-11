'use client';

import { useActionState } from 'react';

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
    <form action={formAction} className="flex flex-col gap-3">
      {hidden &&
        Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.name} className="flex flex-col gap-1">
            <label htmlFor={f.name} className="text-xs font-medium text-neutral-500">
              {f.label}
              {f.required && <span className="text-red-500"> *</span>}
            </label>
            {f.options ? (
              <select
                id={f.name}
                name={f.name}
                required={f.required}
                defaultValue={f.defaultValue}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
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
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
              />
            )}
          </div>
        ))}
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && (
        <p className="text-sm text-green-600">{state.message ?? 'Uloženo.'}</p>
      )}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {pending ? 'Ukládám…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
