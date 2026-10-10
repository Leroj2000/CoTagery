import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Role spravované firmou (matice oprávnění + hierarchie + delegace).
 *
 * - `roles.rank` = úroveň v hierarchii (owner 100 … scan_only 10). Role smí
 *   spravovat a přidělovat jen role s nižší úrovní, než má sama.
 * - `roles.all_permissions` = role má implicitně celý katalog (owner vždy;
 *   systémová šablona admin, dokud ji firma neupraví → pak explicitní sada).
 * - Firemní řádek se stejným klíčem jako systémová šablona = úprava šablony pro
 *   tuto firmu (copy-on-write, „Obnovit výchozí" ho smaže). Vlastní role mají
 *   klíč `c_…`.
 * - `tenant_role_permission_keys(tenant, key)` / `tenant_role_info(tenant, key)`
 *   = efektivní role pro firmu (firemní řádek má přednost před šablonou);
 *   SECURITY DEFINER, protože autorizace běží ve fázi guardu bez app.tenant_id.
 * - Zpevnění RLS: dosavadní policy `roles` dovolovala UPDATE systémového řádku
 *   s přepsáním tenant_id na vlastní (únos šablony pro všechny firmy) a
 *   `role_permissions` RLS neměla vůbec. Nově: šablony jen ke čtení, zápis jen
 *   do vlastních rolí firmy.
 */
export class TenantRoles1928400000000 implements MigrationInterface {
  name = 'TenantRoles1928400000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE roles
      ADD COLUMN rank integer NOT NULL DEFAULT 10,
      ADD COLUMN all_permissions boolean NOT NULL DEFAULT false,
      ADD COLUMN based_on text,
      ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now()`);
    await q.query(`UPDATE roles SET rank = CASE key
        WHEN 'owner' THEN 100 WHEN 'admin' THEN 80 WHEN 'manager' THEN 60
        WHEN 'editor' THEN 40 WHEN 'viewer' THEN 20 WHEN 'scan_only' THEN 10 ELSE rank END,
      all_permissions = key IN ('owner','admin')
      WHERE tenant_id IS NULL`);
    await q.query(`UPDATE roles SET description = CASE key
        WHEN 'owner' THEN 'Plný přístup včetně předání vlastnictví. Nelze upravit.'
        WHEN 'admin' THEN 'Správa firmy, uživatelů a rolí pod sebou.'
        WHEN 'manager' THEN 'Vedení evidence, schvalování požadavků, přehledy.'
        WHEN 'editor' THEN 'Běžná práce s položkami, pohyby a inventurami.'
        WHEN 'viewer' THEN 'Jen prohlížení evidence.'
        WHEN 'scan_only' THEN 'Skenování a identifikace položek.'
        ELSE description END
      WHERE tenant_id IS NULL AND description IS NULL`);

    // --- RLS roles: čtení šablon + vlastních, zápis jen vlastních ---
    await q.query(`DROP POLICY IF EXISTS "role_visibility" ON roles`);
    const tenant = `nullif(current_setting('app.tenant_id', true), '')::uuid`;
    await q.query(`CREATE POLICY roles_select ON roles FOR SELECT
      USING (tenant_id IS NULL OR tenant_id = ${tenant})`);
    await q.query(`CREATE POLICY roles_insert ON roles FOR INSERT
      WITH CHECK (tenant_id = ${tenant})`);
    await q.query(`CREATE POLICY roles_update ON roles FOR UPDATE
      USING (tenant_id = ${tenant}) WITH CHECK (tenant_id = ${tenant})`);
    await q.query(`CREATE POLICY roles_delete ON roles FOR DELETE
      USING (tenant_id = ${tenant})`);

    // --- RLS role_permissions: přes vlastnictví role ---
    await q.query(`ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY`);
    await q.query(`ALTER TABLE role_permissions FORCE ROW LEVEL SECURITY`);
    await q.query(`CREATE POLICY role_permissions_select ON role_permissions FOR SELECT
      USING (EXISTS (SELECT 1 FROM roles r WHERE r.id = role_id))`);
    await q.query(`CREATE POLICY role_permissions_insert ON role_permissions FOR INSERT
      WITH CHECK (EXISTS (SELECT 1 FROM roles r WHERE r.id = role_id AND r.tenant_id = ${tenant}))`);
    await q.query(`CREATE POLICY role_permissions_delete ON role_permissions FOR DELETE
      USING (EXISTS (SELECT 1 FROM roles r WHERE r.id = role_id AND r.tenant_id = ${tenant}))`);

    // --- Efektivní role pro firmu (firemní řádek > systémová šablona) ---
    await q.query(`CREATE OR REPLACE FUNCTION tenant_role_info(p_tenant uuid, p_role_key text)
      RETURNS TABLE (id uuid, key text, name text, rank integer, all_permissions boolean,
                     system_flag boolean, customized boolean)
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
        SELECT r.id, r.key, r.name, r.rank, r.all_permissions,
               EXISTS (SELECT 1 FROM roles s WHERE s.tenant_id IS NULL AND s.key = r.key),
               r.tenant_id IS NOT NULL
          FROM roles r
         WHERE r.key = lower(p_role_key) AND (r.tenant_id = p_tenant OR r.tenant_id IS NULL)
         ORDER BY r.tenant_id NULLS LAST
         LIMIT 1
      $$`);
    await q.query(`CREATE OR REPLACE FUNCTION tenant_role_permission_keys(p_tenant uuid, p_role_key text)
      RETURNS TABLE (key text)
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
        WITH r AS (SELECT * FROM tenant_role_info(p_tenant, p_role_key))
        SELECT p.key FROM r CROSS JOIN permissions p WHERE r.all_permissions
        UNION
        SELECT p.key FROM r
          JOIN role_permissions rp ON rp.role_id = r.id
          JOIN permissions p ON p.id = rp.permission_id
         WHERE NOT r.all_permissions
      $$`);
    await q.query(`GRANT EXECUTE ON FUNCTION tenant_role_info(uuid, text) TO tagery_app`);
    await q.query(
      `GRANT EXECUTE ON FUNCTION tenant_role_permission_keys(uuid, text) TO tagery_app`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP FUNCTION IF EXISTS tenant_role_permission_keys(uuid, text)`);
    await q.query(`DROP FUNCTION IF EXISTS tenant_role_info(uuid, text)`);
    for (const p of ['select', 'insert', 'delete']) {
      await q.query(`DROP POLICY IF EXISTS role_permissions_${p} ON role_permissions`);
    }
    await q.query(`ALTER TABLE role_permissions DISABLE ROW LEVEL SECURITY`);
    for (const p of ['select', 'insert', 'update', 'delete']) {
      await q.query(`DROP POLICY IF EXISTS roles_${p} ON roles`);
    }
    await q.query(`CREATE POLICY "role_visibility" ON roles
      USING (tenant_id IS NULL OR tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)`);
    await q.query(`ALTER TABLE roles DROP COLUMN updated_at, DROP COLUMN based_on,
      DROP COLUMN all_permissions, DROP COLUMN rank`);
  }
}
