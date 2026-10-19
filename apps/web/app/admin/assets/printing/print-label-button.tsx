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
}: {
  data: LabelData;
  carrierId: string;
  /** Otevřít dialog sám, když adresa nese `?print=<carrierId>` (předání z Chrome do Bluefy). */
  autoOpenFromUrl?: boolean;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (autoOpenFromUrl && shouldAutoOpenPrint(window.location.search, carrierId)) setOpen(true);
  }, [autoOpenFromUrl, carrierId]);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        <Printer size={14} className="text-brand-600" />
        Vytisknout štítek
      </button>
      {open && (
        <PrintLabelDialog data={data} carrierId={carrierId} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
