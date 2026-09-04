import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * EPIC-03 rozšíření – dva typy skupin: uživatelů (`user`) a osob (`person`).
 *
 * Schéma:
 *  - `groups.type` (text, default 'user'),
 *  - `group_members.person_id` (nullable, FK people ON DELETE CASCADE),
 *  - `group_members.user_id` → nullable (u person-skupin je prázdné),
 *  - partial unikáty: (group_id,user_id) kde user_id NOT NULL,
 *                     (group_id,person_id) kde person_id NOT NULL.
 *
 * RLS: nové sloupce jsou na existující tabulce group_members, která už má
 * tenant_isolation policy (InitCoreDomain). FK na people (tenant-scoped) je
 * čistě strukturální; izolaci nadále drží tenant_id + RLS.
 *
 * RBAC: nové permission `core.person_group.manage` (person-skupiny může spravovat
 * i EDITOR). Seed do role_permissions pro editor (owner/admin mají implicitně
 * vše přes AuthzService). `core.group.manage` zůstává jen owner/admin (nelinkuje
 * se do editor) → skupiny uživatelů může měnit jen ADMIN+. Aditivní, idempotentní.
 */
export class GroupTypes1919000000000 implements MigrationInterface {
  name = 'GroupTypes1919000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Schéma: typ skupiny + členství osob ---
    await queryRunner.query(
      `ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "type" text NOT NULL DEFAULT 'user'`,
    );
    await queryRunner.query(
      `ALTER TABLE "group_members" ADD COLUMN IF NOT EXISTS "person_id" uuid ` +
        `REFERENCES "people"("id") ON DELETE CASCADE`,
    );
    // user_id už nesmí být povinné (u person-skupin je prázdné).
    await queryRunner.query(`ALTER TABLE "group_members" ALTER COLUMN "user_id" DROP NOT NULL`);

    // Přepiš unikát na partial (jen pro neprázdné hodnoty).
    await queryRunner.query(`DROP INDEX IF EXISTS "ux_group_members"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_group_members_user" ` +
        `ON "group_members" ("group_id", "user_id") WHERE "user_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_group_members_person" ` +
        `ON "group_members" ("group_id", "person_id") WHERE "person_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_group_members_person" ON "group_members" ("person_id")`,
    );

    // --- RBAC: nové permission core.person_group.manage ---
    await queryRunner.query(`
      INSERT INTO "permissions" ("key", "module_key", "resource", "action", "sensitivity")
      VALUES ('core.person_group.manage', 'core', 'person_group', 'manage', 'normal')
      ON CONFLICT ("key") DO NOTHING
    `);

    // editor: person-skupiny (owner/admin mají implicitně vše).
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("role_id","permission_id")
      SELECT r.id, p.id FROM "roles" r JOIN "permissions" p
        ON p.key = 'core.person_group.manage'
      WHERE r.tenant_id IS NULL AND r.key = 'editor'
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "role_permissions" rp USING "permissions" p
      WHERE rp.permission_id = p.id AND p.key = 'core.person_group.manage'
    `);
    await queryRunner.query(`DELETE FROM "permissions" WHERE "key" = 'core.person_group.manage'`);

    await queryRunner.query(`DROP INDEX IF EXISTS "ix_group_members_person"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "ux_group_members_person"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "ux_group_members_user"`);
    // Obnov původní unikát (jen validní, když nejsou person-členové).
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_group_members" ` +
        `ON "group_members" ("group_id", "user_id")`,
    );

    await queryRunner.query(`ALTER TABLE "group_members" DROP COLUMN IF EXISTS "person_id"`);
    await queryRunner.query(`ALTER TABLE "groups" DROP COLUMN IF EXISTS "type"`);
  }
}
