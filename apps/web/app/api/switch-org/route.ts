import { NextResponse } from 'next/server';
import { apiBase, getAccessToken, setSessionCookies, type TokenPair } from '../../lib/session';

/**
 * BFF přepnutí aktivní organizace: zavolá NestJS /auth/switch-org s aktuálním
 * Bearerem (z httpOnly cookie), vydané tokeny pro zvolenou org uloží zpět do
 * cookies. Server komponenty se pak načtou pod novou organizací.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ error: 'Nepřihlášeno' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { organizationId?: string };
  if (!body.organizationId) {
    return NextResponse.json({ error: 'Chybí organizationId' }, { status: 400 });
  }

  const res = await fetch(`${apiBase()}/api/v1/auth/switch-org`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ organizationId: body.organizationId }),
  });
  if (!res.ok) {
    return NextResponse.json({ error: 'Přepnutí se nepodařilo' }, { status: res.status });
  }

  const tokens = (await res.json()) as TokenPair;
  await setSessionCookies(tokens);
  return NextResponse.json({ ok: true });
}
