import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * EPIC-18 Fáze 0.2 – Identity-layer čtení „moje členství napříč organizacemi".
 * SECURITY DEFINER (běží jako vlastník → obchází per-tenant RLS), ale striktně
 * filtruje podle p_user_id → vrací JEN členství dané identity (org + role + stav),
 * NE interní data organizací. Stejný řízený vzor jako `resolve_carrier`.
 */
export class MyMembershipsFn1866000000000 implements MigrationInterface {
  name = 'MyMembershipsFn1866000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION my_memberships(p_user_id uuid)
      RETURNS TABLE (
        membership_id uuid,
        organization_id uuid,
        organization_name text,
        role text,
        status text,
        created_at timestamptz
      )
      LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
        SELECT m.id, m.tenant_id, t.name, m.role, m.status, m.created_at
        FROM memberships m
        JOIN tenants t ON t.id = m.tenant_id
        WHERE m.user_id = p_user_id AND m.status = 'active'
        ORDER BY t.name
      $$;
    `);
    await queryRunner.query(`GRANT EXECUTE ON FUNCTION my_memberships(uuid) TO "tagery_app"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS my_memberships(uuid)`);
  }
}
