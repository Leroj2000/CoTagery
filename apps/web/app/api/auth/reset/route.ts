import { NextResponse } from 'next/server';
import { apiBase } from '../../../lib/session';

/** BFF: nastavení nového hesla dle tokenu (veřejné). */
export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => ({}))) as { token?: string; newPassword?: string };
  const res = await fetch(`${apiBase()}/api/v1/auth/password-reset/confirm`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: body.token ?? '', newPassword: body.newPassword ?? '' }),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { message?: string };
    return NextResponse.json({ error: j.message ?? 'Reset selhal' }, { status: res.status });
  }
  return NextResponse.json({ ok: true });
}
