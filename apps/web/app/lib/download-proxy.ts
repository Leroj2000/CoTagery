import { apiBase, getAccessToken } from './session';

/** Přepošle stažení souboru z API (export / šablona) i s názvem souboru. */
export async function downloadFrom(path: string): Promise<Response> {
  const token = await getAccessToken();
  if (!token) return new Response('Unauthorized', { status: 401 });
  const res = await fetch(`${apiBase()}/api/v1${path}`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return new Response('Stažení selhalo', { status: res.status });
  return new Response(res.body, {
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/octet-stream',
      'content-disposition': res.headers.get('content-disposition') ?? 'attachment',
      'cache-control': 'private, no-store',
    },
  });
}
