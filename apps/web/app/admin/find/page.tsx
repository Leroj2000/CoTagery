import { apiFetch, getMyPermissions } from '../../lib/server-api';
import type { Asset, Location, Person } from '../../lib/types';
import { PageHeader } from '../ui';
import { Finder } from './finder';
export default async function FindPage() {
  const perms = await getMyPermissions();
  const [assets, places, people] = await Promise.all([
    perms.has('asset.item.view') ? apiFetch<Asset[]>('/assets') : Promise.resolve([]),
    apiFetch<Location[]>('/locations'),
    apiFetch<Person[]>('/people').catch(() => []),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Najít"
        description="Najdi věc, jejího držitele nebo přesné místo ve skladu."
      />
      <Finder assets={assets} places={places} people={people} />
    </div>
  );
}
