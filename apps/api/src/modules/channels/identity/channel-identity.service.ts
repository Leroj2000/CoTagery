import { createHash, randomInt } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export type IdentityChannel = 'telegram';

export interface ChannelIdentity {
  id: string;
  userId: string;
  channel: IdentityChannel;
  externalId: string;
  displayName: string | null;
  currentTenantId: string | null;
}

export const LINK_CODE_TTL_MIN = 10;
export const CONVERSATION_TTL_MIN = 30;

interface IdentityRow {
  id: string;
  user_id: string;
  channel: IdentityChannel;
  external_id: string;
  display_name: string | null;
  current_tenant_id: string | null;
}

function toIdentity(r: IdentityRow): ChannelIdentity {
  return {
    id: r.id,
    userId: r.user_id,
    channel: r.channel,
    externalId: r.external_id,
    displayName: r.display_name,
    currentTenantId: r.current_tenant_id,
  };
}

export function hashLinkCode(channel: string, code: string): string {
  return createHash('sha256').update(`${channel}:${code}`, 'utf8').digest('hex');
}

/** 6místný kód (s nulami na začátku), kryptograficky náhodný. */
export function generateLinkCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/**
 * Propojení chatu (external id) s uživatelem Tagery (spec §2, §8.1). Uživatel
 * si kód vygeneruje v přihlášeném webu; kód je jednorázový, 10 min, v DB jen hash.
 * Identita ukazuje na UŽIVATELE – firma se vybírá zvlášť a ověřuje při každé zprávě.
 */
