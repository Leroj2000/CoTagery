import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 🟡 doplňky: nahlášení problému (asset_issues) + generalizace inventury na
 * subjekt (místo/osoba/kontejner). RLS pro asset_issues.
 */
export class IssuesAndInventorySubject1840000000000 implements MigrationInterface {
  name = 'IssuesAndInventorySubject1840000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "asset_issues" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "asset_id" uuid NOT NULL REFERENCES "assets"("id") ON DELETE CASCADE,
        "reported_by_id" uuid REFERENCES "people"("id") ON DELETE SET NULL,
        "kind" text NOT NULL,
        "description" text NOT NULL,
        "status" text NOT NULL DEFAULT 'open',
        "resolved_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_asset_issues_asset" ON "asset_issues" ("asset_id")`,
    );
    await queryRunner.query(`ALTER TABLE "asset_issues" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "asset_issues" FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "asset_issues"
      USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
    `);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON "asset_issues" TO "tagery_app"`);

    // Inventura nad subjektem (místo/osoba/kontejner)
    await queryRunner.query(
      `ALTER TABLE "inventory_checks" ADD COLUMN IF NOT EXISTS "subject_type" text NOT NULL DEFAULT 'location'`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_checks" ADD COLUMN IF NOT EXISTS "subject_id" uuid`,
    );
    // Dopočet u existujících inventur: subject = location
    await queryRunner.query(
      `UPDATE "inventory_checks" SET "subject_id" = "location_id" WHERE "subject_id" IS NULL`,
    );
    // location_id může být nově NULL (u inventur nad osobou/kontejnerem)
    await queryRunner.query(`ALTER TABLE "inventory_checks" ALTER COLUMN "location_id" DROP NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "inventory_checks" DROP COLUMN IF EXISTS "subject_id"`);
    await queryRunner.query(`ALTER TABLE "inventory_checks" DROP COLUMN IF EXISTS "subject_type"`);
    await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "asset_issues"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "asset_issues"`);
  }
}
