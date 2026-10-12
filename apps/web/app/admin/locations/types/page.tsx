import Link from 'next/link';
import { Settings2 } from 'lucide-react';
import { apiFetch, getMyPermissions } from '../../../lib/server-api';
import { EmptyState, PageHeader } from '../../ui';
import type { LocationTypeView } from '../location-types';
import { LocationTypesManager } from './location-types-manager';

export const dynamic = 'force-dynamic';

export default async function LocationTypesPage() {
  const perms = await getMyPermissions();
  const types = await apiFetch<LocationTypeView[]>('/location-types').catch(() => null);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/locations" className="text-xs text-slate-500 hover:underline">
          ← Místa
        </Link>
        <div className="mt-1">
          <PageHeader
            title="Typy míst"
            description="Z čeho se vybírá typ místa. Systémové typy můžete přejmenovat nebo skrýt, vlastní přidat. Existující místa o svůj typ nepřijdou."
            icon={<Settings2 size={18} />}
          />
        </div>
      </div>
      {!types ? (
        <EmptyState>Typy míst se nepodařilo načíst.</EmptyState>
      ) : (
        <LocationTypesManager initial={types} canManage={perms.has('core.location.update')} />
      )}
    </div>
  );
}
