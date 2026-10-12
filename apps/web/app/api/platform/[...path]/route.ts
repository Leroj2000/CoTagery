import { apiBase, getAccessToken } from '../../../lib/session';

/**
 * BFF platform-admin: předplatné firem, úrovně, faktury, nastavení. Oprávnění
 * (is_platform_admin) vynucuje API; tady jen bezpečné přeposlání cesty.
 */
async function forward(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });
  const { path } = await params;
  if (!path.length || path.some((p) => !/^[A-Za-z0-9_-]+$/.test(p)))
    return new Response('Not found', { status: 404 });
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const res = await fetch(`${apiBase()}/api/v1/platform/${path.join('/')}`, {
    method: req.method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(hasBody ? { 'content-type': 'application/json' } : {}),
    },
    body: hasBody ? await req.text() : undefined,
    cache: 'no-store',
  });
  const type = res.headers.get('content-type') ?? 'application/json';
  return new Response(res.body, {
    status: res.status,
    headers: {
      'content-type': type,
      'cache-control': 'private, no-store',
      ...(res.headers.get('content-disposition')
        ? { 'content-disposition': res.headers.get('content-disposition')! }
        : {}),
    },
  });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
