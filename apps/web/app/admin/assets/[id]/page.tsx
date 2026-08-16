import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Package, Home, MapPin, User, CalendarClock, Box } from 'lucide-react';
import { apiFetch, ApiError } from '../../../lib/server-api';
import type { Asset, Movement, Person, Location, DataCarrier } from '../../../lib/types';
import { Section, StatusBadge, Badge, Mono, PageHeader, Table, EmptyState } from '../../ui';
import { ActionForm } from '../../action-form';
import { ActionButton } from '../../action-button';
import { MovementForm } from '../movement-form';
import { addCarrierToObject, putIntoContainer, removeFromContainer } from '../../actions';

export const dynamic = 'force-dynamic';

const MOVEMENT_LABELS: Record<string, string> = {
  loan: 'Půjčeno',
  assign: 'Přiděleno',
  move: 'Přesunuto',
  return: 'Vráceno',
  handover: 'Předáno dál',
  service_out: 'Do servisu',
  service_return: 'Ze servisu',
  dispose: 'Vyřazeno',
};

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('cs-CZ');
}
function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('cs-CZ') : '—';
}

export default async function AssetDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let asset: Asset;
  try {
    asset = await apiFetch<Asset>(`/assets/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const [movements, people, locations, carriers, allAssets, contents] = await Promise.all([
    apiFetch<Movement[]>(`/assets/${id}/movements`),
    apiFetch<Person[]>('/people'),
    apiFetch<Location[]>('/locations'),
    apiFetch<DataCarrier[]>(`/objects/${asset.digitalObjectId}/carriers`).catch(() => []),
    apiFetch<Asset[]>('/assets'),
    asset.canContainAssets ? apiFetch<Asset[]>(`/assets/${id}/contents`) : Promise.resolve([]),
  ]);

  const personName = new Map(people.map((p) => [p.id, p.name]));
  const locName = new Map(locations.map((l) => [l.id, l.name]));
  const assetName = new Map(allAssets.map((a) => [a.id, a.name]));
  // Kandidáti na vložení: nekontejnerové/volné věci mimo tuto věc a její obsah.
  const contentIds = new Set(contents.map((c) => c.id));
  const nestableOptions = allAssets
    .filter((a) => a.id !== asset.id && !a.parentAssetId && !contentIds.has(a.id))
    .map((a) => ({ value: a.id, label: a.name }));
  const label = (type: string | null, id: string | null): string => {
    if (!id) return '—';
    if (type === 'person') return personName.get(id) ?? '👤';
    if (type === 'location') return locName.get(id) ?? '📍';
    return '📦';
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/assets" className="text-xs text-slate-500 hover:underline">
          ← Věci
        </Link>
        <div className="mt-1">
          <PageHeader
            title={asset.name}
            description={[asset.manufacturer, asset.model, asset.serialNumber].filter(Boolean).join(' · ') || undefined}
            icon={<Package size={18} />}
            action={<StatusBadge status={asset.status} />}
          />
        </div>
      </div>

      {/* Stav: patří do ≠ kde je ≠ kdo má */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StateTile icon={<Home size={16} />} label="Patří do" value={locName.get(asset.homeLocationId ?? '') ?? '—'} />
        <StateTile
          icon={asset.currentHolderType === 'person' ? <User size={16} /> : <MapPin size={16} />}
          label={asset.currentHolderType === 'person' ? 'Má ji' : 'Kde je'}
          value={label(asset.currentHolderType, asset.currentHolderId)}
        />
        <StateTile icon={<CalendarClock size={16} />} label="Vrátit do" value={fmtDate(asset.dueAt)} />
      </div>

      <Section title="Akce" description="Kontextové akce podle aktuálního stavu věci">
        <MovementForm
          assetId={asset.id}
          actions={asset.actions ?? []}
          people={people.map((p) => ({ id: p.id, label: p.name }))}
          locations={locations.map((l) => ({ id: l.id, label: l.name }))}
        />
      </Section>

      <Section title="Nosič (QR)" description="Štítek na věci – stabilní identifikátor">
        {carriers.length === 0 ? (
          <div className="flex flex-col gap-3">
            <EmptyState>Věc zatím nemá nosič.</EmptyState>
            <ActionForm
              action={addCarrierToObject}
              hidden={{ objectId: asset.digitalObjectId }}
              submitLabel="Přidat QR nosič"
              fields={[
                {
                  name: 'carrierType',
                  label: 'Typ',
                  options: [
                    { value: 'qr', label: 'QR' },
                    { value: 'nfc', label: 'NFC' },
                  ],
                },
              ]}
            />
          </div>
        ) : (
          <div className="flex flex-wrap gap-4">
            {carriers.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                <Image
                  src={`/api/qr/${c.id}`}
                  alt={c.publicCode}
                  width={72}
                  height={72}
                  unoptimized
                  className="rounded border border-slate-200 bg-white"
                />
                <div>
                  <Mono>{c.publicCode}</Mono>
                  <p className="text-xs text-slate-400">{c.carrierType}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {asset.parentAssetId && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <Box size={15} className="text-slate-400" />
          Uloženo v: <span className="font-medium text-slate-800">{assetName.get(asset.parentAssetId) ?? '—'}</span>
          <span className="ml-auto">
            <ActionButton
              action={removeFromContainer}
              hidden={{ containerId: asset.parentAssetId, childId: asset.id }}
              label="Vyjmout"
            />
          </span>
        </div>
      )}

      {asset.canContainAssets && (
        <Section title="Obsah kontejneru" description="Věci uložené v této věci (dodávka, kufr…)">
          <div className="flex flex-col gap-4">
            {contents.length === 0 ? (
              <EmptyState>Kontejner je prázdný.</EmptyState>
            ) : (
              <Table
                head={['Věc', 'Stav', 'Akce']}
                rows={contents.map((c) => [
                  <Link key="n" href={`/admin/assets/${c.id}`} className="font-medium text-brand-700 hover:underline">
                    {c.name}
                  </Link>,
                  <StatusBadge key="s" status={c.status} />,
                  <ActionButton
                    key="r"
                    action={removeFromContainer}
                    hidden={{ containerId: asset.id, childId: c.id }}
                    label="Vyjmout"
                  />,
                ])}
              />
            )}
            {nestableOptions.length > 0 && (
              <ActionForm
                action={putIntoContainer}
                hidden={{ containerId: asset.id }}
                submitLabel="Vložit věc"
                fields={[{ name: 'childAssetId', label: 'Přidat věc do kontejneru', required: true, options: nestableOptions }]}
              />
            )}
          </div>
        </Section>
      )}

      <Section title={`Historie pohybů (${movements.length})`} description="Nedotknutelný ledger – oprava = nový pohyb">
        <Table
          head={['Kdy', 'Akce', 'Z', 'Do', 'Poznámka']}
          rows={movements.map((m) => [
            fmtDateTime(m.createdAt),
            <Badge key="t" tone="brand">{MOVEMENT_LABELS[m.type] ?? m.type}</Badge>,
            label(m.fromType, m.fromId),
            label(m.toType, m.toId),
            m.note ?? '—',
          ])}
        />
      </Section>
    </div>
  );
}

function StateTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
        <span className="text-slate-400">{icon}</span>
        {label}
      </div>
      <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}
