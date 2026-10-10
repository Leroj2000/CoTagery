'use client';

import { useActionState } from 'react';
import { updateUserRole, setUserStatus } from '../actions';
import type { ActionState } from '../action-form';

/** Inline změna role + přepnutí stavu uživatele (Server Actions). */
export function UserRowActions({
  userId,
  role,
  status,
  options,
  canChangeRole,
}: {
  userId: string;
  role: string;
  status: string;
  /** Role, které smí aktér přidělit (pod jeho úrovní). */
  options: { value: string; label: string }[];
  /** Je uživatel aktérovi podřízený (a není to on sám)? */
  canChangeRole: boolean;
}) {
  const [roleState, roleAction, rolePending] = useActionState<ActionState, FormData>(
    updateUserRole,
    null,
  );
  const [, statusAction, statusPending] = useActionState<ActionState, FormData>(
    setUserStatus,
    null,
  );
  const nextStatus = status === 'active' ? 'suspended' : 'active';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canChangeRole && (
        <form action={roleAction} className="flex items-center gap-1">
          <input type="hidden" name="userId" value={userId} />
          <select
            name="tenantRole"
            defaultValue={role}
            className="rounded border border-neutral-300 px-1.5 py-1 text-xs"
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={rolePending}
            className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100 disabled:opacity-40"
            title={roleState?.error ?? undefined}
          >
            {rolePending ? '…' : 'Uložit roli'}
          </button>
          {roleState?.error && <span className="text-xs text-red-600">{roleState.error}</span>}
        </form>
      )}

      <form action={statusAction} className="inline">
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="status" value={nextStatus} />
        <button
          type="submit"
          disabled={statusPending}
          className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100 disabled:opacity-40"
        >
          {status === 'active' ? 'Pozastavit' : 'Aktivovat'}
        </button>
      </form>
    </div>
  );
}
