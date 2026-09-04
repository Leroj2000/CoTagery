import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Kategorie osob many-to-many: osoba i uživatel může být ve více kategoriích.
 * Polymorfní `category_links` (subject = person | user), tenant-scoped (RLS).
 * Převádí dosavadní single zařazení (`people.category_id`,
 * `org_memberships.person_category_id`) a ty sloupce ruší.
 */
export class PersonCategoryLinks1920000000000 implements MigrationInterface {
  name = 'PersonCategoryLinks1920000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "category_links" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "category_id" uuid NOT NULL REFERENCES "person_categories"("id") ON DELETE CASCADE,
        "subject_type" text NOT NULL,
        "subject_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_category_links" ON "category_links" ("tenant_id", "category_id", "subject_type", "subject_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_category_links_subject" ON "category_links" ("tenant_id", "subject_type", "subject_id")`,
    );
    await queryRunner.query(`ALTER TABLE "category_links" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "category_links" FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "category_links"
      USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
    `);
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON "category_links" TO "tagery_app"`,
    );

    // Převod dosavadních single zařazení do links.
    await queryRunner.query(`
      INSERT INTO "category_links" ("tenant_id", "category_id", "subject_type", "subject_id")
      SELECT "tenant_id", "category_id", 'person', "id" FROM "people" WHERE "category_id" IS NOT NULL
      ON CONFLICT DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO "category_links" ("tenant_id", "category_id", "subject_type", "subject_id")
      SELECT "tenant_id", "person_category_id", 'user', "user_id" FROM "org_memberships" WHERE "person_category_id" IS NOT NULL
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`ALTER TABLE "people" DROP COLUMN IF EXISTS "category_id"`);
    await queryRunner.query(
      `ALTER TABLE "org_memberships" DROP COLUMN IF EXISTS "person_category_id"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "category_id" uuid REFERENCES "person_categories"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "org_memberships" ADD COLUMN IF NOT EXISTS "person_category_id" uuid REFERENCES "person_categories"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "category_links"`);
  }
}
