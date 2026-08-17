import { apiBase, getAccessToken } from '../../../lib/session';

/** BFF proxy: potvrzení workflow → hromadný pohyb (/assets/movements/bulk). */
export async function POST(req: Request): Promise<Response> {
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });

  const body = await req.text();
  const res = await fetch(`${apiBase()}/api/v1/assets/movements/bulk`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body,
    cache: 'no-store',
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': 'application/json' },
  });
}
