import { Mail } from 'lucide-react';
import { apiFetch, ApiError } from '../../../lib/server-api';
import type { NotificationsOverview } from '../../../lib/notifications';
import { PageHeader } from '../../ui';
import { NoAccess } from '../../no-access';
import { NotificationsManager } from './notifications-manager';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  let data: NotificationsOverview;
  try {
    data = await apiFetch<NotificationsOverview>('/notifications');
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) return <NoAccess what="Notifikace" />;
    throw e;
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Notifikace"
        description="Které e-maily firma posílá a s jakým textem. Systémové e-maily (pozvánka, ověření, obnovení hesla) nejdou vypnout."
        icon={<Mail size={18} />}
      />
      <NotificationsManager initial={data} />
    </div>
  );
}
