'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Camera,
  CameraOff,
  ScanLine,
  Search,
  Check,
  HelpCircle,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import type { InventoryDetail, Asset } from '../../../lib/types';
import { StatusBadge, EmptyState, Badge } from '../../ui';
import { useBarcodeScanner } from '../../scan/use-scanner';

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10';

export function InventoryScanner({
  checkId,
  expected,
  initialDetail,
  canReconcile,
  locationName,
  nameOf,
}: {
  checkId: string;
  expected: number;
  initialDetail: InventoryDetail;
  canReconcile: boolean;
  locationName: string;
  nameOf: Record<string, string>;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<InventoryDetail>(initialDetail);
  const [manual, setManual] = useState('');
  const [last, setLast] = useState<{ name: string; result: 'found' | 'unexpected' } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reconciled, setReconciled] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [reconciling, setReconciling] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showFlash = useCallback((msg: string) => {
    setFlash(msg);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 2500);
  }, []);

  const refresh = useCallback(async (): Promise<InventoryDetail | null> => {
    const res = await fetch(`/api/inventory/${checkId}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const d = (await res.json()) as InventoryDetail;
    setDetail(d);
    return d;
  }, [checkId]);

  const scan = useCallback(
    async (raw: string) => {
      const code = raw.trim();
      if (!code) return;
      try {
        const res = await fetch(`/api/inventory/${checkId}/scan`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ publicCode: code }),
          cache: 'no-store',
        });
        if (res.status === 404) {
          showFlash(`Nenalezeno: ${code}`);
          return;
        }
        if (!res.ok) {
          showFlash('Chyba skenu');
          return;
        }
        const scanRes = (await res.json()) as { assetId: string; result: 'found' | 'unexpected' };
        const d = await refresh();
        const asset = d
          ? [...d.found, ...d.unexpected].find((a) => a.id === scanRes.assetId)
          : undefined;
        setLast({ name: asset?.name ?? code, result: scanRes.result });
      } catch {
        showFlash('Chyba spojení');
      }
    },
    [checkId, refresh, showFlash],
  );

  const { videoRef, camOn, camSupported, error: camError, start, stop } = useBarcodeScanner(scan, {
    continuous: true,
  });

  async function finish() {
    setBusy(true);
    try {
      await fetch(`/api/inventory/${checkId}/close`, { method: 'POST', cache: 'no-store' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function reconcile(assetId: string) {
    setReconciling(assetId);
    try {
      const res = await fetch(`/api/inventory/${checkId}/reconcile`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ assetId }),
        cache: 'no-store',
      });
      if (!res.ok) {
        showFlash('Přesun evidence selhal');
        return;
      }
      setDetail((await res.json()) as InventoryDetail);
      setReconciled((prev) => new Set(prev).add(assetId));
    } finally {
      setReconciling(null);
    }
  }

  const holderLabel = (a: Asset): string => {
    if (!a.currentHolderId) return '—';
    return nameOf[a.currentHolderId] ?? (a.currentHolderType === 'person' ? 'osoba' : 'místo');
  };

  const foundN = detail.found.length;
  const pct = expected > 0 ? Math.min(100, Math.round((foundN / expected) * 100)) : 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Živá tabule */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Očekáváno" value={expected} tone="slate" />
        <Tile label="Nalezeno" value={foundN} tone="green" />
        <Tile label="Chybí" value={detail.missing.length} tone="red" />
        <Tile label="Navíc" value={detail.unexpected.length} tone="amber" />
      </div>

      {/* Progress */}
      <div>
        <div className="mb-1 flex justify-between text-xs text-slate-500">
          <span>Průběh</span>
          <span>
            {foundN} / {expected}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Scanner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="mb-4 overflow-hidden rounded-xl bg-slate-900">
          {camOn ? (
            <video ref={videoRef} className="h-44 w-full object-cover" muted playsInline />
          ) : (
            <div className="flex h-44 w-full flex-col items-center justify-center gap-2 text-slate-400">
              <ScanLine size={34} />
              <p className="text-xs">Continuous scan – skenuj věci jednu po druhé</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {camOn ? (
            <button
              onClick={stop}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-300"
            >
              <CameraOff size={16} /> Stop
            </button>
          ) : (
            <button
              onClick={start}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
            >
              <Camera size={16} /> Skenovat kamerou
            </button>
          )}
          {last && (
            <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium">
              {last.result === 'unexpected' ? (
                <span className="inline-flex items-center gap-1 text-amber-700">
                  <HelpCircle size={14} /> {last.name} (navíc)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <Check size={14} /> {last.name}
                </span>
              )}
            </span>
          )}
        </div>
        {!camSupported && (
          <p className="mt-2 text-xs text-amber-600">Kamera není podporovaná – použij ruční zadání / HW čtečku.</p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void scan(manual);
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
            />
          </div>
          <button
            type="submit"
            disabled={!manual.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
          >
            Naskenovat
          </button>
        </form>
        {flash && <p className="mt-2 text-xs text-amber-600">{flash}</p>}
        {camError && <p className="mt-2 text-xs text-red-600">{camError}</p>}
      </div>

      {/* Živé seznamy */}
      <div className="grid gap-6 lg:grid-cols-3">
        <LiveList title={`Nalezeno (${detail.found.length})`} items={detail.found.map((a) => ({ id: a.id, name: a.name, status: a.status }))} />
        <LiveList
          title={`Chybí (${detail.missing.length})`}
          items={detail.missing.map((a) => ({ id: a.id, name: a.name, status: a.status }))}
        />

        {/* Navíc + reconcile dialog (nalezeno tady, ale vedeno jinde) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Navíc ({detail.unexpected.length})</h2>
          {detail.unexpected.length === 0 ? (
            <EmptyState>—</EmptyState>
          ) : (
            <ul className="flex flex-col gap-3">
              {detail.unexpected.map((a) => {
                const done = reconciled.has(a.id);
                const skip = dismissed.has(a.id);
                return (
                  <li key={a.id} className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 truncate text-sm font-medium text-amber-900">{a.name}</span>
                      <StatusBadge status={a.status} />
                    </div>
                    {done ? (
                      <div className="mt-2">
                        <Badge tone="green">
                          <Check size={11} className="mr-1 inline" /> evidence přesunuta do „{locationName}"
                        </Badge>
                      </div>
                    ) : (
                      <>
                        <p className="mt-1 text-xs text-amber-700">
                          Evidováno: <span className="font-medium">{holderLabel(a)}</span> · fyzicky nalezeno tady ({locationName})
                        </p>
                        {canReconcile && !skip && (
                          <div className="mt-2 flex gap-2">
                            <button
                              onClick={() => reconcile(a.id)}
                              disabled={reconciling === a.id}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                            >
                              {reconciling === a.id ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={12} />}
                              Přesunout evidenci sem
                            </button>
                            <button
                              onClick={() => setDismissed((prev) => new Set(prev).add(a.id))}
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                            >
                              Nechat
                            </button>
                          </div>
                        )}
                        {skip && <p className="mt-2 text-xs text-slate-400">Ponecháno beze změny.</p>}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <button
        onClick={finish}
        disabled={busy}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
      >
        {busy && <Loader2 size={16} className="animate-spin" />}
        Dokončit inventuru
      </button>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: number; tone: 'slate' | 'green' | 'red' | 'amber' }) {
  const cls = {
    slate: 'bg-slate-50 text-slate-700 ring-slate-200',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    red: 'bg-red-50 text-red-700 ring-red-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  }[tone];
  return (
    <div className={`rounded-2xl p-4 text-center ring-1 ring-inset ${cls}`}>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs">{label}</p>
    </div>
  );
}

function LiveList({
  title,
  items,
  tone,
}: {
  title: string;
  items: { id: string; name: string; status: string }[];
  tone?: 'amber';
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <h2 className="mb-3 text-sm font-semibold text-slate-800">{title}</h2>
      {items.length === 0 ? (
        <EmptyState>—</EmptyState>
      ) : (
        <ul className="flex flex-col divide-y divide-slate-100">
          {items.map((a) => (
            <li key={a.id} className="flex items-center gap-2 py-2 text-sm">
              <span className={`flex-1 truncate ${tone === 'amber' ? 'text-amber-800' : 'text-slate-700'}`}>{a.name}</span>
              <StatusBadge status={a.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
