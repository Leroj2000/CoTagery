import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * EPIC-21 F2 – feed sítě. SECURITY DEFINER: publikované inzeráty firem, které
 * nájemce sleduje A jsou stále opt-in (`network_listed`). Čte výhradně veřejnou
 * projekci (obchází RLS `rental_listing`), řazeno dle `published_at DESC`.
 */
export class NetworkFeed1914000000000 implements MigrationInterface {
  name = 'NetworkFeed1914000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION network_feed(p_user uuid, p_limit integer, p_offset integer)
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
        FROM network_follows f
          JOIN tenants t ON t.id = f.tenant_id AND t.network_listed
          JOIN rental_listing l ON l.tenant_id = t.id AND l.status = 'published'
          JOIN assets a ON a.id = l.asset_id
          LEFT JOIN locations loc ON loc.id = l.pickup_location_id
        WHERE f.renter_user_id = p_user
        ORDER BY l.published_at DESC NULLS LAST
        LIMIT GREATEST(p_limit, 0) OFFSET GREATEST(p_offset, 0)
      $$;
    `);
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION network_feed(uuid, integer, integer) TO "tagery_app"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS network_feed(uuid, integer, integer)`);
  }
}
