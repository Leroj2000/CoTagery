'use client';

import { useActionState } from 'react';
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
      ? 'border-red-300 text-red-600 hover:bg-red-50'
      : 'border-neutral-300 text-neutral-600 hover:bg-neutral-100';

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
        className={`rounded-lg border px-2.5 py-1 text-xs disabled:opacity-40 ${cls}`}
        title={state?.error ?? undefined}
      >
        {pending ? '…' : label}
      </button>
    </form>
  );
}
