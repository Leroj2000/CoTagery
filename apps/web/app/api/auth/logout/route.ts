import { NextResponse } from 'next/server';
import { apiBase, clearSessionCookies, getRefreshToken } from '../../../lib/session';

/** BFF logout: zneplatní refresh token na API a smaže httpOnly cookies. */
export async function POST(): Promise<NextResponse> {
  const refreshToken = await getRefreshToken();
  if (refreshToken) {
    await fetch(`${apiBase()}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined);
  }
  await clearSessionCookies();
  return NextResponse.json({ ok: true });
}
