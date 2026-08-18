import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * EPIC-18 Fáze 0.1 – Identita nad organizacemi (User/Membership split).
 * Aditivní (expand): users zůstávají, přidá se GLOBÁLNÍ unikátní email (jedna
 * identita), tabulky `memberships` (user×organizace) a `role_assignments`
 * (role + scope + časová platnost). Backfill: každý stávající user → 1 membership
 * v jeho současné organizaci se stejnou rolí (scope ORGANIZATION). Auth flow se
 * NEMĚNÍ v této migraci (to je 0.2). users.tenant_id zůstává (contract později).
 */
export class IdentityMemberships1865000000000 implements MigrationInterface {
  name = 'IdentityMemberships1865000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Globální unikátní email = jedna identita napříč organizacemi.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_users_email" ON "users" ("email")`,
    );

    // --- memberships (user × organizace) ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "org_memberships" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "role" text NOT NULL DEFAULT 'VIEWER',
        "status" text NOT NULL DEFAULT 'active',
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_org_memberships_tenant_user" ON "org_memberships" ("tenant_id", "user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_org_memberships_user" ON "org_memberships" ("user_id")`,
    );
    await queryRunner.query(`ALTER TABLE "org_memberships" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "org_memberships" FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "org_memberships"
      USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
    `);
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON "org_memberships" TO "tagery_app"`,
    );

    // --- role_assignments (role + scope + časová platnost) ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "role_assignments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "membership_id" uuid NOT NULL REFERENCES "org_memberships"("id") ON DELETE CASCADE,
        "role_key" text NOT NULL,
        "scope_type" text NOT NULL DEFAULT 'ORGANIZATION',
        "scope_ref" uuid,
        "valid_from" timestamptz NOT NULL DEFAULT now(),
        "valid_to" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_role_assignments_membership" ON "role_assignments" ("membership_id")`,
    );
    await queryRunner.query(`ALTER TABLE "role_assignments" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "role_assignments" FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "role_assignments"
      USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
    `);
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON "role_assignments" TO "tagery_app"`,
    );

    // --- Backfill (migrace běží jako superuser → obchází RLS) ---
    await queryRunner.query(`
      INSERT INTO "org_memberships" ("tenant_id", "user_id", "role", "status")
      SELECT u."tenant_id", u."id", u."tenant_role", u."status" FROM "users" u
      ON CONFLICT ("tenant_id", "user_id") DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO "role_assignments" ("tenant_id", "membership_id", "role_key", "scope_type")
      SELECT m."tenant_id", m."id", m."role", 'ORGANIZATION' FROM "org_memberships" m
      WHERE NOT EXISTS (
        SELECT 1 FROM "role_assignments" ra WHERE ra."membership_id" = m."id"
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "role_assignments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "role_assignments"`);
    await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "org_memberships"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "org_memberships"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "ux_users_email"`);
  }
}
