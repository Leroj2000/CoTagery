import { MapPin } from 'lucide-react';
import { apiFetch } from '../../lib/server-api';
import type { Location } from '../../lib/types';
import { PageHeader, Section, Badge, EmptyState } from '../ui';
import { ActionForm } from '../action-form';
import { createLocation } from '../actions';

export const dynamic = 'force-dynamic';

const LOCATION_TYPES = [
  { value: 'warehouse', label: 'Sklad' },
  { value: 'store', label: 'Prodejna' },
  { value: 'venue', label: 'Místo konání' },
  { value: 'office', label: 'Kancelář' },
  { value: 'home', label: 'Domov' },
];

/** Vykreslí lokace jako strom (rekurzivně, odsazené dle úrovně). */
function Tree({ nodes, byParent, depth = 0 }: { nodes: Location[]; byParent: Map<string | null, Location[]>; depth?: number }) {
  return (
    <>
      {nodes.map((n) => (
        <div key={n.id}>
          <div
            className="flex items-center gap-2 border-b border-slate-100 py-2 last:border-0"
            style={{ paddingLeft: `${depth * 20}px` }}
          >
            {depth > 0 && <span className="text-slate-300">└</span>}
            <MapPin size={14} className="text-slate-400" />
            <span className="text-sm font-medium text-slate-700">{n.name}</span>
            <Badge tone="slate">{n.type}</Badge>
          </div>
          <Tree nodes={byParent.get(n.id) ?? []} byParent={byParent} depth={depth + 1} />
        </div>
      ))}
    </>
  );
}

export default async function LocationsPage() {
  const locations = await apiFetch<Location[]>('/locations');

  const byParent = new Map<string | null, Location[]>();
  for (const l of locations) {
    const key = l.parentId ?? null;
    byParent.set(key, [...(byParent.get(key) ?? []), l]);
  }
  const roots = byParent.get(null) ?? [];
  const parentOptions = [
    { value: '', label: '— žádná (kořen) —' },
    ...locations.map((l) => ({ value: l.id, label: l.name })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Místa"
        description="Stromová hierarchie lokací (Firma → Sklad → Regál → Police)."
        icon={<MapPin size={18} />}
      />

      <Section title="Nové místo">
        <ActionForm
          action={createLocation}
          submitLabel="Vytvořit místo"
          fields={[
            { name: 'name', label: 'Název', required: true, placeholder: 'Sklad Praha' },
            { name: 'type', label: 'Typ', options: LOCATION_TYPES },
            { name: 'parentId', label: 'Nadřazené místo', options: parentOptions },
          ]}
        />
      </Section>

      <Section title={`Hierarchie (${locations.length})`}>
        {roots.length === 0 ? (
          <EmptyState>Zatím žádná místa.</EmptyState>
        ) : (
          <Tree nodes={roots} byParent={byParent} />
        )}
      </Section>
    </div>
  );
}
