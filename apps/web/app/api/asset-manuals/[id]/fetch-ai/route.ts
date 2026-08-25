import { apiBase, getAccessToken } from '../../../../lib/session';

/** BFF: spustí AI stažení manuálu k položce. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });
  const res = await fetch(`${apiBase()}/api/v1/assets/${id}/manuals/fetch-ai`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  });
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { 'content-type': 'application/json' },
  });
}
