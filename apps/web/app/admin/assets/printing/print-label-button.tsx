'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { shouldAutoOpenPrint } from '../../../lib/printing/bluefy';
import { Printer } from 'lucide-react';
import type { LabelData } from '../../../lib/printing/types';

/**
 * Tlačítko „Vytisknout štítek“ na detailu položky. Dialog (a s ním celá
 * Bluetooth/canvas vrstva) se načítá dynamicky bez SSR – během serverového
 * renderu se nesáhne na `window`/`navigator`/canvas.
 *
 * Oprávnění: tlačítko se vykresluje jen tam, kde už uživatel položku vidí
 * (je na jejím detailu = má `asset.item.view`). Nezavádí nové permission.
 */
const PrintLabelDialog = dynamic(
  () => import('./print-label-dialog').then((m) => m.PrintLabelDialog),
  { ssr: false },
);

export function PrintLabelButton({
  data,
  carrierId,
  autoOpenFromUrl = false,
  variant = 'toolbar',
}: {
  data: LabelData;
  carrierId: string;
  /** Otevřít dialog sám, když adresa nese `?print=<carrierId>` (předání z Chrome do Bluefy). */
  autoOpenFromUrl?: boolean;
  /** `card` = primární plná šířka v řadě se „Kopírovat URL“. `toolbar` = kompaktní (akční lišta, průvodce). */
  variant?: 'toolbar' | 'card';
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (autoOpenFromUrl && shouldAutoOpenPrint(window.location.search, carrierId)) setOpen(true);
  }, [autoOpenFromUrl, carrierId]);
  const card = variant === 'card';
  return (
    <div className={card ? 'w-full' : 'inline-flex'}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          card
            ? 'inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-transparent bg-brand-600 text-sm font-medium text-white hover:bg-brand-700 sm:h-10'
            : 'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50'
        }
      >
        <Printer
          size={card ? 16 : 14}
          className={`shrink-0 ${card ? 'text-white' : 'text-brand-600'}`}
        />
        <span className={card ? 'truncate' : undefined}>Vytisknout štítek</span>
      </button>
      {open && (
        <PrintLabelDialog data={data} carrierId={carrierId} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}
