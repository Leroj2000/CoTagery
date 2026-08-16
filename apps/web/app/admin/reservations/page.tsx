import { CalendarClock } from 'lucide-react';
import { apiFetch } from '../../lib/server-api';
import type { Reservation, Asset, Person } from '../../lib/types';
import { PageHeader, Section, Table, Badge, EmptyState } from '../ui';
import { ActionForm } from '../action-form';
import { ActionButton } from '../action-button';
import { createReservation, setReservationStatus } from '../actions';

export const dynamic = 'force-dynamic';

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('cs-CZ') : '—';
}

const STATUS_TONE: Record<string, 'amber' | 'green' | 'red' | 'slate'> = {
  pending: 'amber',
  approved: 'green',
  rejected: 'red',
  cancelled: 'slate',
};

export default async function ReservationsPage() {
  const [reservations, assets, people] = await Promise.all([
    apiFetch<Reservation[]>('/reservations'),
    apiFetch<Asset[]>('/assets'),
    apiFetch<Person[]>('/people'),
  ]);
  const assetName = new Map(assets.map((a) => [a.id, a.name]));
  const personName = new Map(people.map((p) => [p.id, p.name]));

  const assetOptions = assets.map((a) => ({ value: a.id, label: a.name }));
  const personOptions = [{ value: '', label: '— nikdo —' }, ...people.map((p) => ({ value: p.id, label: p.name }))];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Požadavky / rezervace"
        description="Žádosti o věci na termín – skladník schválí nebo zamítne."
        icon={<CalendarClock size={18} />}
      />

      <Section title="Nový požadavek">
        {assets.length === 0 ? (
          <EmptyState>Nejdřív vytvoř věci (Věci).</EmptyState>
        ) : (
          <ActionForm
            action={createReservation}
            submitLabel="Vytvořit požadavek"
            fields={[
              { name: 'assetId', label: 'Věc', required: true, options: assetOptions },
              { name: 'requestedById', label: 'Žadatel', options: personOptions },
              { name: 'fromAt', label: 'Od', type: 'text' },
              { name: 'toAt', label: 'Do', type: 'text' },
              { name: 'purpose', label: 'Účel' },
            ]}
          />
        )}
      </Section>

      <Section title={`Požadavky (${reservations.length})`}>
        {reservations.length === 0 ? (
          <EmptyState>Zatím žádné požadavky.</EmptyState>
        ) : (
          <Table
            head={['Věc', 'Žadatel', 'Termín', 'Účel', 'Stav', 'Akce']}
            rows={reservations.map((r) => [
              assetName.get(r.assetId) ?? '—',
              r.requestedById ? (personName.get(r.requestedById) ?? '—') : '—',
              `${fmtDate(r.fromAt)} – ${fmtDate(r.toAt)}`,
              r.purpose ?? '—',
              <Badge key="s" tone={STATUS_TONE[r.status] ?? 'slate'}>
                {r.status}
              </Badge>,
              r.status === 'pending' ? (
                <span key="a" className="flex gap-1">
                  <ActionButton action={setReservationStatus} hidden={{ id: r.id, action: 'approve' }} label="Schválit" />
                  <ActionButton action={setReservationStatus} hidden={{ id: r.id, action: 'reject' }} label="Zamítnout" variant="danger" />
                </span>
              ) : (
                '—'
              ),
            ])}
          />
        )}
      </Section>
    </div>
  );
}
