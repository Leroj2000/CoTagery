import { apiBase, getAccessToken } from '../../../../lib/session';

/** BFF konkrétní fotky galerie: GET streamuje soubor, DELETE smaže. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> },
): Promise<Response> {
  const { id, photoId } = await params;
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });
  const res = await fetch(`${apiBase()}/api/v1/assets/${id}/photos/${photoId}/file`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return new Response('Not found', { status: res.status });
  return new Response(res.body, {
    headers: {
      'content-type': res.headers.get('content-type') ?? 'image/jpeg',
      'cache-control': 'private, max-age=60',
    },
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> },
): Promise<Response> {
  const { id, photoId } = await params;
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });
  const res = await fetch(`${apiBase()}/api/v1/assets/${id}/photos/${photoId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}` },
  });
  return new Response(null, { status: res.status });
}
