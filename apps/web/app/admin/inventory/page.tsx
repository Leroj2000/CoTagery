import Link from 'next/link';
import { ClipboardCheck } from 'lucide-react';
import { apiFetch } from '../../lib/server-api';
import type { InventoryCheck, Location, Person, Asset } from '../../lib/types';
import { PageHeader, Section, Table, Badge, EmptyState } from '../ui';
import { ActionForm } from '../action-form';
import { startInventorySubject } from '../actions';

export const dynamic = 'force-dynamic';

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('cs-CZ');
}

export default async function InventoryPage() {
  const [checks, locations, people, assets] = await Promise.all([
    apiFetch<InventoryCheck[]>('/inventory'),
    apiFetch<Location[]>('/locations'),
    apiFetch<Person[]>('/people'),
    apiFetch<Asset[]>('/assets'),
  ]);
  const locName = new Map(locations.map((l) => [l.id, l.name]));
  const perName = new Map(people.map((p) => [p.id, p.name]));
  const assetName = new Map(assets.map((a) => [a.id, a.name]));
  const subjectName = (c: InventoryCheck): string => {
    const id = c.subjectId ?? c.locationId;
    if (!id) return '—';
    if (c.subjectType === 'person') return perName.get(id) ?? '—';
    if (c.subjectType === 'asset') return assetName.get(id) ?? '—';
    return locName.get(id) ?? '—';
  };

  // Subjekt inventury: místo / osoba / kontejner (zakódováno "type:id").
  const subjectOptions = [
    ...locations.map((l) => ({ value: `location:${l.id}`, label: `📍 ${l.name}` })),
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

      <Section title="Spustit inventuru" description="Nad místem, osobou nebo kontejnerem">
        {subjectOptions.length === 0 ? (
          <EmptyState>Nejdřív vytvoř místo, osobu nebo kontejner.</EmptyState>
        ) : (
          <ActionForm
            action={startInventorySubject}
            submitLabel="Spustit"
            fields={[{ name: 'subject', label: 'Co inventarizuješ?', required: true, options: subjectOptions }]}
          />
        )}
      </Section>

      <Section title={`Inventury (${checks.length})`}>
        {checks.length === 0 ? (
          <EmptyState>Zatím žádné inventury.</EmptyState>
        ) : (
          <Table
            head={['Kdy', 'Subjekt', 'Stav', 'Nalezeno', 'Chybí', 'Navíc']}
            rows={checks.map((c) => [
              <Link key="d" href={`/admin/inventory/${c.id}`} className="text-brand-700 hover:underline">
                {fmtDateTime(c.createdAt)}
              </Link>,
              subjectName(c),
              c.status === 'open' ? <Badge tone="amber">probíhá</Badge> : <Badge tone="green">uzavřeno</Badge>,
              c.status === 'closed' ? c.foundCount : '—',
              c.status === 'closed' ? (c.missingCount > 0 ? <Badge tone="red">{c.missingCount}</Badge> : 0) : '—',
              c.status === 'closed' ? (c.unexpectedCount > 0 ? <Badge tone="amber">{c.unexpectedCount}</Badge> : 0) : '—',
            ])}
          />
        )}
      </Section>
    </div>
  );
}
