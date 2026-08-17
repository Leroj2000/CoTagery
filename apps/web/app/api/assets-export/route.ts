import { apiBase, getAccessToken } from '../../lib/session';

/** BFF: stáhne CSV export věcí z API (s Bearer z httpOnly cookie) jako soubor. */
export async function GET(): Promise<Response> {
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });
  const res = await fetch(`${apiBase()}/api/v1/assets/export`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return new Response('Export selhal', { status: res.status });
  return new Response(res.body, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="veci.csv"',
    },
  });
}
