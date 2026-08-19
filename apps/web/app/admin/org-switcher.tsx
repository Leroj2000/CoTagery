'use client';

import { useState } from 'react';
import { Building2, ChevronDown, Check, Loader2 } from 'lucide-react';

interface Org {
  organizationId: string;
  organizationName: string;
  role: string;
}

/**
 * Přepínač aktivní organizace (EPIC-18 0.4). Zobrazuje aktuální firmu; má-li
 * identita víc členství, umožní přepnout – BFF vydá nové tokeny pro zvolenou
 * org a stránka se načte pod ní. U jediné org je to jen štítek.
 */
export function OrgSwitcher({ current, memberships }: { current: string; memberships: Org[] }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const cur = memberships.find((m) => m.organizationId === current);

  async function switchTo(id: string) {
    if (id === current) {
      setOpen(false);
      return;
    }
    setBusy(id);
    const res = await fetch('/api/switch-org', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationId: id }),
    });
    if (res.ok) window.location.href = '/admin';
    else setBusy(null);
  }

  if (memberships.length <= 1) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
        <Building2 size={13} className="text-slate-400" />
        {cur?.organizationName ?? '—'}
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-100"
      >
        <Building2 size={13} className="text-slate-400" />
        <span className="max-w-[9rem] truncate">{cur?.organizationName ?? 'Vyber org'}</span>
        <ChevronDown size={13} className="text-slate-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            <p className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Moje organizace
            </p>
            {memberships.map((m) => (
              <button
                key={m.organizationId}
                onClick={() => switchTo(m.organizationId)}
                disabled={busy !== null}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                <span className="flex-1 truncate">
                  <span className="font-medium text-slate-800">{m.organizationName}</span>
                  <span className="ml-1.5 text-xs text-slate-400">{m.role}</span>
                </span>
                {busy === m.organizationId ? (
                  <Loader2 size={14} className="animate-spin text-slate-400" />
                ) : m.organizationId === current ? (
                  <Check size={14} className="text-brand-600" />
                ) : null}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
