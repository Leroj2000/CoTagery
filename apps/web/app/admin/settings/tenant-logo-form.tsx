'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImageUp, Loader2, Trash2 } from 'lucide-react';
import {
  TENANT_LOGO_URL,
  drawBrandedQr,
  drawQrCaption,
  invalidateLogoCache,
  loadLogo,
} from '../../lib/qr/branded-qr';

/** Ukázková hodnota pro náhled (délka odpovídá běžné resolver URL). */
const PREVIEW_VALUE = 'https://app.tagery.tech/r/AB12CD34';
const PREVIEW_PX = 220;

/**
 * Logo firmy (jen PNG) pro střed QR kódů. Náhled kreslí stejná funkce jako
 * štítky, takže ukazuje přesně, jak bude QR vypadat (barevně i černobíle).
 */
export function TenantLogoForm({ hasLogo, canEdit }: { hasLogo: boolean; canEdit: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const colorRef = useRef<HTMLCanvasElement>(null);
  const monoRef = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Verze pro cache-busting náhledu po nahrání/smazání.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const url = hasLogo ? `${TENANT_LOGO_URL}?v=${version}` : null;
    void loadLogo(url).then((logo) => {
      if (cancelled) return;
      for (const [canvas, monochrome] of [
        [colorRef.current, false],
        [monoRef.current, true],
      ] as const) {
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) continue;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const qr = drawBrandedQr(ctx, PREVIEW_VALUE, {
          x: 0,
          y: 0,
          maxSize: PREVIEW_PX,
          logo,
          monochrome,
        });
        drawQrCaption(ctx, qr, 0, qr.size + 2, 14);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [hasLogo, version]);

  async function upload(file: File) {
    setError(null);
    if (file.type !== 'image/png') {
      setError('Logo musí být ve formátu PNG.');
      return;
    }
    setBusy(true);
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/tenant-logo', { method: 'POST', body: form });
    setBusy(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      setError(body?.message ?? 'Logo se nepodařilo nahrát.');
      return;
    }
    invalidateLogoCache();
    setVersion((v) => v + 1);
    router.refresh();
  }

  async function remove() {
    setError(null);
    setBusy(true);
    const res = await fetch('/api/tenant-logo', { method: 'DELETE' });
    setBusy(false);
    if (!res.ok) {
      setError('Logo se nepodařilo smazat.');
      return;
    }
    invalidateLogoCache();
    setVersion((v) => v + 1);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-6">
        <figure className="flex flex-col items-start gap-1">
          <canvas
            ref={colorRef}
            width={PREVIEW_PX}
            height={PREVIEW_PX + 20}
            className="h-auto w-44 rounded-lg ring-1 ring-slate-200"
          />
          <figcaption className="text-xs text-slate-500">Náhled (PDF, obrazovka)</figcaption>
        </figure>
        <figure className="flex flex-col items-start gap-1">
          <canvas
            ref={monoRef}
            width={PREVIEW_PX}
            height={PREVIEW_PX + 20}
            className="h-auto w-44 rounded-lg ring-1 ring-slate-200"
          />
          <figcaption className="text-xs text-slate-500">Termotisk (Niimbot, černobíle)</figcaption>
        </figure>
      </div>

      <p className="text-sm text-slate-500">
        Jen PNG, max. 2 MB. Ideálně s průhledným pozadím a výrazným, jednoduchým tvarem. QR s logem
        používá nejvyšší úroveň opravy chyb, takže logo neovlivní rychlost načtení.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void upload(file);
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <ImageUp size={16} />}
            {hasLogo ? 'Nahradit logo' : 'Nahrát logo'}
          </button>
          {hasLogo && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void remove()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Trash2 size={16} /> Odebrat logo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
