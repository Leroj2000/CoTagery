'use client';

import { useCallback, useRef, useState } from 'react';
import {
  Loader2,
  Camera,
  CameraOff,
  ScanLine,
  Search,
  AlertCircle,
  CheckCircle2,
  XCircle,
  PackageCheck,
  Undo2,
  MoveRight,
  Trash2,
  Check,
} from 'lucide-react';
import type { WorkflowValidation } from '../../lib/types';
import { StatusBadge, Badge } from '../ui';
import { useBarcodeScanner } from '../scan/use-scanner';

interface Opt {
  value: string;
  label: string;
}

interface Item {
  id: string;
  name: string;
  status: string;
}

type ActionKey = 'loan' | 'return' | 'move';

const ACTIONS: { key: ActionKey; label: string; icon: typeof PackageCheck; needs: 'person' | 'location' | null; confirm: string }[] = [
  { key: 'loan', label: 'Vydávám', icon: PackageCheck, needs: 'person', confirm: 'Vydat' },
  { key: 'return', label: 'Vracím', icon: Undo2, needs: null, confirm: 'Vrátit' },
  { key: 'move', label: 'Přesouvám', icon: MoveRight, needs: 'location', confirm: 'Přesunout' },
];

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10';

export function WorkflowClient({
  people,
  locations,
  assets,
}: {
  people: Opt[];
  locations: Opt[];
  assets: Item[];
}) {
  const [action, setAction] = useState<ActionKey>('loan');
  const [targetId, setTargetId] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [codes, setCodes] = useState<string[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [validation, setValidation] = useState<WorkflowValidation | null>(null);
  const [manual, setManual] = useState('');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: number; failed: { assetId: string; error: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reqIdRef = useRef(0);
  const codesRef = useRef<string[]>([]);
  const pickedRef = useRef<Set<string>>(new Set());
  const cfg = ACTIONS.find((a) => a.key === action)!;
  const needsTarget = cfg.needs !== null;
  const targetOptions = cfg.needs === 'person' ? people : cfg.needs === 'location' ? locations : [];
  const targetReady = !needsTarget || !!targetId;

  /** Pošle aktuální kódy + vybrané věci na pre-flight validaci (stale-safe). */
  const revalidate = useCallback(async () => {
    const nextCodes = codesRef.current;
    const nextPicked = [...pickedRef.current];
    if (nextCodes.length === 0 && nextPicked.length === 0) {
      setValidation(null);
      return;
    }
    const id = ++reqIdRef.current;
    const body = {
      type: action,
      ...(cfg.needs === 'person' && targetId ? { toType: 'person', toId: targetId } : {}),
      ...(cfg.needs === 'location' && targetId ? { toType: 'location', toId: targetId } : {}),
      ...(action === 'loan' && dueAt ? { dueAt } : {}),
      codes: nextCodes,
      assetIds: nextPicked,
    };
    try {
      const res = await fetch('/api/workflow/validate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Validace selhala');
      const data = (await res.json()) as WorkflowValidation;
      if (id === reqIdRef.current) setValidation(data);
    } catch (e) {
      if (id === reqIdRef.current) setError(e instanceof Error ? e.message : 'Chyba validace');
    }
  }, [action, cfg.needs, targetId, dueAt]);

  const addCode = useCallback(
    (raw: string) => {
      const c = raw.trim();
      if (!c) return;
      setResult(null);
      setError(null);
      codesRef.current = [...codesRef.current, c];
      setCodes(codesRef.current);
      void revalidate();
    },
    [revalidate],
  );

  const removeCode = useCallback(
    (code: string) => {
      const idx = codesRef.current.indexOf(code);
      if (idx >= 0) {
        codesRef.current = [...codesRef.current.slice(0, idx), ...codesRef.current.slice(idx + 1)];
        setCodes(codesRef.current);
        void revalidate();
      }
    },
    [revalidate],
  );

  const togglePick = useCallback(
    (id: string) => {
      const next = new Set(pickedRef.current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      pickedRef.current = next;
      setPicked(next);
      setResult(null);
      void revalidate();
    },
    [revalidate],
  );

  const reset = useCallback(() => {
    codesRef.current = [];
    pickedRef.current = new Set();
    setCodes([]);
    setPicked(new Set());
    setValidation(null);
    setResult(null);
    setError(null);
  }, []);

  const { videoRef, camOn, camSupported, error: camError, start, stop } = useBarcodeScanner(addCode, {
    continuous: true,
  });

  async function confirm() {
    if (!validation || validation.assetIds.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const body = {
        assetIds: validation.assetIds,
        type: action,
        ...(cfg.needs === 'person' && targetId ? { toType: 'person', toId: targetId } : {}),
        ...(cfg.needs === 'location' && targetId ? { toType: 'location', toId: targetId } : {}),
        ...(action === 'loan' && dueAt ? { dueAt } : {}),
      };
      const res = await fetch('/api/workflow/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Potvrzení selhalo');
      setResult((await res.json()) as { ok: number; failed: { assetId: string; error: string }[] });
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Neočekávaná chyba');
    } finally {
      setBusy(false);
    }
  }

  const okCount = validation?.okCount ?? 0;

  return (
    <div className="flex flex-col gap-5">
      {/* 1) Zvol akci */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <p className="mb-3 text-xs font-medium text-slate-600">Co děláš?</p>
        <div className="grid grid-cols-3 gap-2">
          {ACTIONS.map((a) => {
            const Icon = a.icon;
            const active = a.key === action;
            return (
              <button
                key={a.key}
                onClick={() => {
                  setAction(a.key);
                  setTargetId('');
                  reset();
                }}
                className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-sm font-medium transition ${
                  active
                    ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/20'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon size={18} />
                {a.label}
              </button>
            );
          })}
        </div>

        {needsTarget && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-600">
                {cfg.needs === 'person' ? 'Komu *' : 'Kam *'}
              </label>
              <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className={inputCls}>
                <option value="">— vyber —</option>
                {targetOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {action === 'loan' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-600">Vrátit do (volitelné)</label>
                <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={inputCls} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2) Skenuj */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="mb-4 overflow-hidden rounded-xl bg-slate-900">
          {/* Video je vždy v DOM (jen skryté), aby videoRef existoval při startu kamery. */}
          <video
            ref={videoRef}
            className={`h-48 w-full object-cover ${camOn ? '' : 'hidden'}`}
            muted
            playsInline
          />
          {!camOn && (
            <div className="flex h-48 w-full flex-col items-center justify-center gap-2 text-slate-400">
              <ScanLine size={36} />
              <p className="text-xs">Continuous scan – skenuj věci jednu po druhé</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {camOn ? (
            <button
              onClick={stop}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-300 sm:w-auto sm:justify-start"
            >
              <CameraOff size={16} /> Stop
            </button>
          ) : (
            <button
              onClick={start}
              disabled={!targetReady}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 sm:w-auto sm:justify-start"
              title={targetReady ? '' : 'Nejdřív vyber cíl'}
            >
              <Camera size={16} /> Skenovat kamerou
            </button>
          )}
          {codes.length > 0 && (
            <span className="text-xs text-slate-500 sm:ml-auto">Naskenováno: {codes.length}</span>
          )}
        </div>
        {!camSupported && (
          <p className="mt-2 text-xs text-amber-600">
            Kamera není dostupná (chybí HTTPS nebo přístup ke kameře) – použij ruční zadání / HW čtečku níže.
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            addCode(manual);
            setManual('');
          }}
          className="mt-4 flex gap-2"
        >
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-3 text-slate-400" />
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="Kód ručně / HW čtečka + Enter"
              className={`${inputCls} pl-9`}
              disabled={!targetReady}
            />
          </div>
          <button
            type="submit"
            disabled={!targetReady || !manual.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
          >
            Přidat
          </button>
        </form>
        {!targetReady && (
          <p className="mt-2 text-xs text-slate-400">Nejdřív vyber {cfg.needs === 'person' ? 'příjemce' : 'cílové místo'}.</p>
        )}

        {/* Nebo vyber ze seznamu (sjednocený výdej – web) */}
        <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60">
          <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium text-slate-600">
            Nebo vyber ze seznamu ({picked.size})
          </summary>
          <div className="border-t border-slate-200 p-3">
            <div className="relative mb-2">
              <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Hledat věc…"
                className={`${inputCls} pl-8`}
                disabled={!targetReady}
              />
            </div>
            <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white">
              {assets
                .filter((a) => a.name.toLowerCase().includes(query.toLowerCase()))
                .slice(0, 60)
                .map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => togglePick(a.id)}
                    disabled={!targetReady}
                    className="flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        picked.has(a.id) ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-300'
                      }`}
                    >
                      {picked.has(a.id) && <Check size={11} />}
                    </span>
                    <span className="flex-1 truncate text-slate-700">{a.name}</span>
                    <StatusBadge status={a.status} />
                  </button>
                ))}
            </div>
          </div>
        </details>
      </div>

      {/* 3) Seznam + blockers */}
      {validation && validation.items.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="mb-3 flex items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
              <CheckCircle2 size={15} /> {okCount} připraveno
            </span>
            {validation.blockedCount > 0 && (
              <span className="inline-flex items-center gap-1.5 font-medium text-amber-700">
                <AlertCircle size={15} /> {validation.blockedCount} blokováno
              </span>
            )}
            <button onClick={reset} className="ml-auto inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
              <Trash2 size={13} /> Vyčistit
            </button>
          </div>

          <ul className="flex flex-col divide-y divide-slate-100">
            {validation.items.map((it, i) => (
              <li key={`${it.code}-${i}`} className="flex items-center gap-3 py-2.5 text-sm">
                {it.ok ? (
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />
                ) : (
                  <XCircle size={16} className="shrink-0 text-amber-500" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-800">{it.name ?? it.code}</p>
                  {!it.ok && it.reason && <p className="truncate text-xs text-amber-700">{it.reason}</p>}
                </div>
                {it.status && <StatusBadge status={it.status} />}
                <button
                  onClick={() => (picked.has(it.code) ? togglePick(it.code) : removeCode(it.code))}
                  className="text-slate-300 hover:text-red-500"
                  title="Odebrat"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>

          <button
            onClick={confirm}
            disabled={busy || okCount === 0}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            {cfg.confirm} {okCount} {okCount === 1 ? 'věc' : okCount >= 2 && okCount <= 4 ? 'věci' : 'věcí'}
          </button>
        </div>
      )}

      {(error || camError) && (
        <p className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
          <AlertCircle size={15} /> {error ?? camError}
        </p>
      )}

      {result && (
        <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800 shadow-card">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Hotovo – {result.ok} věcí zpracováno.</p>
            {result.failed.length > 0 && (
              <p className="mt-0.5 text-amber-700">{result.failed.length} se nepodařilo (souběžná změna stavu).</p>
            )}
            <Badge tone="green">Můžeš skenovat další dávku</Badge>
          </div>
        </div>
      )}
    </div>
  );
}
