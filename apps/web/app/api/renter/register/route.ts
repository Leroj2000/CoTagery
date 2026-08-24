import { apiBase } from '../../../lib/session';
import { setRenterCookie } from '../../../lib/renter-session';

/** BFF registrace nájemce → nastaví httpOnly renter cookie. */
export async function POST(req: Request): Promise<Response> {
  const res = await fetch(`${apiBase()}/api/v1/renter/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: await req.text(),
  });
  const data = (await res.json()) as { accessToken?: string; renter?: unknown; message?: string };
  if (!res.ok || !data.accessToken) {
    return Response.json({ message: data.message ?? 'Registrace selhala' }, { status: res.status });
  }
  await setRenterCookie(data.accessToken);
  return Response.json({ renter: data.renter });
}
