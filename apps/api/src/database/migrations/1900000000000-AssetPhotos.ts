import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Galerie fotek věci (asset_photos) – kurátorská (na rozdíl od nedotknutelné
 * timeline `asset_media`). Řazená přes `position`; fotka na pozici 0 je hlavní
 * a synchronizuje se do `assets.photo_key` (rychlý náhled v seznamu). Tenant-scoped, RLS.
 */
export class AssetPhotos1900000000000 implements MigrationInterface {
  name = 'AssetPhotos1900000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "asset_photos" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "asset_id" uuid NOT NULL REFERENCES "assets"("id") ON DELETE CASCADE,
        "file_key" text NOT NULL,
        "mime" text NOT NULL,
        "position" integer NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_asset_photos_asset" ON "asset_photos" ("asset_id", "position")`,
    );

    await queryRunner.query(`ALTER TABLE "asset_photos" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "asset_photos" FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "asset_photos"
      USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
    `);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON "asset_photos" TO "tagery_app"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "asset_photos"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "asset_photos"`);
  }
}
