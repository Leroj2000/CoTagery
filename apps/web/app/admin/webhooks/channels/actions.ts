'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError, getMe } from '../../../lib/server-api';
import { parseExpiryDays, type McpTokenDto, type TelegramLinkCode } from '../../../lib/channels';
import type { ActionState } from '../../action-form';

const PATH = '/admin/webhooks/channels';

function str(fd: FormData, key: string): string {
  return (fd.get(key) as string | null)?.trim() ?? '';
}

function fail(e: unknown): ActionState {
  return { error: e instanceof ApiError ? e.message : 'Neočekávaná chyba' };
}

export type LinkCodeState = (ActionState & { link?: TelegramLinkCode }) | null;

/** Jednorázový kód pro propojení Telegramu (10 minut, v DB jen hash). */
export async function createTelegramLinkCode(_p: LinkCodeState): Promise<LinkCodeState> {
  try {
    const link = await apiFetch<TelegramLinkCode>('/channels/telegram/link-code', {
      method: 'POST',
    });
    return { ok: true, link };
  } catch (e) {
    return fail(e);
  }
}

export async function revokeChannelIdentity(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await apiFetch(`/channels/identities/${encodeURIComponent(str(fd, 'id'))}`, {
      method: 'DELETE',
    });
    revalidatePath(PATH);
    return { ok: true, message: 'Odpojeno.' };
  } catch (e) {
    return fail(e);
  }
}

export type McpTokenState = (ActionState & { token?: string; info?: McpTokenDto }) | null;

/** Nový MCP token pro aktuální firmu – plný token se vrátí jen jednou. */
export async function createMcpToken(_p: McpTokenState, fd: FormData): Promise<McpTokenState> {
  const name = str(fd, 'name');
  if (!name) return { error: 'Vyplň název (např. „Claude na notebooku“).' };
  try {
    const me = await getMe();
    const res = await apiFetch<{ token: string; info: McpTokenDto }>('/channels/mcp-tokens', {
      method: 'POST',
      body: JSON.stringify({
        tenantId: me.tenantId,
        name: name.slice(0, 100),
        expiresInDays: parseExpiryDays(str(fd, 'expiresIn')),
      }),
    });
    revalidatePath(PATH);
    return { ok: true, message: 'Token vytvořen.', token: res.token, info: res.info };
  } catch (e) {
    return fail(e);
  }
}

export async function revokeMcpToken(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await apiFetch(`/channels/mcp-tokens/${encodeURIComponent(str(fd, 'id'))}`, {
      method: 'DELETE',
    });
    revalidatePath(PATH);
    return { ok: true, message: 'Token zrušen.' };
  } catch (e) {
    return fail(e);
  }
}
