import { ScanBarcode } from 'lucide-react';
import { apiFetch } from '../../lib/server-api';
import type { Person, Location } from '../../lib/types';
import { PageHeader } from '../ui';
import { WorkflowClient } from './workflow-client';

export const dynamic = 'force-dynamic';

export default async function WorkflowPage() {
  const [people, locations] = await Promise.all([
    apiFetch<Person[]>('/people'),
    apiFetch<Location[]>('/locations'),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <PageHeader
        title="Dávkový sken"
        description="Zvol akci → naskenuj víc věcí za sebou → vyřeš blockery → potvrď jednou."
        icon={<ScanBarcode size={18} />}
      />
      <WorkflowClient
        people={people.map((p) => ({ value: p.id, label: p.name }))}
        locations={locations.map((l) => ({ value: l.id, label: l.name }))}
      />
    </div>
  );
}
