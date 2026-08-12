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
  const access = req.cookies.get(ACCESS_COOKIE)?.value;
  if (access) return NextResponse.next();

  const refresh = req.cookies.get(REFRESH_COOKIE)?.value;
  const loginUrl = new URL('/login', req.url);
  loginUrl.searchParams.set('from', req.nextUrl.pathname);

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
  matcher: ['/admin/:path*'],
};
