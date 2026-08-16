import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Inventura (Fáze C): inventory_checks (nad lokací, zmrazené očekávané assety)
 * + inventory_scans (append-only sken). Tenant-scoped, RLS.
 */
export class InitInventory1815000000000 implements MigrationInterface {
  name = 'InitInventory1815000000000';

  private readonly rlsTables = ['inventory_checks', 'inventory_scans'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "inventory_checks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "location_id" uuid NOT NULL REFERENCES "locations"("id") ON DELETE CASCADE,
        "status" text NOT NULL DEFAULT 'open',
        "expected_asset_ids" jsonb NOT NULL DEFAULT '[]',
        "found_count" integer NOT NULL DEFAULT 0,
        "missing_count" integer NOT NULL DEFAULT 0,
        "unexpected_count" integer NOT NULL DEFAULT 0,
        "closed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "inventory_scans" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "check_id" uuid NOT NULL REFERENCES "inventory_checks"("id") ON DELETE CASCADE,
        "asset_id" uuid NOT NULL REFERENCES "assets"("id") ON DELETE CASCADE,
        "result" text NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_inv_scans_check" ON "inventory_scans" ("check_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_inv_scans_check_asset" ON "inventory_scans" ("check_id", "asset_id")`,
    );

    for (const table of this.rlsTables) {
      await queryRunner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
      await queryRunner.query(`
        CREATE POLICY "tenant_isolation" ON "${table}"
        USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
        WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
      `);
      await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON "${table}" TO "tagery_app"`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.rlsTables) {
      await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "${table}"`);
    }
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_scans"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_checks"`);
  }
}
