import { apiBase } from '../../../lib/session';

export const dynamic = 'force-dynamic';

/**
 * iCal feed sdíleného kalendáře na doméně webu (odběr v Google/Outlook/Apple).
 * Jen přeposílá veřejný endpoint API; neplatný odkaz = 404 bez detailů.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params;
  const res = await fetch(`${apiBase()}/api/v1/public/calendar/${encodeURIComponent(token)}/ics`, {
    cache: 'no-store',
  });
  const headers = {
    'cache-control': 'no-store',
    'x-robots-tag': 'noindex',
    'referrer-policy': 'no-referrer',
  };
  if (!res.ok) {
    return new Response('Kalendář není dostupný.', {
      status: res.status === 429 ? 429 : 404,
      headers: { ...headers, 'content-type': 'text/plain; charset=utf-8' },
    });
  }
  return new Response(await res.text(), {
    status: 200,
    headers: {
      ...headers,
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': 'inline; filename="kalendar.ics"',
    },
  });
}
