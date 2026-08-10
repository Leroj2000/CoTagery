import { cookies } from 'next/headers';
import { jwtMaxAge } from './jwt';

/** httpOnly session cookies (BFF): token nikdy neopustí server, není v JS. */
export const ACCESS_COOKIE = 'tg_at';
export const REFRESH_COOKIE = 'tg_rt';

const ACCESS_FALLBACK = 15 * 60; // 15m
const REFRESH_FALLBACK = 30 * 24 * 60 * 60; // 30d

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const isProd = process.env.NODE_ENV === 'production';

/** Interní base URL API pro server-to-server volání (BFF). */
export function apiBase(): string {
  return process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}

/** Uloží access/refresh do httpOnly cookies s životností dle exp tokenů. */
export async function setSessionCookies(tokens: TokenPair): Promise<void> {
  const store = await cookies();
  const common = { httpOnly: true, secure: isProd, sameSite: 'lax' as const, path: '/' };
  store.set(ACCESS_COOKIE, tokens.accessToken, {
    ...common,
    maxAge: jwtMaxAge(tokens.accessToken, ACCESS_FALLBACK),
  });
  store.set(REFRESH_COOKIE, tokens.refreshToken, {
    ...common,
    maxAge: jwtMaxAge(tokens.refreshToken, REFRESH_FALLBACK),
  });
}

/** Smaže session cookies (odhlášení). */
export async function clearSessionCookies(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

export async function getAccessToken(): Promise<string | undefined> {
  return (await cookies()).get(ACCESS_COOKIE)?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  return (await cookies()).get(REFRESH_COOKIE)?.value;
}
