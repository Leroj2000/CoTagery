import { apiBase, getAccessToken } from '../../../lib/session';

/** Autentizovaná BFF proxy pro serverový PDF fallback štítku. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ carrierId: string }> },
): Promise<Response> {
  const { carrierId } = await params;
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });
  const res = await fetch(`${apiBase()}/api/v1/carriers/${carrierId}/fabrication?format=pdf`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  return new Response(res.body, {
    status: res.status,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/pdf',
      'content-disposition':
        res.headers.get('content-disposition') ?? 'inline; filename="tagery-label.pdf"',
    },
  });
}
