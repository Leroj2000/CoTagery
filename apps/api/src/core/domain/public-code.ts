import { randomBytes } from 'node:crypto';

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * Veřejný identifikátor nosiče do URL (ADR-0003): base62, náhodný, nesekvenční.
 * Délka 12 ≈ 71 bitů entropie → bezpečné proti enumeraci i při milionech nosičů.
 */
export function generatePublicCode(length = 12): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}
