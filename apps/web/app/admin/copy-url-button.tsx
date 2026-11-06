'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

/** Kompaktní tlačítko pro zkopírování URL (české UI). */
export function CopyUrlButton({
  value,
  label = 'Kopírovat URL',
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title={copied ? 'Zkopírováno' : label}
      aria-label={copied ? 'Zkopírováno' : label}
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 shadow-sm hover:bg-slate-50"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Zkopírováno' : label}
    </button>
  );
}
