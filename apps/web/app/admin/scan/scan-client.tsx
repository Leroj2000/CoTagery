'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, ScanLine, Camera, CameraOff, Search, AlertCircle, Check } from 'lucide-react';
import type { ScanResult } from '../../lib/types';
import { useBarcodeScanner } from './use-scanner';
import { ResultCard } from './result-card';
import { captureScanPosition } from '../../lib/scan-position';
import { ManualPosition, type ManualCapture } from './manual-position';

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10';

/**
 * Identifikace kódu (kamera / ruční zadání / HW čtečka). Když kód vede na
 * evidovanou položku, po uložení pozorování přejde na stránku „Položka
 * nalezena" (`/admin/scan/result`). Ostatní výsledky zůstávají zde.
 * `autoStart` = identifikovat `initialCode` hned po otevření (odkaz z veřejné
 * stránky po skenu telefonem → přihlášení → identifikace).
 */
export function ScanClient({
  initialCode = '',
  autoStart = false,
  locations,
  locationsAvailable,
}: {
  initialCode?: string;
  autoStart?: boolean;
  locations: { id: string; name: string }[];
  locationsAvailable: boolean;
}) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [includePosition, setIncludePosition] = useState(true);
  const [pending, setPending] = useState<{ code: string; technology: string } | null>(null);
  const busyRef = useRef(false);
  const [technology, setTechnology] = useState('unknown');
  const [positionMessage, setPositionMessage] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Kód právě načtený kamerou – zobrazí potvrzení v náhledovém poli (kamera se vypne).
  const [camFlash, setCamFlash] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const lookup = useCallback(
    async (
      raw: string,
      capture = true,
      manual?: ManualCapture,
      selectedTechnology = technology,
    ) => {
      const c = raw.trim();
      if (!c || busyRef.current || (capture && pending)) return;
      try {
        const url = new URL(c, window.location.origin);
        const match = url.origin === window.location.origin && url.pathname.match(/^\/admin\/locations\/([\da-f-]{36})$/i);
        if (match && locations.some((place) => place.id === match[1])) { router.push(`/admin/locations/${match[1]}`); return; }
      } catch { /* Ordinary identifier, not a location URL. */ }
      busyRef.current = true;
      setLoading(true);
      setError(null);
      setResult(null);
      try {
        let reason = 'Poloha není dostupná.';
        const positionPromise =
          includePosition && capture
            ? captureScanPosition((message) => {
                reason = message;
              })
            : Promise.resolve(undefined);
        if (capture) {
          const preview = await fetch(`/api/scan?code=${encodeURIComponent(c)}`, { cache: 'no-store' });
          if (!preview.ok) throw new Error('Identifikátor se nepodařilo ověřit. Zkus to znovu.');
          const identified = await preview.json() as ScanResult;
          setResult(identified);
          if (!identified.asset) {
            setPositionMessage('Kód nevede na dostupnou položku; pozorování nevzniklo.');
            return;
          }
          setPositionMessage('Položka rozpoznána. Dokončuji záznam pozorování…');
        }
        const position = await positionPromise;
        if (includePosition && capture && !position) {
          setPositionMessage(reason);
          setPending({ code: c, technology: selectedTechnology });
          return;
        }
        const res = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ code: c, technology: selectedTechnology, position, ...manual }),
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(res.status === 401 ? 'Nepřihlášeno' : 'Chyba skenu');
        const scanned = (await res.json()) as ScanResult;
        setPending(null);
        if (scanned.found && scanned.asset) {
          // Položka nalezena → samostatná stránka jen s výsledkem a akcemi.
          const params = new URLSearchParams({
            code: c,
            obs: manual ? 'manual' : position ? 'gps' : 'none',
          });
          if (position && !manual) params.set('acc', String(Math.round(position.accuracyMeters)));
          router.push(`/admin/scan/result?${params.toString()}`);
          return;
        }
        setResult(scanned);
        setPositionMessage(
          scanned.found && scanned.asset
            ? manual
              ? 'Poloha uložena — zadáno ručně.'
              : position
                ? `Poloha přiložena, přesnost ±${Math.round(position.accuracyMeters)} m.`
                : 'Sken uložen bez polohy.'
            : 'Poloha nebyla uložena — kód nevede na evidovanou položku.',
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Neočekávaná chyba');
        setPositionMessage('Uložení pozorování není potvrzené.');
      } finally {
        busyRef.current = false;
        setLoading(false);
      }
    },
    [includePosition, technology, pending, locations, router],
  );

  const {
    videoRef,
    camOn,
    camSupported,
    error: camError,
    start: startCamera,
    stop: stopCamera,
  } = useBarcodeScanner(
    (found) => {
      setCamFlash(found);
      setCode(found);
      void lookup(found);
    },
    { continuous: false },
  );

  // Odkaz z veřejné stránky (`?code=…&auto=1`): identifikuj hned po otevření.
  const autoRan = useRef(false);
  useEffect(() => {
    if (!autoStart || autoRan.current || !initialCode.trim()) return;
    autoRan.current = true;
    void lookup(initialCode, true, undefined, 'qr');
  }, [autoStart, initialCode, lookup]);

  /** Spuštění kamery – vyčistí předchozí potvrzení/výsledek. */
  const beginScan = useCallback(() => {
    setCamFlash(null);
    startCamera();
  }, [startCamera]);

  return (
    <div className="flex flex-col gap-5">
      {/* Vstup: kamera + ruční / HW čtečka */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="mb-4 overflow-hidden rounded-xl bg-slate-900">
          {/* Video je vždy v DOM (jen skryté), aby videoRef existoval při startu kamery. */}
          <video
            ref={videoRef}
            className={`h-56 w-full object-cover ${camOn ? '' : 'hidden'}`}
            muted
            playsInline
          />
          {!camOn && camFlash && (
            <div className="flex h-56 w-full flex-col items-center justify-center gap-2 bg-emerald-950/40 text-emerald-300">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20">
                <Check size={26} className="text-emerald-400" />
              </span>
              <p className="text-sm font-medium">Kód načten</p>
              <p className="max-w-[80%] truncate font-mono text-xs text-emerald-400/80">
                {camFlash}
              </p>
            </div>
          )}
          {!camOn && !camFlash && (
            <div className="flex h-56 w-full flex-col items-center justify-center gap-2 text-slate-400">
              <ScanLine size={40} />
              <p className="text-xs">Namiř kameru na QR / čárový kód nebo zadej kód ručně</p>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {camOn ? (
            <button
              onClick={stopCamera}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-300 sm:w-auto sm:justify-start"
            >
              <CameraOff size={16} /> Vypnout kameru
            </button>
          ) : (
            <button
              onClick={beginScan}
              disabled={loading || !!pending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 sm:w-auto sm:justify-start"
            >
              <Camera size={16} /> {camFlash ? 'Skenovat další' : 'Skenovat kamerou'}
            </button>
          )}
        </div>
        {!camSupported && (
          <p className="mt-2 text-xs text-amber-600">
            Kamera není v tomto prohlížeči dostupná (chybí HTTPS nebo přístup ke kameře). Použij
            ruční zadání nebo HW čtečku níže.
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void lookup(code);
          }}
          className="mt-4 flex gap-2"
        >
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-3 text-slate-400" />
            <input
              ref={inputRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Kód (náš nebo adoptovaný) – i z HW čtečky + Enter"
              className={`${inputCls} pl-9`}
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <ScanLine size={16} />}
            Najít
          </button>
        </form>
        <div className="mt-3 flex flex-col gap-2 text-sm text-slate-600">
          <label>
            Typ identifikátoru{' '}
            <select
              value={technology}
              onChange={(e) => setTechnology(e.target.value)}
              className="rounded border p-1"
            >
              <option value="unknown">Neurčeno</option>
              <option value="qr">QR</option>
              <option value="barcode">Čárový kód</option>
              <option value="nfc">NFC</option>
              <option value="rfid">RFID</option>
              <option value="manual">Ruční zadání</option>
            </select>
          </label>
          <details>
            <summary>Nastavení polohy skeneru</summary>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includePosition}
                disabled={loading || !!pending}
                onChange={(e) => setIncludePosition(e.target.checked)}
              />{' '}
              Automaticky získávat polohu při skenu (pro toto otevření skeneru)
            </label>
          </details>
          <p className="text-xs">
            Při skenu se poloha zařízení ukládá do interní historie položky. Prohlížeč může požádat
            o svolení a zapamatovat si ho. Bez dostupné polohy ji můžete zadat ručně nebo sken
            dokončit bez ní.
          </p>
          {positionMessage && (
            <p role="status" className="text-xs">
              {positionMessage}
            </p>
          )}
        </div>
      </div>

      {pending && (
        <ManualPosition
          key={pending.code}
          locations={locations}
          locationsAvailable={locationsAvailable}
          busy={loading}
          onSubmit={(value) => {
            void lookup(pending.code, false, value, pending.technology);
          }}
          onSkip={() => {
            void lookup(pending.code, false, undefined, pending.technology);
          }}
          onCancel={() => {
            setPending(null);
            setPositionMessage('Sken zrušen; žádné pozorování nebylo uloženo.');
          }}
        />
      )}

      {(error || camError) && (
        <p className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
          <AlertCircle size={15} /> {error ?? camError}
        </p>
      )}
      {result && <ResultCard result={result} acting={loading || !!pending} />}
    </div>
  );
}
