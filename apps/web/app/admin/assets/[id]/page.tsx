import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Package, Home, MapPin, User, CalendarClock, Box, Clock, QrCode } from 'lucide-react';
import { apiFetch, ApiError, getMyPermissions } from '../../../lib/server-api';
import { locationPath } from '../../../lib/location-path';
import { assetAbilities, NO_PERMISSION_NOTE } from '../../../lib/abilities';
import type {
  Asset,
  Movement,
  Person,
  Location,
  DataCarrier,
  ServiceRecord,
  Category,
  MaintenanceSummary,
} from '../../../lib/types';
import { Section, StatusBadge, Badge, Mono, PageHeader, Table, EmptyState } from '../../ui';
import { ActionForm } from '../../action-form';
import { ActionButton } from '../../action-button';
import { MovementForm } from '../movement-form';
import { PhotoGallery } from '../photo-gallery';
import { AssetManuals } from '../asset-manuals';
import { AssetSpecs } from '../asset-specs';
import { MediaTimeline } from '../media-timeline';
import { ReturnForm } from '../return-form';
import { PrintLabelButton } from '../printing/print-label-button';
import { MaintenancePanel } from './maintenance-panel';
import { LastObservationCard } from './last-observation-card';
import { PurchasePanel } from './purchase-panel';
import { getActiveModules } from '../../module-access';
import { WarrantyHint } from './warranty-hint';
import type { PurchaseView, Warranty } from '../../../lib/purchase';
import type { AssetMedia, AssetManual, AssetSpec, Observation } from '../../../lib/types';
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

