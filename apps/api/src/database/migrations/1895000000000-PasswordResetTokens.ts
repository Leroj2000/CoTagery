import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reset hesla (identity-level, pre-auth) – jako refresh_tokens BEZ RLS.
 * Ukládá jen hash tokenu, s expirací a jednorázovým použitím (used_at).
 */
export class PasswordResetTokens1895000000000 implements MigrationInterface {
  name = 'PasswordResetTokens1895000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "token_hash" text NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "used_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(
      `CREATE INDEX IF NOT EXISTS "ix_prt_token_hash" ON "password_reset_tokens" ("token_hash")`,
    );
    await q.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON "password_reset_tokens" TO "tagery_app"`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "password_reset_tokens"`);
  }
}
