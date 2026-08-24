import { apiFetch } from '../../lib/server-api';
import type { Tenant } from '../../lib/types';
import { Section, Badge, Mono } from '../ui';
import { ActionForm } from '../action-form';
import { updateTenant, updateRentalPayment } from '../actions';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const tenant = await apiFetch<Tenant>('/tenant');
  const maxMedia = Number(tenant.settings?.maxMediaPerEvent) || 5;
  const requireReturnPhoto = tenant.settings?.requireReturnPhoto === true;
  const rentalPayment = (tenant.settings?.rentalPayment ?? {}) as {
    iban?: string;
    accountName?: string;
  };

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
            {
              name: 'requireReturnPhoto',
              label: 'Vyžadovat foto při vrácení',
              options: [
                { value: 'false', label: 'Ne' },
                { value: 'true', label: 'Ano' },
              ],
              defaultValue: requireReturnPhoto ? 'true' : 'false',
            },
          ]}
        />
      </Section>

      <Section title="Bankovní údaje pro půjčovnu">
        <p className="mb-3 text-sm text-neutral-500">
          Účet, na který nájemci platí (QR/převod). Bez IBAN nelze vygenerovat platbu objednávky.
        </p>
        <ActionForm
          action={updateRentalPayment}
          submitLabel="Uložit bankovní údaje"
          fields={[
            {
              name: 'iban',
              label: 'IBAN',
              placeholder: 'CZ65 0800 0000 1920 0014 5399',
              defaultValue: rentalPayment.iban ?? '',
            },
            {
              name: 'accountName',
              label: 'Název účtu (příjemce)',
              placeholder: 'Firma s.r.o.',
              defaultValue: rentalPayment.accountName ?? '',
            },
          ]}
        />
      </Section>
    </div>
  );
}
