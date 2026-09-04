'use client';

import { useActionState, useMemo, useState } from 'react';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import type { ActionState, ServerAction } from '../action-form';

export interface Candidate {
  id: string;
  label: string;
  categoryIds: string[];
}

export interface CategoryOption {
  id: string;
  name: string;
}

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10';

/**
 * Interaktivní výběr člena k přidání do skupiny. Klientská logika:
 *  - roletka kategorie zúží kandidáty na ty, kdo mají vybranou kategorii,
 *  - kandidáti, kteří už jsou členy skupiny (`memberIds`), se nenabízí.
 * Přidání jde přes server action `addGroupMember` (posílá `fieldName` = ID).
 */
export function MemberPicker({
  action,
  groupId,
  fieldName,
  candidates,
  memberIds,
  categories,
  addLabel,
  memberLabel,
}: {
  action: ServerAction;
  groupId: string;
  fieldName: 'userId' | 'personId';
  candidates: Candidate[];
  memberIds: string[];
  categories: CategoryOption[];
  addLabel: string;
  memberLabel: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, null);
  const [categoryId, setCategoryId] = useState('');

  const memberSet = useMemo(() => new Set(memberIds), [memberIds]);
  const available = useMemo(
    () =>
      candidates.filter(
        (c) =>
          !memberSet.has(c.id) && (categoryId === '' || c.categoryIds.includes(categoryId)),
      ),
    [candidates, memberSet, categoryId],
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="groupId" value={groupId} />
      <div className="grid gap-4 sm:grid-cols-2">
        {categories.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`cat-${groupId}`} className="text-xs font-medium text-slate-600">
              Kategorie
            </label>
            <select
              id={`cat-${groupId}`}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={inputCls}
            >
              <option value="">— všechny kategorie —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`mem-${groupId}`} className="text-xs font-medium text-slate-600">
            {memberLabel}
            <span className="text-brand-600"> *</span>
          </label>
          <select
            id={`mem-${groupId}`}
            name={fieldName}
            required
            key={categoryId /* reset výběru při změně filtru */}
            className={inputCls}
            disabled={available.length === 0}
          >
            {available.length === 0 ? (
              <option value="">Žádní kandidáti</option>
            ) : (
              available.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))
            )}
          </select>
        </div>
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
          disabled={pending || available.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus:ring-4 focus:ring-brand-500/20 disabled:opacity-50"
        >
          {pending && <Loader2 size={15} className="animate-spin" />}
          {pending ? 'Ukládám…' : addLabel}
        </button>
      </div>
    </form>
  );
}
