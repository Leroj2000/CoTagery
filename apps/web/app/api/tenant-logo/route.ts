import { apiBase, getAccessToken } from '../../lib/session';

/** BFF proxy loga firmy – GET obrázek (pro QR/štítky), POST upload PNG, DELETE smazání. */
export async function GET(): Promise<Response> {
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });
  const res = await fetch(`${apiBase()}/api/v1/tenant/logo`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return new Response('Not found', { status: res.status });
  return new Response(res.body, {
    headers: { 'content-type': 'image/png', 'cache-control': 'private, no-cache' },
  });
}

export async function POST(req: Request): Promise<Response> {
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return new Response('Chybí soubor', { status: 400 });
  const fwd = new FormData();
  fwd.append('file', file, file.name);
  const res = await fetch(`${apiBase()}/api/v1/tenant/logo`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: fwd,
  });
  return new Response(res.body, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

export async function DELETE(): Promise<Response> {
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });
  const res = await fetch(`${apiBase()}/api/v1/tenant/logo`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}` },
  });
  return new Response(res.body, { status: res.status });
}
