'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import {
  Camera,
  Download,
  ExternalLink,
  FileText,
  ImageIcon,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react';
import type { AssetManual } from '../../lib/types';

const SOURCE_LABELS: Record<AssetManual['source'], string> = {
  upload: 'Soubor',
  camera: 'Foto',
  ai: 'AI',
};

function fmtSize(bytes: number | string | null): string {
  if (bytes == null) return '';
  const n = typeof bytes === 'string' ? Number(bytes) : bytes;
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} kB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Zkrátí zdroj na doménu (u URL), jinak vrátí původní text zkrácený. */
function sourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.length > 48 ? `${url.slice(0, 48)}…` : url;
  }
}

/**
 * Sekce „Manuály a návody" k položce. Tři způsoby přidání: upload souboru,
 * vyfocení kamerou telefonu, automatické stažení „přes AI" (webhook do n8n).
 * Mobile-first – tlačítko fotky cílí na zadní kameru telefonu.
 */
export function AssetManuals({
  assetId,
  manuals,
  canManage,
}: {
  assetId: string;
  manuals: AssetManual[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  async function upload(
    e: React.ChangeEvent<HTMLInputElement>,
    source: 'upload' | 'camera',
  ): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(source);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('source', source);
      const res = await fetch(`/api/asset-manuals/${assetId}`, { method: 'POST', body: fd });
      if (!res.ok) {
        setError(
          res.status === 400
            ? 'Nahrání selhalo (nepodporovaný typ nebo příliš velký soubor).'
            : 'Nahrání selhalo.',
        );
        return;
      }
      router.refresh();
    } catch {
      setError('Nahrání selhalo.');
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
      if (camRef.current) camRef.current.value = '';
    }
  }


  async function remove(manualId: string): Promise<void> {
    if (!confirm('Smazat tento manuál?')) return;
    setBusy(`del-${manualId}`);
    setError(null);
    try {
      const res = await fetch(`/api/manual-file/${manualId}`, { method: 'DELETE' });
      if (!res.ok) setError('Smazání selhalo.');
      else router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const anyBusy = busy !== null;

  return (
    <div className="flex flex-col gap-4">
      {manuals.length === 0 ? (
        <p className="text-sm text-slate-400">Zatím žádné manuály.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-slate-100 rounded-xl border border-slate-200">
          {manuals.map((m) => {
            const isPdf = m.mime === 'application/pdf';
            const size = fmtSize(m.sizeBytes);
            return (
              <li key={m.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <span className="text-slate-400">
                  {isPdf ? <FileText size={18} /> : <ImageIcon size={18} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-800">{m.title}</p>
                  <p className="text-xs text-slate-400">
                    {SOURCE_LABELS[m.source]}
                    {size ? ` · ${size}` : ''}
                    {m.status === 'fetching' ? ' · stahuji…' : ''}
                    {m.status === 'failed' && !m.failureReason ? ' · nenalezeno' : ''}
                  </p>
                  {m.status === 'failed' && m.failureReason && (
                    <p className="mt-0.5 text-xs text-red-600">{m.failureReason}</p>
                  )}
                  {m.sourceUrl && (
                    <a
                      href={m.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={m.sourceUrl}
                      className="mt-0.5 inline-flex max-w-full items-center gap-1 text-xs text-brand-600 hover:underline"
                    >
                      <ExternalLink size={12} className="shrink-0" />
                      <span className="truncate">Zdroj: {sourceHost(m.sourceUrl)}</span>
                    </a>
                  )}
                </div>
                {m.status === 'fetching' && (
                  <Loader2 size={16} className="animate-spin text-slate-400" />
                )}
                {m.status === 'ready' && m.fileKey && (
                  <a
                    href={`/api/manual-file/${m.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Otevřít / stáhnout"
                    className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  >
                    <Download size={16} />
                  </a>
                )}
                {canManage && (
                  <button
                    onClick={() => remove(m.id)}
                    disabled={anyBusy}
                    title="Smazat"
                    className="rounded-md p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {busy === `del-${m.id}` ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canManage && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <label
              className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium shadow-sm transition ${
                anyBusy
                  ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {busy === 'upload' ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Upload size={15} />
              )}
              Nahrát soubor
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => upload(e, 'upload')}
                disabled={anyBusy}
                className="hidden"
              />
            </label>

            <label
              className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium shadow-sm transition ${
                anyBusy
                  ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {busy === 'camera' ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Camera size={15} />
              )}
              Vyfotit
              <input
                ref={camRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => upload(e, 'camera')}
                disabled={anyBusy}
                className="hidden"
              />
            </label>

          </div>
          <p className="text-xs text-slate-400">
            Podporované soubory: PDF a obrázky. „Vyfotit" na telefonu spustí kameru.
          </p>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
