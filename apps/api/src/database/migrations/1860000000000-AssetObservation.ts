import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Last Observation – samostatná vrstva „kde/kdy byla věc naposledy VIDĚNA
 * (naskenována)". NEMÍCHAT s evidencí (current_holder). Zapisuje se při Global
 * Scanu a inventuře; nemění stav věci. Tenant-scoped, RLS.
 */
export class AssetObservation1860000000000 implements MigrationInterface {
  name = 'AssetObservation1860000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "asset_observations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "asset_id" uuid NOT NULL REFERENCES "assets"("id") ON DELETE CASCADE,
        "source" text NOT NULL DEFAULT 'scan',
        "location_id" uuid REFERENCES "locations"("id") ON DELETE SET NULL,
        "actor_user_id" uuid,
        "note" text,
        "observed_at" timestamptz NOT NULL DEFAULT now(),
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_asset_observations_asset" ON "asset_observations" ("asset_id", "observed_at" DESC)`,
    );

    await queryRunner.query(`ALTER TABLE "asset_observations" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "asset_observations" FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "asset_observations"
      USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
    `);
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON "asset_observations" TO "tagery_app"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "asset_observations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "asset_observations"`);
  }
}
