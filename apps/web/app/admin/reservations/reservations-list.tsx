'use client';

import { useMemo, useState } from 'react';
import type { Reservation } from '../../lib/types';
import { Badge, EmptyState, Table } from '../ui';
import { ActionButton } from '../action-button';
import { fulfillReservation, setReservationStatus } from '../actions';

const PAGE_SIZE = 25;
const STATUS_TONE: Record<string, 'amber' | 'green' | 'red' | 'slate'> = {
  pending: 'amber',
  approved: 'green',
  fulfilled: 'green',
  rejected: 'red',
  cancelled: 'slate',
};

function fmtDate(iso: string | null): string {
  return iso
    ? new Date(iso).toLocaleString('cs-CZ', { dateStyle: 'short', timeStyle: 'short' })
    : '—';
}

export function ReservationsList({
  reservations,
  assetNames,
  personNames,
}: {
  reservations: Reservation[];
  assetNames: Record<string, string>;
  personNames: Record<string, string>;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [order, setOrder] = useState<'newest' | 'from-asc' | 'from-desc'>('newest');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('cs');
    return reservations
      .filter((item) => !status || item.status === status)
      .filter((item) => {
        if (!needle) return true;
        return `${assetNames[item.assetId] ?? ''} ${item.requestedById ? (personNames[item.requestedById] ?? '') : ''} ${item.purpose ?? ''}`
          .toLocaleLowerCase('cs')
          .includes(needle);
      })
      .sort((a, b) => {
        if (order === 'newest') return b.createdAt.localeCompare(a.createdAt);
        const result = (a.fromAt ?? '').localeCompare(b.fromAt ?? '');
        return order === 'from-asc' ? result : -result;
      });
  }, [reservations, status, query, order, assetNames, personNames]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const reset = (callback: () => void) => {
    callback();
    setPage(1);
  };

  if (reservations.length === 0) return <EmptyState>Zatím žádné požadavky.</EmptyState>;

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <input
          value={query}
          onChange={(event) => reset(() => setQuery(event.target.value))}
          placeholder="Hledat položku, žadatele nebo účel…"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(event) => reset(() => setStatus(event.target.value))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Všechny stavy</option>
          <option value="pending">Čeká</option>
          <option value="approved">Schváleno</option>
          <option value="fulfilled">Vydáno</option>
          <option value="rejected">Zamítnuto</option>
          <option value="cancelled">Zrušeno</option>
        </select>
        <select
          value={order}
          onChange={(event) => reset(() => setOrder(event.target.value as typeof order))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="newest">Nejnovější požadavky</option>
          <option value="from-asc">Termín od nejbližšího</option>
          <option value="from-desc">Termín od nejvzdálenějšího</option>
        </select>
      </div>
      <p className="text-xs text-slate-500">
        Zobrazeno {visible.length} z {filtered.length} požadavků.
      </p>
      {visible.length === 0 ? (
        <EmptyState>Žádný požadavek neodpovídá filtru.</EmptyState>
      ) : (
        <Table
          head={['Položka', 'Žadatel', 'Termín', 'Účel', 'Stav', 'Akce']}
          rows={visible.map((item) => [
            assetNames[item.assetId] ?? '—',
            item.requestedById ? (personNames[item.requestedById] ?? '—') : '—',
            `${fmtDate(item.fromAt)} – ${fmtDate(item.toAt)}`,
            item.purpose ?? '—',
            <Badge key="status" tone={STATUS_TONE[item.status] ?? 'slate'}>
              {item.status}
            </Badge>,
            item.status === 'pending' ? (
              <span key="actions" className="flex gap-1">
                <ActionButton
                  action={setReservationStatus}
                  hidden={{ id: item.id, action: 'approve' }}
                  label="Schválit"
                />
                <ActionButton
                  action={setReservationStatus}
                  hidden={{ id: item.id, action: 'reject' }}
                  label="Zamítnout"
                  variant="danger"
                />
              </span>
            ) : item.status === 'approved' && item.requestedById && item.toAt ? (
              <span key="actions" className="flex gap-1">
                <ActionButton
                  action={fulfillReservation}
                  hidden={{
                    reservationId: item.id,
                    assetId: item.assetId,
                    requestedById: item.requestedById,
                    toAt: item.toAt,
                  }}
                  label="Vydat"
                />
                <ActionButton
                  action={setReservationStatus}
                  hidden={{ id: item.id, action: 'cancel' }}
                  label="Zrušit"
                  variant="danger"
                />
              </span>
            ) : (
              '—'
            ),
          ])}
        />
      )}
      {pageCount > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>
            Strana {currentPage} z {pageCount}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setPage((value) => value - 1)}
              className="rounded-lg border px-3 py-1.5 disabled:opacity-40"
            >
              Předchozí
            </button>
            <button
              type="button"
              disabled={currentPage === pageCount}
              onClick={() => setPage((value) => value + 1)}
              className="rounded-lg border px-3 py-1.5 disabled:opacity-40"
            >
              Další
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
