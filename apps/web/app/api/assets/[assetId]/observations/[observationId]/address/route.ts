import { apiBase, getAccessToken } from '@/app/lib/session';

/** BFF: reverzní překlad GPS bodu; API výsledek uloží jako cache k pozorování. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ assetId: string; observationId: string }> },
): Promise<Response> {
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });
  const { assetId, observationId } = await params;
  const response = await fetch(
    `${apiBase()}/api/v1/assets/${assetId}/observations/${observationId}/address`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      cache: 'no-store',
    },
  );
  return new Response(await response.text(), {
    status: response.status,
    headers: { 'content-type': 'application/json' },
  });
}
