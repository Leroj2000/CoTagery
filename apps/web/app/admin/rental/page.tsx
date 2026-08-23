import { apiFetch, getMyPermissions } from '../../lib/server-api';
import type { Asset, Tenant } from '../../lib/types';
import { PageHeader } from '../ui';
import { RentalManager, type Listing } from './rental-manager';

export const dynamic = 'force-dynamic';

export default async function RentalAdminPage() {
  const [listings, assets, tenant, perms] = await Promise.all([
    apiFetch<Listing[]>('/rental-listings').catch(() => [] as Listing[]),
    apiFetch<Asset[]>('/assets').catch(() => [] as Asset[]),
    apiFetch<Tenant>('/tenant').catch(() => null),
    getMyPermissions(),
  ]);
  const canManage = perms.has('rental.item.manage');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Půjčovna"
        description="Publikuj své Věci k veřejnému zapůjčení s ceníkem. První fotka věci se zobrazí v katalogu."
      />
      {tenant?.slug && (
        <p className="text-sm text-slate-500">
          Veřejná stránka:{' '}
          <a href={`/pujcovna/${tenant.slug}`} target="_blank" rel="noreferrer" className="font-medium text-brand-700 hover:underline">
            /pujcovna/{tenant.slug}
          </a>
        </p>
      )}
      <RentalManager
        listings={listings}
        assets={assets.map((a) => ({ id: a.id, name: a.name }))}
        tenantSlug={tenant?.slug ?? null}
        canManage={canManage}
      />
    </div>
  );
}
