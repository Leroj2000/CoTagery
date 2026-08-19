import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * EPIC-18 Fáze 3 – entitlementy modulů per organizace. Opt-out model: modul je
 * aktivní, pokud NENÍ explicitní `inactive` řádek (nic se nerozbije, admin může
 * modul vypnout). `authorize()` čte neaktivní moduly přes SECURITY DEFINER
 * (guard fáze bez tenant kontextu). Tenant-scoped, RLS.
 */
export class OrganizationModules1885000000000 implements MigrationInterface {
  name = 'OrganizationModules1885000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "organization_modules" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "module_key" text NOT NULL,
        "state" text NOT NULL DEFAULT 'active',
        "limits_json" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_org_modules_tenant_key" ON "organization_modules" ("tenant_id", "module_key")`,
    );
    await queryRunner.query(`ALTER TABLE "organization_modules" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "organization_modules" FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "organization_modules"
      USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
    `);
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON "organization_modules" TO "tagery_app"`,
    );

    // Neaktivní moduly organizace – čteno v guard fázi (bez tenant kontextu).
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION org_inactive_modules(p_org uuid)
      RETURNS TABLE (module_key text)
      LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
        SELECT module_key FROM organization_modules
         WHERE tenant_id = p_org AND state = 'inactive'
      $$;
    `);
    await queryRunner.query(`GRANT EXECUTE ON FUNCTION org_inactive_modules(uuid) TO "tagery_app"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS org_inactive_modules(uuid)`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organization_modules"`);
  }
}
