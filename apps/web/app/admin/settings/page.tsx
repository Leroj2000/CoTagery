import { NoAccess } from '../no-access';
import { apiFetch, getMyPermissions } from '../../lib/server-api';
import type { Tenant } from '../../lib/types';
import { Section, Badge, Mono } from '../ui';
import { ActionForm } from '../action-form';
import { updateTenant, updateRentalPayment, updateVatSettings, setModuleState } from '../actions';
import { ActionButton } from '../action-button';
import { TenantLogoForm } from './tenant-logo-form';
import { SubscriptionSection } from './subscription-section';
import type { TenantSubscriptionView } from '../../lib/platform';
import { ExportSettingsForm } from './export-settings-form';
import { PLAN_FEATURES, PLAN_MODULES, resolveExportSettings } from '@tagery/shared';

export const dynamic = 'force-dynamic';

interface ModuleState {
  moduleKey: string;
  state: 'active' | 'inactive';
  kind?: 'module' | 'feature';
  ownerState?: 'active' | 'inactive';
  allowed?: boolean;
  lock?: 'not_in_plan' | 'disabled_by_platform' | null;
}

const ENTITLEMENT_INFO = new Map<string, { label: string; description: string }>(
  [...PLAN_FEATURES, ...PLAN_MODULES].map((m) => [m.key, m]),
);

const LOCK_LABELS = {
  not_in_plan: 'Není ve vašem předplatném',
  disabled_by_platform: 'Vypnuto správcem Tagery',
} as const;

export default async function SettingsPage() {
  if (!(await getMyPermissions()).has('core.organization.view'))
    return <NoAccess what="Nastavení firmy" />;
  const [tenant, modules, permissions] = await Promise.all([
    apiFetch<Tenant & { hasLogo?: boolean }>('/tenant'),
    apiFetch<ModuleState[]>('/modules').catch(() => [] as ModuleState[]),
    getMyPermissions(),
  ]);
  const subscription = permissions.has('core.organization.view')
    ? await apiFetch<TenantSubscriptionView>('/subscription').catch(() => null)
    : null;
  const branding = modules.find((m) => m.moduleKey === 'branding');
  const maxMedia = Number(tenant.settings?.maxMediaPerEvent) || 5;
  const requireReturnPhoto = tenant.settings?.requireReturnPhoto === true;
  const rentalPayment = (tenant.settings?.rentalPayment ?? {}) as {
    iban?: string;
    accountName?: string;
  };
  const networkListed = tenant.networkListed === true;
  const vatPayer = tenant.settings?.vatPayer === true;
  const defaultVatRate = Number(tenant.settings?.defaultVatRate ?? 21);
  const canConfigureModules = permissions.has('core.module.configure');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Nastavení tenanta</h1>
        <p className="text-sm text-neutral-500">
          <Badge>{tenant.type}</Badge> · <Mono>{tenant.id.slice(0, 8)}…</Mono>
        </p>
      </div>

      {subscription && (
        <SubscriptionSection
          view={subscription}
          canSeeInvoices={permissions.has('core.organization.configure')}
        />
      )}

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
        title="DPH"
        description="Plátce zadává ceny pořízení bez DPH, neplátce s DPH (DPH je pro něj náklad). U každého pořízení se uloží, jak to bylo v době zadání."
      >
        <ActionForm
          action={updateVatSettings}
          submitLabel="Uložit DPH"
          fields={[
            {
              name: 'vatPayer',
              label: 'Firma je plátce DPH',
              options: [
                { value: 'false', label: 'Ne – neplátce' },
                { value: 'true', label: 'Ano – plátce' },
              ],
              defaultValue: vatPayer ? 'true' : 'false',
            },
            {
              name: 'defaultVatRate',
              label: 'Výchozí sazba DPH (%)',
              type: 'number',
              defaultValue: String(Number.isFinite(defaultVatRate) ? defaultVatRate : 21),
            },
          ]}
        />
      </Section>

      <div id="exporty" className="scroll-mt-20">
        <Section
          title="Exporty"
          description="Co obsahují soubory Excelu stažené ze seznamu inventur. Pořadí sloupců je pevné, vypnuté sloupce se do souboru nedostanou."
        >
          <ExportSettingsForm
            settings={resolveExportSettings(tenant.settings)}
            canEdit={permissions.has('core.organization.configure')}
          />
        </Section>
      </div>

      <Section
        title="Logo firmy"
        description="Vkládá se doprostřed QR kódů na štítcích a v exportech."
      >
        {branding && branding.state !== 'active' ? (
          <p className="text-sm text-slate-500">
            {branding.lock
              ? `Logo v QR kódech: ${LOCK_LABELS[branding.lock].toLowerCase()}.`
              : 'Funkce „Logo firmy" je vypnutá v části Funkce níže.'}
          </p>
        ) : (
          <TenantLogoForm
            hasLogo={tenant.hasLogo === true}
            canEdit={permissions.has('core.organization.configure')}
          />
        )}
      </Section>

      {(['feature', 'module'] as const).map((kind) => {
        const items = modules.filter((m) => (m.kind ?? 'module') === kind);
        if (!items.length) return null;
        return (
          <Section
            key={kind}
            title={kind === 'feature' ? 'Funkce' : 'Rozšíření'}
            description={
              kind === 'feature'
                ? 'Části Tagery Věcí podle předplatného. Povolené můžete vypnout, pokud je firma nepoužívá.'
                : 'Další produktové moduly. Zapínejte jen ty, které firma používá.'
            }
          >
            <div className="divide-y divide-slate-100">
              {items.map((module) => {
                const info = ENTITLEMENT_INFO.get(module.moduleKey);
                const on = (module.ownerState ?? module.state) === 'active';
                const locked = module.allowed === false;
                return (
                  <div
                    key={module.moduleKey}
                    className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800">
                        {info?.label ?? module.moduleKey}
                      </p>
                      <p className="text-xs text-slate-500">
                        {info?.description}
                        {info?.description ? ' · ' : ''}
                        {locked ? 'Nedostupné' : on ? 'Zapnuto' : 'Vypnuto'}
                      </p>
                    </div>
                    {locked ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        <Lock size={12} /> {LOCK_LABELS[module.lock ?? 'not_in_plan']}
                      </span>
                    ) : (
                      canConfigureModules && (
                        <ActionButton
                          action={setModuleState}
                          hidden={{
                            moduleKey: module.moduleKey,
                            state: on ? 'inactive' : 'active',
                          }}
                          label={on ? 'Vypnout' : 'Zapnout'}
                          variant={on ? 'danger' : 'default'}
                        />
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </Section>
        );
      })}

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
import { Lock, Printer } from 'lucide-react';
