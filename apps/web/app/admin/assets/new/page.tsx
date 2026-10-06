import { apiFetch, getMyPermissions } from '../../../lib/server-api';
import type { Location, Category } from '../../../lib/types';
import { PageHeader, EmptyState } from '../../ui';
import { RegistrationWizard } from './registration-wizard';

export default async function NewAssetPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string }>;
}) {
  const perms = await getMyPermissions();
  if (!perms.has('asset.item.create'))
    return <EmptyState>Nemáš oprávnění přidávat položky.</EmptyState>;
  const [places, categories, query] = await Promise.all([
    apiFetch<Location[]>('/locations'),
    apiFetch<Category[]>('/categories'),
    searchParams,
  ]);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Přidat položku" description="Vyfoť, označ a ulož na správné místo." />
      <RegistrationWizard
        initialPlaces={places.filter((place) => place.type !== 'access_point')}
        categories={categories}
        initialLocation={query.location}
        canCreatePlace={perms.has('core.location.create')}
        canTag={perms.has('carrier.item.manage')}
        canPhoto={perms.has('asset.media.manage')}
      />
    </div>
  );
}
