import { ShieldCheck } from 'lucide-react';
import { apiFetch, ApiError } from '../../lib/server-api';
import type { RolesOverview } from '../../lib/roles';
import { EmptyState, PageHeader } from '../ui';
import { RolesManager } from './roles-manager';

export const dynamic = 'force-dynamic';

export default async function RolesPage() {
  let overview: RolesOverview;
  try {
    overview = await apiFetch<RolesOverview>('/roles');
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) {
      return (
        <EmptyState>Role a oprávnění si může prohlédnout jen role s přístupem k rolím.</EmptyState>
      );
    }
    throw e;
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Role a oprávnění"
        description="Co která role ve firmě smí. Nahoře jsou nadřízené role, každá spravuje jen role pod sebou."
        icon={<ShieldCheck size={18} />}
      />
      <RolesManager initial={overview} />
    </div>
  );
}
