/** EPIC-22 – typy a čisté pomocné funkce stránky „Propojené kanály“. */

export interface ChannelIdentityDto {
  id: string;
  channel: string;
  displayName: string | null;
  createdAt: string;
  lastSeenAt: string | null;
}

export interface McpTokenDto {
  id: string;
  name: string;
  tenantId: string;
  organizationName: string | null;
  tokenPrefix: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface TelegramLinkCode {
  code: string;
  expiresAt: string;
  deepLink: string | null;
}

/** Platnosti MCP tokenu nabízené ve formuláři (dny; `null` = bez expirace). */
export const MCP_TOKEN_EXPIRY_OPTIONS: { value: string; label: string; days: number | null }[] = [
  { value: '30', label: '30 dní', days: 30 },
  { value: '90', label: '90 dní', days: 90 },
  { value: '365', label: '1 rok', days: 365 },
  { value: 'never', label: 'Bez expirace', days: null },
];

/** Hodnota z formuláře → počet dní; neznámá hodnota = výchozích 90. */
export function parseExpiryDays(value: string | null | undefined): number | null {
  const opt = MCP_TOKEN_EXPIRY_OPTIONS.find((o) => o.value === value);
  return opt ? opt.days : 90;
}

/**
 * Veřejná adresa MCP serveru z veřejné URL API (`NEXT_PUBLIC_API_URL`).
 * MCP běží mimo prefix `/api/v1`, proto se případný prefix odřízne.
 */
export function mcpEndpoint(publicApiUrl: string): string {
  const base = publicApiUrl
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api\/v1$/, '');
  return `${base}/mcp`;
}

/** Zbývající čas „m:ss“ (pro odpočet platnosti kódu); 0 a méně = „0:00“. */
export function formatRemaining(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const CHANNEL_LABELS: Record<string, string> = {
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
};
