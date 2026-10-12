import { apiFetch } from '../../lib/server-api';
import type { PlatformSettings } from '../../lib/platform';
import { PlatformShell, requirePlatformAdmin } from '../platform-shell';
import { SettingsForm } from './settings-form';

export const dynamic = 'force-dynamic';

export default async function PlatformSettingsPage() {
  await requirePlatformAdmin('/platform/settings');
  const settings = await apiFetch<PlatformSettings>('/platform/settings');
  return (
    <PlatformShell active="/platform/settings">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Nastavení platformy</h1>
        <p className="text-sm text-slate-500">
          Dodavatel na fakturách za předplatné, DPH a pravidla zkušební doby a splatnosti.
        </p>
      </div>
      <SettingsForm settings={settings} />
    </PlatformShell>
  );
}
