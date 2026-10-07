import { apiBase, getAccessToken } from '../../lib/session';

/** BFF proxy: šablony štítků firmy (výchozí formát + šablona pro každý formát). */
export async function GET(): Promise<Response> {
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });
  const res = await fetch(`${apiBase()}/api/v1/label-templates`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  return new Response(res.body, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}
