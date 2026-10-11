import { apiBase, getAccessToken } from '../../lib/session';

/** BFF: import položek ze souboru. `?dryRun=0` zapisuje, jinak jen náhled. */
export async function POST(req: Request): Promise<Response> {
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return new Response('Chybí soubor', { status: 400 });
  const fwd = new FormData();
  fwd.append('file', file, file.name);
  const dryRun = new URL(req.url).searchParams.get('dryRun') === '0' ? '0' : '1';
  const res = await fetch(`${apiBase()}/api/v1/assets/import?dryRun=${dryRun}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: fwd,
  });
  return new Response(res.body, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}
