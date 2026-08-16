import Link from 'next/link';
import { ClipboardCheck } from 'lucide-react';
import { apiFetch } from '../../lib/server-api';
import type { InventoryCheck, Location } from '../../lib/types';
import { PageHeader, Section, Table, Badge, EmptyState } from '../ui';
import { ActionForm } from '../action-form';
import { startInventory } from '../actions';

export const dynamic = 'force-dynamic';

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('cs-CZ');
}

export default async function InventoryPage() {
  const [checks, locations] = await Promise.all([
    apiFetch<InventoryCheck[]>('/inventory'),
    apiFetch<Location[]>('/locations'),
  ]);
  const locName = new Map(locations.map((l) => [l.id, l.name]));
  const locationOptions = locations.map((l) => ({ value: l.id, label: l.name }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Inventura"
        description="Porovnání evidence s realitou – nalezeno / chybí / navíc."
        icon={<ClipboardCheck size={18} />}
      />

      <Section title="Spustit inventuru">
        {locations.length === 0 ? (
          <EmptyState>Nejdřív vytvoř místo (Místa).</EmptyState>
        ) : (
          <ActionForm
            action={startInventory}
            submitLabel="Spustit"
            fields={[{ name: 'locationId', label: 'Místo', required: true, options: locationOptions }]}
          />
        )}
      </Section>

      <Section title={`Inventury (${checks.length})`}>
        {checks.length === 0 ? (
          <EmptyState>Zatím žádné inventury.</EmptyState>
        ) : (
          <Table
            head={['Kdy', 'Místo', 'Stav', 'Nalezeno', 'Chybí', 'Navíc']}
            rows={checks.map((c) => [
              <Link key="d" href={`/admin/inventory/${c.id}`} className="text-brand-700 hover:underline">
                {fmtDateTime(c.createdAt)}
              </Link>,
              locName.get(c.locationId) ?? '—',
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
