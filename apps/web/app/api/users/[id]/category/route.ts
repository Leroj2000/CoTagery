import { apiBase, getAccessToken } from '../../../../lib/session';

/** BFF: změna kategorie uživatele v aktuální firmě ({categoryId | null}). */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });
  const { categoryId } = (await req.json()) as { categoryId?: string | null };
  const res = await fetch(`${apiBase()}/api/v1/users/${id}/category`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ categoryId: categoryId ?? null }),
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': 'application/json' },
  });
}
