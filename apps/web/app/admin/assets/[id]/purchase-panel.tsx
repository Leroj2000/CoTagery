'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Loader2, Pencil, Plus, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { Badge, Section } from '../../ui';
import {
  CONDITION_LABELS,
  DOCUMENT_LABELS,
  START_BASIS_LABELS,
  daysUntil,
  defaultStartBasis,
  warrantyStartFor,
  documentUrl,
  fmtDay,
  fmtMoney,
  purchaseApi,
  type AssetDocument,
  type DocumentType,
  type PurchaseCondition,
  type PurchaseDates,
  type PurchaseView,
  type Warranty,
  type WarrantyStartBasis,
} from '../../../lib/purchase';

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10';
const primaryBtn =
  'inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50';
const secondaryBtn =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50';
const iconBtn = 'rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800';

const VAT_RATES = [21, 12, 0];
const MONTH_PRESETS = [6, 12, 24, 36, 60];

/** Rychlé názvy záruky; u výrobce/prodejce rovnou nastaví, od čeho běží. */
const TITLE_PRESETS: {
  title: string;
  basis?: (d: PurchaseDates | null) => WarrantyStartBasis;
}[] = [
  { title: 'Záruka výrobce', basis: (d) => (d?.condition === 'used' ? 'in_service' : 'purchase') },
  { title: 'Záruka prodejce', basis: () => 'purchase' },
  { title: 'Prodloužená záruka' },
];

