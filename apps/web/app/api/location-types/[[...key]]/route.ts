import { apiBase, getAccessToken } from '../../../lib/session';

/** BFF: číselník typů míst firmy (čtení pro výběr, správa v Místa → Typy míst). */
async function forward(
  req: Request,
  { params }: { params: Promise<{ key?: string[] }> },
): Promise<Response> {
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });
  const { key = [] } = await params;
  if (key.length > 1 || key.some((k) => !/^[a-z][a-z0-9_]{1,40}$/.test(k)))
    return new Response('Not found', { status: 404 });
  const hasBody = req.method === 'POST' || req.method === 'PATCH';
  const res = await fetch(`${apiBase()}/api/v1/location-types${key.length ? `/${key[0]}` : ''}`, {
    method: req.method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(hasBody ? { 'content-type': 'application/json' } : {}),
    },
    body: hasBody ? await req.text() : undefined,
    cache: 'no-store',
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': 'application/json' },
  });
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const DELETE = forward;
