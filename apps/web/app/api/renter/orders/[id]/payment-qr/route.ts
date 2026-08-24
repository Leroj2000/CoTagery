import { apiBase } from '../../../../../lib/session';
import { getRenterToken } from '../../../../../lib/renter-session';

/** BFF: QR obrázek (PNG) platby objednávky nájemce. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const token = await getRenterToken();
  if (!token) return new Response('Unauthorized', { status: 401 });
  const res = await fetch(`${apiBase()}/api/v1/renter/orders/${id}/payment/qr.png`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return new Response('Not found', { status: res.status });
  return new Response(res.body, {
    headers: { 'content-type': 'image/png', 'cache-control': 'private, max-age=60' },
  });
}