@Injectable()
export class ChannelIdentityService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async createLinkCode(
    userId: string,
    channel: IdentityChannel,
  ): Promise<{ code: string; expiresAt: Date }> {
    const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MIN * 60_000);
    // Starší nepoužité kódy uživatele zneplatní – platí vždy jen poslední.
    await this.dataSource.query(
      `DELETE FROM channel_link_codes WHERE user_id = $1 AND channel = $2 AND used_at IS NULL`,
      [userId, channel],
    );
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateLinkCode();
      const rows: unknown[] = await this.dataSource.query(
        `INSERT INTO channel_link_codes (user_id, channel, code_hash, expires_at)
         VALUES ($1, $2, $3, $4) ON CONFLICT (code_hash) DO NOTHING RETURNING id`,
        [userId, channel, hashLinkCode(channel, code), expiresAt],
      );
      if (rows.length) return { code, expiresAt };
      // Kolize s cizím platným kódem (vzácné) – zkusit jiný; prošlé uklidit.
      await this.dataSource.query(`DELETE FROM channel_link_codes WHERE expires_at < now()`);
    }
    throw new Error('Nepodařilo se vygenerovat kód');
  }

  /**
   * Spotřebuje kód a propojí chat s uživatelem. Vrací null pro neplatný / prošlý /
   * použitý kód (bez rozlišení – nic neprozradí). Případné starší propojení téhož
   * chatu se zneplatní (chat patří vždy jednomu uživateli).
   */
  async consumeLinkCode(
    channel: IdentityChannel,
    externalId: string,
    code: string,
    displayName: string | null,
  ): Promise<ChannelIdentity | null> {
    if (!/^\d{6}$/.test(code)) return null;
    return this.dataSource.transaction(async (m) => {
      const codes: { id: string; user_id: string }[] = await m.query(
        `UPDATE channel_link_codes SET used_at = now()
          WHERE code_hash = $1 AND channel = $2 AND used_at IS NULL AND expires_at > now()
          RETURNING id, user_id`,
        [hashLinkCode(channel, code), channel],
      );
      if (codes.length === 0) return null;
      const userId = codes[0].user_id;
      await m.query(
        `UPDATE channel_identities SET revoked_at = now(), updated_at = now()
          WHERE channel = $1 AND external_id = $2 AND revoked_at IS NULL`,
        [channel, externalId],
      );
      const memberships: { organization_id: string }[] = await m.query(
        `SELECT organization_id FROM my_memberships($1)`,
        [userId],
      );
      const rows: IdentityRow[] = await m.query(
        `INSERT INTO channel_identities (user_id, channel, external_id, display_name, current_tenant_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, user_id, channel, external_id, display_name, current_tenant_id`,
        [
          userId,
          channel,
          externalId,
          displayName?.slice(0, 120) ?? null,
          memberships.length === 1 ? memberships[0].organization_id : null,
        ],
      );
      return toIdentity(rows[0]);
    });
  }

  async findActive(channel: IdentityChannel, externalId: string): Promise<ChannelIdentity | null> {
    const rows: IdentityRow[] = await this.dataSource.query(
      `UPDATE channel_identities SET last_seen_at = now()
        WHERE channel = $1 AND external_id = $2 AND revoked_at IS NULL
        RETURNING id, user_id, channel, external_id, display_name, current_tenant_id`,
      [channel, externalId],
    );
    return rows[0] ? toIdentity(rows[0]) : null;
  }

  /** Nastaví vybranou firmu; rozpracované konverzace identity se zahodí (§8.6). */
  async setTenant(identityId: string, tenantId: string | null): Promise<void> {
    await this.dataSource.query(
      `UPDATE channel_identities SET current_tenant_id = $2, updated_at = now() WHERE id = $1`,
      [identityId, tenantId],
    );
    await this.dataSource.query(`DELETE FROM channel_conversations WHERE identity_id = $1`, [
      identityId,
    ]);
  }

  async revokeById(identityId: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE channel_identities SET revoked_at = now(), updated_at = now()
        WHERE id = $1 AND revoked_at IS NULL`,
      [identityId],
    );
  }

  async listForUser(userId: string): Promise<
    {
      id: string;
      channel: string;
      displayName: string | null;
      createdAt: string;
      lastSeenAt: string | null;
    }[]
  > {
    const rows: {
      id: string;
      channel: string;
      display_name: string | null;
      created_at: Date;
      last_seen_at: Date | null;
    }[] = await this.dataSource.query(
      `SELECT id, channel, display_name, created_at, last_seen_at FROM channel_identities
        WHERE user_id = $1 AND revoked_at IS NULL ORDER BY created_at DESC`,
      [userId],
    );
    return rows.map((r) => ({
      id: r.id,
      channel: r.channel,
      displayName: r.display_name,
      createdAt: new Date(r.created_at).toISOString(),
      lastSeenAt: r.last_seen_at ? new Date(r.last_seen_at).toISOString() : null,
    }));
  }

  /** Odpojení z webu – jen vlastní identitu uživatele. */
  async revokeForUser(userId: string, identityId: string): Promise<void> {
    const rows: unknown[] = await this.dataSource.query(
      `UPDATE channel_identities SET revoked_at = now(), updated_at = now()
        WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL RETURNING id`,
      [identityId, userId],
    );
    if (rows.length === 0) throw new NotFoundException('Propojení neexistuje');
  }

  // --- Konverzace (čekající potvrzení) ---

  async saveConversation(
    identityId: string,
    tenantId: string | null,
    state: Record<string, unknown>,
  ): Promise<string> {
    // Jedna rozpracovaná akce na identitu – starší se zahodí.
    await this.dataSource.query(`DELETE FROM channel_conversations WHERE identity_id = $1`, [
      identityId,
    ]);
    const rows: { id: string }[] = await this.dataSource.query(
      `INSERT INTO channel_conversations (identity_id, tenant_id, state, expires_at)
       VALUES ($1, $2, $3, now() + make_interval(mins => $4)) RETURNING id`,
      [identityId, tenantId, JSON.stringify(state), CONVERSATION_TTL_MIN],
    );
    return rows[0].id;
  }

  /** Vezme (a smaže) konverzaci – jen vlastní identity a neprošlou. */
  async takeConversation(
    identityId: string,
    conversationId: string,
  ): Promise<{ tenantId: string | null; state: Record<string, unknown> } | null> {
    if (!/^[0-9a-f-]{36}$/i.test(conversationId)) return null;
    const rows: { tenant_id: string | null; state: Record<string, unknown> }[] =
      await this.dataSource.query(
        `DELETE FROM channel_conversations
          WHERE id = $1 AND identity_id = $2 AND expires_at > now()
          RETURNING tenant_id, state`,
        [conversationId, identityId],
      );
    return rows[0] ? { tenantId: rows[0].tenant_id, state: rows[0].state } : null;
  }

  /** Idempotence webhooku: true = zpracovat, false = už zpracováno. */
  async markProcessed(channel: string, key: string): Promise<boolean> {
    const rows: unknown[] = await this.dataSource.query(
      `INSERT INTO channel_processed_updates (channel, update_key) VALUES ($1, $2)
       ON CONFLICT DO NOTHING RETURNING update_key`,
      [channel, key],
    );
    return rows.length > 0;
  }
}
