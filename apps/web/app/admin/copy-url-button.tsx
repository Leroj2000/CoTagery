'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

type CopyState = 'idle' | 'copied' | 'error';

/** Tlačítko pro zkopírování resolver URL nosiče (české UI). */
export function CopyUrlButton({
  value,
  label = 'Kopírovat URL',
  variant = 'compact',
}: {
  value: string;
  label?: string;
  /** `card` = stejná velikost jako „Vytisknout štítek“ v řadě na kartě štítku. */
  variant?: 'compact' | 'card';
}) {
  const [state, setState] = useState<CopyState>('idle');
  const text = state === 'idle' ? label : state === 'copied' ? 'Zkopírováno' : 'Nelze zkopírovat';
  const card = variant === 'card';

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
    } catch {
      setState('error');
    }
    window.setTimeout(() => setState('idle'), 2000);
  }

  return (
    <button
      type="button"
      title={text}
      aria-label={text}
      aria-live="polite"
      onClick={() => void onCopy()}
      className={
        card
          ? [
              'inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border text-sm font-medium sm:h-10',
              state === 'copied'
                ? 'border-green-500 bg-white text-green-700 hover:bg-green-50'
                : state === 'error'
                  ? 'border-red-300 bg-white text-red-700 hover:bg-red-50'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
            ].join(' ')
          : 'inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 shadow-sm hover:bg-slate-50'
      }
    >
      {state === 'copied' ? (
        <Check size={card ? 16 : 12} className="shrink-0" />
      ) : (
        <Copy size={card ? 16 : 12} className="shrink-0" />
      )}
      <span className={card ? 'truncate' : undefined}>{text}</span>
    </button>
  );
}
