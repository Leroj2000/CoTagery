'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '../lib/server-api';
import { localToIso } from '../lib/calendar';
import type { ActionState } from './action-form';

function str(fd: FormData, key: string): string {
  return (fd.get(key) as string | null)?.trim() ?? '';
}

function fail(e: unknown): ActionState {
  return { error: e instanceof ApiError ? e.message : 'Neočekávaná chyba' };
}

function refresh(fd: FormData): void {
  revalidatePath('/admin/calendar');
  revalidatePath('/admin/me');
  const assetId = str(fd, 'assetId');
  if (assetId) revalidatePath(`/admin/assets/${assetId}`);
}

const fmt = new Intl.DateTimeFormat('cs-CZ', {
  timeZone: 'Europe/Prague',
  weekday: 'short',
  day: 'numeric',
  month: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/** Hromadné vypsání termínů přezutí (den, od–do po X minutách). */
export async function createTireSlots(_p: ActionState, fd: FormData): Promise<ActionState> {
  const day = str(fd, 'day');
  const from = str(fd, 'from');
  const to = str(fd, 'to');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { error: 'Vyber den.' };
  if (!/^\d{1,2}:\d{2}$/.test(from) || !/^\d{1,2}:\d{2}$/.test(to)) {
    return { error: 'Čas zadej jako HH:MM, např. 8:00.' };
  }
  const startsAt = localToIso(`${day}T${from.padStart(5, '0')}`);
  const endsAt = localToIso(`${day}T${to.padStart(5, '0')}`);
  if (!startsAt || !endsAt) return { error: 'Neplatný čas.' };
  const season = str(fd, 'season');
  try {
    const res = await apiFetch<{ created: number }>('/tire-slots', {
      method: 'POST',
      body: JSON.stringify({
        startsAt,
        endsAt,
        durationMin: Number(str(fd, 'durationMin') || 30),
        capacity: Number(str(fd, 'capacity') || 1),
        location: str(fd, 'location') || undefined,
        note: str(fd, 'note') || undefined,
        season: season || undefined,
      }),
    });
    refresh(fd);
    return { ok: true, message: `Vypsáno termínů: ${res.created}.` };
  } catch (e) {
    return fail(e);
  }
}

export async function cancelTireSlot(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const res = await apiFetch<{ cancelledBookings: number }>(`/tire-slots/${str(fd, 'id')}`, {
      method: 'DELETE',
    });
    refresh(fd);
    return {
      ok: true,
      message: res.cancelledBookings
        ? `Termín zrušen, zrušené rezervace: ${res.cancelledBookings}.`
        : 'Termín zrušen.',
    };
  } catch (e) {
    return fail(e);
  }
}

export async function bookTireSlot(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const b = await apiFetch<{ startsAt: string }>(`/tire-slots/${str(fd, 'slotId')}/book`, {
      method: 'POST',
      body: JSON.stringify({ assetId: str(fd, 'assetId') }),
    });
    refresh(fd);
    return { ok: true, message: `Zarezervováno na ${fmt.format(new Date(b.startsAt))}.` };
  } catch (e) {
    return fail(e);
  }
}

export async function moveTireBooking(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const b = await apiFetch<{ startsAt: string }>(`/tire-bookings/${str(fd, 'id')}/move`, {
      method: 'POST',
      body: JSON.stringify({ slotId: str(fd, 'slotId') }),
    });
    refresh(fd);
    return { ok: true, message: `Termín změněn na ${fmt.format(new Date(b.startsAt))}.` };
  } catch (e) {
    return fail(e);
  }
}

export async function cancelTireBooking(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await apiFetch(`/tire-bookings/${str(fd, 'id')}/cancel`, { method: 'POST' });
    refresh(fd);
    return { ok: true, message: 'Rezervace přezutí zrušena.' };
  } catch (e) {
    return fail(e);
  }
}

export async function completeTireBooking(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const res = await apiFetch<{ mountedSet: string | null }>(
      `/tire-bookings/${str(fd, 'id')}/complete`,
      { method: 'POST' },
    );
    refresh(fd);
    return {
      ok: true,
      message: res.mountedSet
        ? `Hotovo – namontována sada „${res.mountedSet}“, zapsán servis.`
        : 'Hotovo – zapsán servis.',
    };
  } catch (e) {
    return fail(e);
  }
}
