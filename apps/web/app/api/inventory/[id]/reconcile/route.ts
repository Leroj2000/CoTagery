import { apiBase, getAccessToken } from '../../../../lib/session';

/** BFF proxy: reconcile „navíc" věci – přesun evidence do inventarizovaného místa. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });
  const { id } = await params;
  const body = await req.text();
  const res = await fetch(`${apiBase()}/api/v1/inventory/${id}/reconcile`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body,
    cache: 'no-store',
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': 'application/json' },
  });
}
