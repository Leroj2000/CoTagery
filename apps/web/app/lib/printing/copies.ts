import { COPIES_MAX, COPIES_MIN } from './niimbot-config';

/**
 * Ořízne počet kopií do povoleného rozsahu 1–99 (sekce 5/13 zadání).
 * Neplatné/prázdné vstupy spadnou na minimum.
 */
export function clampCopies(value: number | string): number {
  const n = typeof value === 'string' ? parseInt(value, 10) : Math.trunc(value);
  if (!Number.isFinite(n) || Number.isNaN(n)) return COPIES_MIN;
  if (n < COPIES_MIN) return COPIES_MIN;
  if (n > COPIES_MAX) return COPIES_MAX;
  return n;
}

/** Je počet kopií platný (celé číslo v rozsahu 1–99)? */
export function isValidCopies(value: number): boolean {
  return Number.isInteger(value) && value >= COPIES_MIN && value <= COPIES_MAX;
}
