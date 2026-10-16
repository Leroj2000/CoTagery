import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * EPIC-22 – OAuth 2.1 autorizační server pro MCP (ChatGPT/Claude konektory):
 * - `mcp_oauth_clients` – klienti z dynamické registrace (RFC 7591), secret jen hash,
 * - `mcp_oauth_grants` – souhlas uživatele: klient × uživatel × firma × resource,
 * - `mcp_oauth_codes` – jednorázové autorizační kódy (PKCE S256, hash, krátká platnost),
 * - `mcp_oauth_tokens` – access/refresh tokeny (jen hash; rotace refresh tokenů).
 * Uživatelské tabulky (jako `mcp_access_tokens`) → bez RLS, čte jen API; firma se
 * ověřuje proti aktivním členstvím při každém volání MCP.
 */
export class McpOAuth1929700000000 implements MigrationInterface {
  name = 'McpOAuth1929700000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE mcp_oauth_clients (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id text NOT NULL UNIQUE,
      client_secret_hash text,
      client_name text NOT NULL,
      redirect_uris text[] NOT NULL,
      token_endpoint_auth_method text NOT NULL
        CHECK (token_endpoint_auth_method IN ('none', 'client_secret_post', 'client_secret_basic')),
      client_uri text,
      software_id text,
      created_ip text,
      last_used_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now())`);

    await q.query(`CREATE TABLE mcp_oauth_grants (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id uuid NOT NULL REFERENCES mcp_oauth_clients(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      scope text NOT NULL,
      resource text NOT NULL,
      last_used_at timestamptz,
      revoked_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now())`);
    await q.query(`CREATE INDEX ix_mcp_oauth_grants_user ON mcp_oauth_grants (user_id)`);

    await q.query(`CREATE TABLE mcp_oauth_codes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code_hash text NOT NULL UNIQUE,
      grant_id uuid NOT NULL REFERENCES mcp_oauth_grants(id) ON DELETE CASCADE,
      redirect_uri text NOT NULL,
      code_challenge text NOT NULL,
      expires_at timestamptz NOT NULL,
      used_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now())`);

    await q.query(`CREATE TABLE mcp_oauth_tokens (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      grant_id uuid NOT NULL REFERENCES mcp_oauth_grants(id) ON DELETE CASCADE,
      kind text NOT NULL CHECK (kind IN ('access', 'refresh')),
      token_hash text NOT NULL UNIQUE,
      expires_at timestamptz NOT NULL,
      revoked_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now())`);
    await q.query(`CREATE INDEX ix_mcp_oauth_tokens_grant ON mcp_oauth_tokens (grant_id)`);

    for (const t of [
      'mcp_oauth_clients',
      'mcp_oauth_grants',
      'mcp_oauth_codes',
      'mcp_oauth_tokens',
    ]) {
      await q.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${t} TO tagery_app`);
    }
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE mcp_oauth_tokens`);
    await q.query(`DROP TABLE mcp_oauth_codes`);
    await q.query(`DROP TABLE mcp_oauth_grants`);
    await q.query(`DROP TABLE mcp_oauth_clients`);
  }
}
