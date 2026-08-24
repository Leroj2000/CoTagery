'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Bluetooth, Info, Printer, RotateCcw, X } from 'lucide-react';
import { useNiimbotPrinter } from '../../../lib/printing/use-niimbot-printer';
import { clampCopies } from '../../../lib/printing/copies';
import { COPIES_MAX, COPIES_MIN } from '../../../lib/printing/niimbot-config';
import { PRINTER_MESSAGES } from '../../../lib/printing/printer-messages';
import type { LabelData } from '../../../lib/printing/types';
import { LabelPreview } from './label-preview';
import { PrinterStatus } from './printer-status';

const BLUEFY_URL = 'https://apps.apple.com/us/app/bluefy-web-ble-browser/id1492822055';

/**
 * Modální dialog pro tisk štítku na NIIMBOT B1: náhled, stav tiskárny,
 * připojení, počet kopií (1–99), tisk, průběh, opakování po chybě a zákaz
 * dvojitého odeslání. Veškerá tisková logika je v hooku/izolované vrstvě.
 */
export function PrintLabelDialog({ data, onClose }: { data: LabelData; onClose: () => void }) {
  const printer = useNiimbotPrinter();
  const [copies, setCopies] = useState(1);

  const busy = printer.state === 'connecting' || printer.state === 'rendering' || printer.state === 'printing';
  const canPrint =
    (printer.state === 'connected' || printer.state === 'success') && !busy;

  const previewData = useMemo(() => data, [data]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Tisk štítku"
      onClick={() => !busy && onClose()}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Printer size={16} className="text-brand-600" />
            Tisk štítku
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
            aria-label="Zavřít"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">
          {/* Přesný náhled 384 × 240 px */}
          <div>
            <LabelPreview data={previewData} />
            <p className="mt-1 text-center text-[11px] text-slate-400">384 × 240 px · 50 × 30 mm · 203 DPI</p>
          </div>

          {/* Nepodporované prostředí → návod */}
          {!printer.supported ? (
            <UnsupportedNotice kind={printer.unsupportedKind} />
          ) : (
            <>
              <PrinterStatus state={printer.state} printer={printer.printer} progress={printer.progress} />

              {/* Chyba + možnost opakovat */}
              {printer.state === 'error' && printer.error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p>{printer.error}</p>
                    <button
                      type="button"
                      onClick={printer.resetError}
                      className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-red-700 underline hover:text-red-800"
                    >
                      <RotateCcw size={12} /> Zkusit znovu
                    </button>
                  </div>
                </div>
              )}

              {/* Připojení tiskárny */}
              {printer.state === 'idle' || (printer.state === 'error' && !printer.printer) ? (
                <button
                  type="button"
                  onClick={printer.connect}
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  <Bluetooth size={16} />
                  Připojit tiskárnu
                </button>
              ) : null}

              {printer.state === 'connecting' && (
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white opacity-60"
                >
                  <Bluetooth size={16} />
                  Připojuji…
                </button>
              )}

              {/* Počet kopií + tisk (po připojení) */}
              {(printer.state === 'connected' ||
                printer.state === 'rendering' ||
                printer.state === 'printing' ||
                printer.state === 'success') && (
                <div className="flex flex-col gap-3">
                  <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
                    <span>Počet kopií</span>
                    <input
                      type="number"
                      min={COPIES_MIN}
                      max={COPIES_MAX}
                      value={copies}
                      disabled={busy}
                      onChange={(e) => setCopies(clampCopies(e.target.value))}
                      className="w-20 rounded-lg border border-slate-300 px-2.5 py-1.5 text-right text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => printer.printLabel(data, copies)}
                    disabled={!canPrint}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    <Printer size={16} />
                    {busy ? 'Tisknu…' : `Vytisknout${copies > 1 ? ` (${copies}×)` : ''}`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function UnsupportedNotice({ kind }: { kind: 'ios-no-bluetooth' | 'unsupported' | null }) {
  if (kind === 'ios-no-bluetooth') {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
        <Info size={16} className="mt-0.5 shrink-0" />
        <div>
          <p>{PRINTER_MESSAGES['ios-no-bluetooth']}</p>
          <a href={BLUEFY_URL} target="_blank" rel="noreferrer" className="mt-1 inline-block font-medium underline">
            Stáhnout Bluefy
          </a>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
      <Info size={16} className="mt-0.5 shrink-0" />
      <p>{PRINTER_MESSAGES.unsupported} Použijte Chrome nebo Edge (Android, Windows, macOS).</p>
    </div>
  );
}
