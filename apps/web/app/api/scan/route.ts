import { apiBase, getAccessToken } from '../../lib/session';

export async function POST(req: Request): Promise<Response> {
  const origin = req.headers.get('origin');
  const expectedOrigin = new URL(process.env.PUBLIC_WEB_URL ?? req.url).origin;
  if (origin && origin !== expectedOrigin) return new Response('Forbidden', { status: 403 });
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });
  const res = await fetch(`${apiBase()}/api/v1/scan`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: await req.text(),
    cache: 'no-store',
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': 'application/json' },
  });
}

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
