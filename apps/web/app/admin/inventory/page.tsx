import { NoAccess } from '../no-access';
import Link from 'next/link';
import { Car, ClipboardCheck, FileSpreadsheet } from 'lucide-react';
import { apiFetch, getMyPermissions } from '../../lib/server-api';
import { locationPath } from '../../lib/location-path';
import type { InventoryCheck, Location, Person, Asset, Category } from '../../lib/types';
import { PageHeader, Section, Table, Badge, EmptyState } from '../ui';
import { ActionForm } from '../action-form';
import { startInventorySubject, startVehicleInventory } from '../actions';
import { getActiveModules, requireActiveModule } from '../module-access';

export const dynamic = 'force-dynamic';

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('cs-CZ');
}

/** `YYYY-MM-DD` → `1. 3. 2026`. */
function fmtDay(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d}. ${m}. ${y}`;
}

function pragueToday(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague' }).format(new Date());
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string }>;
}) {
  if (!(await getMyPermissions()).has('asset.inventory.manage'))
    return <NoAccess what="Inventury" />;
  const { location } = await searchParams;
  await requireActiveModule('inventory');
  const active = await getActiveModules();
  const canVehicles = active.has('vehicles');
  const canExport = active.has('import_export');
  const [checks, locations, people, assets, categories] = await Promise.all([
    apiFetch<InventoryCheck[]>('/inventory'),
    apiFetch<Location[]>('/locations'),
    apiFetch<Person[]>('/people'),
    apiFetch<Asset[]>('/assets'),
    apiFetch<Category[]>('/categories'),
  ]);
  const vehicleCategories = new Set(
    categories.filter((c) => c.equipmentKind === 'vehicle').map((c) => c.id),
  );
  const vehicles = assets
    .filter((a) => a.categoryId && vehicleCategories.has(a.categoryId) && a.status !== 'retired')
    .sort((a, b) => a.name.localeCompare(b.name, 'cs'));
  const today = pragueToday();
  const locName = new Map(locations.map((l) => [l.id, locationPath(l.id, locations)]));
  const perName = new Map(people.map((p) => [p.id, p.name]));
  const assetName = new Map(assets.map((a) => [a.id, a.name]));
  const subjectName = (c: InventoryCheck): string => {
    if (c.kind === 'vehicle') {
      const which = c.subjectId ? (assetName.get(c.subjectId) ?? 'vozidlo') : 'Všechna vozidla';
      return `${which} · ${fmtDay(c.periodFrom)} – ${fmtDay(c.periodTo)}`;
    }
    const id = c.subjectId ?? c.locationId;
    if (!id) return '—';
    if (c.subjectType === 'person') return perName.get(id) ?? '—';
    if (c.subjectType === 'asset') return assetName.get(id) ?? '—';
    return locName.get(id) ?? '—';
  };

  // Subjekt inventury: místo / osoba / kontejner (zakódováno "type:id").
  const subjectOptions = [
    ...locations
      .filter((l) => l.type !== 'access_point')
      .map((l) => ({ value: `location:${l.id}`, label: `📍 ${locName.get(l.id)}` })),
    ...people.map((p) => ({ value: `person:${p.id}`, label: `👤 ${p.name}` })),
    ...assets
      .filter((a) => a.canContainAssets)
      .map((a) => ({ value: `asset:${a.id}`, label: `📦 ${a.name}` })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Inventura"
        description="Porovnání evidence s realitou – nalezeno / chybí / navíc."
        icon={<ClipboardCheck size={18} />}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title="Inventura skladu"
          description="Naskenuj, co je na místě, u osoby nebo v kontejneru – výsledek nalezeno / chybí / navíc."
        >
          {subjectOptions.length === 0 ? (
            <EmptyState>Nejdřív vytvoř místo, osobu nebo kontejner.</EmptyState>
          ) : (
            <ActionForm
              action={startInventorySubject}
              submitLabel="Spustit"
              fields={[
                {
                  name: 'subject',
                  label: 'Co inventarizuješ?',
                  required: true,
                  options: subjectOptions,
                  defaultValue: locations.some((l) => l.id === location)
                    ? `location:${location}`
                    : undefined,
                },
              ]}
            />
          )}
        </Section>

        {canVehicles && (
          <Section
            title="Inventura vozidel"
            description="Sepsání stavu vozidel k období: tachometr, ujeté km, dny a km do servisu / po servisu."
          >
            {vehicles.length === 0 ? (
              <EmptyState>
                Žádná vozidla. V{' '}
                <Link href="/admin/categories" className="text-brand-700 hover:underline">
                  Kategoriích
                </Link>{' '}
                nastav u kategorie druh „Vozidlo“.
              </EmptyState>
            ) : (
              <ActionForm
                action={startVehicleInventory}
                submitLabel="Založit inventuru vozidel"
                fields={[
                  {
                    name: 'vehicle',
                    label: 'Vozidla',
                    required: true,
                    defaultValue: 'all',
                    options: [
                      { value: 'all', label: `Všechna vozidla (${vehicles.length})` },
                      ...vehicles.map((v) => ({
                        value: v.id,
                        label: [v.name, v.registrationPlate ?? v.inventoryNumber]
                          .filter(Boolean)
                          .join(' · '),
                      })),
                    ],
                  },
                  {
                    name: 'periodFrom',
                    label: 'Období od',
                    type: 'date',
                    required: true,
                    defaultValue: `${today.slice(0, 8)}01`,
                  },
                  {
                    name: 'periodTo',
                    label: 'Období do',
                    type: 'date',
                    required: true,
                    defaultValue: today,
                  },
                ]}
              />
            )}
          </Section>
        )}
      </div>

      <Section
        title={`Inventury (${checks.length})`}
        description={
          canExport
            ? 'Uzavřenou i probíhající inventuru lze stáhnout do Excelu – co soubor obsahuje, nastavíš v Nastavení → Exporty.'
            : undefined
        }
      >
        {checks.length === 0 ? (
          <EmptyState>Zatím žádné inventury.</EmptyState>
        ) : (
          <Table
            head={['Kdy', 'Inventura', 'Stav', 'Výsledek', ...(canExport ? ['Export'] : [])]}
            rows={checks.map((c) => [
              <Link
                key="d"
                href={`/admin/inventory/${c.id}`}
                className="text-brand-700 hover:underline"
              >
                {fmtDateTime(c.createdAt)}
              </Link>,
              <span key="s" className="inline-flex items-center gap-1.5">
                {c.kind === 'vehicle' ? (
                  <Car size={14} className="shrink-0 text-slate-400" aria-label="Vozidla" />
                ) : (
                  <ClipboardCheck
                    size={14}
                    className="shrink-0 text-slate-400"
                    aria-label="Sklad"
                  />
                )}
                {subjectName(c)}
              </span>,
              c.status === 'open' ? (
                <Badge tone="amber">probíhá</Badge>
              ) : (
                <Badge tone="green">uzavřeno</Badge>
              ),
              <ResultCell key="r" check={c} />,
              ...(canExport
                ? [
                    <a
                      key="x"
                      href={`/api/inventory/${c.id}/export`}
                      className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
                    >
                      <FileSpreadsheet size={14} /> Excel
                    </a>,
                  ]
                : []),
            ])}
          />
        )}
      </Section>
    </div>
  );
}

function ResultCell({ check: c }: { check: InventoryCheck }) {
  if (c.status !== 'closed') return <span className="text-slate-400">—</span>;
  if (c.kind === 'vehicle') {
    // Uzavřená inventura vozidel: found = vozidel, missing = po servisu, unexpected = bez tachometru.
    return (
      <span className="flex flex-wrap items-center gap-1.5">
        <span>{c.foundCount} vozidel</span>
        {c.missingCount > 0 && <Badge tone="red">{c.missingCount} po servisu</Badge>}
        {c.unexpectedCount > 0 && <Badge tone="amber">{c.unexpectedCount} bez tachometru</Badge>}
      </span>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span>{c.foundCount} nalezeno</span>
      {c.missingCount > 0 && <Badge tone="red">{c.missingCount} chybí</Badge>}
      {c.unexpectedCount > 0 && <Badge tone="amber">{c.unexpectedCount} navíc</Badge>}
    </span>
  );
}
