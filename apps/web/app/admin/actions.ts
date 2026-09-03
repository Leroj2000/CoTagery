'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '../lib/server-api';
import type { ActionState } from './action-form';

/** Obalí volání API do ActionState (chyba/úspěch) + revaliduje cestu. */
async function run(
  path: string,
  body: Record<string, unknown> | null,
  revalidate: string,
  message?: string,
  method: 'POST' | 'PATCH' | 'DELETE' = 'POST',
): Promise<ActionState> {
  try {
    await apiFetch(path, {
      method,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    revalidatePath(revalidate);
    return { ok: true, message };
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Neočekávaná chyba' };
  }
}

function str(fd: FormData, key: string): string {
  return (fd.get(key) as string | null)?.trim() ?? '';
}

function num(fd: FormData, key: string): number | undefined {
  const v = str(fd, key);
  return v === '' ? undefined : Number(v);
}

// --- Objekty & identifikátory ---
export async function createObject(_p: ActionState, fd: FormData): Promise<ActionState> {
  return run(
    '/objects',
    {
      moduleType: str(fd, 'moduleType'),
      slug: str(fd, 'slug') || undefined,
      primaryUrl: str(fd, 'primaryUrl') || undefined,
    },
    '/admin/objects',
    'Objekt vytvořen.',
  );
}

export async function generateCarriers(_p: ActionState, fd: FormData): Promise<ActionState> {
  return run(
    '/carriers/batch',
    { count: num(fd, 'count') ?? 1, carrierType: str(fd, 'carrierType') || 'qr' },
    '/admin/objects',
    'Identifikátory vygenerovány.',
  );
}

// --- Membership ---
export async function createTier(_p: ActionState, fd: FormData): Promise<ActionState> {
  const zones = str(fd, 'zoneKeys');
  return run(
    '/memberships/tiers',
    {
      name: str(fd, 'name'),
      level: num(fd, 'level') ?? 0,
      price: str(fd, 'price') || '0',
      validityDays: num(fd, 'validityDays') ?? 365,
      graceDays: num(fd, 'graceDays') ?? 7,
      zoneKeys: zones ? zones.split(',').map((z) => z.trim()).filter(Boolean) : [],
    },
    '/admin/membership',
    'Tier vytvořen.',
  );
}

export async function createMember(_p: ActionState, fd: FormData): Promise<ActionState> {
  return run(
    '/memberships/members',
    { name: str(fd, 'name'), email: str(fd, 'email') || undefined },
    '/admin/membership',
    'Člen vytvořen.',
  );
}

export async function issueMembership(_p: ActionState, fd: FormData): Promise<ActionState> {
  return run(
    '/memberships',
    { memberId: str(fd, 'memberId'), tierId: str(fd, 'tierId') },
    '/admin/membership',
    'Členství vydáno.',
  );
}

// --- Billing ---
export async function checkout(_p: ActionState, fd: FormData): Promise<ActionState> {
  return run(
    '/billing/checkout',
    {
      memberId: str(fd, 'memberId'),
      tierId: str(fd, 'tierId'),
      trialDays: num(fd, 'trialDays'),
    },
    '/admin/billing',
    'Předplatné založeno.',
  );
}

// --- Access ---
export async function createAccessPoint(_p: ActionState, fd: FormData): Promise<ActionState> {
  return run(
    '/access-points',
    { name: str(fd, 'name'), zoneKey: str(fd, 'zoneKey'), direction: str(fd, 'direction') || 'in' },
    '/admin/access',
    'Přístupový bod vytvořen.',
  );
}

// --- Membership karty ---
export async function issueCard(_p: ActionState, fd: FormData): Promise<ActionState> {
  return run(
    `/memberships/${str(fd, 'membershipId')}/cards`,
    { dataCarrierId: str(fd, 'dataCarrierId') },
    '/admin/membership',
    'Karta vydána.',
  );
}

// --- Identifikátory: pool + claim ---
export async function generatePool(_p: ActionState, fd: FormData): Promise<ActionState> {
  const selfAct = str(fd, 'selfActivatable') === 'on' || str(fd, 'selfActivatable') === 'true';
  const body: Record<string, unknown> = {
    count: num(fd, 'count') ?? 1,
    carrierType: str(fd, 'carrierType') || 'qr',
  };
  if (selfAct) {
    body.selfActivatable = true;
    body.moduleTemplate = str(fd, 'moduleTemplate') || 'contact';
  }
  try {
    const rows = await apiFetch<{ publicCode: string; pin: string | null }[]>('/carriers/batch', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    revalidatePath('/admin/carriers');
    const summary = rows
      .map((r) => (r.pin ? `${r.publicCode} (PIN ${r.pin})` : r.publicCode))
      .join(', ');
    return { ok: true, message: `Vygenerováno ${rows.length}: ${summary}` };
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Neočekávaná chyba' };
  }
}

export async function claimCarrier(_p: ActionState, fd: FormData): Promise<ActionState> {
  return run(
    '/carriers/claim',
    { publicCode: str(fd, 'publicCode'), objectId: str(fd, 'objectId') },
    '/admin/carriers',
    'Identifikátor přiřazen.',
  );
}

// --- Skupiny ---
export async function createGroup(_p: ActionState, fd: FormData): Promise<ActionState> {
  return run('/groups', { name: str(fd, 'name') }, '/admin/groups', 'Skupina vytvořena.');
}

export async function deleteGroup(_p: ActionState, fd: FormData): Promise<ActionState> {
  return run(`/groups/${str(fd, 'groupId')}`, null, '/admin/groups', 'Skupina smazána.', 'DELETE');
}

export async function addGroupMember(_p: ActionState, fd: FormData): Promise<ActionState> {
  return run(
    `/groups/${str(fd, 'groupId')}/members`,
    { userId: str(fd, 'userId') },
    '/admin/groups',
    'Člen přidán.',
  );
}

export async function removeGroupMember(_p: ActionState, fd: FormData): Promise<ActionState> {
  return run(
    `/groups/${str(fd, 'groupId')}/members/${str(fd, 'userId')}`,
    null,
    '/admin/groups',
    'Člen odebrán.',
    'DELETE',
  );
}

// --- Tenant nastavení ---
export async function updateTenant(_p: ActionState, fd: FormData): Promise<ActionState> {
  const maxMedia = num(fd, 'maxMediaPerEvent');
  const settings: Record<string, unknown> = {
    requireReturnPhoto: str(fd, 'requireReturnPhoto') === 'true',
  };
  if (maxMedia && maxMedia > 0) settings.maxMediaPerEvent = maxMedia;
  return run(
    '/tenant',
    {
      name: str(fd, 'name'),
      brandingDomain: str(fd, 'brandingDomain'),
      networkListed: str(fd, 'networkListed') === 'true',
      settings,
    },
    '/admin/settings',
    'Nastavení uloženo.',
    'PATCH',
  );
}

/** Bankovní údaje firmy pro QR/převod platby v půjčovně (EPIC-19 F3). */
export async function updateRentalPayment(_p: ActionState, fd: FormData): Promise<ActionState> {
  const rentalPayment = {
    iban: str(fd, 'iban').replace(/\s+/g, '').toUpperCase(),
    accountName: str(fd, 'accountName'),
  };
  return run(
    '/tenant',
    { settings: { rentalPayment } },
    '/admin/settings',
    'Bankovní údaje uloženy.',
    'PATCH',
  );
}

// --- NFC pairing ---
export async function pairNfc(_p: ActionState, fd: FormData): Promise<ActionState> {
  const objectId = str(fd, 'objectId');
  return run(
    `/carriers/${str(fd, 'carrierId')}/nfc/pair`,
    { nfcUid: str(fd, 'nfcUid') },
    `/admin/objects/${objectId}`,
    'NFC spárováno.',
  );
}

// --- Membership benefity ---
export async function addBenefit(_p: ActionState, fd: FormData): Promise<ActionState> {
  return run(
    `/memberships/tiers/${str(fd, 'tierId')}/benefits`,
    {
      kind: str(fd, 'kind'),
      value: str(fd, 'value') || undefined,
      targetKey: str(fd, 'targetKey') || undefined,
      description: str(fd, 'description') || undefined,
    },
    '/admin/membership',
    'Benefit přidán.',
  );
}

// --- CSV import + hromadný výdej ---
export async function importAssetsCsv(_p: ActionState, fd: FormData): Promise<ActionState> {
  const csv = fd.get('csv') as string | null;
  if (!csv || !csv.trim()) return { error: 'Prázdný CSV.' };
  try {
    const res = await apiFetch<{ created: number; failed: { row: number; error: string }[] }>(
      '/assets/import',
      { method: 'POST', body: JSON.stringify({ csv }) },
    );
    revalidatePath('/admin/assets');
    const failMsg = res.failed.length ? ` (${res.failed.length} chyb)` : '';
    return { ok: true, message: `Naimportováno ${res.created} položek${failMsg}.` };
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Import selhal' };
  }
}

// Pozn.: hromadný výdej sjednocen do workflow scanneru (/admin/workflow → BFF /api/workflow/*).

// --- Nálezy + webhooky (🔵) ---
export async function handleFoundReport(_p: ActionState, fd: FormData): Promise<ActionState> {
  return run(`/found-reports/${str(fd, 'id')}/handle`, null, '/admin/found', 'Vyřízeno.');
}

export async function createWebhook(_p: ActionState, fd: FormData): Promise<ActionState> {
  const events = str(fd, 'events');
  return run(
    '/webhooks',
    { url: str(fd, 'url'), events: events ? events.split(',').map((e) => e.trim()).filter(Boolean) : [] },
    '/admin/webhooks',
    'Endpoint přidán.',
  );
}

export async function testWebhook(_p: ActionState, fd: FormData): Promise<ActionState> {
  return run(`/webhooks/${str(fd, 'id')}/test`, null, '/admin/webhooks', 'Test odeslán.');
}

export async function deleteWebhook(_p: ActionState, fd: FormData): Promise<ActionState> {
  return run(`/webhooks/${str(fd, 'id')}`, null, '/admin/webhooks', 'Endpoint smazán.', 'DELETE');
}

// --- Nahlášení problému + inventura subjekt ---
export async function reportIssue(_p: ActionState, fd: FormData): Promise<ActionState> {
  const assetId = str(fd, 'assetId');
  return run(
    `/assets/${assetId}/issues`,
    {
      kind: str(fd, 'kind'),
      description: str(fd, 'description'),
      reportedById: str(fd, 'reportedById') || undefined,
    },
    `/admin/assets/${assetId}`,
    'Problém nahlášen.',
  );
}

export async function resolveIssue(_p: ActionState, fd: FormData): Promise<ActionState> {
  const assetId = str(fd, 'assetId');
  return run(
    `/assets/issues/${str(fd, 'issueId')}/resolve`,
    null,
    assetId ? `/admin/assets/${assetId}` : '/admin/attention',
    'Vyřešeno.',
  );
}

export async function startInventorySubject(_p: ActionState, fd: FormData): Promise<ActionState> {
  const subject = str(fd, 'subject'); // "type:id"
  const [subjectType, subjectId] = subject.includes(':') ? subject.split(':') : ['location', subject];
  return run('/inventory', { subjectType, subjectId }, '/admin/inventory', 'Inventura spuštěna.');
}

// --- Kategorie věcí ---
export async function createCategory(_p: ActionState, fd: FormData): Promise<ActionState> {
  return run('/categories', { name: str(fd, 'name') }, '/admin/categories', 'Kategorie vytvořena.');
}

export async function renameCategory(_p: ActionState, fd: FormData): Promise<ActionState> {
  return run(
    `/categories/${str(fd, 'id')}`,
    { name: str(fd, 'name') },
    '/admin/categories',
    'Přejmenováno.',
    'PATCH',
  );
}

export async function deleteCategory(_p: ActionState, fd: FormData): Promise<ActionState> {
  return run(`/categories/${str(fd, 'id')}`, null, '/admin/categories', 'Kategorie smazána.', 'DELETE');
}

/** Najde kategorii podle názvu, nebo ji vytvoří. Vrací její id. */
async function findOrCreateCategory(name: string): Promise<string | undefined> {
  try {
    const cat = await apiFetch<{ id: string }>('/categories', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    return cat.id;
  } catch {
    // Nejspíš už existuje (duplicitní název) → dohledej ji.
    const list = await apiFetch<{ id: string; name: string }[]>('/categories');
    return list.find((c) => c.name.toLowerCase() === name.toLowerCase())?.id;
  }
}

// --- Asset custody (Fáze A/B) ---
export async function createAsset(_p: ActionState, fd: FormData): Promise<ActionState> {
  // Inline „➕ Nová kategorie…": categoryId='__new__' + newCategory → založ ji.
  let categoryId = str(fd, 'categoryId');
  const newCategory = str(fd, 'newCategory');
  if (categoryId === '__new__') {
    categoryId = newCategory ? ((await findOrCreateCategory(newCategory)) ?? '') : '';
  }

  const idMode = str(fd, 'idMode'); // '' | 'generate' | 'adopt'
  const carrierType = str(fd, 'carrierType') || 'qr';

  try {
    // 1) Vytvoř položku (vrací digital_object_id pro případný identifikátor).
    const asset = await apiFetch<{ id: string; digitalObjectId: string }>('/assets', {
      method: 'POST',
      body: JSON.stringify({
        name: str(fd, 'name'),
        categoryId: categoryId || undefined,
        manufacturer: str(fd, 'manufacturer') || undefined,
        serialNumber: str(fd, 'serialNumber') || undefined,
        homeLocationId: str(fd, 'homeLocationId') || undefined,
        canContainAssets: str(fd, 'canContainAssets') === 'true',
      }),
    });

    // 2) Volitelný identifikátor – vygenerovat nový, nebo adoptovat vlastní kód.
    //    Selhání identifikátoru nesmí shodit už vytvořenou položku.
    let extra = '';
    try {
      if (idMode === 'generate') {
        await apiFetch(`/objects/${asset.digitalObjectId}/carriers`, {
          method: 'POST',
          body: JSON.stringify({ carrierType }),
        });
        extra = ` + ${carrierType.toUpperCase()} identifikátor vytvořen`;
      } else if (idMode === 'adopt') {
        const externalCode = str(fd, 'externalCode');
        if (externalCode) {
          await apiFetch(`/objects/${asset.digitalObjectId}/carriers/adopt`, {
            method: 'POST',
            body: JSON.stringify({
              externalCode,
              externalScheme: str(fd, 'externalScheme') || undefined,
              carrierType,
            }),
          });
          extra = ' + vlastní kód adoptován';
        }
      }
    } catch (e) {
      revalidatePath('/admin/assets');
      return {
        ok: true,
        message: `Položka vytvořena, ale identifikátor se nepodařilo přidat (${
          e instanceof ApiError ? e.message : 'chyba'
        }).`,
      };
    }

    revalidatePath('/admin/assets');
    return { ok: true, message: `Položka vytvořena${extra}.` };
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Neočekávaná chyba' };
  }
}

// --- Servis / revize (§17) ---
export async function addService(_p: ActionState, fd: FormData): Promise<ActionState> {
  const assetId = str(fd, 'assetId');
  return run(
    `/assets/${assetId}/services`,
    {
      kind: str(fd, 'kind'),
      performedAt: str(fd, 'performedAt') || undefined,
      nextDueAt: str(fd, 'nextDueAt') || undefined,
      provider: str(fd, 'provider') || undefined,
      cost: str(fd, 'cost') || undefined,
      note: str(fd, 'note') || undefined,
    },
    `/admin/assets/${assetId}`,
    'Servisní záznam přidán.',
  );
}

// --- Potvrzení převzetí (§8) ---
export async function confirmMovement(_p: ActionState, fd: FormData): Promise<ActionState> {
  const assetId = str(fd, 'assetId');
  return run(
    `/assets/movements/${str(fd, 'movementId')}/confirm`,
    null,
    assetId ? `/admin/assets/${assetId}` : '/admin/assets',
    'Převzetí potvrzeno.',
  );
}

// --- Rezervace / požadavky (§15) ---
export async function createReservation(_p: ActionState, fd: FormData): Promise<ActionState> {
  return run(
    '/reservations',
    {
      assetId: str(fd, 'assetId'),
      requestedById: str(fd, 'requestedById') || undefined,
      fromAt: str(fd, 'fromAt') || undefined,
      toAt: str(fd, 'toAt') || undefined,
      purpose: str(fd, 'purpose') || undefined,
    },
    '/admin/reservations',
    'Rezervace vytvořena.',
  );
}

export async function setReservationStatus(_p: ActionState, fd: FormData): Promise<ActionState> {
  const action = str(fd, 'action'); // approve | reject | cancel
  return run(`/reservations/${str(fd, 'id')}/${action}`, null, '/admin/reservations', 'Stav změněn.');
}

// --- Asset nesting (§14) ---
export async function putIntoContainer(_p: ActionState, fd: FormData): Promise<ActionState> {
  const containerId = str(fd, 'containerId');
  return run(
    `/assets/${containerId}/contents`,
    { childAssetId: str(fd, 'childAssetId') },
    `/admin/assets/${containerId}`,
    'Vloženo do kontejneru.',
  );
}

export async function removeFromContainer(_p: ActionState, fd: FormData): Promise<ActionState> {
  const containerId = str(fd, 'containerId');
  return run(
    `/assets/contents/${str(fd, 'childId')}`,
    null,
    `/admin/assets/${containerId}`,
    'Vyjmuto z kontejneru.',
    'DELETE',
  );
}

/**
 * Provede pohyb assetu. `target` je zakódované "person:ID" / "location:ID"
 * (nebo prázdné pro dispose). Rozloží se na toType/toId pro API.
 */
export async function performAssetMovement(_p: ActionState, fd: FormData): Promise<ActionState> {
  const assetId = str(fd, 'assetId');
  const target = str(fd, 'target');
  const [toType, toId] = target.includes(':') ? target.split(':') : [undefined, undefined];
  return run(
    `/assets/${assetId}/movements`,
    {
      type: str(fd, 'type'),
      toType,
      toId,
      dueAt: str(fd, 'dueAt') || undefined,
      note: str(fd, 'note') || undefined,
      requireConfirmation: str(fd, 'requireConfirmation') === 'true',
    },
    `/admin/assets/${assetId}`,
    'Pohyb zaznamenán.',
  );
}

export async function createPerson(_p: ActionState, fd: FormData): Promise<ActionState> {
  return run(
    '/people',
    {
      name: str(fd, 'name'),
      email: str(fd, 'email') || undefined,
      phone: str(fd, 'phone') || undefined,
      company: str(fd, 'company') || undefined,
    },
    '/admin/people',
    'Osoba vytvořena.',
  );
}

export async function createLocation(_p: ActionState, fd: FormData): Promise<ActionState> {
  const type = str(fd, 'type') || undefined;
  const gridRows = num(fd, 'gridRows');
  const gridCols = num(fd, 'gridCols');
  try {
    // 1) Vytvoř místo.
    const loc = await apiFetch<{ id: string }>('/locations', {
      method: 'POST',
      body: JSON.stringify({
        name: str(fd, 'name'),
        type,
        parentId: str(fd, 'parentId') || undefined,
      }),
    });
    // 2) Úložný prostor (regál/skříň) se zadanou mřížkou → rovnou vygeneruj buňky.
    let extra = '';
    if ((type === 'rack' || type === 'cabinet') && gridRows && gridCols) {
      try {
        await apiFetch(`/locations/${loc.id}/grid`, {
          method: 'POST',
          body: JSON.stringify({ rows: gridRows, cols: gridCols }),
        });
        extra = ` + mřížka ${gridRows}×${gridCols}`;
      } catch {
        extra = ' (mřížku se nepodařilo vygenerovat – zkus ji v místě ručně)';
      }
    }
    revalidatePath('/admin/locations');
    return { ok: true, message: `Místo vytvořeno.${extra}` };
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Neočekávaná chyba' };
  }
}

// --- Editace položek (permission-gated) ---
export async function updatePerson(_p: ActionState, fd: FormData): Promise<ActionState> {
  return run(
    `/people/${str(fd, 'id')}`,
    {
      name: str(fd, 'name'),
      email: str(fd, 'email') || '',
      phone: str(fd, 'phone') || '',
      company: str(fd, 'company') || '',
    },
    '/admin/people',
    'Osoba upravena.',
    'PATCH',
  );
}

export async function updateLocation(_p: ActionState, fd: FormData): Promise<ActionState> {
  return run(
    `/locations/${str(fd, 'id')}`,
    {
      name: str(fd, 'name'),
      type: str(fd, 'type') || undefined,
      address: str(fd, 'address') || '',
      parentId: str(fd, 'parentId') || undefined,
    },
    '/admin/locations',
    'Místo upraveno.',
    'PATCH',
  );
}

export async function updateAsset(_p: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, 'id');
  return run(
    `/assets/${id}`,
    {
      name: str(fd, 'name'),
      category: str(fd, 'category') || '',
      manufacturer: str(fd, 'manufacturer') || '',
      model: str(fd, 'model') || '',
      serialNumber: str(fd, 'serialNumber') || '',
      inventoryNumber: str(fd, 'inventoryNumber') || '',
      homeLocationId: str(fd, 'homeLocationId') || undefined,
    },
    `/admin/assets/${id}`,
    'Položka upravena.',
    'PATCH',
  );
}

// --- Inventura (Fáze C) ---
export async function startInventory(_p: ActionState, fd: FormData): Promise<ActionState> {
  return run('/inventory', { locationId: str(fd, 'locationId') }, '/admin/inventory', 'Inventura spuštěna.');
}

// Pozn.: sken a uzavření inventury řeší continuous-scan klient (BFF /api/inventory/*).

// --- Object detail ---
export async function addCarrierToObject(_p: ActionState, fd: FormData): Promise<ActionState> {
  const objectId = str(fd, 'objectId');
  return run(
    `/objects/${objectId}/carriers`,
    { carrierType: str(fd, 'carrierType') || 'qr' },
    `/admin/objects/${objectId}`,
    'Identifikátor přidán.',
  );
}

/** Adopce cizího kódu: uloží externí alias + vytvoří náš nativní carrier. */
export async function adoptCarrier(_p: ActionState, fd: FormData): Promise<ActionState> {
  const objectId = str(fd, 'objectId');
  const assetId = str(fd, 'assetId');
  const revalidate = assetId ? `/admin/assets/${assetId}` : `/admin/objects/${objectId}`;
  return run(
    `/objects/${objectId}/carriers/adopt`,
    {
      externalCode: str(fd, 'externalCode'),
      externalScheme: str(fd, 'externalScheme') || undefined,
      carrierType: str(fd, 'carrierType') || 'qr',
    },
    revalidate,
    'Kód adoptován – vytvořen i náš identifikátor.',
  );
}

export async function archiveObject(_p: ActionState, fd: FormData): Promise<ActionState> {
  return run(`/objects/${str(fd, 'objectId')}`, null, '/admin/objects', 'Objekt archivován.', 'DELETE');
}

// --- Billing detail ---
export async function cancelSubscription(_p: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, 'subscriptionId');
  return run(
    `/billing/subscriptions/${id}/cancel`,
    { immediately: str(fd, 'immediately') === 'true' },
    `/admin/billing/${id}`,
    'Předplatné zrušeno.',
  );
}

// --- Users ---
export async function updateUserRole(_p: ActionState, fd: FormData): Promise<ActionState> {
  return run(
    `/users/${str(fd, 'userId')}/role`,
    { tenantRole: str(fd, 'tenantRole') },
    '/admin/users',
    'Role změněna.',
    'PATCH',
  );
}

export async function setUserStatus(_p: ActionState, fd: FormData): Promise<ActionState> {
  const action = str(fd, 'status') === 'suspended' ? 'suspend' : 'activate';
  return run(`/users/${str(fd, 'userId')}/${action}`, null, '/admin/users', 'Stav změněn.');
}

export async function inviteUser(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const res = await apiFetch<{ tempPassword: string }>('/users', {
      method: 'POST',
      body: JSON.stringify({
        email: str(fd, 'email'),
        name: str(fd, 'name'),
        tenantRole: str(fd, 'tenantRole'),
      }),
    });
    revalidatePath('/admin/users');
    return { ok: true, message: `Pozván. Dočasné heslo: ${res.tempPassword}` };
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Neočekávaná chyba' };
  }
}
