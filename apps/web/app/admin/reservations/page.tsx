import { CalendarClock } from 'lucide-react';
import { apiFetch, getMe } from '../../lib/server-api';
import type { Reservation, Asset, Person, Category, Location } from '../../lib/types';
import { locationPath } from '../../lib/location-path';
import { PageHeader, Section, EmptyState } from '../ui';
import { ReservationsList } from './reservations-list';
import { NewReservationForm } from './new-reservation-form';
import type { AssetFacet } from './reservation-filters';

export const dynamic = 'force-dynamic';

export default async function ReservationsPage() {
  const [reservations, assets, people, categories, locations, me] = await Promise.all([
    apiFetch<Reservation[]>('/reservations'),
    apiFetch<Asset[]>('/assets'),
    apiFetch<Person[]>('/people'),
    apiFetch<Category[]>('/categories').catch(() => [] as Category[]),
    apiFetch<Location[]>('/locations').catch(() => [] as Location[]),
    getMe().catch(() => null),
  ]);
  // Žadatel = přihlášený uživatel: osoba propojená s účtem, jinak shoda e-mailu
  // (stejné pravidlo jako „Moje vybavení").
  const linked = people as (Person & { userId?: string | null })[];
  const byUser = me ? linked.filter((p) => p.userId === me.user.id) : [];
  const byEmail = me
    ? linked.filter(
        (p) => !p.userId && p.email && p.email.toLowerCase() === me.user.email.toLowerCase(),
      )
    : [];
  const mePersonId = byUser.length === 1 ? byUser[0].id : byEmail.length === 1 ? byEmail[0].id : '';
  const assetNames = Object.fromEntries(assets.map((a) => [a.id, a.name]));
  const personNames = Object.fromEntries(people.map((p) => [p.id, p.name]));

  // Filtry: kategorie z číselníku (+ volný text u starších položek), sklad = domovské
  // místo včetně podřízených míst.
  const facets: AssetFacet[] = assets
    .map((a) => ({
      id: a.id,
      name: a.name,
      categoryKey: a.categoryId ?? (a.category ? `text:${a.category}` : ''),
      homeLocationId: a.homeLocationId,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'cs'));
  const legacyCategories = [
    ...new Set(assets.filter((a) => !a.categoryId && a.category).map((a) => a.category!)),
  ];
  const categoryOptions = [
    ...categories.map((c) => ({ value: c.id, label: c.name })),
    ...legacyCategories.map((name) => ({ value: `text:${name}`, label: name })),
  ].sort((a, b) => a.label.localeCompare(b.label, 'cs'));
  const places = locations
    .filter((l) => l.type !== 'access_point')
    .map((l) => ({ id: l.id, name: l.name, parentId: l.parentId }));
  const locationOptions = locations
    .filter((l) => l.type !== 'access_point' && l.cellRow == null)
    .map((l) => ({ value: l.id, label: locationPath(l.id, locations) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'cs'));
  const personOptions = people
    .map((p) => ({ value: p.id, label: p.name }))
    .sort((a, b) => a.label.localeCompare(b.label, 'cs'));

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
          <NewReservationForm
            assets={facets}
            categories={categoryOptions}
            locations={locationOptions}
            places={places}
            people={personOptions}
            defaultRequestedById={mePersonId}
          />
        )}
      </Section>

      <Section title={`Požadavky (${reservations.length})`}>
        <ReservationsList
          reservations={reservations}
          assetNames={assetNames}
          personNames={personNames}
          assets={facets}
          categories={categoryOptions}
          locations={locationOptions}
          places={places}
        />
      </Section>
    </div>
  );
}
