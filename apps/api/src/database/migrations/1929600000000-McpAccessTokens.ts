import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * EPIC-22 – osobní přístupové tokeny pro MCP (dočasná náhrada OAuth 2.1, viz
 * PLAN.md). Token patří UŽIVATELI a je vázaný na jednu firmu; oprávnění a
 * členství se ověřují při každém volání. Ukládá se jen SHA-256 hash.
 * Uživatelská tabulka → bez RLS, čte jen API.
 */
export class McpAccessTokens1929600000000 implements MigrationInterface {
  name = 'McpAccessTokens1929600000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE mcp_access_tokens (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name text NOT NULL,
      token_hash text NOT NULL UNIQUE,
      token_prefix text NOT NULL,
      expires_at timestamptz,
      last_used_at timestamptz,
      revoked_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now())`);
    await q.query(`CREATE INDEX ix_mcp_access_tokens_user ON mcp_access_tokens (user_id)`);
    await q.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON mcp_access_tokens TO tagery_app`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE mcp_access_tokens`);
  }
}
