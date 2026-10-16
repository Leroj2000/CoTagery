'use client';

import { useActionState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Plus } from 'lucide-react';
import { MCP_TOKEN_EXPIRY_OPTIONS } from '../../../lib/channels';
import { createMcpToken, type McpTokenState } from './actions';
import { CopyField, inputCls, primaryBtnCls } from './copy-field';

/** Založení MCP tokenu; plný token se ukáže jen hned po založení. */
export function McpTokenForm({ endpoint }: { endpoint: string }) {
  const [state, formAction, pending] = useActionState<McpTokenState, FormData>(
    createMcpToken,
    null,
  );

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="mcp-name" className="text-xs font-medium text-slate-600">
              Název tokenu
            </label>
            <input
              id="mcp-name"
              name="name"
              required
              maxLength={100}
              placeholder="např. Claude na notebooku"
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="mcp-expires" className="text-xs font-medium text-slate-600">
              Platnost
            </label>
            <select id="mcp-expires" name="expiresIn" defaultValue="90" className={inputCls}>
              {MCP_TOKEN_EXPIRY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {state?.error && (
          <p className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-100">
            <AlertCircle size={15} /> {state.error}
          </p>
        )}

        <div>
          <button type="submit" disabled={pending} className={primaryBtnCls}>
            {pending ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            {pending ? 'Vytvářím…' : 'Vytvořit token'}
          </button>
        </div>
      </form>

      {state?.ok && state.token && (
        <div className="flex flex-col gap-3 rounded-xl bg-emerald-50 p-4 ring-1 ring-inset ring-emerald-100">
          <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-800">
            <CheckCircle2 size={15} /> Token je hotový. Zkopíruj si ho teď – z bezpečnostních důvodů
            ho později znovu nezobrazíme.
          </p>
          <CopyField label="Token (Bearer)" value={state.token} />
          <CopyField label="Adresa MCP serveru" value={endpoint} />
          <p className="text-xs text-emerald-800">
            {state.info?.expiresAt
              ? `Platí do ${new Date(state.info.expiresAt).toLocaleDateString('cs-CZ')}.`
              : 'Platí bez omezení, dokud ho nezrušíš.'}
          </p>
        </div>
      )}
    </div>
  );
}
