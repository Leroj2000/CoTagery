import { NextResponse } from 'next/server';
import { apiBase, setSessionCookies, type TokenPair } from '../../../lib/session';

/**
 * BFF login: přijme {email,password}, zavolá NestJS /auth/login a uloží
 * získané tokeny do httpOnly cookies. Prohlížeč token nikdy nevidí.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  if (!body.email || !body.password) {
    return NextResponse.json({ error: 'Chybí e-mail nebo heslo' }, { status: 400 });
  }

  const res = await fetch(`${apiBase()}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: body.email, password: body.password }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: 'Neplatné přihlašovací údaje' }, { status: 401 });
  }

  const tokens = (await res.json()) as TokenPair;
  await setSessionCookies(tokens);
  return NextResponse.json({ ok: true });
}
