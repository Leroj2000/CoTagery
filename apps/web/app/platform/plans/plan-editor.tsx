'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { PLAN_FEATURES, PLAN_LIMITS, PLAN_MODULES } from '@tagery/shared';
import type { PlanDefinition } from '../../lib/platform';

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10';

const num = (v: number | null | undefined) => (v == null ? '' : String(v));

/** Editor jedné úrovně (ceník, limity, moduly a funkce). */
export function PlanEditor({ plan }: { plan: PlanDefinition }) {
  const router = useRouter();
  const [name, setName] = useState(plan.name);
  const [description, setDescription] = useState(plan.description ?? '');
  const [priceMonth, setPriceMonth] = useState(num(plan.priceMonth));
  const [priceYear, setPriceYear] = useState(num(plan.priceYear));
  const [isPublic, setIsPublic] = useState(plan.isPublic);
  const [limits, setLimits] = useState<Record<string, string>>(() =>
    Object.fromEntries(PLAN_LIMITS.map((l) => [l.key, num(plan.limits[l.key])])),
  );
  const [ents, setEnts] = useState(new Set<string>(plan.entitlements));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function toggle(key: string) {
    setEnts((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsePrice = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));
    const lim: Record<string, number | null> = {};
    for (const l of PLAN_LIMITS) {
      const v = limits[l.key].trim();
      const n = v === '' ? null : Number(v);
      if (n != null && (!Number.isInteger(n) || n < 0))
        return setMsg({ ok: false, text: `${l.label}: celé číslo, nebo prázdné = neomezeno` });
      lim[l.key] = n;
    }
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/platform/plans/${plan.key}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name,
        description: description || null,
        priceMonth: parsePrice(priceMonth),
        priceYear: parsePrice(priceYear),
        isPublic,
        limits: lim,
        entitlements: [...ents],
      }),
    });
    setBusy(false);
    if (res.ok) {
      setMsg({ ok: true, text: 'Uloženo a promítnuto do firem.' });
      router.refresh();
    } else {
      const data = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
      setMsg({
        ok: false,
        text: (Array.isArray(data?.message) ? data?.message.join(', ') : data?.message) ?? 'Chyba',
      });
    }
  }

  const checks = (items: readonly { key: string; label: string }[]) => (
    <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((m) => (
        <label key={m.key} className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={ents.has(m.key)} onChange={() => toggle(m.key)} />
          {m.label}
        </label>
      ))}
    </div>
  );

  return (
    <form
      onSubmit={save}
      className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">
          {plan.name} <span className="text-xs font-normal text-slate-400">({plan.key})</span>
        </h2>
        <label className="inline-flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
          />
          Nabízet firmám
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-600">Název</span>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5 lg:col-span-3">
          <span className="text-xs font-medium text-slate-600">Popis</span>
          <input
            className={inputCls}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-600">Cena / měsíc bez DPH</span>
          <input
            inputMode="decimal"
            className={inputCls}
            value={priceMonth}
            onChange={(e) => setPriceMonth(e.target.value)}
            placeholder="individuálně"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-600">Cena / rok bez DPH</span>
          <input
            inputMode="decimal"
            className={inputCls}
            value={priceYear}
            onChange={(e) => setPriceYear(e.target.value)}
            placeholder="individuálně"
          />
        </label>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Limity (prázdné = neomezeno)
        </p>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {PLAN_LIMITS.map((l) => (
            <label key={l.key} className="flex flex-col gap-1.5">
              <span className="text-xs text-slate-600">{l.label}</span>
              <input
                inputMode="numeric"
                className={inputCls}
                value={limits[l.key]}
                placeholder="∞"
                onChange={(e) => setLimits((x) => ({ ...x, [l.key]: e.target.value }))}
              />
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Funkce Tagery Věcí
        </p>
        {checks(PLAN_FEATURES)}
      </div>
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Rozšíření
        </p>
        {checks(PLAN_MODULES)}
      </div>

      {msg && (
        <p className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-red-700'}`}>{msg.text}</p>
      )}
      <div>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
        >
          {busy && <Loader2 size={15} className="animate-spin" />} Uložit úroveň
        </button>
      </div>
    </form>
  );
}
