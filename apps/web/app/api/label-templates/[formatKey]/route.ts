import { apiBase, getAccessToken } from '../../../lib/session';

/**
 * BFF proxy: PUT uloží šablonu formátu (nebo `default-format` = výchozí formát),
 * DELETE vrátí formát na výchozí šablonu.
 */
async function forward(
  method: 'PUT' | 'DELETE',
  req: Request,
  params: Promise<{ formatKey: string }>,
): Promise<Response> {
  const { formatKey } = await params;
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });
  const res = await fetch(`${apiBase()}/api/v1/label-templates/${encodeURIComponent(formatKey)}`, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: method === 'PUT' ? await req.text() : undefined,
  });
  return new Response(res.body, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

export function PUT(req: Request, { params }: { params: Promise<{ formatKey: string }> }) {
  return forward('PUT', req, params);
}

export function DELETE(req: Request, { params }: { params: Promise<{ formatKey: string }> }) {
  return forward('DELETE', req, params);
}
