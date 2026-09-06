import { apiBase } from '../../../lib/session';

export async function POST(req: Request): Promise<Response> {
  const res = await fetch(`${apiBase()}/api/v1/auth/verify-email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: await req.text(),
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': 'application/json' },
  });
}
