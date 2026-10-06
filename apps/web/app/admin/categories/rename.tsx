'use client';

import { useActionState, useEffect, useState } from 'react';
import { renameCategory } from '../actions';
import type { ActionState } from '../action-form';

/** Inline přejmenování kategorie. */
export function RenameCategory({
  id,
  current,
  equipmentKind,
}: {
  id: string;
  current: string;
  equipmentKind: 'general' | 'vehicle' | 'machine';
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(renameCategory, null);
  const [name, setName] = useState(current);
  const [kind, setKind] = useState(equipmentKind);

  useEffect(() => setName(current), [current]);
  useEffect(() => setKind(equipmentKind), [equipmentKind]);

  return (
    <form action={action} className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <input type="hidden" name="id" value={id} />
        <input
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-40 rounded border border-slate-300 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none"
        />
        <select
          name="equipmentKind"
          value={kind}
          onChange={(event) => setKind(event.target.value as typeof kind)}
          className="rounded border border-slate-300 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none"
        >
          <option value="general">Běžná</option>
          <option value="vehicle">Vozidlo · km</option>
          <option value="machine">Stroj · mth</option>
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-40"
        >
          {pending ? '…' : 'Uložit'}
        </button>
      </div>
      {state?.error && <p className="text-xs text-red-700">{state.error}</p>}
      {state?.ok && <p className="text-xs text-emerald-700">{state.message ?? 'Uloženo.'}</p>}
    </form>
  );
}
