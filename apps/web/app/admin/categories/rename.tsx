'use client';

import { useActionState } from 'react';
import { renameCategory } from '../actions';
import type { ActionState } from '../action-form';

/** Inline přejmenování kategorie. */
export function RenameCategory({ id, current }: { id: string; current: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(renameCategory, null);
  return (
    <form action={action} className="flex items-center gap-1">
      <input type="hidden" name="id" value={id} />
      <input
        name="name"
        defaultValue={current}
        className="w-40 rounded border border-slate-300 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-40"
        title={state?.error ?? undefined}
      >
        {pending ? '…' : 'Uložit'}
      </button>
    </form>
  );
}
