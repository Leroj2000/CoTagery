import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Package, Home, MapPin, User, CalendarClock, Box, Clock, QrCode, Eye } from 'lucide-react';
import { apiFetch, ApiError, getMyPermissions } from '../../../lib/server-api';
import type { Asset, Movement, Person, Location, DataCarrier, ServiceRecord } from '../../../lib/types';
import { Section, StatusBadge, Badge, Mono, PageHeader, Table, EmptyState } from '../../ui';
import { ActionForm } from '../../action-form';
import { ActionButton } from '../../action-button';
import { MovementForm } from '../movement-form';
import { PhotoGallery } from '../photo-gallery';
import { MediaTimeline } from '../media-timeline';
import { ReturnForm } from '../return-form';
import { PrintLabelButton } from '../printing/print-label-button';
import type { AssetMedia, Tenant, Observation } from '../../../lib/types';
import {
  addCarrierToObject,
  adoptCarrier,
  putIntoContainer,
  removeFromContainer,
  addService,
  confirmMovement,
  reportIssue,
  resolveIssue,
  updateAsset,
} from '../../actions';
import type { Issue } from '../../../lib/types';

export const dynamic = 'force-dynamic';

const ISSUE_LABELS: Record<string, string> = {
  damage: 'Poškození',
  malfunction: 'Závada',
  missing_part: 'Chybí díl',
  other: 'Jiné',
};

