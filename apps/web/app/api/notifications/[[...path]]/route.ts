import { apiBase, getAccessToken } from '../../../lib/session';

/** BFF: Nastavení → Notifikace (přístup owner / manager s povolením hlídá API). */
async function forward(
  req: Request,
  { params }: { params: Promise<{ path?: string[] }> },
): Promise<Response> {
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });
  const { path = [] } = await params;
  if (path.length > 2 || path.some((p) => !/^[a-z][a-z0-9_-]{0,40}$/.test(p)))
    return new Response('Not found', { status: 404 });
  const hasBody = req.method === 'POST' || req.method === 'PUT';
  const res = await fetch(
    `${apiBase()}/api/v1/notifications${path.length ? `/${path.join('/')}` : ''}`,
    {
      method: req.method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(hasBody ? { 'content-type': 'application/json' } : {}),
      },
      body: hasBody ? await req.text() : undefined,
      cache: 'no-store',
    },
  );
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': 'application/json' },
  });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
