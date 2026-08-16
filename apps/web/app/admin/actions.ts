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

// --- Objekty & nosiče ---
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
    'Nosiče vygenerovány.',
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

// --- Nosiče: pool + claim ---
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
    'Nosič přiřazen.',
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
  return run(
    '/tenant',
    { name: str(fd, 'name'), brandingDomain: str(fd, 'brandingDomain') },
    '/admin/settings',
    'Nastavení uloženo.',
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

// --- Asset custody (Fáze A/B) ---
export async function createAsset(_p: ActionState, fd: FormData): Promise<ActionState> {
  return run(
    '/assets',
    {
      name: str(fd, 'name'),
      category: str(fd, 'category') || undefined,
      manufacturer: str(fd, 'manufacturer') || undefined,
      serialNumber: str(fd, 'serialNumber') || undefined,
      homeLocationId: str(fd, 'homeLocationId') || undefined,
      canContainAssets: str(fd, 'canContainAssets') === 'true',
    },
    '/admin/assets',
    'Věc vytvořena.',
  );
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
  return run(
    '/locations',
    {
      name: str(fd, 'name'),
      type: str(fd, 'type') || undefined,
      parentId: str(fd, 'parentId') || undefined,
    },
    '/admin/locations',
    'Místo vytvořeno.',
  );
}

// --- Inventura (Fáze C) ---
export async function startInventory(_p: ActionState, fd: FormData): Promise<ActionState> {
  return run('/inventory', { locationId: str(fd, 'locationId') }, '/admin/inventory', 'Inventura spuštěna.');
}

export async function scanInventory(_p: ActionState, fd: FormData): Promise<ActionState> {
  const checkId = str(fd, 'checkId');
  const assetId = str(fd, 'assetId');
  return run(
    `/inventory/${checkId}/scan`,
    { assetId: assetId || undefined, publicCode: str(fd, 'publicCode') || undefined },
    `/admin/inventory/${checkId}`,
    'Naskenováno.',
  );
}

export async function closeInventory(_p: ActionState, fd: FormData): Promise<ActionState> {
  const checkId = str(fd, 'checkId');
  return run(`/inventory/${checkId}/close`, null, `/admin/inventory/${checkId}`, 'Inventura uzavřena.');
}

// --- Object detail ---
export async function addCarrierToObject(_p: ActionState, fd: FormData): Promise<ActionState> {
  const objectId = str(fd, 'objectId');
  return run(
    `/objects/${objectId}/carriers`,
    { carrierType: str(fd, 'carrierType') || 'qr' },
    `/admin/objects/${objectId}`,
    'Nosič přidán.',
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
