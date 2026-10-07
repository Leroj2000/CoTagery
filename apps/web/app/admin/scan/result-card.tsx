'use client';

import Link from 'next/link';
import {
  Loader2,
  AlertCircle,
  Home,
  MapPin,
  User,
  CalendarClock,
  QrCode,
  ArrowRight,
  Undo2,
} from 'lucide-react';
import type { ScanResult } from '../../lib/types';
import { StatusBadge, Badge, Mono } from '../ui';

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

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('cs-CZ') : '—';
}

/** Výsledek identifikace: karta položky s kontextem a kontextovými akcemi. */
export function ResultCard({
  result,
  acting,
  onQuickReturn,
}: {
  result: ScanResult;
  acting: boolean;
  /** One-tap „Vrátit domů"; bez handleru se místo tlačítka nabídne akce Vrátit. */
  onQuickReturn?: (assetId: string) => void;
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
    !!onQuickReturn &&
    primaryAction === 'return' &&
    !!asset.homeLocationId &&
    !result.requireReturnPhoto;
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
            onClick={() => onQuickReturn?.(asset.id)}
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
