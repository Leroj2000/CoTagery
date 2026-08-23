import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * EPIC-19 F1 – veřejná půjčovna: publikace Věci jako inzerát (rental_listing).
 * Tenant-scoped (RLS). Veřejné čtení katalogu/detailu/fotky přes SECURITY DEFINER
 * funkce (vzor resolveru) – vrací jen status='published', bez úniku privátních dat.
 * Přidává tenants.slug pro veřejnou URL storefrontu.
 */
export class RentalListing1905000000000 implements MigrationInterface {
  name = 'RentalListing1905000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- tenants.slug (veřejná URL storefrontu) ---
    await queryRunner.query(`ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "slug" text`);
    await queryRunner.query(
      `UPDATE "tenants" SET "slug" = regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g') WHERE "slug" IS NULL`,
    );
    // Deduplikace slugů (append prefix id u kolizí).
    await queryRunner.query(`
      UPDATE "tenants" SET "slug" = "slug" || '-' || left("id"::text, 4)
      WHERE "id" IN (
        SELECT id FROM (
          SELECT id, row_number() OVER (PARTITION BY "slug" ORDER BY "created_at") rn FROM "tenants"
        ) x WHERE x.rn > 1
      )
    `);
    await queryRunner.query(`ALTER TABLE "tenants" ALTER COLUMN "slug" SET NOT NULL`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_tenants_slug" ON "tenants" ("slug")`,
    );

    // --- rental_listing ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "rental_listing" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "asset_id" uuid NOT NULL REFERENCES "assets"("id") ON DELETE CASCADE,
        "status" text NOT NULL DEFAULT 'draft',
        "title" text NOT NULL,
        "description" text,
        "terms" text,
        "pickup_location_id" uuid REFERENCES "locations"("id") ON DELETE SET NULL,
        "currency" text NOT NULL DEFAULT 'CZK',
        "price_per_day" numeric NOT NULL DEFAULT 0,
        "price_per_hour" numeric,
        "price_per_week" numeric,
        "deposit_amount" numeric NOT NULL DEFAULT 0,
        "min_days" integer NOT NULL DEFAULT 1,
        "max_days" integer,
        "slug" text NOT NULL,
        "published_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_rental_listing_slug" ON "rental_listing" ("tenant_id", "slug")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_rental_listing_asset" ON "rental_listing" ("asset_id")`,
    );

    await queryRunner.query(`ALTER TABLE "rental_listing" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "rental_listing" FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "rental_listing"
      USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
    `);
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON "rental_listing" TO "tagery_app"`,
    );

    // --- Veřejné čtení (SECURITY DEFINER, obchází RLS, jen published) ---
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public_rental_catalog(p_tenant_slug text)
      RETURNS TABLE (
        listing_id uuid, slug text, title text, description text, currency text,
        price_per_day numeric, price_per_hour numeric, price_per_week numeric,
        deposit_amount numeric, min_days integer, max_days integer,
        pickup text, asset_name text, photo_count integer
      )
      LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
        SELECT l.id, l.slug, l.title, l.description, l.currency,
          l.price_per_day, l.price_per_hour, l.price_per_week, l.deposit_amount,
          l.min_days, l.max_days, loc.name, a.name,
          (SELECT count(*)::int FROM asset_photos ap WHERE ap.asset_id = l.asset_id)
        FROM rental_listing l
          JOIN tenants t ON t.id = l.tenant_id
          JOIN assets a ON a.id = l.asset_id
          LEFT JOIN locations loc ON loc.id = l.pickup_location_id
        WHERE t.slug = p_tenant_slug AND l.status = 'published'
        ORDER BY l.published_at DESC NULLS LAST
      $$;
    `);
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION public_rental_catalog(text) TO "tagery_app"`,
    );

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public_rental_listing(p_tenant_slug text, p_listing_slug text)
      RETURNS TABLE (
        listing_id uuid, slug text, title text, description text, terms text, currency text,
        price_per_day numeric, price_per_hour numeric, price_per_week numeric,
        deposit_amount numeric, min_days integer, max_days integer,
        pickup text, asset_name text, tenant_name text, photo_count integer
      )
      LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
        SELECT l.id, l.slug, l.title, l.description, l.terms, l.currency,
          l.price_per_day, l.price_per_hour, l.price_per_week, l.deposit_amount,
          l.min_days, l.max_days, loc.name, a.name, t.name,
          (SELECT count(*)::int FROM asset_photos ap WHERE ap.asset_id = l.asset_id)
        FROM rental_listing l
          JOIN tenants t ON t.id = l.tenant_id
          JOIN assets a ON a.id = l.asset_id
          LEFT JOIN locations loc ON loc.id = l.pickup_location_id
        WHERE t.slug = p_tenant_slug AND l.slug = p_listing_slug AND l.status = 'published'
        LIMIT 1
      $$;
    `);
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION public_rental_listing(text, text) TO "tagery_app"`,
    );

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public_rental_photo(p_listing_id uuid, p_idx integer)
      RETURNS TABLE (file_key text, mime text)
      LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
        SELECT ap.file_key, ap.mime
        FROM rental_listing l
          JOIN asset_photos ap ON ap.asset_id = l.asset_id
        WHERE l.id = p_listing_id AND l.status = 'published'
        ORDER BY ap.position ASC
        OFFSET GREATEST(p_idx, 0) LIMIT 1
      $$;
    `);
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION public_rental_photo(uuid, integer) TO "tagery_app"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS public_rental_photo(uuid, integer)`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS public_rental_listing(text, text)`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS public_rental_catalog(text)`);
    await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "rental_listing"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rental_listing"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "ux_tenants_slug"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "slug"`);
  }
}
