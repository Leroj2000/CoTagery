import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Veřejné projekce nemají JWT ani tenant context. Tyto úzké SECURITY DEFINER
 * predikáty jim umožní respektovat stejný stav modulů jako autentizované API.
 */
export class PublicModuleGates1921000000000 implements MigrationInterface {
  name = 'PublicModuleGates1921000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION is_org_module_active(p_tenant uuid, p_module text)
      RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
        SELECT EXISTS (SELECT 1 FROM tenants WHERE id = p_tenant)
          AND NOT EXISTS (
            SELECT 1 FROM organization_modules
             WHERE tenant_id = p_tenant AND module_key = p_module AND state = 'inactive'
          )
      $$
    `);
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION is_org_module_active(uuid, text) TO "tagery_app"`,
    );

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION is_public_rental_tenant_active(p_slug text)
      RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
        SELECT COALESCE((
          SELECT is_org_module_active(t.id, 'rental') FROM tenants t WHERE t.slug = p_slug
        ), false)
      $$
    `);
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION is_public_rental_tenant_active(text) TO "tagery_app"`,
    );

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION is_public_rental_listing_active(p_listing uuid)
      RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
        SELECT COALESCE((
          SELECT l.status = 'published' AND is_org_module_active(l.tenant_id, 'rental')
            FROM rental_listing l WHERE l.id = p_listing
        ), false)
      $$
    `);
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION is_public_rental_listing_active(uuid) TO "tagery_app"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS is_public_rental_listing_active(uuid)`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS is_public_rental_tenant_active(text)`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS is_org_module_active(uuid, text)`);
  }
}
