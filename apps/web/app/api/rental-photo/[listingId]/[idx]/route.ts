import { apiBase } from '../../../../lib/session';

/**
 * Veřejná (bez auth) proxy fotky inzerátu — obrázky pro veřejný katalog půjčovny.
 * API vrací foto jen pro publikovaný inzerát (SECURITY DEFINER).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ listingId: string; idx: string }> },
): Promise<Response> {
  const { listingId, idx } = await params;
  const res = await fetch(
    `${apiBase()}/api/v1/public/rental/listings/${listingId}/photos/${idx}`,
    { cache: 'no-store' },
  );
  if (!res.ok) return new Response('Not found', { status: res.status });
  return new Response(res.body, {
    headers: {
      'content-type': res.headers.get('content-type') ?? 'image/jpeg',
      'cache-control': 'public, max-age=300',
    },
  });
}
