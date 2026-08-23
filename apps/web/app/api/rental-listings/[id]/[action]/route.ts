import { apiBase, getAccessToken } from '../../../../lib/session';

/** BFF publikace inzerátu: POST publish | unpublish. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; action: string }> },
): Promise<Response> {
  const { id, action } = await params;
  if (action !== 'publish' && action !== 'unpublish') {
    return new Response('Neznámá akce', { status: 400 });
  }
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });
  const res = await fetch(`${apiBase()}/api/v1/rental-listings/${id}/${action}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': 'application/json' },
  });
}
