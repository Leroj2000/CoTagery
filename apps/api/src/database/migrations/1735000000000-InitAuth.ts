import { MigrationInterface, QueryRunner } from 'typeorm';

/** EPIC-01 Auth: tabulky users a refresh_tokens. */
export class InitAuth1735000000000 implements MigrationInterface {
  name = 'InitAuth1735000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "email" text NOT NULL,
        "name" text NOT NULL,
        "password_hash" text NOT NULL,
        "tenant_role" text NOT NULL DEFAULT 'VIEWER',
        "status" text NOT NULL DEFAULT 'active',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_users_tenant_email" ON "users" ("tenant_id", "email")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "refresh_tokens" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "jti" uuid NOT NULL,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "tenant_id" uuid NOT NULL,
        "token_hash" text NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_refresh_tokens_jti" ON "refresh_tokens" ("jti")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_refresh_tokens_user" ON "refresh_tokens" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