const OBSERVATION_SOURCE: Record<string, string> = {
  scan: 'Sken',
  inventory: 'Inventura',
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
  const media = await apiFetch<AssetMedia[]>(`/assets/${id}/media`);
  const observations = await apiFetch<Observation[]>(`/assets/${id}/observations`).catch(() => []);
  const tenant = await apiFetch<Tenant>('/tenant');
  const perms = await getMyPermissions();
  const canEdit = perms.has('asset.item.update');
  const canManagePhotos = perms.has('asset.media.manage');
  const photos = await apiFetch<{
    items: { id: string; mime: string; position: number }[];
    max: number;
  }>(`/assets/${id}/photos`).catch(() => ({ items: [], max: 5 }));
  const requireReturnPhoto = tenant.settings?.requireReturnPhoto === true;
  const actions = asset.actions ?? [];
  const canReturn = actions.includes('return');
  const otherActions = actions.filter((a) => a !== 'return');

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
          ← Položky
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

      {/* Galerie fotek věci (první = hlavní, zobrazuje se v seznamu) */}
      <PhotoGallery
        assetId={asset.id}
        photos={photos.items}
        max={photos.max}
        canManage={canManagePhotos}
      />

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

      {canEdit && (
        <Section title="Upravit položku" description="Základní údaje (stav a držení se mění pohyby, ne zde)">
          <ActionForm
            action={updateAsset}
            hidden={{ id: asset.id }}
            submitLabel="Uložit změny"
            fields={[
              { name: 'name', label: 'Název', required: true, defaultValue: asset.name },
              { name: 'category', label: 'Kategorie', defaultValue: asset.category ?? '' },
              { name: 'manufacturer', label: 'Výrobce', defaultValue: asset.manufacturer ?? '' },
              { name: 'model', label: 'Model', defaultValue: asset.model ?? '' },
              { name: 'serialNumber', label: 'Sériové číslo', defaultValue: asset.serialNumber ?? '' },
              { name: 'inventoryNumber', label: 'Inventární číslo', defaultValue: asset.inventoryNumber ?? '' },
              {
                name: 'homeLocationId',
                label: 'Patří do (domov)',
                defaultValue: asset.homeLocationId ?? '',
                options: [
                  { value: '', label: '— beze změny —' },
                  ...locations.map((l) => ({ value: l.id, label: l.name })),
                ],
              },
            ]}
          />
        </Section>
      )}

      {/* Last Observation – kde byla naposledy VIDĚNA (≠ evidence výše) */}
      <Section
        title="Naposledy viděno"
        description="Poslední sken položky – kde byla fyzicky spatřena. Nemění evidenci (kde je vedená)."
      >
        {observations.length === 0 ? (
          <EmptyState>Zatím nenaskenováno.</EmptyState>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-sm">
              <Eye size={16} className="text-slate-400" />
              <div className="flex-1">
                <span className="font-medium text-slate-800">{fmtDateTime(observations[0].observedAt)}</span>
                {observations[0].locationName && (
                  <span className="text-slate-600"> · {observations[0].locationName}</span>
                )}
              </div>
              <Badge tone="slate">
                {OBSERVATION_SOURCE[observations[0].source] ?? observations[0].source}
                {observations[0].actorName ? ` · ${observations[0].actorName}` : ''}
              </Badge>
            </div>
            {observations.length > 1 && (
              <ul className="flex flex-col divide-y divide-slate-100 text-xs text-slate-500">
                {observations.slice(1, 5).map((o) => (
                  <li key={o.id} className="flex items-center gap-2 py-1.5">
                    <span className="flex-1">
                      {fmtDateTime(o.observedAt)}
                      {o.locationName ? ` · ${o.locationName}` : ''}
                    </span>
                    <span className="text-slate-400">
                      {OBSERVATION_SOURCE[o.source] ?? o.source}
                      {o.actorName ? ` · ${o.actorName}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Section>

      <Section
        title="Časová galerie"
        description="Fotodokumentace stavu v čase – porovnání při půjčení a vrácení"
      >
        <MediaTimeline assetId={asset.id} media={media} />
      </Section>

      {canReturn && (
        <Section
          title="Vrátit položku"
          description={requireReturnPhoto ? 'Politika tenanta vyžaduje foto stavu' : 'Vrácení do assetu (foto volitelné)'}
        >
          <ReturnForm assetId={asset.id} requirePhoto={requireReturnPhoto} />
        </Section>
      )}

      {otherActions.length > 0 && (
        <Section title="Akce" description="Kontextové akce podle aktuálního stavu položky">
          {carriers.length === 0 && (
            <a
              href="#identifikator"
              className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 transition hover:bg-amber-100"
            >
              <QrCode size={15} className="mt-0.5 shrink-0" />
              <span>
                <span className="font-medium">Položka nemá identifikátor.</span> Vydat ji můžeš i tak – nebo
                nejdřív přidej QR/NFC identifikátor níže.
              </span>
            </a>
          )}
          <MovementForm
            assetId={asset.id}
            actions={otherActions}
            people={people.map((p) => ({ id: p.id, label: p.name }))}
            locations={locations.map((l) => ({ id: l.id, label: l.name }))}
          />
        </Section>
      )}

      <div id="identifikator" className="scroll-mt-4">
      <Section title="Identifikátor (QR)" description="Štítek na položce – stabilní identifikátor">
        <div className="flex flex-col gap-4">
          {carriers.length === 0 ? (
            <div className="flex flex-col gap-3">
              <EmptyState>Položka zatím nemá identifikátor.</EmptyState>
              <ActionForm
                action={addCarrierToObject}
                hidden={{ objectId: asset.digitalObjectId }}
                submitLabel="Přidat QR identifikátor"
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
                    {c.externalCode && (
                      <p className="mt-1">
                        <Badge tone="brand">
                          alias{c.externalScheme ? ` (${c.externalScheme})` : ''}: {c.externalCode}
                        </Badge>
                      </p>
                    )}
                    {c.carrierType === 'qr' && (
                      <div className="mt-2">
                        <PrintLabelButton
                          data={{
                            qrValue: c.resolverUrl ?? c.publicCode,
                            itemName: asset.name,
                            assetCode: asset.inventoryNumber ?? c.publicCode,
                            subtitle: asset.category ?? undefined,
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Adopce cizího kódu: uloží externí alias (pozná ho jen interní skener)
              a zároveň vytvoří náš nativní identifikátor pro veřejný resolver. */}
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-3">
            <p className="mb-2 text-xs font-medium text-slate-600">
              Adoptovat existující kód
            </p>
            <p className="mb-3 text-xs text-slate-500">
              Cizí QR/EAN/kód uložíme jako alias rozpoznatelný interním skenerem a vytvoříme k němu
              i náš vlastní identifikátor pro veřejný resolver.
            </p>
            <ActionForm
              action={adoptCarrier}
              hidden={{ objectId: asset.digitalObjectId, assetId: asset.id }}
              submitLabel="Adoptovat kód"
              fields={[
                { name: 'externalCode', label: 'Externí kód', required: true, placeholder: 'EAN / URL / vlastní kód' },
                {
                  name: 'externalScheme',
                  label: 'Typ kódu',
                  options: [
                    { value: 'custom', label: 'Vlastní' },
                    { value: 'ean13', label: 'EAN-13' },
                    { value: 'url', label: 'URL' },
                  ],
                },
                {
                  name: 'carrierType',
                  label: 'Náš nosič',
                  options: [
                    { value: 'qr', label: 'QR' },
                    { value: 'nfc', label: 'NFC' },
                  ],
                },
              ]}
            />
          </div>
        </div>
      </Section>
      </div>

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
        <Section title="Obsah kontejneru" description="Položky uložené v této položce (dodávka, kufr…)">
          <div className="flex flex-col gap-4">
            {contents.length === 0 ? (
              <EmptyState>Kontejner je prázdný.</EmptyState>
            ) : (
              <Table
                head={['Položka', 'Stav', 'Akce']}
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
                submitLabel="Vložit položku"
                fields={[{ name: 'childAssetId', label: 'Přidat položku do kontejneru', required: true, options: nestableOptions }]}
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
