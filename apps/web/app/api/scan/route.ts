import { apiBase, getAccessToken } from '../../lib/session';

/**
 * BFF proxy pro Global Scan. API `/scan?code=` vyžaduje JWT (Bearer), který
 * drží server v httpOnly cookie – klientský scanner ho nemá. Tudy protéká
 * s Bearerem a vrací JSON výsledek skenu.
 */
export async function GET(req: Request): Promise<Response> {
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });

  const code = new URL(req.url).searchParams.get('code') ?? '';
  const res = await fetch(`${apiBase()}/api/v1/scan?code=${encodeURIComponent(code)}`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { 'content-type': 'application/json' },
  });
}
