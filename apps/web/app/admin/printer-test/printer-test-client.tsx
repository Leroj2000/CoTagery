'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Bluetooth, Download, Printer } from 'lucide-react';
import { PageHeader, Section } from '../ui';
import { LabelPreview } from '../assets/printing/label-preview';
import { PrinterStatus } from '../assets/printing/printer-status';
import { useNiimbotPrinter } from '../../lib/printing/use-niimbot-printer';
import { setDebug, getLibraryVersion } from '../../lib/printing/niimbot-client';
import { clampCopies } from '../../lib/printing/copies';
import type { LabelData } from '../../lib/printing/types';

/**
 * Diagnostická obrazovka: zadej QR/název/kód, zobraz náhled 384 × 240 px, stáhni
 * PNG, připoj tiskárnu, identifikuj model, vytiskni 1 nebo 3 kopie a zapni
 * diagnostický režim knihovny (jen ve vývoji).
 */
export function PrinterTestClient() {
  const printer = useNiimbotPrinter();
  const [qrValue, setQrValue] = useState('https://tagery.app/r/DEMO-CODE');
  const [itemName, setItemName] = useState('Aku vrtačka Bosch GSB 18V-55 Professional');
  const [assetCode, setAssetCode] = useState('INV-000123');
  const [subtitle, setSubtitle] = useState('Nářadí');
  const [copies, setCopies] = useState(1);
  const [debug, setDebugState] = useState(false);
  const [version, setVersion] = useState<string | null>(null);
  const pngUrlRef = useRef<string | null>(null);

  const data: LabelData = useMemo(
    () => ({ qrValue, itemName, assetCode, subtitle: subtitle || undefined }),
    [qrValue, itemName, assetCode, subtitle],
  );

  const busy =
    printer.state === 'connecting' || printer.state === 'rendering' || printer.state === 'printing';
  const canPrint = (printer.state === 'connected' || printer.state === 'success') && !busy;

  useEffect(() => {
    setDebug(debug).catch(() => undefined);
    if (debug && !version) {
      getLibraryVersion()
        .then(setVersion)
        .catch(() => undefined);
    }
  }, [debug, version]);

  const downloadPng = () => {
    if (!pngUrlRef.current) return;
    const a = document.createElement('a');
    a.href = pngUrlRef.current;
    a.download = 'stitek-384x240.png';
    a.click();
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Test tisku štítků"
        description="Vývojová diagnostika NIIMBOT B1 (384 × 240 px)"
        icon={<Printer size={18} />}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Data štítku" description="Zadej libovolné hodnoty pro test">
          <div className="flex flex-col gap-3">
            <Field label="QR hodnota" value={qrValue} onChange={setQrValue} />
            <Field label="Název položky" value={itemName} onChange={setItemName} />
            <Field label="Evidenční kód" value={assetCode} onChange={setAssetCode} />
            <Field label="Podtitulek (nepovinný)" value={subtitle} onChange={setSubtitle} />
          </div>
        </Section>

        <Section
          title="Náhled a tisk"
          description="Náhled je shodný s tiskovým obrazem"
        >
          <div className="flex flex-col gap-4">
            <LabelPreview
              data={data}
              onPngUrl={(url) => {
                pngUrlRef.current = url;
              }}
            />

            <button
              type="button"
              onClick={downloadPng}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Download size={15} />
              Stáhnout PNG (diagnostika)
            </button>

            {!printer.supported ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                {printer.unsupportedKind === 'ios-no-bluetooth'
                  ? 'Na iPhonu otevřete stránku v aplikaci Bluefy.'
                  : 'Tento prohlížeč nepodporuje Web Bluetooth. Použijte Chrome/Edge.'}
              </p>
            ) : (
              <>
                <PrinterStatus state={printer.state} printer={printer.printer} progress={printer.progress} />
                {printer.state === 'error' && printer.error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                    <p>{printer.error}</p>
                    <button
                      type="button"
                      onClick={printer.resetError}
                      className="mt-1 text-xs font-medium underline"
                    >
                      Zkusit znovu
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={printer.connect}
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  <Bluetooth size={16} />
                  Připojit tiskárnu
                </button>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    Kopie
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={copies}
                      disabled={busy}
                      onChange={(e) => setCopies(clampCopies(e.target.value))}
                      className="w-20 rounded-lg border border-slate-300 px-2.5 py-1.5 text-right text-sm"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => printer.printLabel(data, 1)}
                    disabled={!canPrint}
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    <Printer size={15} /> Tisk 1×
                  </button>
                  <button
                    type="button"
                    onClick={() => printer.printLabel(data, 3)}
                    disabled={!canPrint}
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    <Printer size={15} /> Tisk 3×
                  </button>
                  <button
                    type="button"
                    onClick={() => printer.printLabel(data, copies)}
                    disabled={!canPrint}
                    className="inline-flex items-center gap-2 rounded-lg border border-brand-300 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50"
                  >
                    <Printer size={15} /> Tisk {copies}×
                  </button>
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={debug}
                    onChange={(e) => setDebugState(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  Diagnostický režim knihovny (konzole)
                  {version && <span className="text-xs text-slate-400">v{version}</span>}
                </label>
              </>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-slate-700">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </label>
  );
}
