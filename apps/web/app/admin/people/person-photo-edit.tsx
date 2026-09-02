'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, Trash2, X } from 'lucide-react';

/**
 * Editace profilové fotky existující osoby: nahrání/výměna (POST) a smazání
 * (DELETE) přes BFF `/api/person-photo/:id`. Mirror stylu z `person-form.tsx`,
 * `capture="environment"` umožní vyfotit rovnou z mobilu. Po akci `router.refresh()`.
 */
export function PersonPhotoEdit({
  personId,
  hasPhoto,
}: {
  personId: string;
  hasPhoto: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<'upload' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy('upload');
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/person-photo/${personId}`, { method: 'POST', body: fd });
      if (!res.ok) {
        setError(res.status === 400 ? 'Neplatný soubor.' : 'Nahrání selhalo.');
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError('Nahrání selhalo.');
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function remove(): Promise<void> {
    if (!confirm('Smazat fotku osoby?')) return;
    setBusy('delete');
    setError(null);
    try {
      const res = await fetch(`/api/person-photo/${personId}`, { method: 'DELETE' });
      if (!res.ok) {
        setError('Smazání selhalo.');
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError('Smazání selhalo.');
    } finally {
      setBusy(null);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
      >
        <Camera size={12} /> Fotka
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label
        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium shadow-sm transition ${
          busy
            ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
            : 'cursor-pointer border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
        }`}
      >
        {busy === 'upload' ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={12} />}
        {hasPhoto ? 'Vyměnit' : 'Nahrát'}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={upload}
          disabled={busy !== null}
          className="hidden"
        />
      </label>

      {hasPhoto && (
        <button
          onClick={remove}
          disabled={busy !== null}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-slate-50 disabled:opacity-50"
        >
          {busy === 'delete' ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
          Smazat
        </button>
      )}

      <button
        type="button"
        onClick={() => setOpen(false)}
        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
      >
        <X size={12} /> Zavřít
      </button>

      {error && <span className="w-full text-xs text-red-600">{error}</span>}
    </div>
  );
}
