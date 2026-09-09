import { apiBase, getAccessToken } from '../../../../../lib/session';

/** BFF: uloží ohnisko náhledu fotky (v procentech). */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> },
): Promise<Response> {
  const { id, photoId } = await params;
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });
  const body = await req.text();
  const res = await fetch(`${apiBase()}/api/v1/assets/${id}/photos/${photoId}/preview`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body,
  });
  return new Response(null, { status: res.status });
}
