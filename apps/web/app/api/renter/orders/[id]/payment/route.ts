import { apiBase } from '../../../../../lib/session';
import { getRenterToken } from '../../../../../lib/renter-session';

/** BFF: pokyny k platbě objednávky nájemce (SPAYD + IBAN + VS). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const token = await getRenterToken();
  if (!token) return new Response('Unauthorized', { status: 401 });
  const res = await fetch(`${apiBase()}/api/v1/renter/orders/${id}/payment`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': 'application/json' },
  });
}
