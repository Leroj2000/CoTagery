import { apiBase, getAccessToken } from '../../../../../lib/session';

/** BFF proxy: zápis stavu tachometru / poznámky k vozidlu v inventuře. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; assetId: string }> },
): Promise<Response> {
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });
  const { id, assetId } = await params;
  const uuid = /^[0-9a-f-]{36}$/i;
  if (!uuid.test(id) || !uuid.test(assetId)) return new Response('Not found', { status: 404 });
  const res = await fetch(`${apiBase()}/api/v1/inventory/${id}/vehicles/${assetId}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: await req.text(),
    cache: 'no-store',
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': 'application/json' },
  });
}
