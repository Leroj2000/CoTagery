import { KeyRound } from 'lucide-react';
import { apiFetch, getMyPermissions } from '../../lib/server-api';
import { PageHeader } from '../ui';
import { KlicenkaClient, type WalletView } from './klicenka-client';

export const dynamic = 'force-dynamic';

/**
 * Klíčenka – osobní slevové/přístupové kódy uživatele + celofiremní sdílené
 * (spravuje admin) + agregace nároků z členství. QR / čárový kód / NFC.
 */
export default async function KlicenkaPage() {
  const [view, perms] = await Promise.all([
    apiFetch<WalletView>('/wallet').catch(
      () => ({ personal: [], shared: [], aggregated: [] }) as WalletView,
    ),
    getMyPermissions(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Klíčenka"
        description="Slevové a přístupové kódy po ruce – QR, čárové kódy a NFC."
        icon={<KeyRound size={18} />}
      />
      <KlicenkaClient initial={view} canManageShared={perms.has('core.organization.configure')} />
    </div>
  );
}
