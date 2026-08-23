import { apiBase, getAccessToken } from '../../lib/session';

/** BFF inzeráty půjčovny (admin): GET seznam, POST vytvoření. */
export async function GET(): Promise<Response> {
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });
  const res = await fetch(`${apiBase()}/api/v1/rental-listings`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function POST(req: Request): Promise<Response> {
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });
  const res = await fetch(`${apiBase()}/api/v1/rental-listings`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: await req.text(),
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': 'application/json' },
  });
}
