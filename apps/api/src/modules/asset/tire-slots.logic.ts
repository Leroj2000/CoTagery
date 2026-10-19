import { TIRE_BOOKING_CUTOFF_HOURS, type TireSlotSeason } from '@tagery/shared';

/** Čisté funkce pravidel termínů přezutí (testované v tire-slots.logic.spec.ts). */

export const CUTOFF_MS = TIRE_BOOKING_CUTOFF_HOURS * 60 * 60 * 1000;
export const MAX_SLOTS_PER_REQUEST = 100;

/** Uzávěrka: v posledních 24 h před začátkem už nejde rezervovat ani rušit. */
export function withinCutoff(startsAt: Date, now: Date): boolean {
  return startsAt.getTime() - now.getTime() < CUTOFF_MS;
}

/** Rozdělí interval [start, end) na sloty délky `durationMin` (zbytek se zahodí). */
export function generateSlotTimes(
  start: Date,
  end: Date,
  durationMin: number,
): { startsAt: Date; endsAt: Date }[] {
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    throw new Error('Neplatný začátek nebo konec.');
  }
  if (!Number.isInteger(durationMin) || durationMin < 5 || durationMin > 24 * 60) {
    throw new Error('Délka termínu musí být 5 až 1440 minut.');
  }
  if (end <= start) throw new Error('Konec musí být po začátku.');
  const step = durationMin * 60_000;
  const out: { startsAt: Date; endsAt: Date }[] = [];
  for (let t = start.getTime(); t + step <= end.getTime(); t += step) {
    out.push({ startsAt: new Date(t), endsAt: new Date(t + step) });
    if (out.length > MAX_SLOTS_PER_REQUEST) {
      throw new Error(`Najednou jde vypsat nejvýš ${MAX_SLOTS_PER_REQUEST} termínů.`);
    }
  }
  if (!out.length) throw new Error('Do zvoleného rozmezí se nevejde žádný termín.');
  return out;
}

export interface EligibilityInput {
  isManager: boolean;
  /** Osoba přihlášeného uživatele (null = účet není spojený s osobou). */
  personId: string | null;
  holderType: string | null;
  holderId: string | null;
  responsiblePersonId: string | null;
  equipmentKind: string | null | undefined;
}

/**
 * Smí uživatel rezervovat přezutí pro vozidlo? Vrací null (smí) nebo důvod.
 * Pravidla: jen kategorie „vozidlo“; správce vždy; jinak současný držitel nebo
 * odpovědná osoba. Vozidlo bez držitele osoby (na místě) rezervuje jen správce.
 */
export function bookingDenial(i: EligibilityInput): string | null {
  if (i.equipmentKind !== 'vehicle') return 'Přezutí jde rezervovat jen pro vozidla.';
  if (i.isManager) return null;
  if (!i.personId) {
    return 'Účet není jednoznačně spojený s osobou. Požádej správce o kontrolu e-mailu u osoby.';
  }
  const holderPerson = i.holderType === 'person' ? i.holderId : null;
  if (holderPerson === i.personId || i.responsiblePersonId === i.personId) return null;
  if (!holderPerson && !i.responsiblePersonId) {
    return 'Vozidlo nemá držitele – termín přezutí zarezervuje správce vozového parku.';
  }
  return 'Termín přezutí rezervuje držitel vozidla nebo odpovědná osoba.';
}

/** Za koho se rezervace eviduje: držitel (osoba) → odpovědná osoba → uživatel. */
export function bookingPerson(i: EligibilityInput): string | null {
  if (i.holderType === 'person' && i.holderId) return i.holderId;
  return i.responsiblePersonId ?? i.personId;
}

export interface SlotState {
  startsAt: Date;
  cancelledAt: Date | null;
  capacity: number;
  booked: number;
}

/** Lze na termín rezervovat? null = ano, jinak důvod. */
export function slotDenial(slot: SlotState, now: Date, isManager: boolean): string | null {
  if (slot.cancelledAt) return 'Termín byl zrušen.';
  if (slot.startsAt <= now) return 'Termín už proběhl.';
  if (!isManager && withinCutoff(slot.startsAt, now)) {
    return `Rezervovat jde nejpozději ${TIRE_BOOKING_CUTOFF_HOURS} h před začátkem termínu.`;
  }
  if (slot.booked >= slot.capacity) return 'Termín je už obsazený.';
  return null;
}

/** Lze rezervaci zrušit/přesunout pryč z termínu? null = ano, jinak důvod. */
export function cancelDenial(
  booking: { status: string; startsAt: Date },
  now: Date,
  isManager: boolean,
): string | null {
  if (booking.status !== 'booked') return 'Rezervace už není aktivní.';
  if (!isManager && withinCutoff(booking.startsAt, now)) {
    return 'Změnit nebo zrušit termín jde nejpozději 24 h před začátkem. Domluv se se správcem.';
  }
  return null;
}

/**
 * Sada pneumatik k namontování při „Hotovo“: sada se sezónou termínu; přednost
 * má ta, která ještě není na kolech, pak abecedně. null = žádná taková sada.
 */
export function pickSeasonSet(
  rows: { setLabel: string; season: string; mounted: boolean }[],
  season: TireSlotSeason | null,
): string | null {
  if (!season) return null;
  const sets = new Map<string, boolean>();
  for (const r of rows) {
    if (r.season !== season) continue;
    sets.set(r.setLabel, (sets.get(r.setLabel) ?? false) || r.mounted);
  }
  if (!sets.size) return null;
  const sorted = [...sets.entries()].sort(
    (a, b) => Number(a[1]) - Number(b[1]) || a[0].localeCompare(b[0], 'cs'),
  );
  return sorted[0][0];
}
