'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import type { AssetSpec } from '../../lib/types';

/** Zkrátí URL na doménu (u URL), jinak vrátí zkrácený text. */
function sourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.length > 48 ? `${url.slice(0, 48)}…` : url;
  }
}

/**
 * Technické specifikace položky „přes AI" – dohledá klíčové parametry z webu a
 * zobrazí je jako tabulku + zdroj. Po spuštění polluje stav (fetching→ready/failed).
 */
export function AssetSpecs({
  assetId,
  initial,
  canManage,
}: {
  assetId: string;
  initial: AssetSpec | null;
  canManage: boolean;
}) {
  const [spec, setSpec] = useState<AssetSpec | null>(initial);
  const [busy, setBusy] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const poll = useCallback(() => {
    stop();
    let ticks = 0;
    timer.current = setInterval(async () => {
      ticks += 1;
      try {
        const res = await fetch(`/api/asset-specs/${assetId}`);
        if (res.ok) {
          const s = (await res.json()) as AssetSpec | null;
          setSpec(s);
          if (!s || s.status !== 'fetching') stop();
        }
      } catch {
        /* ponech pollovat */
      }
      if (ticks > 65) stop(); // ~2 min strop
    }, 2000);
  }, [assetId, stop]);

  useEffect(() => {
    if (initial?.status === 'fetching') poll();
    return stop;
  }, [initial, poll, stop]);

  async function run(): Promise<void> {
    setBusy(true);
    setNotConfigured(false);
    try {
      const res = await fetch(`/api/asset-specs/${assetId}/fetch-ai`, { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as {
        spec?: AssetSpec;
        configured?: boolean;
      };
      if (data.configured === false) {
        setNotConfigured(true);
        return;
      }
      if (data.spec) {
        setSpec(data.spec);
        if (data.spec.status === 'fetching') poll();
      }
    } finally {
      setBusy(false);
    }
  }

  const isFetching = spec?.status === 'fetching';
  const hasSpecs = spec?.status === 'ready' && spec.specs && spec.specs.length > 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Sparkles size={16} /> Technické specifikace
      </div>
      <p className="mb-4 text-xs text-slate-400">
        Klíčové parametry položky dohledané přes AI (výrobce/model).
      </p>

      {hasSpecs && (
        <table className="w-full text-sm">
          <tbody>
            {spec!.specs!.map((it, i) => (
              <tr key={i} className="border-b border-slate-100 last:border-0">
                <td className="w-2/5 py-1.5 pr-3 text-slate-500">{it.label}</td>
                <td className="py-1.5 font-medium text-slate-800">{it.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {isFetching && (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 size={15} className="animate-spin" /> Hledám specifikace…
        </p>
      )}

      {spec?.status === 'failed' && (
        <p className="text-sm text-red-600">
          {spec.failureReason ?? 'Specifikace se nepodařilo dohledat.'}
        </p>
      )}

      {!spec && !isFetching && <p className="text-sm text-slate-400">Zatím bez specifikací.</p>}

      {notConfigured && (
        <p className="mt-2 text-xs text-amber-600">AI dohledání specifikací zatím není nakonfigurováno.</p>
      )}

      {spec?.status === 'ready' && spec.sourceUrl && (
        <a
          href={spec.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={spec.sourceUrl}
          className="mt-3 inline-flex max-w-full items-center gap-1 text-xs text-brand-600 hover:underline"
        >
          <ExternalLink size={12} className="shrink-0" />
          <span className="truncate">Zdroj: {sourceHost(spec.sourceUrl)}</span>
        </a>
      )}

      {canManage && (
        <div className="mt-4">
          <button
            onClick={run}
            disabled={busy || isFetching}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {busy || isFetching ? (
              <Loader2 size={15} className="animate-spin" />
            ) : hasSpecs || spec?.status === 'failed' ? (
              <RefreshCw size={15} />
            ) : (
              <Sparkles size={15} />
            )}
            {hasSpecs || spec?.status === 'failed' ? 'Aktualizovat přes AI' : 'Načíst přes AI'}
          </button>
        </div>
      )}
    </div>
  );
}
