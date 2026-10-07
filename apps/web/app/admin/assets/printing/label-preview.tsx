'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { DEFAULT_LABEL_FORMAT, findLabelFormat, type LabelTemplate } from '@tagery/shared';
import { labelPixelSize, renderLabel } from '../../../lib/printing/render-label';
import type { LabelData } from '../../../lib/printing/types';

/**
 * Přesný náhled štítku ve zvoleném formátu a šabloně. Vykreslí se stejnou
 * funkcí jako tiskový obraz, takže náhled == tisk. Client-only (canvas/Blob) –
 * během SSR nic nedělá.
 *
 * `onPngUrl` nepovinně vrací object URL vykreslené PNG (test page ji nabízí ke
 * stažení pro diagnostiku).
 */
export function LabelPreview({
  data,
  formatKey = DEFAULT_LABEL_FORMAT,
  template = null,
  className,
  onPngUrl,
}: {
  data: LabelData;
  formatKey?: string;
  template?: LabelTemplate | null;
  className?: string;
  onPngUrl?: (url: string | null) => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  // Callback držíme v refu, ať efekt nezávisí na jeho identitě (jinak by inline
  // funkce z volajícího spouštěla re-render smyčku).
  const onPngUrlRef = useRef(onPngUrl);
  onPngUrlRef.current = onPngUrl;

  const dataKey = JSON.stringify(data);
  const templateKey = JSON.stringify(template);
  const format = findLabelFormat(formatKey) ?? findLabelFormat(DEFAULT_LABEL_FORMAT)!;
  const px = labelPixelSize(format);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    setReady(false);
    setError(false);

    renderLabel(data, { formatKey, template })
      .then((rendered) => {
        if (cancelled) {
          rendered.revoke();
          return;
        }
        url = rendered.url;
        if (imgRef.current) imgRef.current.src = rendered.url;
        setReady(true);
        onPngUrlRef.current?.(rendered.url);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
      onPngUrlRef.current?.(null);
      if (url) URL.revokeObjectURL(url);
    };
    // Přerenderuje se jen při změně dat štítku, formátu nebo šablony.
  }, [dataKey, formatKey, templateKey]);

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white ${className ?? ''}`}
      // Poměr stran přesně podle bitmapy formátu.
      style={{ aspectRatio: `${px.w} / ${px.h}` }}
    >
      {!ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-300">
          <Loader2 className="animate-spin" size={20} />
        </div>
      )}
      {error ? (
        <p className="p-4 text-center text-xs text-red-600">Náhled se nepodařilo připravit.</p>
      ) : (
        <img
          ref={imgRef}
          alt={`Náhled štítku ${format.label}`}
          width={px.w}
          height={px.h}
          className="h-full w-full object-contain"
          style={{ imageRendering: 'pixelated' }}
        />
      )}
    </div>
  );
}
