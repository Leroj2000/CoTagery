'use client';

import { useActionState } from 'react';
import { pairNfc } from '../actions';
import type { ActionState } from '../action-form';

/** Kompaktní inline formulář pro spárování NFC UID s identifikátorem (Server Action). */
export function NfcPairForm({ carrierId, objectId }: { carrierId: string; objectId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(pairNfc, null);

  return (
    <form action={action} className="flex items-center gap-1">
      <input type="hidden" name="carrierId" value={carrierId} />
      <input type="hidden" name="objectId" value={objectId} />
      <input
        name="nfcUid"
        required
        placeholder="NFC UID"
        className="w-28 rounded border border-neutral-300 px-2 py-1 text-xs focus:border-neutral-900 focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100 disabled:opacity-40"
        title={state?.error ?? (state?.ok ? 'Spárováno' : undefined)}
      >
        {pending ? '…' : state?.ok ? '✓' : 'Párovat'}
      </button>
    </form>
  );
}
