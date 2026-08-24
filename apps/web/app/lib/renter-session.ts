import { cookies } from 'next/headers';
import { apiBase } from './session';
import { jwtMaxAge } from './jwt';

/**
 * Session nájemce (EPIC-19 F2) – oddělená od org admin session. httpOnly cookie
 * `tg_renter` drží renter token (scope='renter'); token nikdy neopustí server.
 */
export const RENTER_COOKIE = 'tg_renter';

const RENTER_FALLBACK = 7 * 24 * 60 * 60; // 7d

const cookieSecure =
  process.env.COOKIE_SECURE !== undefined
    ? process.env.COOKIE_SECURE === 'true'
    : process.env.NODE_ENV === 'production';

export async function setRenterCookie(accessToken: string): Promise<void> {
  const store = await cookies();
  store.set(RENTER_COOKIE, accessToken, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: jwtMaxAge(accessToken, RENTER_FALLBACK),
  });
}

export async function clearRenterCookie(): Promise<void> {
  (await cookies()).delete(RENTER_COOKIE);
}

export async function getRenterToken(): Promise<string | undefined> {
  return (await cookies()).get(RENTER_COOKIE)?.value;
}

export interface RenterInfo {
  id: string;
  email: string;
  name: string;
}

/** Vrátí přihlášeného nájemce (ověří token přes API /renter/auth/me), nebo null. */
export async function getRenter(): Promise<RenterInfo | null> {
  const token = await getRenterToken();
  if (!token) return null;
  const res = await fetch(`${apiBase()}/api/v1/renter/auth/me`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return (await res.json()) as RenterInfo;
}
