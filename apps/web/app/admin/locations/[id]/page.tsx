import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiFetch, ApiError, getMyPermissions } from '../../../lib/server-api';
import { locationPath, locationDescendants } from '../../../lib/location-path';
import type { Asset, Location } from '../../../lib/types';
import { PageHeader, Section, EmptyState, StatusBadge } from '../../ui';
import { LocationLabel } from './location-label';
import { EditLocationForm } from '../edit-location-form';

export default async function LocationDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let place: Location;
  try {
    place = await apiFetch<Location>(`/locations/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const perms = await getMyPermissions();
  const [places, result, modules] = await Promise.all([
    apiFetch<Location[]>('/locations'),
    place.type !== 'access_point' && perms.has('asset.item.view')
      ? apiFetch<{ items: Asset[]; total: number }>(`/assets/search?location=${id}`)
      : Promise.resolve({ items: [], total: 0 }),
    apiFetch<{ moduleKey: string; state: string }[]>('/modules'),
  ]);
  const assets = result.items;
  const descendants = locationDescendants(id, places);
  const present = assets.filter(
    (a) => a.currentHolderType === 'location' && descendants.has(a.currentHolderId ?? ''),
  );
  const homes = assets.filter((a) => descendants.has(a.homeLocationId ?? ''));
  return (
    <div className="space-y-6">
      <Link href="/admin/locations" className="text-sm text-brand-700">
        ← Místa
      </Link>
      <PageHeader
        title={place.name}
        description={locationPath(id, places)}
        action={
          place.type !== 'access_point' && perms.has('asset.item.create') ? (
            <Link className="action-primary" href={`/admin/assets/new?location=${id}`}>
              Přidat položku sem
            </Link>
          ) : undefined
        }
      />
      {place.type === 'access_point' && perms.has('core.location.create') && (
        <Section
          title="Upravit přístupový bod"
          description="Změň název, adresu nebo zařazení pod fyzické místo."
        >
          <EditLocationForm
            id={place.id}
            name={place.name}
            type={place.type}
            address={place.address}
            parentId={place.parentId}
            parentOptions={[
              { value: '', label: '— žádná (kořen) —' },
              ...places
                .filter((p) => p.type !== 'access_point' && p.cellRow == null)
                .map((p) => ({ value: p.id, label: locationPath(p.id, places), type: p.type })),
            ]}
          />
        </Section>
      )}
      <LocationLabel id={id} name={place.name} />
      {place.type === 'access_point' &&
        modules.some((m) => m.moduleKey === 'access' && m.state === 'active') &&
        perms.has('access.point.manage') && (
          <Link className="action-secondary" href={`/admin/access/${id}`}>
            Nastavit Vstupy pro tento bod →
          </Link>
        )}
      {place.type !== 'access_point' && perms.has('asset.inventory.manage') && (
        <Link className="action-secondary" href={`/admin/inventory?location=${id}`}>
          Zahájit inventuru tohoto místa
        </Link>
      )}
      {place.type !== 'access_point' && !perms.has('asset.item.view') && (
        <p className="text-sm text-slate-600">V této roli nemáš přístup k obsahu místa.</p>
      )}
      {place.type !== 'access_point' && result.total > assets.length && (
        <p role="status" className="text-sm text-amber-800">
          Zobrazeno {assets.length} z {result.total} položek tohoto místa. Další najdeš přes Najít.
        </p>
      )}
      {place.type !== 'access_point' && (
        <Section title="Podřízená místa">
          <div className="flex flex-wrap gap-3">
            {places
              .filter((p) => p.parentId === id)
              .map((p) => (
                <Link key={p.id} href={`/admin/locations/${p.id}`} className="action-secondary">
                  {p.name} →
                </Link>
              ))}
          </div>
          {!places.some((p) => p.parentId === id) && (
            <EmptyState>Toto místo nemá další podřízená místa.</EmptyState>
          )}
        </Section>
      )}
      {place.type !== 'access_point' && (
        <Section
          title={`Tady a v podřízených místech (${present.length})`}
          description="Aktuální evidované umístění. Položky u lidí nebo v jiných kontejnerech zde nejsou započítané."
        >
          {present.map((a) => (
            <Link
              key={a.id}
              href={`/admin/assets/${a.id}`}
              className="flex items-center justify-between gap-3 border-b border-slate-100 py-3"
            >
              <div>
                <span className="font-medium">{a.name}</span>
                <p className="text-xs text-slate-500">{locationPath(a.currentHolderId!, places)}</p>
              </div>
              <StatusBadge status={a.status} />
            </Link>
          ))}
          {!present.length && <EmptyState>Žádné položky zde nejsou aktuálně evidované.</EmptyState>}
        </Section>
      )}
      {place.type !== 'access_point' && (
        <Section
          title={`Patří sem (${homes.length})`}
          description="Domovské místo; věc může být právě u někoho jiného."
        >
          {homes.map((a) => (
            <Link key={a.id} href={`/admin/assets/${a.id}`} className="block py-2 text-brand-700">
              {a.name}
            </Link>
          ))}
        </Section>
      )}
    </div>
  );
}
