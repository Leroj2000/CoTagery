import { clearRenterCookie } from '../../../lib/renter-session';

/** BFF odhlášení nájemce → smaže renter cookie. */
export async function POST(): Promise<Response> {
  await clearRenterCookie();
  return new Response(null, { status: 204 });
}
