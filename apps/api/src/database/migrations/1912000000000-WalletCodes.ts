import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Klíčenka: vlastní slevové/přístupové kódy k rychlému ukázání (QR / čárový kód /
 * NFC). Tenant-scoped (RLS). `user_id` NULL = celofiremní kód, který firma sdílí
 * všem uživatelům; jinak osobní kód konkrétního uživatele. Agregace existujících
 * kódů z modulů (membership benefity) se čte za běhu, neukládá se sem.
 */
export class WalletCodes1912000000000 implements MigrationInterface {
  name = 'WalletCodes1912000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "wallet_codes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
        "label" text NOT NULL,
        "kind" text NOT NULL DEFAULT 'discount',
        "format" text NOT NULL DEFAULT 'qr',
        "value" text NOT NULL,
        "note" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_wallet_codes_tenant_user" ON "wallet_codes" ("tenant_id", "user_id")`,
    );
    await queryRunner.query(`ALTER TABLE "wallet_codes" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "wallet_codes" FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "wallet_codes"
      USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
    `);
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON "wallet_codes" TO "tagery_app"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "wallet_codes"`);
  }
}
