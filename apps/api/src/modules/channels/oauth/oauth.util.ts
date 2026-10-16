import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const OAUTH_SCOPE = 'mcp';
export const ACCESS_TOKEN_TTL_SEC = 3600;
export const REFRESH_TOKEN_TTL_DAYS = 30;
export const CODE_TTL_SEC = 300;

/** Výchozí povolené hostitele redirect URI (ChatGPT a Claude konektory). */
export const DEFAULT_REDIRECT_HOSTS = [
  'chatgpt.com',
  'chat.openai.com',
  'platform.openai.com',
  'claude.ai',
  'claude.com',
];

export function oauthHash(value: string): string {
  return createHash('sha256').update(`oauth:${value}`).digest('hex');
}

export function randomToken(prefix: string, bytes = 32): string {
  return prefix + randomBytes(bytes).toString('base64url');
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** PKCE S256 (RFC 7636): BASE64URL(SHA256(verifier)) === challenge. */
export function verifyPkce(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  const computed = createHash('sha256').update(verifier).digest('base64url');
  return safeEqual(computed, challenge);
}

export function isValidChallenge(challenge: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(challenge);
}

/**
 * Redirect URI z dynamické registrace: https na povoleném hostiteli (nebo jeho
 * subdoméně), případně http jen na loopback (desktopoví/CLI klienti, RFC 8252).
 * Fragment ani uživatelské údaje nejsou povolené.
 */
export function isAllowedRedirectUri(uri: string, allowedHosts: string[]): boolean {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.hash || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  if (url.protocol === 'http:') {
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  }
  if (url.protocol !== 'https:') return false;
  return allowedHosts.some((h) => host === h || host.endsWith(`.${h}`));
}

/** Požadovaný scope → normalizovaný; null = neplatný (podporujeme jen `mcp`). */
export function normalizeScope(scope: string | undefined | null): string | null {
  const parts = (scope ?? '').split(/\s+/).filter(Boolean);
  if (parts.length === 0) return OAUTH_SCOPE;
  return parts.every((p) => p === OAUTH_SCOPE) ? OAUTH_SCOPE : null;
}

/** Shoda resource indikátoru (RFC 8707) s naším MCP serverem; tolerujeme koncové lomítko. */
export function resourceMatches(requested: string | undefined | null, resource: string): boolean {
  if (!requested) return true;
  return requested.replace(/\/+$/, '') === resource.replace(/\/+$/, '');
}

export function appendQuery(uri: string, params: Record<string, string | undefined>): string {
  const url = new URL(uri);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, v);
  return url.toString();
}
