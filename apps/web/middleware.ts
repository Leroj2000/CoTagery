import { NextResponse, type NextRequest } from 'next/server';
import { jwtMaxAge } from './app/lib/jwt';

const ACCESS_COOKIE = 'tg_at';
const REFRESH_COOKIE = 'tg_rt';
const ACCESS_FALLBACK = 15 * 60;
const REFRESH_FALLBACK = 30 * 24 * 60 * 60;

function apiBase(): string {
  return process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}

/**
 * Chrání /admin/*. Přístupový token má krátkou životnost (cookie zmizí ~s exp);
 * když chybí, ale je refresh token, middleware tiše obnoví session (rotace) a
 * nastaví nové httpOnly cookies. Bez refresh tokenu → redirect na /login.
 */
export async function middleware(req: NextRequest): Promise<NextResponse> {
  const access = req.cookies.get(ACCESS_COOKIE)?.value;
  if (access) return NextResponse.next();

  const refresh = req.cookies.get(REFRESH_COOKIE)?.value;
  const loginUrl = new URL('/login', req.url);
  loginUrl.searchParams.set('from', req.nextUrl.pathname);

  if (!refresh) return NextResponse.redirect(loginUrl);

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
    const next = NextResponse.next();
    const common = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
    };
    next.cookies.set(ACCESS_COOKIE, tokens.accessToken, {
      ...common,
      maxAge: jwtMaxAge(tokens.accessToken, ACCESS_FALLBACK),
    });
    next.cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
      ...common,
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
