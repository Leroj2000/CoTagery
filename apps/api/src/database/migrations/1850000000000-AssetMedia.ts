import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Časová galerie věci (asset_media) – nedotknutelná média navázaná volitelně
 * na pohyb, se sha256 otiskem. Tenant-scoped, RLS.
 */
export class AssetMedia1850000000000 implements MigrationInterface {
  name = 'AssetMedia1850000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "asset_media" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "asset_id" uuid NOT NULL REFERENCES "assets"("id") ON DELETE CASCADE,
        "movement_id" uuid REFERENCES "asset_movements"("id") ON DELETE SET NULL,
        "phase" text NOT NULL DEFAULT 'general',
        "kind" text NOT NULL DEFAULT 'photo',
        "file_key" text NOT NULL,
        "mime" text NOT NULL,
        "caption" text,
        "sha256" text,
        "captured_at" timestamptz NOT NULL DEFAULT now(),
        "captured_by" uuid,
        "hidden" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_asset_media_asset" ON "asset_media" ("asset_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_asset_media_movement" ON "asset_media" ("movement_id")`,
    );

    await queryRunner.query(`ALTER TABLE "asset_media" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "asset_media" FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "asset_media"
      USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
    `);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON "asset_media" TO "tagery_app"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "asset_media"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "asset_media"`);
  }
}
