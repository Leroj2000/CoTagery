import { apiBase, getAccessToken } from '../../lib/session';

/** BFF proxy pro vytvoření osoby (vrací JSON včetně id pro následný upload fotky). */
export async function POST(req: Request): Promise<Response> {
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });

  const body = await req.text();
  const res = await fetch(`${apiBase()}/api/v1/people`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body,
  });
  return new Response(res.body, {
    status: res.status,
    headers: { 'content-type': 'application/json' },
  });
}
