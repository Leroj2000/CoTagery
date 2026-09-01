import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * EPIC-21 F1 – síť/discovery nad půjčovnou.
 * - `tenants.network_listed`: opt-in viditelnost firmy v síti (default false).
 * - `network_follows`: follow graf (nájemce → firma). Platform-global, VLASTNÍ ho
 *   nájemce (ne tenant) → záměrně MIMO tenant RLS (jako `users`/`renter_profiles`).
 * - SECURITY DEFINER funkce = jediná cesta ke čtení/zápisu; gate `network_listed`
 *   i počet inzerátů (obchází RLS `rental_listing`) žijí v SQL (ADR-0002).
 */
export class NetworkFollows1913000000000 implements MigrationInterface {
  name = 'NetworkFollows1913000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "network_listed" boolean NOT NULL DEFAULT false`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "network_follows" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "renter_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_network_follow" UNIQUE ("renter_user_id", "tenant_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_network_follows_user" ON "network_follows" ("renter_user_id")`,
    );
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON "network_follows" TO "tagery_app"`,
    );

    // Follow: jen když je firma opt-in v síti. Vrací true = sledováno.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION network_follow(p_user uuid, p_tenant uuid)
      RETURNS boolean
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = p_tenant AND network_listed) THEN
          RETURN false;
        END IF;
        INSERT INTO network_follows (renter_user_id, tenant_id)
        VALUES (p_user, p_tenant)
        ON CONFLICT ON CONSTRAINT uq_network_follow DO NOTHING;
        RETURN true;
      END;
      $$;
    `);
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION network_follow(uuid, uuid) TO "tagery_app"`,
    );

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION network_unfollow(p_user uuid, p_tenant uuid)
      RETURNS void
      LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
        DELETE FROM network_follows WHERE renter_user_id = p_user AND tenant_id = p_tenant;
      $$;
    `);
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION network_unfollow(uuid, uuid) TO "tagery_app"`,
    );

    // Sledované firmy nájemce – jen ty stále opt-in, s počtem publikovaných inzerátů.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION network_followed_tenants(p_user uuid)
      RETURNS TABLE (
        tenant_id uuid, name text, slug text, listing_count integer, followed_at timestamptz
      )
      LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
        SELECT t.id, t.name, t.slug,
          (SELECT count(*)::int FROM rental_listing l
             WHERE l.tenant_id = t.id AND l.status = 'published'),
          f.created_at
        FROM network_follows f
          JOIN tenants t ON t.id = f.tenant_id
        WHERE f.renter_user_id = p_user AND t.network_listed
        ORDER BY f.created_at DESC
      $$;
    `);
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION network_followed_tenants(uuid) TO "tagery_app"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS network_followed_tenants(uuid)`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS network_unfollow(uuid, uuid)`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS network_follow(uuid, uuid)`);
    await queryRunner.query(`DROP TABLE IF EXISTS "network_follows"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "network_listed"`);
  }
}
