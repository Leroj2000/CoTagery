import { apiFetch } from '../../lib/server-api';
import type { Tenant } from '../../lib/types';
import { Section, Badge, Mono } from '../ui';
import { ActionForm } from '../action-form';
import { updateTenant } from '../actions';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const tenant = await apiFetch<Tenant>('/tenant');
  const maxMedia = Number(tenant.settings?.maxMediaPerEvent) || 5;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Nastavení tenanta</h1>
        <p className="text-sm text-neutral-500">
          <Badge>{tenant.type}</Badge> · <Mono>{tenant.id.slice(0, 8)}…</Mono>
        </p>
      </div>

      <Section title="Základní údaje">
        <ActionForm
          action={updateTenant}
          submitLabel="Uložit"
          fields={[
            { name: 'name', label: 'Název', required: true, defaultValue: tenant.name },
            {
              name: 'brandingDomain',
              label: 'Doména (branding)',
              placeholder: 'napr. tagy.firma.cz',
              defaultValue: tenant.brandingDomain ?? '',
            },
            {
              name: 'maxMediaPerEvent',
              label: 'Max. fotek na událost',
              type: 'number',
              defaultValue: String(maxMedia),
            },
          ]}
        />
      </Section>
    </div>
  );
}