/** Číslo z inputu – přijme i desetinnou čárku a mezery. */
function parseAmount(raw: string): number | null {
  const v = raw.replace(/\s/g, '').replace(',', '.');
  if (v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

/** Konec záruky pro náhled (stejné pravidlo jako API: konec měsíce se zarovná). */
function previewEnd(startsOn: string, months: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn) || !(months > 0)) return null;
  const [y, m, d] = startsOn.split('-').map(Number);
  const target = m - 1 + months;
  const year = y + Math.floor(target / 12);
  const month = target % 12;
  const day = Math.min(d, new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

async function send(path: string, method: string, body?: unknown): Promise<void> {
  const res = await fetch(purchaseApi(path), {
    method,
    headers: body instanceof FormData ? undefined : { 'content-type': 'application/json' },
    body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const msg = Array.isArray(data?.message) ? data?.message[0] : data?.message;
    throw new Error(msg || `Uložení selhalo (${res.status})`);
  }
}

export function WarrantyStatusBadge({ warranty }: { warranty: Warranty }) {
  const days = daysUntil(warranty.endsOn);
  if (warranty.status === 'expired') return <Badge tone="slate">Skončila</Badge>;
  if (warranty.status === 'expiring')
    return <Badge tone="amber">{days === 0 ? 'Končí dnes' : `Končí za ${days} dní`}</Badge>;
  return <Badge tone="green">Platí</Badge>;
}

/**
 * Sekce „Pořízení a záruka" v detailu položky. Ceny a doklady se zobrazí jen
 * s oprávněním `asset.purchase.view` (`view` není null); záruky vidí každý.
 */
export function PurchasePanel({
  assetId,
  view,
  warranties,
  canEdit,
}: {
  assetId: string;
  view: PurchaseView | null;
  warranties: Warranty[];
  canEdit: boolean;
}) {
  return (
    <Section
      title={view ? 'Pořízení a záruka' : 'Záruka'}
      description={
        view
          ? 'Kdy a za kolik byla položka pořízena, doklady a záruky (i víc záruk, např. zvlášť na baterii).'
          : 'Záruky položky – při závadě nejdřív zkontroluj, jestli nejde o reklamaci.'
      }
    >
      <div className="flex flex-col gap-6">
        {view && <PurchaseBlock assetId={assetId} view={view} canEdit={canEdit} />}
        <WarrantyBlock
          assetId={assetId}
          warranties={warranties}
          documents={view?.documents ?? []}
          dates={view?.purchase ?? null}
          canEdit={canEdit}
        />
        {view && <DocumentsBlock assetId={assetId} documents={view.documents} canEdit={canEdit} />}
      </div>
    </Section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-100">
      {error}
    </p>
  );
}

function Segmented<T extends string | boolean>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { v: T; label: string }[];
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex shrink-0 overflow-hidden rounded-lg border border-slate-300 bg-white text-sm shadow-sm"
    >
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={`px-3 py-2 font-medium transition ${
            value === o.v ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// --- Pořízení ---

function PurchaseBlock({
  assetId,
  view,
  canEdit,
}: {
  assetId: string;
  view: PurchaseView;
  canEdit: boolean;
}) {
  const p = view.purchase;
  const [editing, setEditing] = useState(false);
  const empty =
    !p ||
    (!p.purchasedOn &&
      !p.inServiceOn &&
      p.condition === 'new' &&
      !p.supplier &&
      p.priceNet == null &&
      p.priceGross == null);

  if (editing)
    return <PurchaseForm assetId={assetId} view={view} onDone={() => setEditing(false)} />;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pořízení</h3>
        {canEdit && (
          <button type="button" className={secondaryBtn} onClick={() => setEditing(true)}>
            <Pencil size={14} /> {empty ? 'Vyplnit' : 'Upravit'}
          </button>
        )}
      </div>
      {empty ? (
        <p className="text-sm text-slate-400">
          Zatím nevyplněno. Z data pořízení a uvedení do provozu se počítá začátek záruky.
        </p>
      ) : (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
          <Item label="Pořízeno" value={CONDITION_LABELS[p.condition]} />
          <Item label="Datum pořízení" value={fmtDay(p.purchasedOn)} />
          <Item
            label={p.condition === 'used' ? 'První uvedení do provozu' : 'Uvedeno do provozu'}
            value={
              p.inServiceOn
                ? fmtDay(p.inServiceOn)
                : p.condition === 'new' && p.purchasedOn
                  ? `${fmtDay(p.purchasedOn)} (= pořízení)`
                  : '—'
            }
          />
          <Item label="Dodavatel" value={p.supplier ?? '—'} />
          <Item label="Číslo dokladu" value={p.documentNumber ?? '—'} />
          <Item label="Cena bez DPH" value={fmtMoney(p.priceNet, p.currency)} />
          <Item
            label={p.vatRate != null ? `DPH ${p.vatRate.toLocaleString('cs-CZ')} %` : 'DPH'}
            value={
              p.priceNet != null && p.priceGross != null
                ? fmtMoney(Math.round((p.priceGross - p.priceNet) * 100) / 100, p.currency)
                : '—'
            }
          />
          <Item label="Cena s DPH" value={fmtMoney(p.priceGross, p.currency)} strong />
          {p.note && (
            <div className="col-span-2 sm:col-span-3">
              <Item label="Poznámka" value={p.note} />
            </div>
          )}
          <p className="col-span-2 text-xs text-slate-400 sm:col-span-3">
            Zadáno jako {p.vatPayer ? 'plátce' : 'neplátce'} DPH.
          </p>
        </dl>
      )}
    </div>
  );
}

function Item({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`truncate ${strong ? 'font-semibold text-slate-900' : 'text-slate-800'}`}>
        {value}
      </dd>
    </div>
  );
}

function PurchaseForm({
  assetId,
  view,
  onDone,
}: {
  assetId: string;
  view: PurchaseView;
  onDone: () => void;
}) {
  const router = useRouter();
  const p = view.purchase;
  const payer = view.vat.payer;
  const [purchasedOn, setPurchasedOn] = useState(p?.purchasedOn ?? '');
  const [condition, setCondition] = useState<PurchaseCondition>(p?.condition ?? 'new');
  const [inServiceOn, setInServiceOn] = useState(p?.inServiceOn ?? '');
  const [supplier, setSupplier] = useState(p?.supplier ?? '');
  const [documentNumber, setDocumentNumber] = useState(p?.documentNumber ?? '');
  const [note, setNote] = useState(p?.note ?? '');
  // Plátce zadává bez DPH, neplátce s DPH – přepnout jde vždy.
  const [includesVat, setIncludesVat] = useState(!payer);
  const initialAmount = payer ? (p?.priceNet ?? p?.priceGross) : (p?.priceGross ?? p?.priceNet);
  const [amount, setAmount] = useState(initialAmount != null ? String(initialAmount) : '');
  const initialRate = p ? p.vatRate : payer ? view.vat.defaultRate : null;
  const [rate, setRate] = useState(initialRate != null ? String(initialRate) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = parseAmount(amount);
  const rateNum = rate === '' ? null : Number(rate);
  let preview: string | null = null;
  if (parsed != null && !Number.isNaN(parsed) && rateNum != null) {
    const factor = 1 + rateNum / 100;
    preview = includesVat
      ? `Bez DPH: ${fmtMoney(Math.round((parsed / factor) * 100) / 100)}`
      : `S DPH: ${fmtMoney(Math.round(parsed * factor * 100) / 100)}`;
  }
  const rates = [...new Set([...VAT_RATES, ...(initialRate != null ? [initialRate] : [])])];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (Number.isNaN(parsed)) return setError('Cena musí být číslo.');
    setBusy(true);
    setError(null);
    try {
      await send(`assets/${assetId}/purchase`, 'PUT', {
        purchasedOn: purchasedOn || null,
        condition,
        inServiceOn: inServiceOn || null,
        supplier: supplier || null,
        documentNumber: documentNumber || null,
        note: note || null,
        price: parsed,
        priceIncludesVat: includesVat,
        vatRate: rateNum,
      });
      router.refresh();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení selhalo');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4 rounded-xl bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pořízení</h3>
        <Segmented
          label="Stav při pořízení"
          value={condition}
          onChange={setCondition}
          options={[
            { v: 'new', label: 'Nové' },
            { v: 'used', label: 'Použité' },
          ]}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Datum pořízení">
          <input
            type="date"
            className={inputCls}
            value={purchasedOn}
            onChange={(e) => setPurchasedOn(e.target.value)}
          />
        </Field>
        <Field label={condition === 'used' ? 'První uvedení do provozu' : 'Uvedeno do provozu'}>
          <input
            type="date"
            className={inputCls}
            value={inServiceOn}
            onChange={(e) => setInServiceOn(e.target.value)}
          />
        </Field>
      </div>
      <p className="-mt-2 text-xs text-slate-500">
        {condition === 'used'
          ? 'U použité věci je uvedení do provozu u předchozího majitele (viz záruční list, doklad nebo štítek) – od něj běží zbytek záruky výrobce. Záruka prodejce běží od pořízení.'
          : 'Vyplň, jen když se věc začala používat později než byla koupena (např. kotel nebo stroj se zárukou od zprovoznění). Prázdné = datum pořízení.'}
      </p>
      {condition === 'used' && inServiceOn && purchasedOn && inServiceOn > purchasedOn && (
        <p className="-mt-2 text-xs text-amber-700">
          Uvedení do provozu je až po pořízení – u použité věci bývá dřív. Zkontroluj data.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Dodavatel">
          <input
            className={inputCls}
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            placeholder="např. Alza.cz a.s."
          />
        </Field>
        <Field label="Číslo faktury / dokladu">
          <input
            className={inputCls}
            value={documentNumber}
            onChange={(e) => setDocumentNumber(e.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">Pořizovací cena (Kč)</span>
          <div className="flex gap-2">
            <input
              inputMode="decimal"
              className={inputCls}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
            />
            <Segmented
              label="Cena je"
              value={includesVat}
              onChange={setIncludesVat}
              options={[
                { v: false, label: 'bez DPH' },
                { v: true, label: 's DPH' },
              ]}
            />
          </div>
          <span className="text-xs text-slate-500">
            {preview ??
              (payer
                ? 'Firma je plátce DPH – obvykle se zadává cena bez DPH.'
                : 'Firma je neplátce DPH – obvykle se zadává cena s DPH.')}
          </span>
        </div>
        <Field label="Sazba DPH">
          <select className={inputCls} value={rate} onChange={(e) => setRate(e.target.value)}>
            {rates.map((r) => (
              <option key={r} value={String(r)}>
                {r.toLocaleString('cs-CZ')} %
              </option>
            ))}
            <option value="">neuvedeno</option>
          </select>
        </Field>
      </div>

      <Field label="Poznámka">
        <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>

      <ErrorText error={error} />
      <div className="flex gap-2">
        <button type="submit" className={primaryBtn} disabled={busy}>
          {busy && <Loader2 size={15} className="animate-spin" />} Uložit
        </button>
        <button type="button" className={secondaryBtn} onClick={onDone} disabled={busy}>
          Zrušit
        </button>
      </div>
    </form>
  );
}

// --- Záruky ---

function WarrantyBlock({
  assetId,
  warranties,
  documents,
  dates,
  canEdit,
}: {
  assetId: string;
  warranties: Warranty[];
  documents: AssetDocument[];
  dates: PurchaseDates | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(w: Warranty) {
    if (!confirm(`Smazat záruku „${w.title}"?`)) return;
    try {
      await send(`warranties/${w.id}`, 'DELETE');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Smazání selhalo');
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Záruky</h3>
        {canEdit && editing === null && (
          <button type="button" className={secondaryBtn} onClick={() => setEditing('new')}>
            <Plus size={14} /> Přidat záruku
          </button>
        )}
      </div>
      <ErrorText error={error} />
      {warranties.length === 0 && editing !== 'new' && (
        <p className="text-sm text-slate-400">Žádná evidovaná záruka.</p>
      )}
      <ul className="flex flex-col gap-2">
        {warranties.map((w) =>
          editing === w.id ? (
            <li key={w.id}>
              <WarrantyForm
                assetId={assetId}
                warranty={w}
                documents={documents}
                dates={dates}
                onDone={() => setEditing(null)}
              />
            </li>
          ) : (
            <li
              key={w.id}
              className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${
                w.status === 'expired'
                  ? 'border-slate-200 bg-slate-50/60 text-slate-500'
                  : 'border-emerald-200 bg-emerald-50/40'
              }`}
            >
              <ShieldCheck
                size={18}
                className={`mt-0.5 shrink-0 ${w.status === 'expired' ? 'text-slate-400' : 'text-emerald-600'}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-800">{w.title}</span>
                  <WarrantyStatusBadge warranty={w} />
                </div>
                <p className="mt-0.5 text-slate-600">
                  do <strong>{fmtDay(w.endsOn)}</strong>
                  {w.startsOn &&
                    ` · od ${fmtDay(w.startsOn)}${
                      w.startBasis === 'in_service'
                        ? ' (uvedení do provozu)'
                        : w.startBasis === 'purchase'
                          ? ' (pořízení)'
                          : ''
                    }`}
                  {w.months && ` · ${w.months} měs.`}
                  {w.provider && ` · ${w.provider}`}
                </p>
                {w.note && <p className="mt-0.5 text-xs text-slate-500">{w.note}</p>}
                {w.document && (
                  <a
                    href={documentUrl(w.document.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
                  >
                    <FileText size={13} /> Záruční list
                  </a>
                )}
              </div>
              {canEdit && editing === null && (
                <div className="flex shrink-0">
                  <button
                    type="button"
                    className={iconBtn}
                    onClick={() => setEditing(w.id)}
                    aria-label="Upravit záruku"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                    onClick={() => remove(w)}
                    aria-label="Smazat záruku"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </li>
          ),
        )}
      </ul>
      {editing === 'new' && (
        <WarrantyForm
          assetId={assetId}
          documents={documents}
          dates={dates}
          isFirst={warranties.length === 0}
          onDone={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function WarrantyForm({
  assetId,
  warranty,
  documents,
  dates,
  isFirst,
  onDone,
}: {
  assetId: string;
  warranty?: Warranty;
  documents: AssetDocument[];
  dates: PurchaseDates | null;
  isFirst?: boolean;
  onDone: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(
    warranty?.title ?? (isFirst ? 'Záruka výrobce' : 'Prodloužená záruka'),
  );
  const [basis, setBasis] = useState<WarrantyStartBasis>(
    warranty?.startBasis ?? defaultStartBasis(dates),
  );
  const [customStart, setCustomStart] = useState(warranty?.startsOn ?? '');
  const startsOn = basis === 'custom' ? customStart : (warrantyStartFor(basis, dates) ?? '');
  const [mode, setMode] = useState<'months' | 'date'>(
    warranty && warranty.months == null ? 'date' : 'months',
  );
  const [months, setMonths] = useState(String(warranty?.months ?? 24));
  const [endsOn, setEndsOn] = useState(warranty?.endsOn ?? '');
  const [provider, setProvider] = useState(warranty?.provider ?? '');
  const [note, setNote] = useState(warranty?.note ?? '');
  const [documentId, setDocumentId] = useState(warranty?.documentId ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthsNum = Number(months);
  const computedEnd = mode === 'months' ? previewEnd(startsOn, monthsNum) : endsOn || null;
  const docOptions = documents.filter((d) => d.docType !== 'invoice');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (mode === 'months' && !startsOn)
      return setError(
        basis === 'custom'
          ? 'Zadej začátek záruky, nebo přepni na datum konce.'
          : `Chybí datum ${basis === 'purchase' ? 'pořízení' : 'uvedení do provozu'} – vyplň ho v Pořízení, zvol jiné datum začátku, nebo přepni na datum konce.`,
      );
    setBusy(true);
    setError(null);
    try {
      let docId = documentId || null;
      if (file) {
        const fd = new FormData();
        fd.append('file', file, file.name);
        fd.append('docType', 'warranty');
        const res = await fetch(purchaseApi(`assets/${assetId}/documents`), {
          method: 'POST',
          body: fd,
        });
        if (!res.ok) throw new Error('Nahrání záručního listu selhalo');
        docId = ((await res.json()) as { id: string }).id;
      }
      const body = {
        title,
        startBasis: basis,
        ...(basis === 'custom' ? { startsOn: customStart || null } : {}),
        months: mode === 'months' ? monthsNum : null,
        endsOn: mode === 'date' ? endsOn || null : null,
        provider: provider || null,
        note: note || null,
        documentId: docId,
      };
      await send(
        warranty ? `warranties/${warranty.id}` : `assets/${assetId}/warranties`,
        warranty ? 'PUT' : 'POST',
        body,
      );
      router.refresh();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení selhalo');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4 rounded-xl bg-slate-50 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Název záruky">
          <input
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="např. Záruka výrobce, Baterie"
          />
        </Field>
        <div className="flex flex-wrap items-end gap-1.5">
          {TITLE_PRESETS.map((t) => (
            <button
              key={t.title}
              type="button"
              onClick={() => {
                setTitle(t.title);
                if (t.basis) setBasis(t.basis(dates));
              }}
              className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
            >
              {t.title}
            </button>
          ))}
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-xs font-medium text-slate-600">Záruka běží</legend>
        {(['purchase', 'in_service'] as const).map((b) => {
          const day = warrantyStartFor(b, dates);
          return (
            <label key={b} className="inline-flex items-center gap-2 text-sm">
              <input type="radio" checked={basis === b} onChange={() => setBasis(b)} />
              <span>
                {START_BASIS_LABELS[b]}{' '}
                <span className={day ? 'text-slate-500' : 'text-amber-700'}>
                  ({day ? fmtDay(day) : 'datum není vyplněné'}
                  {b === 'in_service' && day && !dates?.inServiceOn ? ' = pořízení' : ''})
                </span>
              </span>
            </label>
          );
        })}
        <label className="inline-flex flex-wrap items-center gap-2 text-sm">
          <input
            type="radio"
            checked={basis === 'custom'}
            onChange={() => {
              if (!customStart) setCustomStart(startsOn);
              setBasis('custom');
            }}
          />
          od jiného data
          {basis === 'custom' && (
            <input
              type="date"
              className={`${inputCls} w-auto py-1`}
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              aria-label="Začátek záruky"
            />
          )}
        </label>
        <p className="text-xs text-slate-500">
          Záruka prodejce běží od převzetí (pořízení). Zbytek záruky výrobce u použité věci a záruka
          od zprovoznění (kotle, stroje) běží od uvedení do provozu. Při změně dat v Pořízení se
          začátek i konec přepočítají.
        </p>
      </fieldset>

      <div className="flex flex-col gap-2">
        <div className="flex gap-4 text-sm">
          {[
            { v: 'months' as const, label: 'Délka v měsících' },
            { v: 'date' as const, label: 'Datum konce' },
          ].map((o) => (
            <label key={o.v} className="inline-flex items-center gap-1.5">
              <input type="radio" checked={mode === o.v} onChange={() => setMode(o.v)} />
              {o.label}
            </label>
          ))}
        </div>
        {mode === 'months' ? (
          <div className="flex flex-wrap items-center gap-2">
            {MONTH_PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMonths(String(m))}
                className={`rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset transition ${
                  monthsNum === m
                    ? 'bg-brand-600 text-white ring-brand-600'
                    : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'
                }`}
              >
                {m} měs.
              </button>
            ))}
            <input
              type="number"
              min={1}
              max={600}
              className={`${inputCls} w-24`}
              value={months}
              onChange={(e) => setMonths(e.target.value)}
              aria-label="Počet měsíců"
            />
          </div>
        ) : (
          <input
            type="date"
            className={`${inputCls} sm:w-56`}
            value={endsOn}
            onChange={(e) => setEndsOn(e.target.value)}
            required
          />
        )}
        <p className="text-sm text-slate-700">
          Konec záruky: <strong>{computedEnd ? fmtDay(computedEnd) : '—'}</strong>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kdo poskytuje / kde reklamovat">
          <input
            className={inputCls}
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            placeholder="prodejce, servis výrobce…"
          />
        </Field>
        <Field label="Poznámka">
          <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {docOptions.length > 0 && (
          <Field label="Záruční list (nahraný doklad)">
            <select
              className={inputCls}
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
              disabled={!!file}
            >
              <option value="">— bez dokladu —</option>
              {docOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.fileName ?? DOCUMENT_LABELS[d.docType]}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Nahrát záruční list (PDF / fotka)">
          <input
            type="file"
            accept="application/pdf,image/*"
            className="text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 file:shadow-sm file:ring-1 file:ring-slate-300"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </Field>
      </div>

      <ErrorText error={error} />
      <div className="flex gap-2">
        <button type="submit" className={primaryBtn} disabled={busy}>
          {busy && <Loader2 size={15} className="animate-spin" />} Uložit záruku
        </button>
        <button type="button" className={secondaryBtn} onClick={onDone} disabled={busy}>
          Zrušit
        </button>
      </div>
    </form>
  );
}

// --- Doklady ---

function DocumentsBlock({
  assetId,
  documents,
  canEdit,
}: {
  assetId: string;
  documents: AssetDocument[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [docType, setDocType] = useState<DocumentType>('invoice');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file, file.name);
      fd.append('docType', docType);
      await send(`assets/${assetId}/documents`, 'POST', fd);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nahrání selhalo');
    } finally {
      setBusy(false);
    }
  }

  async function remove(d: AssetDocument) {
    if (!confirm(`Odebrat doklad „${d.fileName ?? DOCUMENT_LABELS[d.docType]}"?`)) return;
    try {
      await send(`documents/${d.id}`, 'DELETE');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Odebrání selhalo');
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Doklady</h3>
      {documents.length === 0 ? (
        <p className="text-sm text-slate-400">Žádné doklady (faktura, záruční list…).</p>
      ) : (
        <ul className="flex flex-col divide-y divide-slate-100 rounded-xl border border-slate-200">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              <FileText size={16} className="shrink-0 text-slate-400" />
              <a
                href={documentUrl(d.id)}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate font-medium text-brand-700 hover:underline"
              >
                {d.fileName ?? DOCUMENT_LABELS[d.docType]}
              </a>
              <Badge tone={d.docType === 'warranty' ? 'green' : 'slate'}>
                {DOCUMENT_LABELS[d.docType]}
              </Badge>
              {canEdit && (
                <button
                  type="button"
                  className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                  onClick={() => remove(d)}
                  aria-label="Odebrat doklad"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <ErrorText error={error} />
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            className={`${inputCls} w-auto`}
            value={docType}
            onChange={(e) => setDocType(e.target.value as DocumentType)}
            aria-label="Druh dokladu"
          >
            {(Object.keys(DOCUMENT_LABELS) as DocumentType[]).map((t) => (
              <option key={t} value={t}>
                {DOCUMENT_LABELS[t]}
              </option>
            ))}
          </select>
          <label className={`${secondaryBtn} cursor-pointer py-2`}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            Nahrát PDF / fotku
            <input
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void upload(f);
              }}
            />
          </label>
        </div>
      )}
    </div>
  );
}
