import { NextResponse } from 'next/server';
import { apiBase } from '../../../lib/session';

/** BFF: žádost o reset hesla (veřejné). Vždy 200 (nezveřejňuje existenci účtu). */
export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => ({}))) as { email?: string };
  await fetch(`${apiBase()}/api/v1/auth/password-reset/request`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: body.email ?? '' }),
  }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
