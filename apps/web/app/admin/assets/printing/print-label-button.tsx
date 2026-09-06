'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
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

export function PrintLabelButton({ data, carrierId }: { data: LabelData; carrierId: string }) {
  const [open, setOpen] = useState(false);
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
