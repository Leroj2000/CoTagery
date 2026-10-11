import { apiBase, getAccessToken } from '../../../lib/session';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
/** Povolené cesty – proxy nesmí otevřít libovolný endpoint API. */
const ALLOWED = [
  new RegExp(`^assets/${UUID}/(purchase|documents|warranties)$`, 'i'),
  new RegExp(`^documents/${UUID}(/file)?$`, 'i'),
  new RegExp(`^warranties/${UUID}$`, 'i'),
  /^warranties\/expiring$/,
];

/**
 * BFF pořízení, dokladů a záruk položky. Přeposílá JSON i multipart (upload
 * dokladu) a binární odpověď (soubor dokladu) s Bearer tokenem ze session.
 */
async function proxy(req: Request, params: Promise<{ path: string[] }>): Promise<Response> {
  const path = (await params).path.join('/');
  if (!ALLOWED.some((re) => re.test(path))) return new Response('Not found', { status: 404 });
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });

  const headers: Record<string, string> = { authorization: `Bearer ${token}` };
  const contentType = req.headers.get('content-type');
  if (contentType) headers['content-type'] = contentType;
  const hasBody = req.method !== 'GET' && req.method !== 'DELETE';
  const search = new URL(req.url).search;
  const res = await fetch(`${apiBase()}/api/v1/${path}${search}`, {
    method: req.method,
    headers,
    body: hasBody ? await req.arrayBuffer() : undefined,
    cache: 'no-store',
  });

  const out = new Headers();
  for (const h of ['content-type', 'content-disposition']) {
    const v = res.headers.get(h);
    if (v) out.set(h, v);
  }
  out.set('cache-control', 'private, no-store');
  return new Response(res.status === 204 ? null : res.body, { status: res.status, headers: out });
}

type Ctx = { params: Promise<{ path: string[] }> };
export const GET = (req: Request, { params }: Ctx) => proxy(req, params);
export const POST = (req: Request, { params }: Ctx) => proxy(req, params);
export const PUT = (req: Request, { params }: Ctx) => proxy(req, params);
export const DELETE = (req: Request, { params }: Ctx) => proxy(req, params);
