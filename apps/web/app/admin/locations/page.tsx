import { MapPin } from 'lucide-react';
import { apiFetch, getMyPermissions } from '../../lib/server-api';
import type { Asset, Location } from '../../lib/types';
import { PageHeader, Section, Badge, EmptyState } from '../ui';
import { InlineEdit } from '../inline-edit';
import { updateLocation } from '../actions';
import { LocationGrid } from './location-grid';
import { NewLocationForm } from './new-location-form';

export const dynamic = 'force-dynamic';

const LOCATION_TYPES = [
  { value: 'warehouse', label: 'Sklad', group: 'Místa' },
  { value: 'store', label: 'Prodejna', group: 'Místa' },
  { value: 'venue', label: 'Místo konání', group: 'Místa' },
  { value: 'office', label: 'Kancelář', group: 'Místa' },
  { value: 'home', label: 'Domov', group: 'Místa' },
  { value: 'rack', label: 'Regál', group: 'Úložné prostory' },
  { value: 'cabinet', label: 'Skříň', group: 'Úložné prostory' },
];

const TYPE_LABEL = new Map(LOCATION_TYPES.map((t) => [t.value, t.label]));
/** Typy s mřížkovým rozdělením na sekce. */
const GRID_TYPES = new Set(['rack', 'cabinet']);

interface TreeProps {
  nodes: Location[];
  byParent: Map<string | null, Location[]>;
  depth?: number;
  canManage: boolean;
  parentOptions: { value: string; label: string }[];
  assets: { id: string; name: string }[];
}

/** Vykreslí lokace jako strom (rekurzivně, odsazené dle úrovně). */
function Tree({ nodes, byParent, depth = 0, canManage, parentOptions, assets }: TreeProps) {
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
            <Badge tone="slate">{TYPE_LABEL.get(n.type) ?? n.type}</Badge>
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
          {GRID_TYPES.has(n.type) && (
            <LocationGrid
              locationId={n.id}
              hasGrid={n.gridRows != null && n.gridRows > 0}
              canManage={canManage}
              assets={assets}
            />
          )}
          <Tree nodes={byParent.get(n.id) ?? []} byParent={byParent} depth={depth + 1} canManage={canManage} parentOptions={parentOptions} assets={assets} />
        </div>
      ))}
    </>
  );
}

export default async function LocationsPage() {
  const [locations, assets, perms] = await Promise.all([
    apiFetch<Location[]>('/locations'),
    apiFetch<Asset[]>('/assets').catch(() => [] as Asset[]),
    getMyPermissions(),
  ]);
  const canManage = perms.has('core.location.create');
  const assetOpts = assets.map((a) => ({ id: a.id, name: a.name }));

  // Buňky mřížky (cellRow != null) se ve stromu nezobrazují – patří pod mřížku rodiče.
  const visible = locations.filter((l) => l.cellRow == null);
  const byParent = new Map<string | null, Location[]>();
  for (const l of visible) {
    const key = l.parentId ?? null;
    byParent.set(key, [...(byParent.get(key) ?? []), l]);
  }
  const roots = byParent.get(null) ?? [];
  const parentOptions = [
    { value: '', label: '— žádná (kořen) —' },
    ...visible.map((l) => ({ value: l.id, label: l.name })),
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
          <NewLocationForm parentOptions={parentOptions} />
        </Section>
      )}

      <Section title={`Hierarchie (${visible.length})`}>
        {roots.length === 0 ? (
          <EmptyState>Zatím žádná místa.</EmptyState>
        ) : (
          <Tree nodes={roots} byParent={byParent} canManage={canManage} parentOptions={parentOptions} assets={assetOpts} />
        )}
      </Section>
    </div>
  );
}
