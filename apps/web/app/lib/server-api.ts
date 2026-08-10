import { apiBase, getAccessToken } from './session';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Server-side volání NestJS API s Bearer tokenem z httpOnly cookie (BFF).
 * Prefixuje `/api/v1`. Používá se v server komponentách a route handlerech.
 * Na 401 vyhodí ApiError(401) – nadřazený layout přesměruje na /login.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${apiBase()}/api/v1${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.body ? { 'content-type': 'application/json' } : {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new ApiError(res.status, body.message ?? `API ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface Me {
  user: { id: string; email: string; name: string };
  tenantId: string;
  tenantRole: string;
}

export function getMe(): Promise<Me> {
  return apiFetch<Me>('/auth/me');
}
