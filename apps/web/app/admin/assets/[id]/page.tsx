import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Package, Home, MapPin, User, CalendarClock, Box, Clock } from 'lucide-react';
import { apiFetch, ApiError } from '../../../lib/server-api';
import type { Asset, Movement, Person, Location, DataCarrier, ServiceRecord } from '../../../lib/types';
import { Section, StatusBadge, Badge, Mono, PageHeader, Table, EmptyState } from '../../ui';
import { ActionForm } from '../../action-form';
import { ActionButton } from '../../action-button';
import { MovementForm } from '../movement-form';
import { PhotoUpload } from '../photo-upload';
import {
  addCarrierToObject,
  putIntoContainer,
  removeFromContainer,
  addService,
  confirmMovement,
  reportIssue,
  resolveIssue,
} from '../../actions';
import type { Issue } from '../../../lib/types';

export const dynamic = 'force-dynamic';

const ISSUE_LABELS: Record<string, string> = {
  damage: 'Poškození',
  malfunction: 'Závada',
  missing_part: 'Chybí díl',
  other: 'Jiné',
};

const SERVICE_LABELS: Record<string, string> = {
  service: 'Servis',
  inspection: 'Revize',
  calibration: 'Kalibrace',
  repair: 'Oprava',
};

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
  const [movements, people, locations, carriers, allAssets, contents, services] = await Promise.all([
    apiFetch<Movement[]>(`/assets/${id}/movements`),
    apiFetch<Person[]>('/people'),
    apiFetch<Location[]>('/locations'),
    apiFetch<DataCarrier[]>(`/objects/${asset.digitalObjectId}/carriers`).catch(() => []),
    apiFetch<Asset[]>('/assets'),
    asset.canContainAssets ? apiFetch<Asset[]>(`/assets/${id}/contents`) : Promise.resolve([]),
    apiFetch<ServiceRecord[]>(`/assets/${id}/services`),
  ]);
  const issues = await apiFetch<Issue[]>(`/assets/${id}/issues`);

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

      {/* Fotka věci */}
      <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
        {asset.photoKey ? (
          <Image
            src={`/api/asset-photo/${asset.id}`}
            alt={asset.name}
            width={96}
            height={96}
            unoptimized
            className="h-24 w-24 rounded-xl border border-slate-200 object-cover"
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-slate-100 text-xs text-slate-400">
            bez fotky
          </div>
        )}
        <PhotoUpload assetId={asset.id} hasPhoto={!!asset.photoKey} />
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

      <Section title="Problémy / poškození" description="Nahlášení závady – condition je oddělený od půjčení">
        <div className="flex flex-col gap-4">
          {issues.length === 0 ? (
            <EmptyState>Žádná hlášení.</EmptyState>
          ) : (
            <Table
              head={['Kdy', 'Typ', 'Popis', 'Stav']}
              rows={issues.map((i) => [
                fmtDate(i.createdAt),
                <Badge key="k" tone={i.status === 'open' ? 'red' : 'slate'}>
                  {ISSUE_LABELS[i.kind] ?? i.kind}
                </Badge>,
                i.description,
                i.status === 'open' ? (
                  <ActionButton
                    key="r"
                    action={resolveIssue}
                    hidden={{ issueId: i.id, assetId: asset.id }}
                    label="Vyřešit"
                  />
                ) : (
                  <Badge key="r" tone="green">vyřešeno</Badge>
                ),
              ])}
            />
          )}
          <ActionForm
            action={reportIssue}
            hidden={{ assetId: asset.id }}
            submitLabel="Nahlásit problém"
            fields={[
              {
                name: 'kind',
                label: 'Typ',
                required: true,
                options: [
                  { value: 'damage', label: 'Poškození' },
                  { value: 'malfunction', label: 'Závada' },
                  { value: 'missing_part', label: 'Chybí díl' },
                  { value: 'other', label: 'Jiné' },
                ],
              },
              { name: 'description', label: 'Popis', required: true },
            ]}
          />
        </div>
      </Section>

      <Section
        title="Servis a revize"
        description="Servis, revize, kalibrace – s termínem příští kontroly (§17)"
      >
        <div className="flex flex-col gap-4">
          {services.length === 0 ? (
            <EmptyState>Žádné servisní záznamy.</EmptyState>
          ) : (
            <Table
              head={['Typ', 'Provedeno', 'Příští termín', 'Kdo', 'Cena']}
              rows={services.map((s) => [
                <Badge key="k" tone="slate">{SERVICE_LABELS[s.kind] ?? s.kind}</Badge>,
                fmtDate(s.performedAt),
                s.nextDueAt ? <span key="d" className="inline-flex items-center gap-1"><Clock size={13} className="text-amber-500" />{fmtDate(s.nextDueAt)}</span> : '—',
                s.provider ?? '—',
                s.cost ? `${s.cost}` : '—',
              ])}
            />
          )}
          <ActionForm
            action={addService}
            hidden={{ assetId: asset.id }}
            submitLabel="Přidat servis/revizi"
            fields={[
              {
                name: 'kind',
                label: 'Typ',
                required: true,
                options: [
                  { value: 'service', label: 'Servis' },
                  { value: 'inspection', label: 'Revize' },
                  { value: 'calibration', label: 'Kalibrace' },
                  { value: 'repair', label: 'Oprava' },
                ],
              },
              { name: 'performedAt', label: 'Provedeno', type: 'text', placeholder: 'YYYY-MM-DD' },
              { name: 'nextDueAt', label: 'Příští termín', type: 'text', placeholder: 'YYYY-MM-DD' },
              { name: 'provider', label: 'Kdo (servis)' },
              { name: 'cost', label: 'Cena' },
            ]}
          />
        </div>
      </Section>

      <Section title={`Historie pohybů (${movements.length})`} description="Nedotknutelný ledger – oprava = nový pohyb">
        <Table
          head={['Kdy', 'Akce', 'Z', 'Do', 'Potvrzení']}
          rows={movements.map((m) => [
            fmtDateTime(m.createdAt),
            <Badge key="t" tone="brand">{MOVEMENT_LABELS[m.type] ?? m.type}</Badge>,
            label(m.fromType, m.fromId),
            label(m.toType, m.toId),
            m.confirmation === 'pending' ? (
              <ActionButton
                key="c"
                action={confirmMovement}
                hidden={{ movementId: m.id, assetId: asset.id }}
                label="Potvrdit převzetí"
              />
            ) : m.confirmation === 'confirmed' ? (
              <Badge key="c" tone="green">potvrzeno</Badge>
            ) : (
              '—'
            ),
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
