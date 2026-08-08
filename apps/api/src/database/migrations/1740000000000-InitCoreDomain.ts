import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * EPIC-03 Core-Domain: rozšíření tenants, tabulky locations/groups/group_members
 * a PostgreSQL Row Level Security (ADR-0001).
 *
 * Politika `tenant_isolation` porovnává tenant_id s `app.tenant_id`, které
 * per-request nastavuje TenantTransactionInterceptor (SET LOCAL). Chybějící
 * hodnota → NULL → žádné řádky (bezpečné výchozí odepření).
 * FORCE ROW LEVEL SECURITY zajistí, že RLS platí i pro vlastníka tabulky
 * (aplikace se připojuje jako vlastník).
 */
export class InitCoreDomain1740000000000 implements MigrationInterface {
  name = 'InitCoreDomain1740000000000';

  private readonly rlsTables = ['locations', 'groups', 'group_members'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "branding_domain" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "settings_json" jsonb NOT NULL DEFAULT '{}'::jsonb`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "locations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "name" text NOT NULL,
        "type" text NOT NULL DEFAULT 'store',
        "address" text,
        "timezone" text NOT NULL DEFAULT 'Europe/Prague',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "groups" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "name" text NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "group_members" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "group_id" uuid NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_locations_tenant" ON "locations" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_groups_tenant" ON "groups" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_group_members" ON "group_members" ("group_id", "user_id")`,
    );

    for (const table of this.rlsTables) {
      await queryRunner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
      await queryRunner.query(`
        CREATE POLICY "tenant_isolation" ON "${table}"
        USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
        WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
      `);
    }

    // Runtime aplikační role: NE-superuser podléhající RLS (ADR-0001).
    // Migrace/seed běží pod vlastníkem; aplikace se za běhu připojuje jako tagery_app.
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'tagery_app') THEN
          CREATE ROLE "tagery_app" LOGIN PASSWORD 'tagery_app' NOSUPERUSER NOBYPASSRLS;
        END IF;
      END $$;
    `);
    await queryRunner.query(`GRANT USAGE ON SCHEMA public TO "tagery_app"`);
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "tagery_app"`,
    );
    await queryRunner.query(
      `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "tagery_app"`,
    );
    await queryRunner.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "tagery_app"`,
    );
    await queryRunner.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO "tagery_app"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.rlsTables) {
      await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "${table}"`);
    }
    await queryRunner.query(`DROP TABLE IF EXISTS "group_members"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "groups"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "locations"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "settings_json"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "branding_domain"`);
  }
}
