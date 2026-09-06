import { apiFetch, getMyPermissions } from '../../lib/server-api';
import type { Tenant } from '../../lib/types';
import { Section, Badge, Mono } from '../ui';
import { ActionForm } from '../action-form';
import { updateTenant, updateRentalPayment, setModuleState } from '../actions';
import { ActionButton } from '../action-button';

export const dynamic = 'force-dynamic';

interface ModuleState {
  moduleKey: string;
  state: 'active' | 'inactive';
}

const MODULE_LABELS: Record<string, string> = {
  access: 'Řízení přístupu',
  billing: 'Předplatné a billing',
  gallery: 'Sdílené galerie',
  membership: 'Členství',
  product: 'Produktové karty',
  rental: 'Půjčovna',
  ticketing: 'Vstupenky',
};

export default async function SettingsPage() {
  const [tenant, modules, permissions] = await Promise.all([
    apiFetch<Tenant>('/tenant'),
    apiFetch<ModuleState[]>('/modules').catch(() => [] as ModuleState[]),
    getMyPermissions(),
  ]);
  const maxMedia = Number(tenant.settings?.maxMediaPerEvent) || 5;
  const requireReturnPhoto = tenant.settings?.requireReturnPhoto === true;
  const rentalPayment = (tenant.settings?.rentalPayment ?? {}) as {
    iban?: string;
    accountName?: string;
  };
  const networkListed = tenant.networkListed === true;
  const canConfigureModules = permissions.has('core.module.configure');

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
            {
              name: 'networkListed',
              label: 'Zobrazovat firmu v síti (discovery půjčovny)',
              options: [
                { value: 'false', label: 'Ne' },
                { value: 'true', label: 'Ano' },
              ],
              defaultValue: networkListed ? 'true' : 'false',
            },
          ]}
        />
      </Section>

      <Section
        title="Rozšíření"
        description="Tagery Věci jsou vždy aktivní. Další produktové moduly zapínejte jen tehdy, když je firma používá."
      >
        <div className="divide-y divide-slate-100">
          {modules.map((module) => {
            const active = module.state === 'active';
            return (
              <div
                key={module.moduleKey}
                className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {MODULE_LABELS[module.moduleKey] ?? module.moduleKey}
                  </p>
                  <p className="text-xs text-slate-500">{active ? 'Aktivní' : 'Vypnuto'}</p>
                </div>
                {canConfigureModules && (
                  <ActionButton
                    action={setModuleState}
                    hidden={{ moduleKey: module.moduleKey, state: active ? 'inactive' : 'active' }}
                    label={active ? 'Vypnout' : 'Zapnout'}
                    variant={active ? 'danger' : 'default'}
                  />
                )}
              </div>
            );
          })}
        </div>
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

      <Section
        title="Diagnostika tisku"
        description="Kontrola přímého Bluetooth tisku na NIIMBOT B1."
      >
        <Link
          href="/admin/printer-test"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Printer size={16} /> Otevřít test tiskárny
        </Link>
      </Section>
    </div>
  );
}
import Link from 'next/link';
import { Printer } from 'lucide-react';
