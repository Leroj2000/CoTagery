import { MigrationInterface, QueryRunner } from 'typeorm';

/** EPIC-15 Access-Control: access_points + access_events (tenant-scoped, RLS). */
export class InitAccessControl1760000000000 implements MigrationInterface {
  name = 'InitAccessControl1760000000000';

  private readonly rlsTables = ['access_points', 'access_events'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "access_points" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "location_id" uuid REFERENCES "locations"("id") ON DELETE SET NULL,
        "name" text NOT NULL,
        "zone_key" text NOT NULL,
        "direction" text NOT NULL DEFAULT 'in',
        "settings_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "access_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "access_point_id" uuid NOT NULL REFERENCES "access_points"("id") ON DELETE CASCADE,
        "subject_type" text NOT NULL,
        "subject_ref" text NOT NULL,
        "decision" text NOT NULL,
        "reason" text,
        "entitlement_ref" text,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_access_events_point" ON "access_events" ("access_point_id", "created_at")`,
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
    await queryRunner.query(`DROP TABLE IF EXISTS "access_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "access_points"`);
  }
}
