import Link from 'next/link';
import { Package, AlertTriangle } from 'lucide-react';
import { apiFetch } from '../../lib/server-api';
import type { Asset, Person, Location, Category } from '../../lib/types';
import Image from 'next/image';
import { PageHeader, Section, Table, StatusBadge, EmptyState } from '../ui';
import { AssetForm } from './asset-form';
import { CsvTools } from './csv-tools';

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
  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));

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

  const locationOptions = locations.map((l) => ({ value: l.id, label: l.name }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Položky"
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

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Section title="Nová položka">
          <AssetForm categories={categoryOptions} locations={locationOptions} />
        </Section>
        <Section title="Import / export CSV" description="Hromadné nahrání a stažení položek">
          <CsvTools />
        </Section>
      </div>

      <Section title={`Položky (${assets.length})`}>
        {assets.length === 0 ? (
          <EmptyState>Zatím žádné položky.</EmptyState>
        ) : (
          <Table
            head={['', 'Název', 'Stav', 'Kde je / kdo má', 'Vrátit do']}
            rows={assets.map((a) => [
              a.photoKey ? (
                <Image
                  key="p"
                  src={`/api/asset-photo/${a.id}`}
                  alt={a.name}
                  width={36}
                  height={36}
                  unoptimized
                  className="h-9 w-9 rounded-lg border border-slate-200 object-cover"
                />
              ) : (
                <span key="p" className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-[10px] text-slate-400">
                  —
                </span>
              ),
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
