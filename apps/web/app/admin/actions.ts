'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '../lib/server-api';
import type { ActionState } from './action-form';

/** Obalí volání API do ActionState (chyba/úspěch) + revaliduje cestu. */
async function run(
  path: string,
  body: Record<string, unknown>,
  revalidate: string,
  message?: string,
): Promise<ActionState> {
  try {
    await apiFetch(path, { method: 'POST', body: JSON.stringify(body) });
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

// --- Users ---
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
