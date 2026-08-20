import { MapPin } from 'lucide-react';
import { apiFetch, getMyPermissions } from '../../lib/server-api';
import type { Location } from '../../lib/types';
import { PageHeader, Section, Badge, EmptyState } from '../ui';
import { ActionForm } from '../action-form';
import { InlineEdit } from '../inline-edit';
import { createLocation, updateLocation } from '../actions';

export const dynamic = 'force-dynamic';

const LOCATION_TYPES = [
  { value: 'warehouse', label: 'Sklad' },
  { value: 'store', label: 'Prodejna' },
  { value: 'venue', label: 'Místo konání' },
  { value: 'office', label: 'Kancelář' },
  { value: 'home', label: 'Domov' },
];

interface TreeProps {
  nodes: Location[];
  byParent: Map<string | null, Location[]>;
  depth?: number;
  canManage: boolean;
  parentOptions: { value: string; label: string }[];
}

/** Vykreslí lokace jako strom (rekurzivně, odsazené dle úrovně). */
function Tree({ nodes, byParent, depth = 0, canManage, parentOptions }: TreeProps) {
  return (
    <>
      {nodes.map((n) => (
        <div key={n.id}>
          <div
            className="flex flex-wrap items-center gap-2 border-b border-slate-100 py-2 last:border-0"
            style={{ paddingLeft: `${depth * 20}px` }}
          >
            {depth > 0 && <span className="text-slate-300">└</span>}
            <MapPin size={14} className="text-slate-400" />
            <span className="text-sm font-medium text-slate-700">{n.name}</span>
            <Badge tone="slate">{n.type}</Badge>
            {canManage && (
              <span className="ml-auto">
                <InlineEdit
                  action={updateLocation}
                  id={n.id}
                  fields={[
                    { name: 'name', label: 'Název', defaultValue: n.name },
                    { name: 'type', label: 'Typ', defaultValue: n.type, options: LOCATION_TYPES },
                    { name: 'address', label: 'Adresa', defaultValue: n.address ?? '' },
                    {
                      name: 'parentId',
                      label: 'Nadřazené',
                      defaultValue: n.parentId ?? '',
                      options: parentOptions.filter((o) => o.value !== n.id),
                    },
                  ]}
                />
              </span>
            )}
          </div>
          <Tree nodes={byParent.get(n.id) ?? []} byParent={byParent} depth={depth + 1} canManage={canManage} parentOptions={parentOptions} />
        </div>
      ))}
    </>
  );
}

export default async function LocationsPage() {
  const [locations, perms] = await Promise.all([apiFetch<Location[]>('/locations'), getMyPermissions()]);
  const canManage = perms.has('core.location.create');

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

      {canManage && (
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
      )}

      <Section title={`Hierarchie (${locations.length})`}>
        {roots.length === 0 ? (
          <EmptyState>Zatím žádná místa.</EmptyState>
        ) : (
          <Tree nodes={roots} byParent={byParent} canManage={canManage} parentOptions={parentOptions} />
        )}
      </Section>
    </div>
  );
}
