import { apiBase, getAccessToken } from '../../../../lib/session';

/** BFF proxy: uzavření inventury a spočítání výsledku. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });
  const { id } = await params;
  const res = await fetch(`${apiBase()}/api/v1/inventory/${id}/close`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': 'application/json' },
  });
}
