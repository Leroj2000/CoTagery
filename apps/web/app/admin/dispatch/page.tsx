import { PackageCheck } from 'lucide-react';
import { apiFetch } from '../../lib/server-api';
import type { Asset, Person, Location } from '../../lib/types';
import { PageHeader, Section, EmptyState } from '../ui';
import { DispatchForm } from './dispatch-form';

export const dynamic = 'force-dynamic';

export default async function DispatchPage() {
  const [assets, people, locations] = await Promise.all([
    apiFetch<Asset[]>('/assets'),
    apiFetch<Person[]>('/people'),
    apiFetch<Location[]>('/locations'),
  ]);

  // K výdeji jen věci, které lze půjčit/přidělit (ne retired/loaned).
  const dispatchable = assets
    .filter((a) => a.status === 'available' || a.status === 'assigned' || a.status === 'reserved')
    .map((a) => ({ id: a.id, name: a.name, status: a.status }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Výdej"
        description="Hromadné předání více věcí najednou – vyber příjemce a zaškrtni věci."
        icon={<PackageCheck size={18} />}
      />

      <Section title="Hromadný výdej">
        {people.length === 0 && locations.length === 0 ? (
          <EmptyState>Nejdřív vytvoř osobu nebo místo.</EmptyState>
        ) : dispatchable.length === 0 ? (
          <EmptyState>Žádné dostupné věci k výdeji.</EmptyState>
        ) : (
          <DispatchForm
            assets={dispatchable}
            people={people.map((p) => ({ value: p.id, label: p.name }))}
            locations={locations.map((l) => ({ value: l.id, label: l.name }))}
          />
        )}
      </Section>
    </div>
  );
}
