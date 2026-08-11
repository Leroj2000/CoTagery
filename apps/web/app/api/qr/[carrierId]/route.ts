import { apiBase, getAccessToken } from '../../../lib/session';

/**
 * BFF proxy pro QR obrázek nosiče. API endpoint `/carriers/:id/qr` vyžaduje
 * JWT (Bearer), který drží server v httpOnly cookie – proto ho nelze načíst
 * přímo <img> tagem. Tudy protéká s Bearerem a streamuje PNG zpět.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ carrierId: string }> },
): Promise<Response> {
  const { carrierId } = await params;
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });

  const res = await fetch(`${apiBase()}/api/v1/carriers/${carrierId}/qr?format=png`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return new Response('Not found', { status: res.status });

  return new Response(res.body, {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'private, max-age=60',
    },
  });
}
