import { apiBase, getAccessToken } from '../../../lib/session';

/** BFF: vrácení věci s fotkami (multipart) – přepošle na API s Bearer. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });

  const form = await req.formData();
  const fwd = new FormData();
  for (const f of form.getAll('files')) {
    if (f instanceof File) fwd.append('files', f, f.name);
  }
  for (const key of ['toId', 'note']) {
    const v = form.get(key);
    if (typeof v === 'string' && v) fwd.append(key, v);
  }

  const res = await fetch(`${apiBase()}/api/v1/assets/${id}/return`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: fwd,
  });
  return new Response(res.body, { status: res.status });
}
