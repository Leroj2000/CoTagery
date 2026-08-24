'use client';

import { CheckCircle2, Loader2, Printer, XCircle } from 'lucide-react';
import type { PrinterInfo, PrinterState } from '../../../lib/printing/types';

/**
 * Řádek se stavem tiskárny + identifikací připojeného modelu a průběhem tisku.
 * Čistě prezentační – veškerý stav dostává z hooku.
 */
export function PrinterStatus({
  state,
  printer,
  progress,
}: {
  state: PrinterState;
  printer: PrinterInfo | null;
  progress: string | null;
}) {
  const { icon, label, tone } = describe(state, printer);
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-sm">
      <div className={`flex items-center gap-2 font-medium ${tone}`}>
        {icon}
        <span>{label}</span>
      </div>
      {printer && (state === 'connected' || state === 'printing' || state === 'rendering' || state === 'success') && (
        <p className="pl-6 text-xs text-slate-500">
          {printer.label}
          {printer.dpi ? ` · ${printer.dpi} DPI` : ''}
          {printer.deviceName ? ` · ${printer.deviceName}` : ''}
        </p>
      )}
      {progress && state === 'printing' && <p className="pl-6 text-xs text-slate-500">{progress}</p>}
    </div>
  );
}

function describe(
  state: PrinterState,
  printer: PrinterInfo | null,
): { icon: React.ReactNode; label: string; tone: string } {
  switch (state) {
    case 'unsupported':
      return { icon: <XCircle size={16} />, label: 'Bluetooth tisk není dostupný', tone: 'text-slate-500' };
    case 'idle':
      return { icon: <Printer size={16} />, label: 'Tiskárna nepřipojena', tone: 'text-slate-600' };
    case 'connecting':
      return { icon: <Loader2 size={16} className="animate-spin" />, label: 'Připojuji tiskárnu…', tone: 'text-slate-600' };
    case 'connected':
      return { icon: <CheckCircle2 size={16} />, label: printer ? 'Tiskárna připojena' : 'Připojeno', tone: 'text-emerald-600' };
    case 'rendering':
      return { icon: <Loader2 size={16} className="animate-spin" />, label: 'Připravuji štítek…', tone: 'text-slate-600' };
    case 'printing':
      return { icon: <Loader2 size={16} className="animate-spin" />, label: 'Tisknu…', tone: 'text-brand-600' };
    case 'success':
      return { icon: <CheckCircle2 size={16} />, label: 'Štítek byl odeslán do tiskárny.', tone: 'text-emerald-600' };
    case 'error':
      return { icon: <XCircle size={16} />, label: 'Chyba tisku', tone: 'text-red-600' };
    default:
      return { icon: <Printer size={16} />, label: '', tone: 'text-slate-600' };
  }
}
