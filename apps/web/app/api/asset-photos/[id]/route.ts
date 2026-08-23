import { apiBase, getAccessToken } from '../../../lib/session';

/** BFF galerie fotek věci: GET seznam (+ limit), POST přidání jedné/více fotek. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });
  const res = await fetch(`${apiBase()}/api/v1/assets/${id}/photos`, {
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
  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (files.length === 0) return new Response('Chybí soubor', { status: 400 });

  const fwd = new FormData();
  for (const f of files) fwd.append('files', f, f.name);
  const res = await fetch(`${apiBase()}/api/v1/assets/${id}/photos`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: fwd,
  });
  return new Response(res.body, { status: res.status });
}
