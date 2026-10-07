import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Role-based čtení osob (M3 zpřísnění): nové oprávnění `core.person.view`
 * pro výpis osob a kategorií osob. Grant VIEWER/EDITOR/MANAGER; OWNER/ADMIN
 * mají implicitně vše (AuthzService). Aditivní, idempotentní.
 */
export class PersonViewPermission1928000000000 implements MigrationInterface {
  name = 'PersonViewPermission1928000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "permissions" ("key", "module_key", "resource", "action", "sensitivity")
      VALUES ('core.person.view', 'core', 'person', 'view', 'normal')
      ON CONFLICT ("key") DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("role_id", "permission_id")
      SELECT r.id, p.id FROM "roles" r JOIN "permissions" p ON p.key = 'core.person.view'
      WHERE r.tenant_id IS NULL AND r.key IN ('viewer', 'editor', 'manager')
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "permissions" WHERE "key" = 'core.person.view'`);
  }
}
