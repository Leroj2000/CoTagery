import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Pneumatiky položky (vozidla, stroje): řádek = náprava v sadě (např. „Zimní“ –
 * přední/zadní). Sada je skupina řádků se stejným `set_label`; namontovaná je
 * nejvýše jedna sada na položku (hlídá služba při „přezutí“). Aditivní migrace.
 */
export class AssetTires1929800000000 implements MigrationInterface {
  name = 'AssetTires1929800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "asset_tires" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "asset_id" uuid NOT NULL REFERENCES "assets"("id") ON DELETE CASCADE,
        "set_label" text NOT NULL,
        "season" text NOT NULL
          CHECK ("season" IN ('summer','winter','all_season','construction','industrial')),
        "axle" text NOT NULL DEFAULT 'all' CHECK ("axle" IN ('front','rear','all')),
        "width" integer NOT NULL,
        "aspect_ratio" integer,
        "rim_diameter" numeric(5,1) NOT NULL,
        "construction" text NOT NULL DEFAULT 'R' CHECK ("construction" IN ('R','D')),
        "load_index" text,
        "speed_index" text,
        "brand" text,
        "dot" text,
        "tread_depth_mm" numeric(4,1),
        "quantity" integer NOT NULL DEFAULT 4,
        "mounted" boolean NOT NULL DEFAULT false,
        "stored_location_id" uuid REFERENCES "locations"("id") ON DELETE SET NULL,
        "note" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_asset_tires_asset" ON "asset_tires" ("tenant_id", "asset_id")`,
    );
    await queryRunner.query(`ALTER TABLE "asset_tires" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "asset_tires" FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "asset_tires"
      USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
    `);
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON "asset_tires" TO "tagery_app"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "asset_tires"`);
  }
}
