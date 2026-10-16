'use server';

import { redirect } from 'next/navigation';
import { apiFetch, ApiError } from '../../lib/server-api';
import { OAUTH_AUTHORIZE_PARAMS } from '../../lib/channels';

export type ConsentState = { error?: string } | null;

/**
 * Rozhodnutí uživatele na stránce souhlasu. API znovu ověří klienta,
 * redirect_uri, PKCE i členství ve firmě a vrátí adresu pro návrat ke klientovi.
 */
export async function decideConsent(_p: ConsentState, fd: FormData): Promise<ConsentState> {
  const body: Record<string, string> = {};
  for (const key of OAUTH_AUTHORIZE_PARAMS) {
    const v = fd.get(key);
    if (typeof v === 'string' && v) body[key] = v;
  }
  body.tenantId = String(fd.get('tenantId') ?? '');
  body.decision = fd.get('decision') === 'approve' ? 'approve' : 'deny';
  let target: string;
  try {
    const res = await apiFetch<{ redirectUrl: string }>('/oauth/authorize/decision', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    target = res.redirectUrl;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      const qs = new URLSearchParams(
        Object.fromEntries(OAUTH_AUTHORIZE_PARAMS.filter((k) => body[k]).map((k) => [k, body[k]])),
      );
      redirect(`/login?from=${encodeURIComponent(`/oauth/authorize?${qs.toString()}`)}`);
    }
    return { error: e instanceof ApiError ? e.message : 'Neočekávaná chyba' };
  }
  redirect(target);
}
