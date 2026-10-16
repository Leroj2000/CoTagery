'use client';

import { useActionState, useEffect, useState } from 'react';
import { AlertCircle, ExternalLink, Info, Loader2, Send } from 'lucide-react';
import { formatRemaining } from '../../../lib/channels';
import { createTelegramLinkCode, type LinkCodeState } from './actions';
import { CopyField, primaryBtnCls } from './copy-field';

function Countdown({ expiresAt }: { expiresAt: string }) {
  const end = Date.parse(expiresAt);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = (end - now) / 1000;
  return left > 0 ? (
    <span className="text-xs text-slate-500">
      Platí ještě <span className="font-mono">{formatRemaining(left)}</span>
    </span>
  ) : (
    <span className="text-xs font-medium text-red-600">Kód vypršel – vygeneruj nový.</span>
  );
}

/** Vygenerování jednorázového kódu a odkazu do Telegramu. */
export function TelegramLink() {
  const [state, formAction, pending] = useActionState<LinkCodeState, FormData>(
    createTelegramLinkCode,
    null,
  );
  const link = state?.ok ? state.link : undefined;

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction}>
        <button type="submit" disabled={pending} className={primaryBtnCls}>
          {pending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          {link ? 'Vygenerovat nový kód' : 'Propojit Telegram'}
        </button>
      </form>

      {state?.error && (
        <p className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-100">
          <AlertCircle size={15} /> {state.error}
        </p>
      )}

      {link && (
        <div className="flex flex-col gap-3 rounded-xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-200">
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="font-mono text-2xl font-semibold tracking-[0.3em] text-slate-900">
              {link.code}
            </span>
            <Countdown key={link.expiresAt} expiresAt={link.expiresAt} />
          </div>
          {link.deepLink ? (
            <>
              <a
                href={link.deepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
              >
                Otevřít bota v Telegramu <ExternalLink size={14} />
              </a>
              <CopyField label="Odkaz (např. pro otevření v telefonu)" value={link.deepLink} />
              <p className="text-xs text-slate-500">
                Po otevření odkazu klepni v Telegramu na „Start“. Případně botovi pošli zprávu{' '}
                <span className="font-mono">/start {link.code}</span>.
              </p>
            </>
          ) : (
            <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-inset ring-amber-100">
              <Info size={15} className="mt-0.5 shrink-0" />
              Telegram bot zatím není na tomto serveru nastavený, takže kód nemá kam poslat.
              Nastavení zajistí správce instalace.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
