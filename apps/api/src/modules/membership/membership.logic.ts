import type { MembershipStatus } from './entities/membership.entity';

/**
 * Efektivní stav členství pro daný okamžik. Uložený stav (`suspended`,
 * `cancelled`) má přednost; jinak rozhoduje platnost do `validTo` s tolerancí
 * grace periody (dny po expiraci, kdy ještě pouštíme – dunning EPIC-17).
 *
 * `graceDays` se uplatní jen když je členství stále `active` (čeká na platbu);
 * ručně `cancelled`/`suspended` grace nedostává.
 */
export function computeEffectiveStatus(
  stored: MembershipStatus,
  validTo: Date,
  now: Date = new Date(),
  graceDays = 0,
): MembershipStatus {
  if (stored === 'suspended' || stored === 'cancelled') return stored;

  const graceMs = Math.max(0, graceDays) * 24 * 60 * 60 * 1000;
  if (now.getTime() <= validTo.getTime() + graceMs) return 'active';
  return 'expired';
}

/** Je členství právě teď platné (pustí do zóny / dá slevu)? */
export function isMembershipActive(
  stored: MembershipStatus,
  validTo: Date,
  now: Date = new Date(),
  graceDays = 0,
): boolean {
  return computeEffectiveStatus(stored, validTo, now, graceDays) === 'active';
}

/** Prodloužení platnosti o `days` od pozdějšího z {teď, stávající validTo}. */
export function extendValidTo(current: Date, days: number, now: Date = new Date()): Date {
  const base = current.getTime() > now.getTime() ? current : now;
  return new Date(base.getTime() + Math.max(0, days) * 24 * 60 * 60 * 1000);
}
