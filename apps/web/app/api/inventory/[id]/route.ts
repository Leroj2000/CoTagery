import { apiBase, getAccessToken } from '../../../lib/session';

/** BFF proxy: detail inventury (živý refresh po skenu). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });
  const { id } = await params;
  const res = await fetch(`${apiBase()}/api/v1/inventory/${id}`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': 'application/json' },
  });
}
