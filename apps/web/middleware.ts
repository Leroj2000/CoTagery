import { NextResponse, type NextRequest } from 'next/server';
import { jwtMaxAge } from './app/lib/jwt';

const ACCESS_COOKIE = 'tg_at';
const REFRESH_COOKIE = 'tg_rt';
const ACCESS_FALLBACK = 15 * 60;
const REFRESH_FALLBACK = 30 * 24 * 60 * 60;

function apiBase(): string {
  return process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}

// COOKIE_SECURE override (viz session.ts) – vypnutelné pro demo přes plain http.
const COOKIE_SECURE =
  process.env.COOKIE_SECURE !== undefined
    ? process.env.COOKIE_SECURE === 'true'
    : process.env.NODE_ENV === 'production';

const COOKIE_COMMON = {
  httpOnly: true,
  secure: COOKIE_SECURE,
  sameSite: 'lax' as const,
  path: '/',
};

/** Je request jen prefetch (Next Router)? Na těch session neobnovujeme. */
function isPrefetch(req: NextRequest): boolean {
  return (
    req.headers.get('next-router-prefetch') === '1' ||
    req.headers.get('purpose') === 'prefetch' ||
    (req.headers.get('sec-purpose') ?? '').includes('prefetch')
  );
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF ochrana BFF route handlerů (`/api/*`): mutace jedou přes httpOnly cookie,
 * které prohlížeč přiloží i při cross-site requestu (SameSite=Lax chrání jen
 * top-level navigaci, ne `fetch`/formulář z jiného originu). Pro nebezpečné
 * metody proto explicitně ověříme, že request vznikl na stejném originu – přes
 * `Sec-Fetch-Site` (moderní prohlížeče), s fallbackem na `Origin` vs. `Host`.
 * Request bez obou signálů (ne-browser klient) zamítáme – bezpečný default.
 */
function isSameOriginRequest(req: NextRequest): boolean {
  const secFetchSite = req.headers.get('sec-fetch-site');
  if (secFetchSite) return secFetchSite === 'same-origin' || secFetchSite === 'none';

  const origin = req.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host === req.headers.get('host');
  } catch {
    return false;
  }
}

function csrfRejected(req: NextRequest): NextResponse | null {
  if (SAFE_METHODS.has(req.method)) return null;
  if (isSameOriginRequest(req)) return null;
  return NextResponse.json({ error: 'CSRF: požadavek odmítnut (cizí origin)' }, { status: 403 });
}

/**
 * Chrání /admin/*. Přístupový token má krátkou životnost (cookie zmizí ~s exp);
 * když chybí, ale je refresh token, middleware tiše obnoví session (rotace) a
 * nastaví nové httpOnly cookies. Bez refresh tokenu → redirect na /login.
 *
 * Dvě úskalí BFF refreshe, která tu řešíme:
 * 1) Nové cookies nastavíme i na *request* (přes `next({ request })`), aby je
 *    viděl už aktuální render (jinak by getMe token nenašel → bounce na /login).
 * 2) Prefetch requesty session NEobnovují – paralelní prefetch by rotoval
 *    refresh token vícekrát a spustil serverovou reuse-detekci → odhlášení.
 */
export async function middleware(req: NextRequest): Promise<NextResponse> {
  if (req.nextUrl.pathname.startsWith('/api/')) {
    const rejected = csrfRejected(req);
    if (rejected) return rejected;
    return NextResponse.next();
  }

  const access = req.cookies.get(ACCESS_COOKIE)?.value;
  if (access) return NextResponse.next();

  const refresh = req.cookies.get(REFRESH_COOKIE)?.value;
  const loginUrl = new URL('/login', req.url);
  // Včetně query (např. `/admin/scan?code=…&auto=1`), ať se po přihlášení vrátí přesně sem.
  loginUrl.searchParams.set('from', req.nextUrl.pathname + req.nextUrl.search);

  if (!refresh) return NextResponse.redirect(loginUrl);

  // Prefetch bez access cookie neobnovujeme (viz úskalí 2) – jen propustíme.
  if (isPrefetch(req)) return NextResponse.next();

  try {
    const res = await fetch(`${apiBase()}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    if (!res.ok) {
      const redirect = NextResponse.redirect(loginUrl);
      redirect.cookies.delete(REFRESH_COOKIE);
      return redirect;
    }
    const tokens = (await res.json()) as { accessToken: string; refreshToken: string };

    // (1) Propagace do aktuálního renderu: nastavíme na request a předáme headers.
    req.cookies.set(ACCESS_COOKIE, tokens.accessToken);
    req.cookies.set(REFRESH_COOKIE, tokens.refreshToken);
    const next = NextResponse.next({ request: { headers: req.headers } });

    // A do prohlížeče (s životností dle exp tokenů).
    next.cookies.set(ACCESS_COOKIE, tokens.accessToken, {
      ...COOKIE_COMMON,
      maxAge: jwtMaxAge(tokens.accessToken, ACCESS_FALLBACK),
    });
    next.cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
      ...COOKIE_COMMON,
      maxAge: jwtMaxAge(tokens.refreshToken, REFRESH_FALLBACK),
    });
    return next;
  } catch {
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: ['/admin/:path*', '/platform/:path*', '/api/:path*'],
};
