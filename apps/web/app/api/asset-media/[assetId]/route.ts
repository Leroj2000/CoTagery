import { apiBase, getAccessToken } from '../../../lib/session';

/** BFF: upload média věci (multipart) – přepošle na API s Bearer z httpOnly cookie. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ assetId: string }> },
): Promise<Response> {
  const { assetId } = await params;
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });

  const form = await req.formData();
  const fwd = new FormData();
  const file = form.get('file');
  if (!(file instanceof File)) return new Response('Chybí soubor', { status: 400 });
  fwd.append('file', file, file.name);
  for (const key of ['movementId', 'phase', 'caption']) {
    const v = form.get(key);
    if (typeof v === 'string' && v) fwd.append(key, v);
  }

  const res = await fetch(`${apiBase()}/api/v1/assets/${assetId}/media`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: fwd,
  });
  return new Response(res.body, { status: res.status });
}
