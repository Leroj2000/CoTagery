import { MapPin, Settings2 } from 'lucide-react';
import Link from 'next/link';
import { locationPath } from '../../lib/location-path';
import { isGridType, typeLabel, type LocationTypeDef } from './location-types';
import { apiFetch, getMyPermissions } from '../../lib/server-api';
import type { Asset, Location } from '../../lib/types';
import { PageHeader, Section, Badge, EmptyState } from '../ui';
import { LocationGrid } from './location-grid';
import { NewLocationForm } from './new-location-form';
import { EditLocationForm } from './edit-location-form';

export const dynamic = 'force-dynamic';

interface TreeProps {
  nodes: Location[];
  byParent: Map<string | null, Location[]>;
  depth?: number;
  canManage: boolean;
  parentOptions: { value: string; label: string; type?: string }[];
  assets: { id: string; name: string }[];
  types: LocationTypeDef[];
}

/** Vykreslí lokace jako strom (rekurzivně, odsazené dle úrovně). */
function Tree({ nodes, byParent, depth = 0, canManage, parentOptions, assets, types }: TreeProps) {
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
            <Link
              href={`/admin/locations/${n.id}`}
              className="py-2 text-sm font-medium text-brand-700 hover:underline"
            >
              {n.name}
            </Link>
            <Badge tone="slate">{typeLabel(types, n.type)}</Badge>
            {canManage && (
              <span className="ml-auto">
                <EditLocationForm
                  id={n.id}
                  name={n.name}
                  type={n.type}
                  address={n.address}
                  parentId={n.parentId}
                  parentOptions={parentOptions}
                  types={types}
                />
              </span>
            )}
          </div>
          {(isGridType(types, n.type) || (n.gridRows ?? 0) > 0) && (
            <LocationGrid
              locationId={n.id}
              hasGrid={n.gridRows != null && n.gridRows > 0}
              canManage={canManage}
              assets={assets}
            />
          )}
          <Tree
            nodes={byParent.get(n.id) ?? []}
            byParent={byParent}
            depth={depth + 1}
            canManage={canManage}
            parentOptions={parentOptions}
            assets={assets}
            types={types}
          />
        </div>
      ))}
    </>
  );
}

export default async function LocationsPage() {
  const [locations, assets, perms, types] = await Promise.all([
    apiFetch<Location[]>('/locations'),
    apiFetch<Asset[]>('/assets').catch(() => [] as Asset[]),
    getMyPermissions(),
    apiFetch<LocationTypeDef[]>('/location-types').catch(() => [] as LocationTypeDef[]),
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
  const roots = visible.filter((l) => !l.parentId || !visible.some((p) => p.id === l.parentId));
  const parentOptions = [
    { value: '', label: '— žádná (kořen) —' },
    ...visible
      .filter((l) => l.type !== 'access_point')
      .map((l) => ({ value: l.id, label: locationPath(l.id, locations), type: l.type })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Místa"
        description="Stromová hierarchie lokací (Firma → Sklad → Regál → Police)."
        icon={<MapPin size={18} />}
        action={
          perms.has('core.location.update') ? (
            <Link
              href="/admin/locations/types"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Settings2 size={15} /> Typy míst
            </Link>
          ) : undefined
        }
      />

      {canManage && (
        <Section title="Nové místo">
          <NewLocationForm parentOptions={parentOptions} types={types} />
        </Section>
      )}

      <Section title={`Hierarchie (${visible.length})`}>
        {roots.length === 0 ? (
          <EmptyState>Zatím žádná místa. Začněte formulářem „Nové místo“ výše.</EmptyState>
        ) : (
          <Tree
            nodes={roots}
            byParent={byParent}
            canManage={canManage}
            parentOptions={parentOptions}
            assets={assetOpts}
            types={types}
          />
        )}
      </Section>
    </div>
  );
}
