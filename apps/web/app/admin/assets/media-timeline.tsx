'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Image from 'next/image';
import { Camera, Loader2, ShieldCheck } from 'lucide-react';
import type { AssetMedia } from '../../lib/types';

const PHASE_LABEL: Record<string, string> = {
  at_loan: 'Při půjčení',
  at_return: 'Při vrácení',
  at_service: 'Servis',
  general: 'Obecné',
};
const PHASE_TONE: Record<string, string> = {
  at_loan: 'bg-amber-50 text-amber-700 ring-amber-200',
  at_return: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  at_service: 'bg-brand-50 text-brand-700 ring-brand-200',
  general: 'bg-slate-100 text-slate-600 ring-slate-200',
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('cs-CZ');
}

/** Časová galerie věci: upload s fází + mřížka médií + porovnání půjčka⇄vrácení. */
export function MediaTimeline({ assetId, media }: { assetId: string; media: AssetMedia[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState('general');
  const [caption, setCaption] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('phase', phase);
      if (caption) fd.append('caption', caption);
      const res = await fetch(`/api/asset-media/${assetId}`, { method: 'POST', body: fd });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { message?: string };
        setError(b.message ?? 'Nahrání selhalo.');
        return;
      }
      setCaption('');
      router.refresh();
    } catch {
      setError('Nahrání selhalo.');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  const atLoan = media.filter((m) => m.phase === 'at_loan')[0];
  const atReturn = media.filter((m) => m.phase === 'at_return')[0];

  return (
    <div className="flex flex-col gap-4">
      {/* Porovnání půjčka ⇄ vrácení */}
      {(atLoan || atReturn) && (
        <div className="grid gap-3 sm:grid-cols-2">
          <ComparePane label="Při půjčení" media={atLoan} />
          <ComparePane label="Při vrácení" media={atReturn} />
        </div>
      )}

      {/* Upload */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Fáze</label>
          <select
            value={phase}
            onChange={(e) => setPhase(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="general">Obecné</option>
            <option value="at_loan">Při půjčení</option>
            <option value="at_return">Při vrácení</option>
            <option value="at_service">Servis</option>
          </select>
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Popis (volitelné)</label>
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="např. škrábanec na krytu"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
          Přidat foto
          <input type="file" accept="image/*,video/*" onChange={onFile} disabled={busy} className="hidden" />
        </label>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Mřížka médií */}
      {media.length === 0 ? (
        <p className="text-sm text-slate-400">Zatím žádná média.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {media.map((m) => (
            <div key={m.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <Image
                src={`/api/media-file/${m.id}`}
                alt={m.caption ?? 'médium'}
                width={240}
                height={180}
                unoptimized
                className="h-32 w-full object-cover"
              />
              <div className="flex flex-col gap-1 p-2">
                <span className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${PHASE_TONE[m.phase]}`}>
                  {PHASE_LABEL[m.phase] ?? m.phase}
                </span>
                {m.caption && <p className="truncate text-xs text-slate-600">{m.caption}</p>}
                <p className="text-[10px] text-slate-400">{fmt(m.capturedAt)}</p>
                {m.sha256 && (
                  <p className="flex items-center gap-1 text-[10px] text-emerald-600" title={m.sha256}>
                    <ShieldCheck size={11} /> ověřitelné
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ComparePane({ label, media }: { label: string; media?: AssetMedia }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2">
      <p className="mb-1 px-1 text-xs font-medium text-slate-500">{label}</p>
      {media ? (
        <Image
          src={`/api/media-file/${media.id}`}
          alt={label}
          width={320}
          height={200}
          unoptimized
          className="h-40 w-full rounded-lg object-cover"
        />
      ) : (
        <div className="flex h-40 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
          bez fotky
        </div>
      )}
    </div>
  );
}
