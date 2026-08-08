import { MigrationInterface, QueryRunner } from 'typeorm';

/** EPIC-08 Product modul: tabulka products (tenant-scoped, RLS). */
export class InitProduct1755000000000 implements MigrationInterface {
  name = 'InitProduct1755000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "products" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "digital_object_id" uuid NOT NULL REFERENCES "digital_objects"("id") ON DELETE CASCADE,
        "gtin" text,
        "brand" text,
        "name" text NOT NULL,
        "description" text,
        "ingredients" text,
        "origin" text,
        "care_instructions" text,
        "media" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_products_object" ON "products" ("digital_object_id")`,
    );
    await queryRunner.query(`ALTER TABLE "products" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "products" FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "products"
      USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
    `);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON "products" TO "tagery_app"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "products"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "products"`);
  }
}
