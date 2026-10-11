import { FileText, ShieldCheck } from 'lucide-react';
import { documentUrl, fmtDay, type Warranty } from '../../../lib/purchase';

/**
 * Upozornění „V záruce" u závad a servisu – kdo hlásí poruchu, hned vidí, že
 * má reklamovat, ne platit opravu. Server-safe; nic nevykreslí bez platné záruky.
 */
export function WarrantyHint({ warranties, hint }: { warranties: Warranty[]; hint: string }) {
  const active = warranties.filter((w) => w.status !== 'expired');
  if (active.length === 0) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
      <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-600" />
      <div className="min-w-0 flex-1">
        {active.map((w) => (
          <p key={w.id}>
            <span className="font-medium">V záruce do {fmtDay(w.endsOn)}</span>
            {active.length > 1 || w.title !== 'Záruka výrobce' ? ` (${w.title})` : ''}
            {w.provider && <span className="text-emerald-800"> · reklamace: {w.provider}</span>}
            {w.document && (
              <a
                href={documentUrl(w.document.id)}
                target="_blank"
                rel="noreferrer"
                className="ml-2 inline-flex items-center gap-1 font-medium text-emerald-700 underline-offset-2 hover:underline"
              >
                <FileText size={13} /> záruční list
              </a>
            )}
          </p>
        ))}
        <p className="mt-0.5 text-xs text-emerald-700">{hint}</p>
      </div>
    </div>
  );
}
