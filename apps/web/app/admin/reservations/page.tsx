import { CalendarClock } from 'lucide-react';
import { apiFetch } from '../../lib/server-api';
import type { Reservation, Asset, Person } from '../../lib/types';
import { PageHeader, Section, EmptyState } from '../ui';
import { ActionForm } from '../action-form';
import { createReservation } from '../actions';
import { ReservationsList } from './reservations-list';

export const dynamic = 'force-dynamic';

export default async function ReservationsPage() {
  const [reservations, assets, people] = await Promise.all([
    apiFetch<Reservation[]>('/reservations'),
    apiFetch<Asset[]>('/assets'),
    apiFetch<Person[]>('/people'),
  ]);
  const assetNames = Object.fromEntries(assets.map((a) => [a.id, a.name]));
  const personNames = Object.fromEntries(people.map((p) => [p.id, p.name]));

  const assetOptions = assets.map((a) => ({ value: a.id, label: a.name }));
  const personOptions = [
    { value: '', label: '— nikdo —' },
    ...people.map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Požadavky / rezervace"
        description="Žádosti o položky na termín – skladník schválí nebo zamítne."
        icon={<CalendarClock size={18} />}
      />

      <Section title="Nový požadavek">
        {assets.length === 0 ? (
          <EmptyState>Nejdřív vytvoř položky (Položky).</EmptyState>
        ) : (
          <ActionForm
            action={createReservation}
            submitLabel="Vytvořit požadavek"
            fields={[
              { name: 'assetId', label: 'Položka', required: true, options: assetOptions },
              { name: 'requestedById', label: 'Žadatel', options: personOptions },
              { name: 'fromAt', label: 'Od', type: 'datetime-local', required: true },
              { name: 'toAt', label: 'Do', type: 'datetime-local', required: true },
              { name: 'purpose', label: 'Účel' },
            ]}
          />
        )}
      </Section>

      <Section title={`Požadavky (${reservations.length})`}>
        <ReservationsList
          reservations={reservations}
          assetNames={assetNames}
          personNames={personNames}
        />
      </Section>
    </div>
  );
}
