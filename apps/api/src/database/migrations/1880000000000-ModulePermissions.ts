import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * EPIC-18 Fáze 1.4 – permissions pro zbývající moduly + napojení do balíčků.
 * owner/admin mají implicitně vše (AuthzService), takže se linkuje jen do
 * editor/manager. Aditivní, idempotentní.
 */
export class ModulePermissions1880000000000 implements MigrationInterface {
  name = 'ModulePermissions1880000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const keys = [
      'object.item.manage', 'carrier.item.manage', 'core.person.manage', 'core.group.manage',
      'access.point.manage', 'rental.item.manage', 'rental.renter.verify',
      'billing.subscription.manage', 'product.item.manage', 'membership.card.manage',
      'found.report.handle', 'gallery.item.manage', 'ticketing.event.manage',
    ];
    const values = keys.map((k) => `('${k}')`).join(',');
    await queryRunner.query(`
      INSERT INTO "permissions" ("key", "module_key", "resource", "action", "sensitivity")
      SELECT k, split_part(k,'.',1), split_part(k,'.',2), split_part(k,'.',3),
             CASE WHEN k IN ('core.group.manage') THEN 'high' ELSE 'normal' END
      FROM (VALUES ${values}) AS t(k)
      ON CONFLICT ("key") DO NOTHING
    `);

    // editor + manager: provozní správa modulů (owner/admin implicitně)
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("role_id","permission_id")
      SELECT r.id, p.id FROM "roles" r JOIN "permissions" p ON p.key IN (
        'object.item.manage','carrier.item.manage','core.person.manage','core.location.create',
        'access.point.manage','rental.item.manage','product.item.manage','membership.card.manage',
        'found.report.handle','gallery.item.manage','ticketing.event.manage')
      WHERE r.tenant_id IS NULL AND r.key IN ('editor','manager')
      ON CONFLICT DO NOTHING
    `);

    // manager navíc: ověření nájemce + billing (byly MANAGER)
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("role_id","permission_id")
      SELECT r.id, p.id FROM "roles" r JOIN "permissions" p
        ON p.key IN ('rental.renter.verify','billing.subscription.manage')
      WHERE r.tenant_id IS NULL AND r.key='manager'
      ON CONFLICT DO NOTHING
    `);
    // core.group.manage zůstává jen owner/admin (implicit) – nelinkuje se.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "permissions" WHERE "key" IN (
        'object.item.manage','carrier.item.manage','core.person.manage','core.group.manage',
        'access.point.manage','rental.item.manage','rental.renter.verify',
        'billing.subscription.manage','product.item.manage','membership.card.manage',
        'found.report.handle','gallery.item.manage','ticketing.event.manage')
    `);
  }
}
