'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, CheckCircle2, Loader2, ScanLine } from 'lucide-react';
import type { ScanResult } from '../../../lib/types';
import { ResultCard } from '../result-card';

/** Stav položky přes BFF (`GET /api/scan`) – jen náhled, nové pozorování nevzniká. */
async function fetchResult(code: string): Promise<ScanResult> {
  const res = await fetch(`/api/scan?code=${encodeURIComponent(code)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Položku se nepodařilo načíst. Zkus to znovu.');
  return (await res.json()) as ScanResult;
}

export function IdentifiedClient({
  code,
  observation,
}: {
  code: string;
  observation: string | null;
}) {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchResult(code)
      .then((r) => !cancelled && setResult(r))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : 'Chyba'));
    return () => {
      cancelled = true;
    };
  }, [code]);

  /** One-tap „Vrátit domů" → pohyb + obnovení karty. */
  const quickReturn = useCallback(
    async (assetId: string) => {
      setActing(true);
      setError(null);
      setFlash(null);
      try {
        const res = await fetch(`/api/asset-movement/${assetId}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ type: 'return' }),
          cache: 'no-store',
        });
        if (!res.ok) throw new Error('Vrácení se nepodařilo');
        setResult(await fetchResult(code));
        setFlash('Vráceno domů ✓');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Neočekávaná chyba');
      } finally {
        setActing(false);
      }
    },
    [code],
  );

  const identified = !!result?.found && !!result.asset;

  return (
    <div className="flex flex-col gap-5">
      {/* Zelená hlavička místo „Identifikovat" */}
      {(identified || !result) && (
        <div className="feedback-enter flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
            <CheckCircle2 size={24} />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-emerald-900">Položka nalezena</h1>
            <p className="text-sm font-medium text-emerald-700">Identifikováno</p>
          </div>
        </div>
      )}

      {observation && identified && <p className="text-xs text-slate-500">{observation}</p>}

      {error && (
        <p className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
          <AlertCircle size={15} /> {error}
        </p>
      )}
      {flash && (
        <p className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
          <Check size={15} /> {flash}
        </p>
      )}

      {!result && !error && (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 size={16} className="animate-spin" /> Načítám položku…
        </div>
      )}

      {result && (
        <ResultCard
          result={result}
          acting={acting}
          onQuickReturn={(assetId) => void quickReturn(assetId)}
        />
      )}

      <Link
        href="/admin/scan"
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <ScanLine size={16} /> Identifikovat další
      </Link>
    </div>
  );
}
