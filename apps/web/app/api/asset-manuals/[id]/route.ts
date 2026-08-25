import { apiBase, getAccessToken } from '../../../lib/session';

/** BFF manuálů položky: GET seznam, POST upload souboru / fotky z kamery. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });
  const res = await fetch(`${apiBase()}/api/v1/assets/${id}/manuals`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return new Response('Chybí soubor', { status: 400 });
  const source = form.get('source');

  const fwd = new FormData();
  fwd.append('file', file, file.name);
  if (typeof source === 'string') fwd.append('source', source);

  const res = await fetch(`${apiBase()}/api/v1/assets/${id}/manuals`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: fwd,
  });
  return new Response(res.body, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}
