import { ScanBarcode } from 'lucide-react';
import { apiFetch } from '../../lib/server-api';
import type { Person, Location, Asset } from '../../lib/types';
import { PageHeader } from '../ui';
import { WorkflowClient } from './workflow-client';

export const dynamic = 'force-dynamic';

export default async function WorkflowPage() {
  const [people, locations, assets] = await Promise.all([
    apiFetch<Person[]>('/people'),
    apiFetch<Location[]>('/locations'),
    apiFetch<Asset[]>('/assets'),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <PageHeader
        title="Výdej / dávkový sken"
        description="Zvol akci → naskenuj nebo vyber položky → vyřeš blockery → potvrď jednou."
        icon={<ScanBarcode size={18} />}
      />
      <WorkflowClient
        people={people.map((p) => ({ value: p.id, label: p.name }))}
        locations={locations.filter((l) => l.cellRow == null).map((l) => ({ value: l.id, label: l.name }))}
        assets={assets.map((a) => ({ id: a.id, name: a.name, status: a.status }))}
      />
    </div>
  );
}
