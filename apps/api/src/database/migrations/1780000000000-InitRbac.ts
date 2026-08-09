import { MigrationInterface, QueryRunner } from 'typeorm';

/** EPIC-06 RBAC-ACL: object_permissions (tenant-scoped, RLS). */
export class InitRbac1780000000000 implements MigrationInterface {
  name = 'InitRbac1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "object_permissions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "digital_object_id" uuid NOT NULL REFERENCES "digital_objects"("id") ON DELETE CASCADE,
        "subject_type" text NOT NULL,
        "subject_id" text NOT NULL,
        "permission" text NOT NULL,
        "expires_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_object_permissions" ON "object_permissions" ("digital_object_id", "subject_type", "subject_id")`,
    );
    await queryRunner.query(`ALTER TABLE "object_permissions" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "object_permissions" FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "object_permissions"
      USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
    `);
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON "object_permissions" TO "tagery_app"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "object_permissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "object_permissions"`);
  }
}
