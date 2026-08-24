import { apiBase } from '../../../../../lib/session';
import { getRenterToken } from '../../../../../lib/renter-session';

/** BFF: nájemce nahlásí poškození/poruchu na půjčené věci (EPIC-19 F3). */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const token = await getRenterToken();
  if (!token) return new Response('Unauthorized', { status: 401 });
  const res = await fetch(`${apiBase()}/api/v1/renter/orders/${id}/issue`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: await req.text(),
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': 'application/json' },
  });
}
