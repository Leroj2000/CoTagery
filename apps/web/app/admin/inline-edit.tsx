'use client';

import { useActionState, useEffect, useState } from 'react';
import { Pencil, X, Loader2 } from 'lucide-react';
import type { ActionState } from './action-form';

interface EditField {
  name: string;
  label: string;
  defaultValue?: string;
  type?: 'text' | 'email';
  options?: { value: string; label: string }[];
}

/**
 * Inline editace položky ve výpisu (EPIC UX): tlačítko „Upravit" rozbalí
 * formulář se server-action. Zobrazuje se jen tam, kde to volající povolí
 * (permission-gated na úrovni stránky). Po úspěchu se zavře.
 */
export function InlineEdit({
  action,
  id,
  fields,
  label = 'Upravit',
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  id: string;
  fields: EditField[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, null);

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state?.ok]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
      >
        <Pencil size={12} /> {label}
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      {fields.map((f) => (
        <label key={f.name} className="flex flex-col gap-0.5 text-[11px] text-slate-500">
          {f.label}
          {f.options ? (
            <select
              name={f.name}
              defaultValue={f.defaultValue ?? ''}
              className="rounded border border-slate-300 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none"
            >
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              name={f.name}
              type={f.type ?? 'text'}
              defaultValue={f.defaultValue ?? ''}
              className="w-36 rounded border border-slate-300 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none"
            />
          )}
        </label>
      ))}
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
