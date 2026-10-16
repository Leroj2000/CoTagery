'use client';

import { useActionState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { decideConsent, type ConsentState } from './actions';

export interface ConsentOrg {
  id: string;
  name: string;
}

/** Výběr firmy a tlačítka Povolit / Zamítnout. */
export function ConsentForm({
  params,
  orgs,
  currentOrgId,
}: {
  params: Record<string, string>;
  orgs: ConsentOrg[];
  currentOrgId: string;
}) {
  const [state, formAction, pending] = useActionState<ConsentState, FormData>(decideConsent, null);
  const defaultOrg = orgs.some((o) => o.id === currentOrgId) ? currentOrgId : orgs[0]?.id;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {Object.entries(params).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-slate-700">
          Firma, ke které dáš přístup
        </legend>
        {orgs.map((o) => (
          <label
            key={o.id}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50"
          >
            <input
              type="radio"
              name="tenantId"
              value={o.id}
              defaultChecked={o.id === defaultOrg}
              required
              className="h-4 w-4 border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            {o.name}
          </label>
        ))}
      </fieldset>

      {state?.error && (
        <p className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-100">
          <AlertCircle size={15} /> {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          name="decision"
          value="approve"
          disabled={pending}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus:ring-4 focus:ring-brand-500/20 disabled:opacity-50"
        >
          {pending && <Loader2 size={16} className="animate-spin" />}
          Povolit
        </button>
        <button
          type="submit"
          name="decision"
          value="deny"
          formNoValidate
          disabled={pending}
          className="inline-flex flex-1 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
        >
          Zamítnout
        </button>
      </div>
    </form>
  );
}
