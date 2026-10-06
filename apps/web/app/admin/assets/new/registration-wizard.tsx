'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Camera, ArrowLeft, ArrowRight } from 'lucide-react';
import type { Asset, Category, DataCarrier } from '../../../lib/types';
import { locationPath, type PlaceNode } from '../../../lib/location-path';
import { PlaceSelector } from '../../locations/place-selector';
import { CodeInput } from '../../scan/code-input';
import { PrintLabelButton } from '../printing/print-label-button';

type Receipt = { asset: Asset; carriers: DataCarrier[] };
export function RegistrationWizard({
  initialPlaces,
  categories,
  initialLocation,
  canCreatePlace,
  canTag,
  canPhoto,
}: {
  initialPlaces: PlaceNode[];
  categories: Category[];
  initialLocation?: string;
  canCreatePlace: boolean;
  canTag: boolean;
  canPhoto: boolean;
}) {
  const [step, setStep] = useState(0);
  const [places, setPlaces] = useState(initialPlaces);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [mode, setMode] = useState(canTag ? 'generate' : 'none');
  const [carrierType, setCarrierType] = useState('qr');
  const [code, setCode] = useState('');
  const [location, setLocation] = useState(
    initialPlaces.some((p) => p.id === initialLocation) ? initialLocation! : '',
  );
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const requestId = useRef('');
  const requestBody = useRef<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState('');
  const [photoPending, setPhotoPending] = useState(false);
  useEffect(() => {
    if (!photo) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  async function save() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      if (!requestId.current) requestId.current = crypto.randomUUID();
      if (!requestBody.current)
        requestBody.current = JSON.stringify({
          requestId: requestId.current,
          name: name.trim(),
          categoryId: categoryId || undefined,
          manufacturer: manufacturer || undefined,
          serialNumber: serialNumber || undefined,
          homeLocationId: location || undefined,
          identifierMode: mode,
          carrierType,
          code: code || undefined,
        });
      const res = await fetch('/api/asset-registration', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: requestBody.current,
      });
      const data = await res.json();
      if (!res.ok) {
        // Validation failures are rolled back; an uncertain response retains the original request.
        if (res.status >= 400 && res.status < 500 && res.status !== 409) {
          requestBody.current = null;
          requestId.current = '';
        }
        throw new Error(data.message || 'Položku se nepodařilo uložit.');
      }
      setReceipt(data);
      setStep(3);
      if (photo) {
        setPhotoPending(true);
        try {
          const fd = new FormData();
          fd.append('files', photo);
          const upload = await fetch(`/api/asset-photos/${data.asset.id}`, {
            method: 'POST',
            body: fd,
          });
          if (!upload.ok) throw new Error('Fotografie se nenahrála.');
          setPhotoPending(false);
        } catch {
          setError(
            'Položka i identifikátor jsou uložené. Fotografie se nepodařila potvrdit; zkontroluj ji v detailu položky.',
          );
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Spojení se přerušilo. Zkus stejný pokus znovu.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function next() {
    if (!name.trim()) {
      setError('Jak se položka jmenuje?');
      setStep(0);
      return;
    }
    if (step === 1 && ['adopt', 'claim'].includes(mode) && !code.trim()) {
      setError('Načti nebo vyplň kód.');
      return;
    }
    setError('');
    setStep(step + 1);
  }
  if (receipt && step === 3) {
    const carrier = receipt.carriers[0];
    return (
      <div className="feedback-enter space-y-5 rounded-2xl border border-emerald-200 bg-white p-6">
        <CheckCircle2 className="text-emerald-600" size={42} />
        <h2 className="text-xl font-semibold">{receipt.asset.name} má své místo v Tagery</h2>
        <p className="text-slate-600">
          {receipt.asset.homeLocationId
            ? locationPath(receipt.asset.homeLocationId, places)
            : 'Umístění zatím není určené.'}
        </p>
        {preview && (
          <img src={preview} alt={name} className="h-40 w-full rounded-xl object-contain" />
        )}
        <p role="status" className="text-sm">
          {busy
            ? 'Dokončuji nahrání fotografie…'
            : photoPending
              ? 'Fotografie vyžaduje kontrolu.'
              : 'Uloženo.'}{' '}
          {carrier ? `Identifikátor: ${carrier.publicCode}` : 'Identifikátor doplníš v detailu.'}
        </p>
        {error && (
          <p role="alert" className="text-sm text-amber-800">
            {error}
          </p>
        )}
        {carrier && (
          <PrintLabelButton
            carrierId={carrier.id}
            data={{
              itemName: receipt.asset.name,
              assetCode: carrier.publicCode,
              qrValue: carrier.resolverUrl ?? carrier.publicCode,
              subtitle: locationPath(location, places),
            }}
          />
        )}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            className="action-primary"
            onClick={() => {
              setReceipt(null);
              setName('');
              setSerialNumber('');
              setPhoto(null);
              setCode('');
              setPhotoPending(false);
              setError('');
              requestId.current = '';
              requestBody.current = null;
              setStep(0);
            }}
          >
            Přidat další do stejného místa
          </button>
          <Link className="action-secondary" href={`/admin/assets/${receipt.asset.id}`}>
            Otevřít položku
          </Link>
        </div>
      </div>
    );
  }
  const labels = ['Fotografie a název', 'Identifikátor', 'Umístění'];
  return (
    <div className="space-y-5">
      <ol className="grid grid-cols-3 gap-2" aria-label="Kroky zařazení">
        {labels.map((label, i) => (
          <li
            key={label}
            aria-current={step === i ? 'step' : undefined}
            className={`rounded-xl p-3 text-sm ${i === step ? 'bg-brand-600 text-white' : 'bg-white text-slate-600'}`}
          >
            <span className="block font-bold">{i + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      <fieldset
        disabled={busy || requestBody.current !== null}
        className="rounded-2xl border border-slate-200 bg-white p-5"
      >
        <div hidden={step !== 0} className="space-y-4">
          {canPhoto && (
            <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-brand-200 bg-brand-50 p-5">
              {preview ? (
                <img src={preview} alt="Náhled fotografie" className="h-36 w-full object-contain" />
              ) : (
                <Camera size={32} className="text-brand-600" />
              )}
              <span className="font-semibold">Vyfotit nebo přidat fotografii</span>
              <input
                aria-label="Fotografie položky"
                type="file"
                accept="image/*"
                onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                className="max-w-full text-sm"
              />
            </label>
          )}
          <label className="block text-sm font-medium">
            Název položky *
            <input
              className="field-input mt-1"
              value={name}
              maxLength={300}
              onChange={(e) => setName(e.target.value)}
              placeholder="Například aku vrtačka Makita"
            />
          </label>
          <details>
            <summary className="cursor-pointer text-sm text-brand-700">
              Doplnit kategorii a další údaje
            </summary>
            <div className="mt-3 space-y-3">
              <label className="block text-sm">
                Kategorie
                <select
                  className="field-input"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">Bez kategorie</option>
                  {categories.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Výrobce
                <input
                  className="field-input"
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                Sériové číslo
                <input
                  className="field-input"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                />
              </label>
            </div>
          </details>
        </div>
        <div hidden={step !== 1} className="space-y-4">
          <h2 className="font-semibold">Jak položku označíš?</h2>
          <label className="block text-sm">
            Identifikátor
            <select className="field-input" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="none">Doplním později</option>
              {canTag && (
                <>
                  <option value="generate">Vytvořit nový štítek</option>
                  <option value="claim">Připojit volný štítek Tagery</option>
                  <option value="adopt">Použít vlastní kód</option>
                </>
              )}
            </select>
          </label>
          {mode !== 'none' && (
            <label className="block text-sm">
              Typ
              <select
                className="field-input"
                value={carrierType}
                onChange={(e) => setCarrierType(e.target.value)}
              >
                <option value="qr">QR</option>
                <option value="nfc">NFC</option>
                <option value="hybrid">QR + NFC</option>
              </select>
            </label>
          )}
          {step === 1 && ['adopt', 'claim'].includes(mode) && (
            <>
              <CodeInput label="Načti identifikátor vybavení" onRead={setCode} />
              <p className="break-all text-sm">{code || 'Kód zatím není načtený.'}</p>
            </>
          )}
          <p className="text-sm text-slate-500">
            Štítek můžeš vytisknout po uložení. NFC tag je potřeba následně zapsat nebo spárovat.
          </p>
        </div>
        <div hidden={step !== 2} className="space-y-4">
          <h2 className="font-semibold">Kam věc patří a kam ji ukládáš?</h2>
          <p className="text-sm text-slate-600">
            Při zařazení nastavíme vybrané místo jako domovské i aktuální. Pozdější přesuny mají
            vlastní historii.
          </p>
          {step === 2 && (
            <PlaceSelector
              places={places}
              onPlaces={setPlaces}
              value={location}
              onChange={setLocation}
              canCreate={canCreatePlace}
            />
          )}
          <button
            type="button"
            className="text-sm text-slate-600 underline"
            onClick={() => setLocation('')}
          >
            Umístění doplním později
          </button>
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {error && requestBody.current && (
        <Link href="/admin/assets" className="block text-sm text-brand-700 underline">
          Zkontrolovat uložené položky
        </Link>
      )}
      <div className="sticky bottom-20 flex gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 backdrop-blur lg:bottom-4">
        {step > 0 && (
          <button
            className="action-secondary"
            disabled={busy || requestBody.current !== null}
            onClick={() => {
              setError('');
              setStep(step - 1);
            }}
          >
            <ArrowLeft size={18} />
            Zpět
          </button>
        )}
        {step < 2 ? (
          <button className="action-primary flex-1" onClick={next}>
            Pokračovat
            <ArrowRight size={18} />
          </button>
        ) : (
          <button className="action-primary flex-1" disabled={busy} onClick={() => void save()}>
            {busy
              ? 'Ukládám položku…'
              : requestBody.current
                ? 'Ověřit a dokončit uložení'
                : 'Uložit položku'}
          </button>
        )}
      </div>
    </div>
  );
}
