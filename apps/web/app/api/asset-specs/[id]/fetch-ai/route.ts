import { apiBase, getAccessToken } from '../../../../lib/session';

/** BFF: spustí AI dohledání technických specifikací k položce. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });
  const res = await fetch(`${apiBase()}/api/v1/assets/${id}/specs/fetch-ai`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': 'application/json' },
  });
}
