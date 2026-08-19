import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * EPIC-18 Fáze 1.4 – čtení permissions systémové role MIMO tenant kontext.
 * `AuthzService` běží ve fázi guardu (bez `app.tenant_id`), takže nesmí záviset
 * na RLS `roles`. SECURITY DEFINER funkce obejde RLS (čte jen systémové role
 * tenant_id IS NULL). Navíc zpevní `roles` policy přes nullif, aby prázdný
 * `app.tenant_id` nespadl na `''::uuid`.
 */
export class RolePermissionKeysFn1875000000000 implements MigrationInterface {
  name = 'RolePermissionKeysFn1875000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION role_permission_keys(p_role_key text)
      RETURNS TABLE (key text)
      LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
        SELECT p.key FROM roles r
          JOIN role_permissions rp ON rp.role_id = r.id
          JOIN permissions p ON p.id = rp.permission_id
         WHERE r.tenant_id IS NULL AND r.key = p_role_key
      $$;
    `);
    await queryRunner.query(`GRANT EXECUTE ON FUNCTION role_permission_keys(text) TO "tagery_app"`);

    // Zpevnění policy: prázdný app.tenant_id → NULL (ne ''::uuid).
    await queryRunner.query(`DROP POLICY IF EXISTS "role_visibility" ON "roles"`);
    await queryRunner.query(`
      CREATE POLICY "role_visibility" ON "roles"
      USING ("tenant_id" IS NULL OR "tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS role_permission_keys(text)`);
    await queryRunner.query(`DROP POLICY IF EXISTS "role_visibility" ON "roles"`);
    await queryRunner.query(`
      CREATE POLICY "role_visibility" ON "roles"
      USING ("tenant_id" IS NULL OR "tenant_id" = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
    `);
  }
}
