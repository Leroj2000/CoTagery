import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Platform-admin vrstva (ADR-0009 open Q#2): globální provozovatel (Tagery), který
 * smí zakládat firmy a vidět všechny firmy napříč tenanty. Označen flagem na `users`
 * (tabulka nemá RLS). Cross-tenant počty (položky/uživatelé na firmu) přes SECURITY
 * DEFINER agregát (obchází RLS bezpečně, jen pro platform endpointy).
 */
export class PlatformAdmin1908000000000 implements MigrationInterface {
  name = 'PlatformAdmin1908000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_platform_admin" boolean NOT NULL DEFAULT false`,
    );

    // Bootstrap: demo OWNER = první platform-admin (ať jde vrstva hned testovat).
    await queryRunner.query(
      `UPDATE "users" SET "is_platform_admin" = true WHERE "email" = 'owner@demo.tagery'`,
    );

    // Cross-tenant statistiky firem pro platform přehled (obchází RLS).
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION platform_tenant_stats()
      RETURNS TABLE (tenant_id uuid, user_count integer, asset_count integer)
      LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
        SELECT t.id,
          (SELECT count(*)::int FROM org_memberships m WHERE m.tenant_id = t.id),
          (SELECT count(*)::int FROM assets a WHERE a.tenant_id = t.id)
        FROM tenants t
      $$;
    `);
    await queryRunner.query(`GRANT EXECUTE ON FUNCTION platform_tenant_stats() TO "tagery_app"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS platform_tenant_stats()`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "is_platform_admin"`);
  }
}
