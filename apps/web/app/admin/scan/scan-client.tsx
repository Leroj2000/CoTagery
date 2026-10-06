'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';
import {
  Loader2,
  ScanLine,
  Camera,
  CameraOff,
  Search,
  AlertCircle,
  Home,
  MapPin,
  User,
  CalendarClock,
  QrCode,
  ArrowRight,
  Check,
  Undo2,
} from 'lucide-react';
import type { ScanResult } from '../../lib/types';
import { StatusBadge, Badge, Mono } from '../ui';
import { useBarcodeScanner } from './use-scanner';
import { captureScanPosition } from '../../lib/scan-position';
import { ManualPosition, type ManualCapture } from './manual-position';

const ACTION_LABEL: Record<string, string> = {
  loan: 'Půjčit',
  assign: 'Přidělit',
  move: 'Přesunout',
  return: 'Vrátit',
  handover: 'Předat dál',
  service_out: 'Do servisu',
  service_return: 'Vrátit ze servisu',
  dispose: 'Vyřadit',
};

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10';

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('cs-CZ') : '—';
}

export function ScanClient({
  initialCode = '',
  locations,
  locationsAvailable,
}: {
  initialCode?: string;
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
  const [flash, setFlash] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  // Kód právě načtený kamerou – zobrazí potvrzení v náhledovém poli (kamera se vypne).
  const [camFlash, setCamFlash] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const lookup = useCallback(
    async (
      raw: string,
      capture = true,
      manual?: ManualCapture,
      selectedTechnology = technology,
      refreshOnly = false,
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
      setFlash(null);
      try {
        let reason = 'Poloha není dostupná.';
        const positionPromise =
          includePosition && capture
            ? captureScanPosition((message) => {
                reason = message;
              })
            : Promise.resolve(undefined);
        if (capture || refreshOnly) {
          const preview = await fetch(`/api/scan?code=${encodeURIComponent(c)}`, { cache: 'no-store' });
          if (!preview.ok) throw new Error('Identifikátor se nepodařilo ověřit. Zkus to znovu.');
          const identified = await preview.json() as ScanResult;
          setResult(identified);
          if (refreshOnly || !identified.asset) { setPositionMessage(refreshOnly ? 'Zobrazen aktuální stav; nové pozorování nevzniklo.' : 'Kód nevede na dostupnou položku; pozorování nevzniklo.'); return; }
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
        setResult(scanned);
        setPending(null);
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

  /** One-tap „Vrátit domů" přímo ze skenu → pohyb + obnova karty. */
  const quickReturn = useCallback(
    async (assetId: string, scannedCode: string) => {
      setActing(true);
      setError(null);
      setFlash(null);
      try {
        const res = await fetch(`/api/asset-movement/${assetId}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ type: 'return' }),
          cache: 'no-store',
        });
        if (!res.ok) throw new Error('Vrácení se nepodařilo');
        await lookup(scannedCode, false, undefined, technology, true);
        setFlash('Vráceno domů ✓');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Neočekávaná chyba');
      } finally {
        setActing(false);
      }
    },
    [lookup, technology],
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
      {flash && (
        <p className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
          <Check size={15} /> {flash}
        </p>
      )}

      {result && (
        <ResultCard
          result={result}
          acting={acting || loading || !!pending}
          onQuickReturn={(assetId) => quickReturn(assetId, result.code)}
        />
      )}
    </div>
  );
}

function ResultCard({
  result,
  acting,
  onQuickReturn,
}: {
  result: ScanResult;
  acting: boolean;
  onQuickReturn: (assetId: string) => void;
}) {
  if (!result.found) {
    return (
      <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800 shadow-card">
        <AlertCircle size={18} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-medium">Kód nenalezen</p>
          <p className="mt-0.5 text-amber-700">
            Kód <Mono>{result.code}</Mono> není v tomto tenantu evidovaný (ani jako náš
            identifikátor, ani jako adoptovaný alias).
          </p>
        </div>
      </div>
    );
  }

  const { asset, carrier, context, primaryAction, object } = result;

  // Kód sedí, ale není to věc (pool / členská karta / produkt).
  if (!asset) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <p className="text-sm font-medium text-slate-800">Kód rozpoznán</p>
        <p className="mt-1 text-sm text-slate-500">
          {carrier && (
            <>
              Identifikátor <Mono>{carrier.publicCode}</Mono>.{' '}
            </>
          )}
          {object ? (
            <>
              Vede na objekt typu <Badge tone="slate">{object.moduleType}</Badge>, není to evidovaná
              položka.
            </>
          ) : (
            <>Zatím nepřiřazený kód z poolu.</>
          )}
        </p>
      </div>
    );
  }

  const primaryLabel = primaryAction ? (ACTION_LABEL[primaryAction] ?? primaryAction) : null;
  // One-tap „Vrátit domů": jen když je věc vratná, má domov a politika nevyžaduje foto.
  const canQuickReturn =
    primaryAction === 'return' && !!asset.homeLocationId && !result.requireReturnPhoto;
  const returnBlockedByPhoto = primaryAction === 'return' && !!result.requireReturnPhoto;
  const availableActions = asset.actions ?? [];
  const secondaryActions = availableActions.filter(
    (action) => action !== primaryAction && !(action === 'return' && canQuickReturn),
  );
  const actionHref = (action: string) =>
    `/admin/assets/${asset.id}?action=${encodeURIComponent(action)}#${action === 'return' ? 'asset-return' : 'asset-actions'}`;

  return (
    <div className="feedback-enter overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
      <div className="flex items-center gap-4 border-b border-slate-100 p-5">
        {asset.photoKey ? (
          <img
            src={`/api/asset-photo/${asset.id}`}
            alt={asset.name}
            className="h-16 w-16 rounded-xl border border-slate-200 object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-100 text-[10px] text-slate-400">
            bez fotky
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-slate-900">{asset.name}</p>
          <div className="mt-1">
            <StatusBadge status={asset.status} />
          </div>
        </div>
      </div>

      {/* Kontext: patří do ≠ kde je ≠ kdo má */}
      <div className="grid gap-3 p-5 sm:grid-cols-3">
        <Ctx icon={<Home size={15} />} label="Patří do" value={context?.homeName ?? '—'} />
        <Ctx
          icon={asset.currentHolderType === 'person' ? <User size={15} /> : <MapPin size={15} />}
          label={asset.currentHolderType === 'person' ? 'Má ji' : 'Kde je'}
          value={context?.holderName ?? '—'}
        />
        <Ctx icon={<CalendarClock size={15} />} label="Vrátit do" value={fmtDate(asset.dueAt)} />
      </div>

      {carrier?.origin === 'adopted' && carrier.externalCode && (
        <div className="px-5 pb-2">
          <Badge tone="brand">
            <QrCode size={11} className="mr-1 inline" /> alias: {carrier.externalCode}
          </Badge>
        </div>
      )}

      {/* Kontextová akce */}
      <div className="flex flex-col flex-wrap items-stretch gap-2 border-t border-slate-100 p-5 sm:flex-row sm:items-center">
        {canQuickReturn ? (
          <button
            onClick={() => onQuickReturn(asset.id)}
            disabled={acting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 sm:w-auto"
          >
            {acting ? <Loader2 size={16} className="animate-spin" /> : <Undo2 size={16} />}
            Vrátit domů{context?.homeName ? ` (${context.homeName})` : ''}
          </button>
        ) : (
          primaryLabel && (
            <Link
              href={actionHref(primaryAction ?? '')}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 sm:w-auto"
            >
              {primaryLabel} <ArrowRight size={16} />
            </Link>
          )
        )}
        {secondaryActions.map((action) => (
          <Link
            key={action}
            href={actionHref(action)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:w-auto"
          >
            {ACTION_LABEL[action] ?? action} <ArrowRight size={15} />
          </Link>
        ))}
        <Link
          href={`/admin/assets/${asset.id}`}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:w-auto"
        >
          Detail položky
        </Link>
        {returnBlockedByPhoto && (
          <span className="text-center text-xs text-amber-600 sm:text-left">
            Vrácení vyžaduje foto → otevři detail
          </span>
        )}
      </div>
    </div>
  );
}

function Ctx({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
        <span className="text-slate-400">{icon}</span>
        {label}
      </div>
      <p className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}
