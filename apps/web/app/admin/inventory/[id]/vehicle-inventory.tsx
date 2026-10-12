'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Car, FileSpreadsheet, Gauge, Loader2, Lock, Wrench } from 'lucide-react';
import { Badge } from '../../ui';
import type {
  InventoryDetail,
  MaintenanceStatus,
  VehicleInventoryRow,
  VehiclePlanState,
} from '../../../lib/types';

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10';
const secondaryBtn =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50';

const STATUS: Record<
  MaintenanceStatus,
  { label: string; tone: 'red' | 'amber' | 'green' | 'slate' }
> = {
  overdue: { label: 'Po servisu', tone: 'red' },
  soon: { label: 'Servis se blíží', tone: 'amber' },
  need_reading: { label: 'Chybí tachometr', tone: 'amber' },
  ok: { label: 'V pořádku', tone: 'green' },
  not_started: { label: 'Bez záznamu servisu', tone: 'slate' },
};

const km = (n: number) => `${n.toLocaleString('cs-CZ')} km`;

function fmtDay(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d}. ${m}. ${y}`;
}

function fmtInstant(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('cs-CZ', { timeZone: 'Europe/Prague' }) : '—';
}

function pragueToday(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague' }).format(new Date());
}

/** „za 1 200 km · za 45 dní" / „400 km po servisu · 10 dní po termínu". */
function serviceDistance(p: VehiclePlanState): string {
  const parts: string[] = [];
  if (p.kmToService != null)
    parts.push(p.kmToService >= 0 ? `za ${km(p.kmToService)}` : `${km(-p.kmToService)} po servisu`);
  if (p.daysToService != null)
    parts.push(
      p.daysToService >= 0
        ? `za ${p.daysToService} ${p.daysToService === 1 ? 'den' : p.daysToService < 5 ? 'dny' : 'dní'}`
        : `${-p.daysToService} dní po termínu`,
    );
  return parts.join(' · ');
}

/** Inventura vozidel: stav vozidel k období, zápis tachometru a poznámek, uzavření. */
export function VehicleInventory({
  initialDetail,
  canExport = true,
}: {
  initialDetail: InventoryDetail;
  canExport?: boolean;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState(initialDetail);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { check } = detail;
  const rows = detail.vehicles ?? [];
  const open = check.status === 'open';
  // Tachometr se zapisuje k dnešku – jen když období ještě neskončilo.
  const canRecordOdometer = open && (check.periodTo ?? '') >= pragueToday();

  const total = rows.reduce((sum, r) => sum + (r.distance ?? 0), 0);
  const overdue = rows.filter((r) => r.next?.status === 'overdue').length;
  const soon = rows.filter((r) => r.next?.status === 'soon').length;
  const noOdometer = rows.filter((r) => r.odometerEnd == null).length;

  async function close() {
    if (!confirm('Uzavřít inventuru? Stav vozidel se zmrazí a už nepůjde měnit.')) return;
    setClosing(true);
    setError(null);
    try {
      const res = await fetch(`/api/inventory/${check.id}/close`, {
        method: 'POST',
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Uzavření selhalo');
      router.refresh();
      const fresh = await fetch(`/api/inventory/${check.id}`, { cache: 'no-store' });
      if (fresh.ok) setDetail((await fresh.json()) as InventoryDetail);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Uzavření selhalo');
    } finally {
      setClosing(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Vozidel" value={String(rows.length)} />
        <Tile label="Ujeto za období" value={km(Math.round(total))} />
        <Tile label="Po servisu" value={String(overdue)} tone={overdue ? 'red' : undefined} />
        <Tile
          label="Bez stavu tachometru"
          value={String(noOdometer)}
          tone={noOdometer ? 'amber' : undefined}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canExport && (
          <a href={`/api/inventory/${check.id}/export`} className={secondaryBtn}>
            <FileSpreadsheet size={15} /> Stáhnout Excel
          </a>
        )}
        {open && (
          <button type="button" className={secondaryBtn} onClick={close} disabled={closing}>
            {closing ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
            Uzavřít inventuru
          </button>
        )}
        <Link href="/admin/settings#exporty" className="text-xs text-slate-500 hover:underline">
          Co je v Excelu? Nastavení → Exporty
        </Link>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {open && !canRecordOdometer && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 ring-1 ring-inset ring-slate-200">
          Období už skončilo – stav tachometru je z odečtů do {fmtDay(check.periodTo)}. Doplnit jde
          poznámka; odečet zapiš v detailu vozidla.
        </p>
      )}
      {soon > 0 && (
        <p className="text-sm text-amber-800">
          U {soon} {soon === 1 ? 'vozidla' : 'vozidel'} se blíží servis.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <VehicleCard
            key={row.assetId}
            checkId={check.id}
            row={row}
            open={open}
            canRecordOdometer={canRecordOdometer}
            onSaved={setDetail}
          />
        ))}
      </ul>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: 'red' | 'amber' }) {
  const cls =
    tone === 'red'
      ? 'bg-red-50 text-red-700 ring-red-200'
      : tone === 'amber'
        ? 'bg-amber-50 text-amber-800 ring-amber-200'
        : 'bg-white text-slate-800 ring-slate-200';
  return (
    <div className={`rounded-2xl p-4 ring-1 ring-inset ${cls}`}>
      <p className="text-xl font-semibold">{value}</p>
      <p className="text-xs opacity-80">{label}</p>
    </div>
  );
}

function VehicleCard({
  checkId,
  row,
  open,
  canRecordOdometer,
  onSaved,
}: {
  checkId: string;
  row: VehicleInventoryRow;
  open: boolean;
  canRecordOdometer: boolean;
  onSaved: (d: InventoryDetail) => void;
}) {
  const [odometer, setOdometer] = useState('');
  const [note, setNote] = useState(row.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const next = row.next;
  const dirty = odometer.trim() !== '' || note !== (row.note ?? '');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const value = odometer.trim() === '' ? undefined : Number(odometer.replace(/\s/g, ''));
    if (value !== undefined && (!Number.isInteger(value) || value < 0))
      return setError('Stav tachometru musí být celé číslo v km.');
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/inventory/${checkId}/vehicles/${row.assetId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...(value !== undefined ? { odometer: value } : {}),
          ...(note !== (row.note ?? '') ? { note: note || null } : {}),
        }),
      });
      const data = (await res.json().catch(() => null)) as
        (InventoryDetail & { message?: string | string[] }) | null;
      if (!res.ok) {
        const msg = Array.isArray(data?.message) ? data?.message[0] : data?.message;
        throw new Error(msg || 'Uložení selhalo');
      }
      setOdometer('');
      setSaved(true);
      if (data) onSaved(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení selhalo');
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/admin/assets/${row.assetId}`}
            className="inline-flex items-center gap-1.5 font-medium text-slate-900 hover:underline"
          >
            <Car size={16} className="shrink-0 text-slate-400" /> {row.name}
          </Link>
          <p className="text-xs text-slate-500">
            {[
              row.registrationPlate && `SPZ ${row.registrationPlate}`,
              row.inventoryNumber,
              row.holder && `má ${row.holder}`,
            ]
              .filter(Boolean)
              .join(' · ') || '—'}
          </p>
        </div>
        {next && <Badge tone={STATUS[next.status].tone}>{STATUS[next.status].label}</Badge>}
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-xs text-slate-500">Tachometr – začátek</dt>
          <dd className="font-medium">{row.odometerStart != null ? km(row.odometerStart) : '—'}</dd>
          <dd className="text-xs text-slate-400">{fmtInstant(row.odometerStartAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Tachometr – konec</dt>
          <dd className="font-medium">{row.odometerEnd != null ? km(row.odometerEnd) : '—'}</dd>
          <dd className="text-xs text-slate-400">{fmtInstant(row.odometerEndAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Ujeto za období</dt>
          <dd className="font-semibold">{row.distance != null ? km(row.distance) : '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Ujeto od předchozího záznamu</dt>
          <dd className="font-medium">
            {row.distanceSincePrevious != null ? km(row.distanceSincePrevious) : '—'}
          </dd>
          {row.previousOdometer != null && (
            <dd className="text-xs text-slate-400">
              z {km(row.previousOdometer)} · {fmtInstant(row.previousOdometerAt ?? null)}
            </dd>
          )}
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-slate-500">Ujeto od pořízení</dt>
          <dd className="font-medium">
            {row.distanceSincePurchase != null ? km(row.distanceSincePurchase) : '—'}
          </dd>
          <dd className="text-xs text-slate-400">
            {row.odometerAtPurchase == null
              ? 'Chybí datum pořízení nebo odečet tachometru.'
              : row.odometerAtPurchaseSource === 'new'
                ? 'Pořízeno jako nové (0 km).'
                : row.odometerAtPurchaseSource === 'first_after'
                  ? `Odhad – první odečet po pořízení (${km(row.odometerAtPurchase)}).`
                  : `Při pořízení ${km(row.odometerAtPurchase)}.`}
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
        <Wrench size={15} className="mt-0.5 shrink-0 text-slate-400" />
        {next ? (
          <div>
            <p className="font-medium text-slate-800">{next.title}</p>
            <p className={next.status === 'overdue' ? 'text-red-700' : 'text-slate-600'}>
              {serviceDistance(next) || 'Chybí údaje (poslední servis nebo tachometr)'}
              {next.nextDueOn && ` · termín ${fmtDay(next.nextDueOn)}`}
            </p>
          </div>
        ) : (
          <p className="text-slate-500">Bez servisních intervalů.</p>
        )}
      </div>

      {row.servicesInPeriod.length > 0 && (
        <ul className="mt-2 flex flex-col gap-0.5 text-xs text-slate-600">
          {row.servicesInPeriod.map((s, i) => (
            <li key={i}>
              {fmtDay(s.performedOn)} – {s.title}
              {s.meterValue != null && ` (${km(s.meterValue)})`}
              {s.provider && `, ${s.provider}`}
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <form onSubmit={save} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          {canRecordOdometer && (
            <label className="flex flex-col gap-1 sm:w-44">
              <span className="text-xs font-medium text-slate-600">Stav tachometru dnes</span>
              <span className="relative">
                <Gauge
                  size={15}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  inputMode="numeric"
                  className={`${inputCls} pl-8`}
                  value={odometer}
                  onChange={(e) => setOdometer(e.target.value)}
                  placeholder={row.odometerEnd != null ? String(row.odometerEnd) : 'km'}
                />
              </span>
            </label>
          )}
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Poznámka</span>
            <input
              className={inputCls}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="stav vozidla, poškození, výbava…"
            />
          </label>
          <button type="submit" className={secondaryBtn} disabled={busy || !dirty}>
            {busy && <Loader2 size={15} className="animate-spin" />} Uložit
          </button>
        </form>
      ) : (
        row.note && <p className="mt-2 text-sm text-slate-700">Poznámka: {row.note}</p>
      )}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      {saved && !error && <p className="mt-2 text-xs text-emerald-700">Uloženo.</p>}
    </li>
  );
}
