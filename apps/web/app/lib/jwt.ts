/**
 * Minimální dekódování JWT payloadu (bez ověření podpisu – token je náš vlastní
 * a drží se v httpOnly cookie). Funguje v Node i Edge runtime (atob). Slouží jen
 * k vyčtení `exp` pro nastavení životnosti cookie.
 */
export function jwtExpSeconds(token: string): number | null {
  try {
    const part = token.split('.')[1];
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const json = JSON.parse(atob(padded)) as { exp?: number };
    return typeof json.exp === 'number' ? json.exp : null;
  } catch {
    return null;
  }
}

/** Zbývající životnost tokenu v sekundách (min. 0), s fallbackem. */
export function jwtMaxAge(token: string, fallbackSeconds: number): number {
  const exp = jwtExpSeconds(token);
  if (exp === null) return fallbackSeconds;
  return Math.max(0, exp - Math.floor(Date.now() / 1000));
}
