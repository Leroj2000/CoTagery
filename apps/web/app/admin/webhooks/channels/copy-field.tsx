'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10';

export const primaryBtnCls =
  'inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus:ring-4 focus:ring-brand-500/20 disabled:opacity-50';

/** Pole jen pro čtení s tlačítkem „Kopírovat“. */
export function CopyField({ label, value }: { label: string; value: string }) {
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
