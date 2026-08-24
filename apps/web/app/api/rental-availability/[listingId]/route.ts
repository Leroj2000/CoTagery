import { apiBase } from '../../../lib/session';

/** BFF veřejná dostupnost inzerátu (obsazené termíny pro kalendář, bez auth). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ listingId: string }> },
): Promise<Response> {
  const { listingId } = await params;
  const res = await fetch(
    `${apiBase()}/api/v1/public/rental/listings/${listingId}/availability`,
    { cache: 'no-store' },
  );
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': 'application/json' },
  });
}
