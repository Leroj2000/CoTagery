import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * EPIC-22 – identity kanálů (Telegram; WhatsApp později):
 * - `channel_identities` – chat/telefon → UŽIVATEL (nikdy přímo firma, spec §8.1);
 *   `current_tenant_id` je jen volba, ověřuje se proti aktivním členstvím při
 *   každé zprávě. Tabulka je uživatelská (ne firemní) → bez RLS, čte jen API.
 * - `channel_link_codes` – jednorázové kódy pro propojení (jen SHA-256 hash, 10 min),
 * - `channel_conversations` – rozpracované akce čekající na potvrzení, vázané na
 *   identitu A firmu (§8.6), expirace 30 min,
 * - `channel_processed_updates` – idempotence webhooků (opakované doručení).
 */
export class ChannelIdentities1929500000000 implements MigrationInterface {
  name = 'ChannelIdentities1929500000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE channel_identities (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      channel text NOT NULL CHECK (channel IN ('telegram', 'whatsapp')),
      external_id text NOT NULL,
      display_name text,
      current_tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
      verified_at timestamptz NOT NULL DEFAULT now(),
      last_seen_at timestamptz,
      revoked_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now())`);
    await q.query(`CREATE UNIQUE INDEX ux_channel_identities_active
      ON channel_identities (channel, external_id) WHERE revoked_at IS NULL`);
    await q.query(`CREATE INDEX ix_channel_identities_user ON channel_identities (user_id)`);

    await q.query(`CREATE TABLE channel_link_codes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      channel text NOT NULL CHECK (channel IN ('telegram', 'whatsapp')),
      code_hash text NOT NULL UNIQUE,
      expires_at timestamptz NOT NULL,
      used_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now())`);
    await q.query(`CREATE INDEX ix_channel_link_codes_user ON channel_link_codes (user_id)`);

    await q.query(`CREATE TABLE channel_conversations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      identity_id uuid NOT NULL REFERENCES channel_identities(id) ON DELETE CASCADE,
      tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
      state jsonb NOT NULL,
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now())`);
    await q.query(
      `CREATE INDEX ix_channel_conversations_identity ON channel_conversations (identity_id)`,
    );

    await q.query(`CREATE TABLE channel_processed_updates (
      channel text NOT NULL,
      update_key text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (channel, update_key))`);

    for (const t of [
      'channel_identities',
      'channel_link_codes',
      'channel_conversations',
      'channel_processed_updates',
    ]) {
      await q.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${t} TO tagery_app`);
    }
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE channel_processed_updates`);
    await q.query(`DROP TABLE channel_conversations`);
    await q.query(`DROP TABLE channel_link_codes`);
    await q.query(`DROP TABLE channel_identities`);
  }
}
