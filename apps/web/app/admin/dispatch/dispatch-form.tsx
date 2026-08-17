'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { Loader2, CheckCircle2, AlertCircle, Search, QrCode } from 'lucide-react';
import { bulkDispatch } from '../actions';
import type { ActionState } from '../action-form';

interface Item {
  id: string;
  name: string;
  status: string;
  hasCarrier: boolean;
}
interface Opt {
  value: string;
  label: string;
}

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10';

/**
 * Hromadný výdej: vyber příjemce/místo → zaškrtni více věcí → jedno potvrzení.
 * Odpovídá „Výdej" z analýzy (rychlé předání N položek jednou transakcí).
 */
export function DispatchForm({
  assets,
  people,
  locations,
}: {
  assets: Item[];
  people: Opt[];
  locations: Opt[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(bulkDispatch, null);
  const [query, setQuery] = useState('');
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const filtered = assets.filter((a) => a.name.toLowerCase().includes(query.toLowerCase()));
  // Vybrané věci bez přiřazeného identifikátoru – jen upozornění, výdej se neblokuje.
  const checkedNoCarrier = assets.filter((a) => checked.has(a.id) && !a.hasCarrier);
  const toggle = (id: string) =>
    setChecked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-600">Komu / kam *</label>
          <select name="target" required className={inputCls} defaultValue="">
            <option value="" disabled>
              — vyber příjemce —
            </option>
            <optgroup label="Osoby">
              {people.map((p) => (
                <option key={p.value} value={`person:${p.value}`}>
                  👤 {p.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Místa">
              {locations.map((l) => (
                <option key={l.value} value={`location:${l.value}`}>
                  📍 {l.label}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-600">Akce</label>
          <select name="type" className={inputCls} defaultValue="loan">
            <option value="loan">Půjčit</option>
            <option value="assign">Přidělit</option>
            <option value="move">Přesunout</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-600">Vrátit do (volitelné)</label>
          <input type="date" name="dueAt" className={inputCls} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-600">Potvrzení převzetí</label>
          <select name="requireConfirmation" className={inputCls} defaultValue="false">
            <option value="false">Nevyžadovat</option>
            <option value="true">Vyžádat potvrzení</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-slate-600">
            Věci k výdeji — vybráno {checked.size}
          </label>
          <div className="relative">
            <Search size={14} className="absolute left-2 top-2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Hledat…"
              className="rounded-lg border border-slate-300 py-1.5 pl-7 pr-3 text-xs focus:border-brand-500 focus:outline-none"
            />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200">
          {filtered.length === 0 ? (
            <p className="p-4 text-sm text-slate-400">Žádné dostupné věci.</p>
          ) : (
            filtered.map((a) => (
              <label
                key={a.id}
                className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-3 py-2 text-sm last:border-0 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  name="assetIds"
                  value={a.id}
                  checked={checked.has(a.id)}
                  onChange={() => toggle(a.id)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="flex-1 text-slate-700">{a.name}</span>
                {!a.hasCarrier && (
                  <Link
                    href={`/admin/assets/${a.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 hover:bg-amber-100"
                    title="Věc nemá identifikátor – přidej ho na kartě věci"
                  >
                    <QrCode size={11} /> bez identifikátoru
                  </Link>
                )}
                <span className="text-xs text-slate-400">{a.status}</span>
              </label>
            ))
          )}
        </div>
      </div>

      {checkedNoCarrier.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <span className="flex items-center gap-1.5 font-medium">
            <AlertCircle size={15} /> {checkedNoCarrier.length}{' '}
            {checkedNoCarrier.length === 1 ? 'vybraná věc nemá' : 'vybraných věcí nemá'} identifikátor
          </span>
          <span className="text-xs text-amber-700">
            Můžeš je vydat i tak, nebo nejdřív přidej QR/NFC identifikátor na kartě věci:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {checkedNoCarrier.map((a) => (
              <Link
                key={a.id}
                href={`/admin/assets/${a.id}`}
                className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100"
              >
                <QrCode size={11} /> {a.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {state?.error && (
        <p className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle size={15} /> {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <CheckCircle2 size={15} /> {state.message}
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={pending || checked.size === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
        >
          {pending && <Loader2 size={15} className="animate-spin" />}
          {pending ? 'Vydávám…' : `Vydat ${checked.size} věcí`}
        </button>
      </div>
    </form>
  );
}
