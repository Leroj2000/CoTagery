import Link from 'next/link';
import { Package, AlertTriangle } from 'lucide-react';
import { apiFetch } from '../../lib/server-api';
import type { Asset, Person, Location, Category } from '../../lib/types';
import { PageHeader, Section, Table, StatusBadge, EmptyState } from '../ui';
import { ActionForm } from '../action-form';
import { createAsset } from '../actions';

export const dynamic = 'force-dynamic';

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('cs-CZ') : '—';
}

export default async function AssetsPage() {
  const [assets, people, locations, categories] = await Promise.all([
    apiFetch<Asset[]>('/assets'),
    apiFetch<Person[]>('/people'),
    apiFetch<Location[]>('/locations'),
    apiFetch<Category[]>('/categories'),
  ]);
  const categoryOptions = [
    { value: '', label: '— bez kategorie —' },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  const personName = new Map(people.map((p) => [p.id, p.name]));
  const locName = new Map(locations.map((l) => [l.id, l.name]));
  const holder = (a: Asset): string => {
    if (!a.currentHolderId) return '—';
    if (a.currentHolderType === 'person') return personName.get(a.currentHolderId) ?? '👤';
    if (a.currentHolderType === 'location') return locName.get(a.currentHolderId) ?? '📍';
    return '📦';
  };

  const now = Date.now();
  const overdue = assets.filter((a) => a.dueAt && new Date(a.dueAt).getTime() < now && a.status === 'loaned');

  const locationOptions = [
    { value: '', label: '— žádné —' },
    ...locations.map((l) => ({ value: l.id, label: l.name })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Věci"
        description="Assety s digitální identitou – stav, kde jsou a kdo je má."
        icon={<Package size={18} />}
      />

      {overdue.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800">
            <AlertTriangle size={16} /> Vyžaduje pozornost — po termínu ({overdue.length})
          </div>
          <ul className="flex flex-col gap-1 text-sm text-amber-800">
            {overdue.map((a) => (
              <li key={a.id} className="flex items-center justify-between">
                <Link href={`/admin/assets/${a.id}`} className="font-medium hover:underline">
                  {a.name}
                </Link>
                <span className="text-xs">
                  má {holder(a)} · vrátit do {fmtDate(a.dueAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Section title="Nová věc">
        <ActionForm
          action={createAsset}
          submitLabel="Vytvořit věc"
          fields={[
            { name: 'name', label: 'Název', required: true, placeholder: 'Aku vrtačka Makita' },
            { name: 'categoryId', label: 'Kategorie', options: categoryOptions },
            { name: 'manufacturer', label: 'Výrobce', placeholder: 'Makita' },
            { name: 'serialNumber', label: 'Sériové číslo' },
            { name: 'homeLocationId', label: 'Patří do (home)', options: locationOptions },
            {
              name: 'canContainAssets',
              label: 'Kontejner (může obsahovat věci)',
              options: [
                { value: 'false', label: 'Ne' },
                { value: 'true', label: 'Ano (dodávka, kufr…)' },
              ],
            },
          ]}
        />
      </Section>

      <Section title={`Věci (${assets.length})`}>
        {assets.length === 0 ? (
          <EmptyState>Zatím žádné věci.</EmptyState>
        ) : (
          <Table
            head={['Název', 'Stav', 'Kde je / kdo má', 'Vrátit do']}
            rows={assets.map((a) => [
              <Link key="n" href={`/admin/assets/${a.id}`} className="font-medium text-brand-700 hover:underline">
                {a.name}
              </Link>,
              <StatusBadge key="s" status={a.status} />,
              holder(a),
              a.dueAt ? fmtDate(a.dueAt) : '—',
            ])}
          />
        )}
      </Section>
    </div>
  );
}
