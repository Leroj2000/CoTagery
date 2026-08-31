import { apiBase, getAccessToken } from '../../../../lib/session';

/** BFF: smazání osobního kódu z klíčenky. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });
  const res = await fetch(`${apiBase()}/api/v1/wallet/codes/${id}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}` },
  });
  return new Response(await res.text(), { status: res.status });
}
