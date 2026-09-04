import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Kategorie osob (číselník, tenant-scoped, RLS) + zařazení. Party osoba má
 * `people.category_id`; uživatel (účet) má kategorii per-firma přes
 * `org_memberships.person_category_id`. Obojí odkazuje stejný číselník.
 */
export class PersonCategories1918000000000 implements MigrationInterface {
  name = 'PersonCategories1918000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "person_categories" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "name" text NOT NULL,
        "color" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_person_categories_tenant_name" ON "person_categories" ("tenant_id", "name")`,
    );
    await queryRunner.query(`ALTER TABLE "person_categories" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "person_categories" FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "person_categories"
      USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
    `);
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON "person_categories" TO "tagery_app"`,
    );

    await queryRunner.query(
      `ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "category_id" uuid REFERENCES "person_categories"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "org_memberships" ADD COLUMN IF NOT EXISTS "person_category_id" uuid REFERENCES "person_categories"("id") ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "org_memberships" DROP COLUMN IF EXISTS "person_category_id"`);
    await queryRunner.query(`ALTER TABLE "people" DROP COLUMN IF EXISTS "category_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "person_categories"`);
  }
}
