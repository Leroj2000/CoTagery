import { apiBase, getAccessToken } from '../../lib/session';

/** Přepošle požadavek na API `/roles…` s Bearer tokenem ze session cookie. */
export async function proxyRoles(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  req?: Request,
): Promise<Response> {
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });
  const res = await fetch(`${apiBase()}/api/v1/roles${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: req && (method === 'POST' || method === 'PUT') ? await req.text() : undefined,
    cache: 'no-store',
  });
  return new Response(res.body, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}
