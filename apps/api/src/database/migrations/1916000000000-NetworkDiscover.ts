import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * EPIC-21 F3 – objevování + profil firmy v síti (obojí VEŘEJNÉ, SECURITY DEFINER
 * nad veřejnou projekcí).
 * - `network_discover`: publikované inzeráty všech opt-in firem, fulltext (ILIKE)
 *   přes název/popis/položku/kategorii/firmu/lokalitu.
 * - `public_tenant_profile`: hlavička storefrontu (opt-in flag, počet sledujících,
 *   počet inzerátů) pro follow tlačítko.
 */
export class NetworkDiscover1916000000000 implements MigrationInterface {
  name = 'NetworkDiscover1916000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION network_discover(p_query text, p_limit integer, p_offset integer)
      RETURNS TABLE (
        listing_id uuid, slug text, title text, description text, currency text,
        price_per_day numeric, price_per_hour numeric, price_per_week numeric,
        deposit_amount numeric, min_days integer, max_days integer,
        pickup text, asset_name text, photo_count integer,
        tenant_id uuid, tenant_name text, tenant_slug text, published_at timestamptz
      )
      LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
        SELECT l.id, l.slug, l.title, l.description, l.currency,
          l.price_per_day, l.price_per_hour, l.price_per_week, l.deposit_amount,
          l.min_days, l.max_days, loc.name, a.name,
          (SELECT count(*)::int FROM asset_photos ap WHERE ap.asset_id = l.asset_id),
          t.id, t.name, t.slug, l.published_at
        FROM rental_listing l
          JOIN tenants t ON t.id = l.tenant_id AND t.network_listed
          JOIN assets a ON a.id = l.asset_id
          LEFT JOIN locations loc ON loc.id = l.pickup_location_id
        WHERE l.status = 'published'
          AND (
            p_query IS NULL OR p_query = '' OR
            l.title ILIKE '%' || p_query || '%' OR
            coalesce(l.description, '') ILIKE '%' || p_query || '%' OR
            a.name ILIKE '%' || p_query || '%' OR
            coalesce(a.category, '') ILIKE '%' || p_query || '%' OR
            t.name ILIKE '%' || p_query || '%' OR
            coalesce(loc.name, '') ILIKE '%' || p_query || '%'
          )
        ORDER BY l.published_at DESC NULLS LAST
        LIMIT GREATEST(p_limit, 0) OFFSET GREATEST(p_offset, 0)
      $$;
    `);
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION network_discover(text, integer, integer) TO "tagery_app"`,
    );

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public_tenant_profile(p_slug text)
      RETURNS TABLE (
        tenant_id uuid, name text, slug text, network_listed boolean,
        follower_count integer, listing_count integer
      )
      LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
        SELECT t.id, t.name, t.slug, t.network_listed,
          (SELECT count(*)::int FROM network_follows f WHERE f.tenant_id = t.id),
          (SELECT count(*)::int FROM rental_listing l
             WHERE l.tenant_id = t.id AND l.status = 'published')
        FROM tenants t
        WHERE t.slug = p_slug
        LIMIT 1
      $$;
    `);
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION public_tenant_profile(text) TO "tagery_app"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS public_tenant_profile(text)`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS network_discover(text, integer, integer)`);
  }
}
