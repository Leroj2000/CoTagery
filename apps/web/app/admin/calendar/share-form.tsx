'use client';

import { useActionState, useEffect, useState } from 'react';
import { AlertCircle, Check, CheckCircle2, Copy, Loader2 } from 'lucide-react';
import { CALENDAR_SOURCE_LABELS, type CalendarSource } from '@tagery/shared';
import { createCalendarShare, type ShareActionState } from './actions';

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10';

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={value}
          className={`${inputCls} font-mono text-xs`}
          onFocus={(e) => e.target.select()}
        />
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(value).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Zkopírováno' : 'Kopírovat'}
        </button>
      </div>
    </div>
  );
}

/** Založení veřejného odkazu na kalendář; odkaz se ukáže jen hned po založení. */
export function ShareForm({ sources }: { sources: CalendarSource[] }) {
  const [state, formAction, pending] = useActionState<ShareActionState, FormData>(
    createCalendarShare,
    null,
  );
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="share-label" className="text-xs font-medium text-slate-600">
              Název (uvidí ho příjemce)
            </label>
            <input
              id="share-label"
              name="label"
              maxLength={120}
              placeholder="např. Kalendář dílny"
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="share-expires" className="text-xs font-medium text-slate-600">
              Platnost do (nepovinné)
            </label>
            <input id="share-expires" name="expiresOn" type="date" className={inputCls} />
          </div>
        </div>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-xs font-medium text-slate-600">
            Co bude v kalendáři vidět
          </legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {sources.map((s) => (
              <label key={s} className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="sources"
                  value={s}
                  defaultChecked={s === 'event'}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                {CALENDAR_SOURCE_LABELS[s]}
              </label>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            Příjemce uvidí jen název, čas a místo termínu – žádné osoby, poznámky k rezervacím ani
            odkazy do administrace.
          </p>
        </fieldset>

        {state?.error && (
          <p className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-100">
            <AlertCircle size={15} /> {state.error}
          </p>
        )}

        <div>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus:ring-4 focus:ring-brand-500/20 disabled:opacity-50"
          >
            {pending && <Loader2 size={15} className="animate-spin" />}
            {pending ? 'Vytvářím…' : 'Vytvořit odkaz'}
          </button>
        </div>
      </form>

      {state?.ok && state.token && (
        <div className="flex flex-col gap-3 rounded-xl bg-emerald-50 p-4 ring-1 ring-inset ring-emerald-100">
          <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-800">
            <CheckCircle2 size={15} /> Odkaz je hotový. Zkopíruj si ho teď – z bezpečnostních důvodů
            ho později znovu nezobrazíme.
          </p>
          <CopyField label="Odkaz na kalendář" value={`${origin}/kalendar/${state.token}`} />
          <CopyField
            label="iCal (odběr v Google/Outlook/Apple kalendáři)"
            value={`${origin}/kalendar/${state.token}/ics`}
          />
        </div>
      )}
    </div>
  );
}
