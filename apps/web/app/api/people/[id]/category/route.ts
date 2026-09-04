import { apiBase, getAccessToken } from '../../../../lib/session';

/** BFF: nastavení kategorií Party osoby (many-to-many, {categoryIds}). */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });
  const { categoryIds } = (await req.json()) as { categoryIds?: string[] };
  const res = await fetch(`${apiBase()}/api/v1/people/${id}/categories`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ categoryIds: categoryIds ?? [] }),
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': 'application/json' },
  });
}