const SERVICE_LABELS: Record<string, string> = {
  service: 'Servis',
  inspection: 'Revize',
  calibration: 'Kalibrace',
  repair: 'Oprava',
  warranty_claim: 'Reklamace (záruka)',
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

export default async function AssetDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ action?: string }>;
}) {
  const { id } = await params;
  const { action } = await searchParams;

  let asset: Asset;
  try {
    asset = await apiFetch<Asset>(`/assets/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const [movements, people, locations, carriers, allAssets, contents, services] = await Promise.all(
    [
      apiFetch<Movement[]>(`/assets/${id}/movements`),
      apiFetch<Person[]>('/people'),
      apiFetch<Location[]>('/locations'),
      apiFetch<DataCarrier[]>(`/objects/${asset.digitalObjectId}/carriers`).catch(() => []),
      apiFetch<Asset[]>('/assets'),
      asset.canContainAssets ? apiFetch<Asset[]>(`/assets/${id}/contents`) : Promise.resolve([]),
      apiFetch<ServiceRecord[]>(`/assets/${id}/services`),
    ],
  );
  const [categories, maintenance] = await Promise.all([
    apiFetch<Category[]>('/categories'),
    // Vozidla a stroje jsou funkce předplatného – bez ní API vrátí 403.
    apiFetch<MaintenanceSummary>(`/maintenance/assets/${id}`).catch(() => null),
  ]);
  const issues = await apiFetch<Issue[]>(`/assets/${id}/issues`);
  const media = await apiFetch<AssetMedia[]>(`/assets/${id}/media`);
  const manuals = await apiFetch<AssetManual[]>(`/assets/${id}/manuals`).catch(() => []);
  const spec = await apiFetch<AssetSpec | null>(`/assets/${id}/specs`).catch(() => null);
  const observations = await apiFetch<Observation[]>(`/assets/${id}/observations`).catch(() => []);
  // Jen provozní pravidla – nastavení firmy (`/tenant`) vidí jen owner/admin.
  const rules = await apiFetch<{ requireReturnPhoto: boolean }>('/assets/rules').catch(() => ({
    requireReturnPhoto: false,
  }));
  const perms = await getMyPermissions();
  const { canEdit, canMove, canCarrier, canIssue, canManagePhotos, canEditPurchase } =
    assetAbilities(perms);
  const active = await getActiveModules();
  const purchase =
    active.has('purchase') && perms.has('asset.purchase.view')
      ? await apiFetch<PurchaseView>(`/assets/${id}/purchase`).catch(() => null)
      : null;
  const warranties = await apiFetch<Warranty[]>(`/assets/${id}/warranties`).catch(() => []);
  const photos = await apiFetch<{
    items: {
      id: string;
      mime: string;
      position: number;
      previewX: number;
      previewY: number;
      previewZoom: number;
    }[];
    max: number;
  }>(`/assets/${id}/photos`).catch(() => ({ items: [], max: 5 }));
  const requireReturnPhoto = rules.requireReturnPhoto;
  const actions = asset.actions ?? [];
  // Výdej/vrácení jen s asset.movement.perform (Náhled formuláře nevidí).
  const canReturn = canMove && actions.includes('return');
  const otherActions = canMove ? actions.filter((a) => a !== 'return') : [];
  const qrCarrier = carriers.find(
    (carrier) =>
      carrier.status === 'active' &&
      (carrier.carrierType === 'qr' || carrier.carrierType === 'hybrid'),
  );

  const personName = new Map(people.map((p) => [p.id, p.name]));
  const locName = new Map(locations.map((l) => [l.id, locationPath(l.id, locations)]));
  // Místa pro výběr umístění (bez buněk; regál/skříň se rozbalí maticí).
  const pickLocations = locations
    .filter((l) => l.cellRow == null && l.type !== 'access_point')
    .map((l) => ({
      id: l.id,
      label: locationPath(l.id, locations),
      // Matice buněk u míst s vygenerovanou mřížkou (regál, skříň i vlastní typy).
      grid: (l.gridRows ?? 0) > 0,
    }));
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
            description={
              [
                asset.registrationPlate && `SPZ ${asset.registrationPlate}`,
                asset.manufacturer,
                asset.model,
                asset.serialNumber,
              ]
                .filter(Boolean)
                .join(' · ') || undefined
            }
            icon={<Package size={18} />}
            action={<StatusBadge status={asset.status} />}
          />
        </div>
      </div>

      {/* Fotky a hlavní QR identifikátor jsou společně viditelné hned na začátku detailu. */}
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(220px,260px)]">
        <PhotoGallery
          assetId={asset.id}
          photos={photos.items}
          max={photos.max}
          canManage={canManagePhotos}
        />
        <Section
          title={
            <span className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <QrCode size={15} />
              </span>
              QR identifikátor
            </span>
          }
          description="Rychlé načtení položky"
          action={qrCarrier ? <Badge tone="green">Aktivní</Badge> : undefined}
        >
          {qrCarrier ? (
            <div className="flex flex-col gap-3">
              {/* Na detailu jen malý náhled (signalizuje, že QR existuje); ke skenování
                  slouží vytištěný štítek, kde je QR co největší. */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <Link
                  href="#identifikator"
                  title="QR identifikátor – správa a tisk štítku"
                  className="shrink-0"
                >
                  <Image
                    src={`/api/qr/${qrCarrier.id}`}
                    alt={`QR kód položky ${asset.name}`}
                    width={56}
                    height={56}
                    unoptimized
                    className="rounded-md border border-slate-200 bg-white p-0.5"
                  />
                </Link>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                    Kód štítku
                  </p>
                  <Mono>{qrCarrier.publicCode}</Mono>
                </div>
                <PrintLabelButton
                  carrierId={qrCarrier.id}
                  data={{
                    qrValue: qrCarrier.resolverUrl ?? qrCarrier.publicCode,
                    itemName: asset.name,
                    assetCode: asset.inventoryNumber ?? qrCarrier.publicCode,
                    category: asset.category ?? undefined,
                    location: asset.homeLocationId ? locName.get(asset.homeLocationId) : undefined,
                  }}
                />
              </div>
              <Link
                href="#identifikator"
                className="text-center text-xs font-medium text-brand-700 hover:underline"
              >
                Spravovat identifikátory →
              </Link>
            </div>
          ) : (
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-brand-200 bg-brand-50/40 p-5 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand-600 shadow-sm ring-1 ring-brand-100">
                <QrCode size={25} aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-medium text-slate-700">Chybí QR identifikátor</p>
                <p className="mt-1 text-xs text-slate-500">
                  {canCarrier
                    ? 'Přidej ho pro rychlé skenování položky.'
                    : 'Přidat ho může správce položek.'}
                </p>
              </div>
              {canCarrier && (
                <Link
                  href="#identifikator"
                  className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700"
                >
                  Vytvořit QR kód
                </Link>
              )}
            </div>
          )}
        </Section>
      </div>

      {/* Stav: patří do ≠ kde je ≠ kdo má */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StateTile
          icon={<Home size={16} />}
          label="Patří do"
          value={locName.get(asset.homeLocationId ?? '') ?? '—'}
          action={
            !asset.homeLocationId ? (
              <Link href="#homeLocationId" className="text-xs text-brand-700 hover:underline">
                Nastav místo
              </Link>
            ) : undefined
          }
        />
        <StateTile
          icon={asset.currentHolderType === 'person' ? <User size={16} /> : <MapPin size={16} />}
          label={asset.currentHolderType === 'person' ? 'Má ji' : 'Kde je'}
          value={label(asset.currentHolderType, asset.currentHolderId)}
          action={
            asset.currentHolderType !== 'person' && asset.currentHolderId == null ? (
              <Link
                href={`/admin/scan?code=${encodeURIComponent(carriers[0]?.publicCode ?? '')}`}
                className="text-xs text-brand-700 hover:underline"
              >
                Přidat aktuální polohu
              </Link>
            ) : undefined
          }
        />
        <StateTile
          icon={<CalendarClock size={16} />}
          label="Vrátit do"
          value={fmtDate(asset.dueAt)}
        />
      </div>

      {canEdit && (
        <details id="edit-asset" open={!asset.homeLocationId}>
          <summary className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-brand-700">
            Upravit údaje položky
          </summary>
          <Section
            title="Upravit položku"
            description="Základní údaje (stav a držení se mění pohyby, ne zde)"
          >
            <ActionForm
              action={updateAsset}
              hidden={{ id: asset.id }}
              submitLabel="Uložit změny"
              fields={[
                { name: 'name', label: 'Název', required: true, defaultValue: asset.name },
                {
                  name: 'categoryId',
                  label: 'Kategorie',
                  defaultValue: asset.categoryId ?? (asset.category ? '__keep__' : ''),
                  options: [
                    ...(asset.category && !asset.categoryId
                      ? [{ value: '__keep__', label: `Ponechat volný text: ${asset.category}` }]
                      : []),
                    { value: '', label: '— bez kategorie —' },
                    ...categories.map((category) => ({
                      value: category.id,
                      label: `${category.name}${category.equipmentKind === 'vehicle' ? ' · vozidlo' : category.equipmentKind === 'machine' ? ' · stroj' : ''}`,
                    })),
                  ],
                  after: { href: '/admin/categories', label: 'Spravovat kategorie' },
                },
                { name: 'manufacturer', label: 'Výrobce', defaultValue: asset.manufacturer ?? '' },
                { name: 'model', label: 'Model', defaultValue: asset.model ?? '' },
                {
                  name: 'serialNumber',
                  label: 'Sériové číslo',
                  defaultValue: asset.serialNumber ?? '',
                },
                {
                  name: 'registrationPlate',
                  label: 'SPZ (u vozidel)',
                  placeholder: 'např. 1AB 2345',
                  defaultValue: asset.registrationPlate ?? '',
                },
                {
                  name: 'inventoryNumber',
                  label: 'Inventární číslo',
                  defaultValue: asset.inventoryNumber ?? '',
                },
                {
                  name: 'homeLocationId',
                  label: 'Patří do (domov)',
                  defaultValue: asset.homeLocationId ?? '',
                  options: [
                    { value: '', label: '— beze změny —' },
                    ...locations
                      .filter((l) => l.type !== 'access_point')
                      .map((l) => ({ value: l.id, label: locationPath(l.id, locations) })),
                  ],
                  after: { href: '/admin/locations', label: 'Přidej místo' },
                },
              ]}
            />
          </Section>
        </details>
      )}

      {active.has('purchase') && (
        <PurchasePanel
          assetId={asset.id}
          view={purchase}
          warranties={warranties}
          canEdit={canEditPurchase}
        />
      )}

      {/* Last Observation – kde byla naposledy VIDĚNA (≠ evidence výše) */}
      <Section
        title="Naposledy viděno"
        description="Poslední sken položky – kde byla fyzicky spatřena. Nemění evidenci (kde je vedená)."
      >
        {observations.length === 0 ? (
          <EmptyState>Zatím nenaskenováno.</EmptyState>
        ) : (
          <LastObservationCard assetId={asset.id} observation={observations[0]} />
        )}
      </Section>

      <Section
        title="Časová galerie"
        description="Fotodokumentace stavu v čase – porovnání při půjčení a vrácení"
      >
        <MediaTimeline assetId={asset.id} media={media} />
      </Section>

      <AssetSpecs
        assetId={asset.id}
        initial={spec}
        canManage={canManagePhotos && active.has('ai')}
      />

      <Section
        title="Manuály a návody"
        description="Dokumentace k obsluze – nahraj soubor nebo vyfoť kamerou."
      >
        <AssetManuals assetId={asset.id} manuals={manuals} canManage={canManagePhotos} />
      </Section>

      {canReturn && (
        <div id="asset-return" className="scroll-mt-4">
          <Section
            title="Vrátit položku"
            description={
              requireReturnPhoto
                ? 'Politika tenanta vyžaduje foto stavu'
                : 'Vrácení do assetu (foto volitelné)'
            }
          >
            <ReturnForm assetId={asset.id} requirePhoto={requireReturnPhoto} />
          </Section>
        </div>
      )}

      {otherActions.length > 0 && (
        <div id="asset-actions" className="scroll-mt-4">
          <Section title="Akce" description="Kontextové akce podle aktuálního stavu položky">
            {carriers.length === 0 && (
              <a
                href="#identifikator"
                className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 transition hover:bg-amber-100"
              >
                <QrCode size={15} className="mt-0.5 shrink-0" />
                <span>
                  <span className="font-medium">Položka nemá identifikátor.</span> Vydat ji můžeš i
                  tak – nebo nejdřív přidej QR/NFC identifikátor níže.
                </span>
              </a>
            )}
            <MovementForm
              key={action ?? 'default'}
              initialType={action}
              assetId={asset.id}
              actions={otherActions}
              people={people.map((p) => ({ id: p.id, label: p.name }))}
              locations={pickLocations}
            />
          </Section>
        </div>
      )}

      <div id="identifikator" className="scroll-mt-4">
        <Section title="Identifikátory" description="Správa QR a NFC identifikátorů položky">
          <div className="flex flex-col gap-4">
            {!qrCarrier && canCarrier && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-slate-600">Přidej QR identifikátor k této položce.</p>
                <ActionForm
                  action={addCarrierToObject}
                  hidden={{ objectId: asset.digitalObjectId, assetId: asset.id, carrierType: 'qr' }}
                  submitLabel="Přidat QR identifikátor"
                  fields={[]}
                />
              </div>
            )}
            {carriers.length > 0 && (
              <div className="flex flex-wrap gap-4">
                {carriers.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 p-3"
                  >
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
                            alias{c.externalScheme ? ` (${c.externalScheme})` : ''}:{' '}
                            {c.externalCode}
                          </Badge>
                        </p>
                      )}
                      {c.carrierType === 'qr' && (
                        <div className="mt-2">
                          <PrintLabelButton
                            carrierId={c.id}
                            data={{
                              qrValue: c.resolverUrl ?? c.publicCode,
                              itemName: asset.name,
                              assetCode: asset.inventoryNumber ?? c.publicCode,
                              category: asset.category ?? undefined,
                              location: asset.homeLocationId
                                ? locName.get(asset.homeLocationId)
                                : undefined,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {canCarrier ? (
              <>
                {/* Adopce cizího kódu: uloží externí alias (pozná ho jen interní skener)
              a zároveň vytvoří náš nativní identifikátor pro veřejný resolver. */}
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-3">
                  <p className="mb-2 text-xs font-medium text-slate-600">
                    Adoptovat existující kód
                  </p>
                  <p className="mb-3 text-xs text-slate-500">
                    Cizí QR/EAN/kód uložíme jako alias rozpoznatelný interním skenerem a vytvoříme k
                    němu i náš vlastní identifikátor pro veřejný resolver.
                  </p>
                  <ActionForm
                    action={adoptCarrier}
                    hidden={{ objectId: asset.digitalObjectId, assetId: asset.id }}
                    submitLabel="Adoptovat kód"
                    fields={[
                      {
                        name: 'externalCode',
                        label: 'Externí kód',
                        required: true,
                        placeholder: 'EAN / URL / vlastní kód',
                      },
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
              </>
            ) : (
              <p className="text-xs text-slate-500">{NO_PERMISSION_NOTE}</p>
            )}
          </div>
        </Section>
      </div>

      {asset.parentAssetId && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <Box size={15} className="text-slate-400" />
          Uloženo v:{' '}
          <span className="font-medium text-slate-800">
            {assetName.get(asset.parentAssetId) ?? '—'}
          </span>
          {canEdit && (
            <span className="ml-auto">
              <ActionButton
                action={removeFromContainer}
                hidden={{ containerId: asset.parentAssetId, childId: asset.id }}
                label="Vyjmout"
              />
            </span>
          )}
        </div>
      )}

      {asset.canContainAssets && (
        <Section
          title="Obsah kontejneru"
          description="Položky uložené v této položce (dodávka, kufr…)"
        >
          <div className="flex flex-col gap-4">
            {contents.length === 0 ? (
              <EmptyState>Kontejner je prázdný.</EmptyState>
            ) : (
              <Table
                head={['Položka', 'Stav', 'Akce']}
                rows={contents.map((c) => [
                  <Link
                    key="n"
                    href={`/admin/assets/${c.id}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {c.name}
                  </Link>,
                  <StatusBadge key="s" status={c.status} />,
                  canEdit ? (
                    <ActionButton
                      key="r"
                      action={removeFromContainer}
                      hidden={{ containerId: asset.id, childId: c.id }}
                      label="Vyjmout"
                    />
                  ) : (
                    '—'
                  ),
                ])}
              />
            )}
            {canEdit && nestableOptions.length > 0 && (
              <ActionForm
                action={putIntoContainer}
                hidden={{ containerId: asset.id }}
                submitLabel="Vložit položku"
                fields={[
                  {
                    name: 'childAssetId',
                    label: 'Přidat položku do kontejneru',
                    required: true,
                    options: nestableOptions,
                  },
                ]}
              />
            )}
          </div>
        </Section>
      )}

      <Section
        title="Problémy / poškození"
        description="Nahlášení závady – condition je oddělený od půjčení"
      >
        <div className="flex flex-col gap-4">
          <WarrantyHint
            warranties={warranties}
            hint="Závadu v záruce reklamuj u prodejce – oprava by neměla nic stát."
          />
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
                i.status === 'open' && !canIssue ? (
                  <Badge key="r" tone="red">
                    otevřeno
                  </Badge>
                ) : i.status === 'open' ? (
                  <ActionButton
                    key="r"
                    action={resolveIssue}
                    hidden={{ issueId: i.id, assetId: asset.id }}
                    label="Vyřešit"
                  />
                ) : (
                  <Badge key="r" tone="green">
                    vyřešeno
                  </Badge>
                ),
              ])}
            />
          )}
          {canIssue ? (
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
          ) : (
            <p className="text-xs text-slate-500">{NO_PERMISSION_NOTE}</p>
          )}
        </div>
      </Section>

      {maintenance && (
        <MaintenancePanel assetId={asset.id} summary={maintenance} canEdit={canEdit} />
      )}

      <Section
        title="Servis a revize"
        description="Servis, revize, kalibrace – s termínem příští kontroly (§17)"
      >
        <div className="flex flex-col gap-4">
          <WarrantyHint
            warranties={warranties}
            hint="Opravu v záruce zapiš jako „Reklamace (záruka)“ – nepočítá se do nákladů."
          />
          {services.filter((s) => !s.planCode).length === 0 ? (
            <EmptyState>Žádné servisní záznamy.</EmptyState>
          ) : (
            <Table
              head={['Typ', 'Provedeno', 'Příští termín', 'Kdo', 'Cena']}
              rows={services
                .filter((s) => !s.planCode)
                .map((s) => [
                  <Badge key="k" tone="slate">
                    {SERVICE_LABELS[s.kind] ?? s.kind}
                  </Badge>,
                  fmtDate(s.performedAt),
                  s.nextDueAt ? (
                    <span key="d" className="inline-flex items-center gap-1">
                      <Clock size={13} className="text-amber-500" />
                      {fmtDate(s.nextDueAt)}
                    </span>
                  ) : (
                    '—'
                  ),
                  s.provider ?? '—',
                  s.kind === 'warranty_claim' ? 'záruka' : s.cost ? `${s.cost}` : '—',
                ])}
            />
          )}
          {canEdit ? (
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
                    { value: 'warranty_claim', label: 'Reklamace (záruka)' },
                  ],
                },
                {
                  name: 'performedAt',
                  label: 'Provedeno',
                  type: 'text',
                  placeholder: 'YYYY-MM-DD',
                },
                {
                  name: 'nextDueAt',
                  label: 'Příští termín',
                  type: 'text',
                  placeholder: 'YYYY-MM-DD',
                },
                { name: 'provider', label: 'Kdo (servis)' },
                { name: 'cost', label: 'Cena' },
              ]}
            />
          ) : (
            <p className="text-xs text-slate-500">{NO_PERMISSION_NOTE}</p>
          )}
        </div>
      </Section>

      <Section
        title={`Historie pohybů (${movements.length})`}
        description="Nedotknutelný ledger – oprava = nový pohyb"
      >
        <Table
          head={['Kdy', 'Akce', 'Z', 'Do', 'Potvrzení']}
          rows={movements.map((m) => [
            fmtDateTime(m.createdAt),
            <Badge key="t" tone="brand">
              {MOVEMENT_LABELS[m.type] ?? m.type}
            </Badge>,
            label(m.fromType, m.fromId),
            label(m.toType, m.toId),
            m.confirmation === 'pending' && !canMove ? (
              <Badge key="c" tone="amber">
                čeká na potvrzení
              </Badge>
            ) : m.confirmation === 'pending' ? (
              <ActionButton
                key="c"
                action={confirmMovement}
                hidden={{ movementId: m.id, assetId: asset.id }}
                label="Potvrdit převzetí"
              />
            ) : m.confirmation === 'confirmed' ? (
              <Badge key="c" tone="green">
                potvrzeno
              </Badge>
            ) : (
              '—'
            ),
          ])}
        />
      </Section>
    </div>
  );
}

function StateTile({
  icon,
  label,
  value,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
        <span className="text-slate-400">{icon}</span>
        {label}
      </div>
      <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
