/** Kanál, přes který akce přichází (WhatsApp přijde v F3). */
export type ChannelKind = 'telegram' | 'mcp';

/** Kdo akci volá: vždy konkrétní uživatel; firma je volitelná (výběr firmy). */
export interface ChannelActor {
  userId: string;
  channel: ChannelKind;
  /** Vybraná firma (ověřuje se proti aktivním členstvím při KAŽDÉM volání). */
  tenantId: string | null;
  /** External id kanálu (chat id, id tokenu) – do auditu jen maskovaně. */
  externalRef?: string | null;
}

/** Klíč funkce předplatného, která kanál zapíná (EPIC-20). */
export function channelFeatureKey(channel: ChannelKind): string {
  return `channel_${channel}`;
}

/** Maskování external id pro audit/logy (`123456789` → `12…89`). */
export function maskExternalRef(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 4) return '…';
  return `${value.slice(0, 2)}…${value.slice(-2)}`;
}
