import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * EPIC-18 Fáze 1.1 + 1.2 – Katalog permissions + role jako datové balíčky.
 * `permissions` = globální platformní katalog (namespace.resource.action).
 * `roles` = systémové šablony (tenant_id NULL) + budoucí tenantové role.
 * `role_permissions` = balíček permissions v roli. Zatím se NEVYNUCUJE (to je
 * krok 1.3 authorize() + 1.4 @RequirePermission) – čistě aditivní data.
 * Seed: core+asset katalog a 6 systémových rolí namapovaných z našich rank rolí.
 */
export class PermissionCatalog1870000000000 implements MigrationInterface {
  name = 'PermissionCatalog1870000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- permissions (globální katalog) ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "permissions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "key" text NOT NULL UNIQUE,
        "module_key" text NOT NULL,
        "resource" text NOT NULL,
        "action" text NOT NULL,
        "sensitivity" text NOT NULL DEFAULT 'normal',
        "description" text,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`GRANT SELECT ON "permissions" TO "tagery_app"`);

    // --- roles (systémové šablony + tenantové) ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "roles" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid REFERENCES "tenants"("id") ON DELETE CASCADE,
        "key" text NOT NULL,
        "name" text NOT NULL,
        "system_flag" boolean NOT NULL DEFAULT false,
        "description" text,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_roles_system_key" ON "roles" ("key") WHERE "tenant_id" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_roles_tenant_key" ON "roles" ("tenant_id", "key") WHERE "tenant_id" IS NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "roles" FORCE ROW LEVEL SECURITY`);
    // Systémové role (NULL) vidí všichni; tenantové jen jejich tenant.
    await queryRunner.query(`
      CREATE POLICY "role_visibility" ON "roles"
      USING ("tenant_id" IS NULL OR "tenant_id" = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
    `);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON "roles" TO "tagery_app"`);

    // --- role_permissions (balíček) ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "role_permissions" (
        "role_id" uuid NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
        "permission_id" uuid NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE,
        PRIMARY KEY ("role_id", "permission_id")
      )
    `);
    await queryRunner.query(
      `GRANT SELECT, INSERT, DELETE ON "role_permissions" TO "tagery_app"`,
    );

    // --- Seed katalogu (idempotentně) ---
    const keys = [
      // core
      'core.organization.view', 'core.organization.configure',
      'core.member.view', 'core.member.invite', 'core.member.update', 'core.member.deactivate',
      'core.role.view', 'core.role.manage',
      'core.scope.manage',
      'core.location.view', 'core.location.create', 'core.location.update', 'core.location.deactivate',
      'core.audit.view', 'core.audit.export',
      'core.module.view', 'core.module.configure',
      'core.integration.manage',
      // asset
      'asset.item.view', 'asset.item.create', 'asset.item.update', 'asset.item.delete',
      'asset.item.assign', 'asset.item.transfer',
      'asset.movement.perform', 'asset.dispatch.bulk', 'asset.scan.use',
      'asset.inventory.manage', 'asset.identifier.manage', 'asset.category.manage',
      'asset.media.manage', 'asset.issue.manage',
      'asset.reservation.view', 'asset.reservation.approve',
    ];
    const values = keys.map((k) => `('${k}')`).join(',');
    await queryRunner.query(`
      INSERT INTO "permissions" ("key", "module_key", "resource", "action", "sensitivity")
      SELECT k, split_part(k,'.',1), split_part(k,'.',2), split_part(k,'.',3),
             CASE WHEN k IN ('core.role.manage','core.member.invite','core.member.deactivate',
                             'core.integration.manage','core.organization.configure')
                  THEN 'high' ELSE 'normal' END
      FROM (VALUES ${values}) AS t(k)
      ON CONFLICT ("key") DO NOTHING
    `);

    // --- Seed systémových rolí (mapování našich rank rolí) ---
    await queryRunner.query(`
      INSERT INTO "roles" ("tenant_id", "key", "name", "system_flag") VALUES
      (NULL,'owner','Vlastník organizace',true),
      (NULL,'admin','Administrátor organizace',true),
      (NULL,'manager','Manažer',true),
      (NULL,'editor','Editor',true),
      (NULL,'viewer','Náhled',true),
      (NULL,'scan_only','Skener',true)
      ON CONFLICT DO NOTHING
    `);

    // --- Balíčky (role_permissions) ---
    // owner + admin = vše
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("role_id","permission_id")
      SELECT r.id, p.id FROM "roles" r CROSS JOIN "permissions" p
      WHERE r.tenant_id IS NULL AND r.key IN ('owner','admin')
      ON CONFLICT DO NOTHING
    `);
    // manager = asset.* + core.member.view + core.location.view + core.audit.view
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("role_id","permission_id")
      SELECT r.id, p.id FROM "roles" r JOIN "permissions" p
        ON (p.module_key='asset' OR p.key IN ('core.member.view','core.location.view','core.audit.view'))
      WHERE r.tenant_id IS NULL AND r.key='manager'
      ON CONFLICT DO NOTHING
    `);
    // editor = asset.* kromě reservation.approve + core.member.view + core.location.view
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("role_id","permission_id")
      SELECT r.id, p.id FROM "roles" r JOIN "permissions" p
        ON ((p.module_key='asset' AND p.key <> 'asset.reservation.approve')
            OR p.key IN ('core.member.view','core.location.view'))
      WHERE r.tenant_id IS NULL AND r.key='editor'
      ON CONFLICT DO NOTHING
    `);
    // viewer = asset views + core.member.view + core.location.view
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("role_id","permission_id")
      SELECT r.id, p.id FROM "roles" r JOIN "permissions" p
        ON ((p.module_key='asset' AND p.action='view')
            OR p.key IN ('core.member.view','core.location.view'))
      WHERE r.tenant_id IS NULL AND r.key='viewer'
      ON CONFLICT DO NOTHING
    `);
    // scan_only = asset.scan.use + asset.item.view
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("role_id","permission_id")
      SELECT r.id, p.id FROM "roles" r JOIN "permissions" p
        ON (p.key IN ('asset.scan.use','asset.item.view'))
      WHERE r.tenant_id IS NULL AND r.key='scan_only'
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "role_permissions"`);
    await queryRunner.query(`DROP POLICY IF EXISTS "role_visibility" ON "roles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "roles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "permissions"`);
  }
}
