'use client';

import { useActionState } from 'react';
import { Loader2 } from 'lucide-react';
import type { ActionState, ServerAction } from './action-form';

/** Tlačítko spouštějící Server Action s hidden parametry (archive, suspend…). */
export function ActionButton({
  action,
  hidden,
  label,
  variant = 'default',
  confirm,
}: {
  action: ServerAction;
  hidden: Record<string, string>;
  label: string;
  variant?: 'default' | 'danger';
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, null);
  const cls =
    variant === 'danger'
      ? 'border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300'
      : 'border-slate-300 text-slate-600 hover:bg-slate-50 hover:border-slate-400';

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className="inline"
    >
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button
        type="submit"
        disabled={pending}
        className={`inline-flex items-center gap-1 rounded-lg border bg-white px-2.5 py-1 text-xs font-medium shadow-sm transition disabled:opacity-40 ${cls}`}
        title={state?.error ?? undefined}
      >
        {pending && <Loader2 size={12} className="animate-spin" />}
        {pending ? '…' : label}
      </button>
    </form>
  );
}
