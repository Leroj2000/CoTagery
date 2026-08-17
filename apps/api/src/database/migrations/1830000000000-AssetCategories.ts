import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Číselník kategorií věcí (asset_categories) + vazba assets.category_id.
 * Tenant-scoped, RLS. Denormalizovaný `assets.category` (text) zůstává pro
 * rychlé zobrazení a zpětnou kompatibilitu s dosud volně psanými kategoriemi.
 */
export class AssetCategories1830000000000 implements MigrationInterface {
  name = 'AssetCategories1830000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "asset_categories" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "name" text NOT NULL,
        "color" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_asset_categories_tenant_name" ON "asset_categories" ("tenant_id", "name")`,
    );

    await queryRunner.query(
      `ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "category_id" uuid REFERENCES "asset_categories"("id") ON DELETE SET NULL`,
    );

    await queryRunner.query(`ALTER TABLE "asset_categories" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "asset_categories" FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "asset_categories"
      USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
    `);
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON "asset_categories" TO "tagery_app"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "assets" DROP COLUMN IF EXISTS "category_id"`);
    await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "asset_categories"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "asset_categories"`);
  }
}
