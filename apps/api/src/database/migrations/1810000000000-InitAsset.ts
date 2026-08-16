import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Asset custody (Fáze A): people (Party), assets, asset_movements (append-only
 * ledger) + locations.parent_id (stromová hierarchie). Vše tenant-scoped, RLS.
 */
export class InitAsset1810000000000 implements MigrationInterface {
  name = 'InitAsset1810000000000';

  private readonly rlsTables = ['people', 'assets', 'asset_movements'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Location strom
    await queryRunner.query(
      `ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "parent_id" uuid REFERENCES "locations"("id") ON DELETE SET NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "people" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "name" text NOT NULL,
        "email" text,
        "phone" text,
        "company" text,
        "user_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_people_tenant_email" ON "people" ("tenant_id", "email") WHERE "email" IS NOT NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "assets" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "digital_object_id" uuid NOT NULL REFERENCES "digital_objects"("id") ON DELETE CASCADE,
        "name" text NOT NULL,
        "category" text,
        "manufacturer" text,
        "model" text,
        "serial_number" text,
        "inventory_number" text,
        "home_location_id" uuid REFERENCES "locations"("id") ON DELETE SET NULL,
        "status" text NOT NULL DEFAULT 'available',
        "current_holder_type" text,
        "current_holder_id" uuid,
        "responsible_person_id" uuid,
        "due_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_assets_object" ON "assets" ("digital_object_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "asset_movements" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "asset_id" uuid NOT NULL REFERENCES "assets"("id") ON DELETE CASCADE,
        "type" text NOT NULL,
        "from_type" text,
        "from_id" uuid,
        "to_type" text,
        "to_id" uuid,
        "actor_person_id" uuid,
        "due_at" timestamptz,
        "note" text,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_movements_asset" ON "asset_movements" ("asset_id")`,
    );

    for (const table of this.rlsTables) {
      await queryRunner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
      await queryRunner.query(`
        CREATE POLICY "tenant_isolation" ON "${table}"
        USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
        WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
      `);
      await queryRunner.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON "${table}" TO "tagery_app"`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.rlsTables) {
      await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "${table}"`);
    }
    await queryRunner.query(`DROP TABLE IF EXISTS "asset_movements"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "assets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "people"`);
    await queryRunner.query(`ALTER TABLE "locations" DROP COLUMN IF EXISTS "parent_id"`);
  }
}
