import { MigrationInterface, QueryRunner } from 'typeorm';

/** Jednorázové odkazy pro ověření registrace a přijetí pozvánky. */
export class AccountActionTokens1922000000000 implements MigrationInterface {
  name = 'AccountActionTokens1922000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "account_action_tokens" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "purpose" text NOT NULL,
        "token_hash" text NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "used_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(
      `CREATE UNIQUE INDEX "ux_account_action_token_hash" ON "account_action_tokens" ("token_hash")`,
    );
    await q.query(
      `CREATE INDEX "ix_account_action_token_user" ON "account_action_tokens" ("user_id", "purpose")`,
    );
    await q.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON "account_action_tokens" TO "tagery_app"`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "account_action_tokens"`);
  }
}
