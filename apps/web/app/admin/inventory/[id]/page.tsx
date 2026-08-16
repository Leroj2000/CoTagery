import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Check, X, HelpCircle, ClipboardCheck } from 'lucide-react';
import { apiFetch, ApiError } from '../../../lib/server-api';
import type { InventoryDetail, Location, Asset } from '../../../lib/types';
import { PageHeader, Section, Badge, StatusBadge, Table, EmptyState } from '../../ui';
import { ActionForm } from '../../action-form';
import { ActionButton } from '../../action-button';
import { scanInventory, closeInventory } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function InventoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let detail: InventoryDetail;
  try {
    detail = await apiFetch<InventoryDetail>(`/inventory/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const [locations, assets] = await Promise.all([
    apiFetch<Location[]>('/locations'),
    apiFetch<Asset[]>('/assets'),
  ]);
  const locName = new Map(locations.map((l) => [l.id, l.name]));
  const { check } = detail;
  const open = check.status === 'open';
  const expected = check.expectedAssetIds.length;

  // Ve výběru pro sken jen assety, které ještě nebyly naskenované.
  const scannedIds = new Set([...detail.found, ...detail.unexpected].map((a) => a.id));
  const scanOptions = assets
    .filter((a) => !scannedIds.has(a.id))
    .map((a) => ({ value: a.id, label: a.name }));

  const assetRows = (list: Asset[]): (string | React.ReactNode)[][] =>
    list.map((a) => [a.name, <StatusBadge key="s" status={a.status} />, a.manufacturer ?? '—']);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/inventory" className="text-xs text-slate-500 hover:underline">
          ← Inventura
        </Link>
        <div className="mt-1">
          <PageHeader
            title={`Inventura — ${locName.get(check.locationId) ?? 'místo'}`}
            description={`Očekáváno: ${expected} · naskenováno: ${detail.scannedCount}`}
            icon={<ClipboardCheck size={18} />}
            action={open ? <Badge tone="amber">probíhá</Badge> : <StatusBadge status="paid" />}
          />
        </div>
      </div>

      {/* Souhrn */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Summary icon={<Check size={18} />} tone="green" label="Nalezeno" value={detail.found.length} />
        <Summary icon={<X size={18} />} tone="red" label="Chybí" value={detail.missing.length} />
        <Summary icon={<HelpCircle size={18} />} tone="amber" label="Navíc" value={detail.unexpected.length} />
      </div>

      {open && (
        <Section title="Naskenovat věc" description="Vyber věc (na mobilu = sken QR)">
          {scanOptions.length === 0 ? (
            <EmptyState>Všechny věci jsou naskenované.</EmptyState>
          ) : (
            <div className="flex flex-col gap-4">
              <ActionForm
                action={scanInventory}
                hidden={{ checkId: check.id }}
                submitLabel="Naskenovat"
                fields={[{ name: 'assetId', label: 'Věc', required: true, options: scanOptions }]}
              />
              <ActionButton
                action={closeInventory}
                hidden={{ checkId: check.id }}
                label="Uzavřít inventuru"
                confirm="Uzavřít inventuru a spočítat výsledek?"
              />
            </div>
          )}
        </Section>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Section title={`Nalezeno (${detail.found.length})`}>
          {detail.found.length === 0 ? <EmptyState>—</EmptyState> : <Table head={['Věc', 'Stav', 'Výrobce']} rows={assetRows(detail.found)} />}
        </Section>
        <Section title={`Chybí (${detail.missing.length})`}>
          {detail.missing.length === 0 ? <EmptyState>—</EmptyState> : <Table head={['Věc', 'Stav', 'Výrobce']} rows={assetRows(detail.missing)} />}
        </Section>
        <Section title={`Navíc (${detail.unexpected.length})`}>
          {detail.unexpected.length === 0 ? <EmptyState>—</EmptyState> : <Table head={['Věc', 'Stav', 'Výrobce']} rows={assetRows(detail.unexpected)} />}
        </Section>
      </div>
    </div>
  );
}

function Summary({
  icon,
  tone,
  label,
  value,
}: {
  icon: React.ReactNode;
  tone: 'green' | 'red' | 'amber';
  label: string;
  value: number;
}) {
  const cls = {
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    red: 'bg-red-50 text-red-700 ring-red-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  }[tone];
  return (
    <div className={`flex items-center gap-3 rounded-2xl p-4 ring-1 ring-inset ${cls}`}>
      <span>{icon}</span>
      <div>
        <p className="text-2xl font-semibold">{value}</p>
        <p className="text-xs">{label}</p>
      </div>
    </div>
  );
}
