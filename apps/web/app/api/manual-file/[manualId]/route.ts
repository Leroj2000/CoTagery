import { apiBase, getAccessToken } from '../../../lib/session';

/** BFF konkrétního manuálu: GET streamuje soubor, DELETE smaže. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ manualId: string }> },
): Promise<Response> {
  const { manualId } = await params;
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });
  const res = await fetch(`${apiBase()}/api/v1/manuals/${manualId}/file`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return new Response('Not found', { status: res.status });
  return new Response(res.body, {
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/octet-stream',
      'cache-control': 'private, max-age=60',
    },
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ manualId: string }> },
): Promise<Response> {
  const { manualId } = await params;
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });
  const res = await fetch(`${apiBase()}/api/v1/manuals/${manualId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}` },
  });
  return new Response(null, { status: res.status });
}
