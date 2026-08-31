'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import {
  Percent,
  DoorOpen,
  Plus,
  Trash2,
  Loader2,
  Nfc,
  Building2,
  User,
  Layers,
} from 'lucide-react';

type Kind = 'discount' | 'access';
type Format = 'qr' | 'barcode' | 'nfc';

interface WalletCode {
  id: string;
  userId: string | null;
  label: string;
  kind: Kind;
  format: Format;
  value: string;
  note: string | null;
}
interface Aggregated {
  id: string;
  source: string;
  kind: Kind;
  label: string;
  detail: string | null;
}
export interface WalletView {
  personal: WalletCode[];
  shared: WalletCode[];
  aggregated: Aggregated[];
}

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10';

/** Vizuál kódu: QR / čárový kód (CODE128) / NFC (hodnota + ikona). */
function CodeVisual({ format, value }: { format: Format; value: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || format === 'nfc') return;
    setErr(null);
    if (format === 'qr') {
      QRCode.toCanvas(canvas, value, { margin: 1, width: 148 }).catch(() =>
        setErr('Kód nelze vykreslit'),
      );
    } else {
      try {
        JsBarcode(canvas, value, {
          format: 'CODE128',
          height: 60,
          width: 1.6,
          fontSize: 12,
          margin: 6,
        });
      } catch {
        setErr('Neplatná hodnota pro čárový kód');
      }
    }
  }, [format, value]);

  if (format === 'nfc') {
    return (
      <div className="flex flex-col items-center gap-2 py-4">
        <Nfc size={40} className="text-brand-500" />
        <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700">
          {value}
        </span>
        <span className="text-[11px] text-slate-400">Přilož telefon k NFC čtečce</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-1 py-1">
      <canvas ref={ref} className="max-w-full" />
      {err && <span className="text-[11px] text-red-500">{err}</span>}
    </div>
  );
}

function KindBadge({ kind }: { kind: Kind }) {
  const isAccess = kind === 'access';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        isAccess ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'
      }`}
    >
      {isAccess ? <DoorOpen size={11} /> : <Percent size={11} />}
      {isAccess ? 'přístup' : 'sleva'}
    </span>
  );
}

function CodeCard({
  code,
  onDelete,
}: {
  code: WalletCode;
  onDelete?: (id: string) => void;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{code.label}</p>
          {code.note && <p className="truncate text-xs text-slate-400">{code.note}</p>}
        </div>
        <KindBadge kind={code.kind} />
      </div>
      <div className="rounded-xl bg-slate-50/70">
        <CodeVisual format={code.format} value={code.value} />
      </div>
      {onDelete && (
        <button
          onClick={() => onDelete(code.id)}
          className="mt-2 inline-flex items-center justify-center gap-1 self-end rounded-lg px-2 py-1 text-xs text-slate-400 transition hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 size={13} /> Smazat
        </button>
      )}
    </div>
  );
}

function AddForm({
  scope,
  onDone,
  onCancel,
}: {
  scope: 'personal' | 'shared';
  onDone: () => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<Kind>('discount');
  const [format, setFormat] = useState<Format>('qr');
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const url = scope === 'shared' ? '/api/wallet/shared' : '/api/wallet/codes';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ label, kind, format, value, note: note || undefined }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.status === 403 ? 'Na tuto akci nemáš oprávnění.' : 'Uložení se nepovedlo.');
      return;
    }
    onDone();
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-2xl border border-brand-200 bg-brand-50/40 p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Název
          <input
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="MultiSport, Lékárna body…"
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Typ
          <select value={kind} onChange={(e) => setKind(e.target.value as Kind)} className={inputCls}>
            <option value="discount">Slevový</option>
            <option value="access">Přístupový</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Formát
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as Format)}
            className={inputCls}
          >
            <option value="qr">QR kód</option>
            <option value="barcode">Čárový kód</option>
            <option value="nfc">NFC</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Hodnota kódu
          <input
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Číslo karty / kód / URL"
            className={inputCls}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Poznámka (volitelné)
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Kde platí, na co…"
          className={inputCls}
        />
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          {scope === 'shared' ? 'Přidat firemní kód' : 'Přidat kód'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-2 text-sm text-slate-500 transition hover:bg-slate-100"
        >
          Zrušit
        </button>
      </div>
    </form>
  );
}

function SectionHead({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          {icon}
        </span>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-400">{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-xs font-medium text-brand-700 transition hover:bg-brand-50"
    >
      <Plus size={14} /> {label}
    </button>
  );
}

export function KlicenkaClient({
  initial,
  canManageShared,
}: {
  initial: WalletView;
  canManageShared: boolean;
}) {
  const [view, setView] = useState<WalletView>(initial);
  const [adding, setAdding] = useState<null | 'personal' | 'shared'>(null);

  async function refetch() {
    const res = await fetch('/api/wallet', { cache: 'no-store' });
    if (res.ok) setView((await res.json()) as WalletView);
  }

  async function del(scope: 'personal' | 'shared', id: string) {
    const url = scope === 'shared' ? `/api/wallet/shared/${id}` : `/api/wallet/codes/${id}`;
    const res = await fetch(url, { method: 'DELETE' });
    if (res.ok) refetch();
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Osobní klíčenka */}
      <section className="flex flex-col gap-3">
        <SectionHead
          icon={<User size={16} />}
          title="Moje kódy"
          description="Osobní klíčenka – vidíš jen ty."
          action={
            adding !== 'personal' && (
              <AddButton onClick={() => setAdding('personal')} label="Přidat kód" />
            )
          }
        />
        {adding === 'personal' && (
          <AddForm
            scope="personal"
            onCancel={() => setAdding(null)}
            onDone={() => {
              setAdding(null);
              refetch();
            }}
          />
        )}
        {view.personal.length === 0 && adding !== 'personal' ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
            Zatím nemáš žádné osobní kódy.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {view.personal.map((c) => (
              <CodeCard key={c.id} code={c} onDelete={(id) => del('personal', id)} />
            ))}
          </div>
        )}
      </section>

      {/* Celofiremní sdílené */}
      <section className="flex flex-col gap-3">
        <SectionHead
          icon={<Building2 size={16} />}
          title="Sdílené firmou"
          description="Kódy, které firma sdílí všem uživatelům."
          action={
            canManageShared &&
            adding !== 'shared' && (
              <AddButton onClick={() => setAdding('shared')} label="Přidat firemní kód" />
            )
          }
        />
        {adding === 'shared' && (
          <AddForm
            scope="shared"
            onCancel={() => setAdding(null)}
            onDone={() => {
              setAdding(null);
              refetch();
            }}
          />
        )}
        {view.shared.length === 0 && adding !== 'shared' ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
            Firma zatím nesdílí žádné kódy.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {view.shared.map((c) => (
              <CodeCard
                key={c.id}
                code={c}
                onDelete={canManageShared ? (id) => del('shared', id) : undefined}
              />
            ))}
          </div>
        )}
      </section>

      {/* Agregace z modulů (read-only) */}
      {view.aggregated.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionHead
            icon={<Layers size={16} />}
            title="Z modulů"
            description="Slevové a přístupové nároky z členství (jen náhled)."
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {view.aggregated.map((a) => (
              <div
                key={a.id}
                className="flex items-start justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{a.label}</p>
                  {a.detail && <p className="truncate text-xs text-slate-400">{a.detail}</p>}
                </div>
                <KindBadge kind={a.kind} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
