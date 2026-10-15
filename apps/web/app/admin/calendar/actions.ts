'use server';

import { revalidatePath } from 'next/cache';
import { isCalendarSource, type CalendarShareDto } from '@tagery/shared';
import { apiFetch, ApiError } from '../../lib/server-api';
import { localToIso } from '../../lib/calendar';
import type { ActionState } from '../action-form';

const PATH = '/admin/calendar';

function str(fd: FormData, key: string): string {
  return (fd.get(key) as string | null)?.trim() ?? '';
}

function fail(e: unknown): ActionState {
  return { error: e instanceof ApiError ? e.message : 'Neočekávaná chyba' };
}

function nextDay(date: string): string {
  return new Date(Date.parse(`${date}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

/** Nová událost. Celodenní = data bez času (konec exkluzivně další den, jako iCal). */
export async function createCalendarEvent(_p: ActionState, fd: FormData): Promise<ActionState> {
  const allDay = str(fd, 'allDay') === 'yes';
  const startRaw = str(fd, 'startsAt');
  const endRaw = str(fd, 'endsAt');
  let startsAt: string | null;
  let endsAt: string | null = null;
  if (allDay) {
    const startDate = startRaw.slice(0, 10);
    const endDate = (endRaw || startRaw).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return { error: 'Vyplň začátek.' };
    startsAt = `${startDate}T00:00:00.000Z`;
    endsAt = `${nextDay(endDate < startDate ? startDate : endDate)}T00:00:00.000Z`;
  } else {
    startsAt = localToIso(startRaw);
    if (endRaw) {
      endsAt = localToIso(endRaw);
      if (!endsAt) return { error: 'Neplatný konec.' };
    }
  }
  if (!startsAt) return { error: 'Vyplň začátek.' };
  try {
    await apiFetch('/calendar/events', {
      method: 'POST',
      body: JSON.stringify({
        title: str(fd, 'title'),
        startsAt,
        endsAt: endsAt ?? undefined,
        allDay,
        location: str(fd, 'location') || undefined,
        description: str(fd, 'description') || undefined,
      }),
    });
    revalidatePath(PATH);
    return { ok: true, message: 'Událost přidána.' };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteCalendarEvent(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await apiFetch(`/calendar/events/${str(fd, 'id')}`, { method: 'DELETE' });
    revalidatePath(PATH);
    return { ok: true, message: 'Událost smazána.' };
  } catch (e) {
    return fail(e);
  }
}

export type ShareActionState = (ActionState & { token?: string }) | null;

/** Nový sdílecí odkaz – token vrátí jen jednou (v DB je jen jeho hash). */
export async function createCalendarShare(
  _p: ShareActionState,
  fd: FormData,
): Promise<ShareActionState> {
  const sources = fd.getAll('sources').map(String).filter(isCalendarSource);
  if (sources.length === 0) return { error: 'Vyber aspoň jeden druh termínů.' };
  const expires = str(fd, 'expiresOn');
  let expiresAt: string | undefined;
  if (expires) {
    // Platí do konce zvoleného dne (čas firmy).
    const iso = localToIso(`${nextDay(expires)}T00:00`);
    if (!iso) return { error: 'Neplatné datum konce platnosti.' };
    expiresAt = iso;
  }
  try {
    const res = await apiFetch<{ share: CalendarShareDto; token: string }>('/calendar/shares', {
      method: 'POST',
      body: JSON.stringify({ label: str(fd, 'label') || undefined, sources, expiresAt }),
    });
    revalidatePath(PATH);
    return { ok: true, message: 'Odkaz vytvořen.', token: res.token };
  } catch (e) {
    return fail(e);
  }
}

export async function revokeCalendarShare(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await apiFetch(`/calendar/shares/${str(fd, 'id')}/revoke`, { method: 'POST' });
    revalidatePath(PATH);
    return { ok: true, message: 'Odkaz zneplatněn.' };
  } catch (e) {
    return fail(e);
  }
}
