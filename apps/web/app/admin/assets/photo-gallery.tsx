'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Camera, Loader2, Star, Trash2, ImagePlus } from 'lucide-react';

interface GalleryPhoto {
  id: string;
  mime: string;
  position: number;
}

/**
 * Galerie fotek věci. První fotka (pozice 0) je hlavní a zobrazuje se v seznamu
 * věcí. Umožňuje přidat víc fotek (do limitu z nastavení), nastavit hlavní a mazat.
 */
export function PhotoGallery({
  assetId,
  photos,
  max,
  canManage,
}: {
  assetId: string;
  photos: GalleryPhoto[];
  max: number;
  canManage: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null); // id akce (upload/main-<id>/del-<id>)
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const full = photos.length >= max;

  async function upload(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setBusy('upload');
    setError(null);
    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append('files', f));
      const res = await fetch(`/api/asset-photos/${assetId}`, { method: 'POST', body: fd });
      if (!res.ok) {
        setError(res.status === 400 ? 'Nahrání selhalo (limit fotek nebo neplatný soubor).' : 'Nahrání selhalo.');
        return;
      }
      router.refresh();
    } catch {
      setError('Nahrání selhalo.');
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function setMain(photoId: string): Promise<void> {
    setBusy(`main-${photoId}`);
    setError(null);
    try {
      const res = await fetch(`/api/asset-photos/${assetId}/${photoId}/main`, { method: 'POST' });
      if (!res.ok) setError('Nastavení hlavní fotky selhalo.');
      else router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function remove(photoId: string): Promise<void> {
    if (!confirm('Smazat tuto fotku?')) return;
    setBusy(`del-${photoId}`);
    setError(null);
    try {
      const res = await fetch(`/api/asset-photos/${assetId}/${photoId}`, { method: 'DELETE' });
      if (!res.ok) setError('Smazání selhalo.');
      else router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Fotky položky</h3>
        <span className="text-xs text-slate-400">
          {photos.length}/{max}
        </span>
      </div>

      {photos.length === 0 ? (
        <p className="text-sm text-slate-400">Zatím žádné fotky.</p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {photos.map((p, i) => (
            <div key={p.id} className="group relative overflow-hidden rounded-xl border border-slate-200">
              <img
                src={`/api/asset-photos/${assetId}/${p.id}`}
                alt=""
                className="aspect-square w-full object-cover"
              />
              {i === 0 && (
                <span className="absolute left-1 top-1 inline-flex items-center gap-1 rounded-md bg-brand-600/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  <Star size={10} /> Hlavní
                </span>
              )}
              {canManage && (
                <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent p-1">
                  {i !== 0 ? (
                    <button
                      onClick={() => setMain(p.id)}
                      disabled={busy !== null}
                      title="Nastavit jako hlavní"
                      className="rounded-md bg-white/90 p-1 text-slate-700 hover:bg-white disabled:opacity-50"
                    >
                      {busy === `main-${p.id}` ? <Loader2 size={13} className="animate-spin" /> : <Star size={13} />}
                    </button>
                  ) : (
                    <span />
                  )}
                  <button
                    onClick={() => remove(p.id)}
                    disabled={busy !== null}
                    title="Smazat"
                    className="rounded-md bg-white/90 p-1 text-red-600 hover:bg-white disabled:opacity-50"
                  >
                    {busy === `del-${p.id}` ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <div className="flex flex-col items-start gap-1">
          <label
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium shadow-sm transition ${
              full || busy === 'upload'
                ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
                : 'cursor-pointer border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {busy === 'upload' ? (
              <Loader2 size={15} className="animate-spin" />
            ) : photos.length === 0 ? (
              <Camera size={15} />
            ) : (
              <ImagePlus size={15} />
            )}
            {photos.length === 0 ? 'Nahrát fotku' : 'Přidat fotku'}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={upload}
              disabled={full || busy === 'upload'}
              className="hidden"
            />
          </label>
          {full && <p className="text-xs text-amber-600">Dosažen limit {max} fotek (změň v Nastavení).</p>}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
