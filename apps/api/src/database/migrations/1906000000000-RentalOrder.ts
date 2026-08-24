import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * EPIC-19 F2 – rezervace + veřejná objednávka půjčovny (rental_order).
 * Tenant-scoped na FIRMU majitele (RLS) → majitel spravuje pod běžnou RLS.
 * Nájemce (platformová identita, bez tenant kontextu firmy) zakládá i čte
 * objednávky přes SECURITY DEFINER funkce. Dvojité rezervaci brání DB:
 * EXCLUDE USING gist na (asset_id, period) pro blokující stavy (btree_gist).
 */
export class RentalOrder1906000000000 implements MigrationInterface {
  name = 'RentalOrder1906000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`);

    // Platformový tenant (nil UUID) = domovská org pro účty nájemců. Nájemce NENÍ
    // členem žádné firmy (rozh. C); users.tenant_id je legacy FK, users nemá RLS.
    // Slug s podtržítky se nikdy neobjeví ve veřejném katalogu firem.
    await queryRunner.query(`
      INSERT INTO "tenants" ("id", "name", "slug", "type")
      VALUES ('00000000-0000-0000-0000-000000000000', 'Platforma (nájemci)', '__platform__', 'mixed')
      ON CONFLICT ("id") DO NOTHING
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "rental_order" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "listing_id" uuid NOT NULL REFERENCES "rental_listing"("id") ON DELETE CASCADE,
        "asset_id" uuid NOT NULL REFERENCES "assets"("id") ON DELETE CASCADE,
        "renter_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "renter_profile_id" uuid,
        "starts_at" timestamptz NOT NULL,
        "ends_at" timestamptz NOT NULL,
        "days" integer NOT NULL,
        "status" text NOT NULL DEFAULT 'awaiting_payment',
        "rent_amount" numeric NOT NULL DEFAULT 0,
        "deposit_amount" numeric NOT NULL DEFAULT 0,
        "total" numeric NOT NULL DEFAULT 0,
        "currency" text NOT NULL DEFAULT 'CZK',
        "payment_method" text,
        "payment_ref" text,
        "deposit_ref" text,
        "renter_note" text,
        "period" tstzrange GENERATED ALWAYS AS (tstzrange("starts_at", "ends_at", '[)')) STORED,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_rental_order_period" CHECK ("ends_at" > "starts_at")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_rental_order_listing" ON "rental_order" ("listing_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_rental_order_asset" ON "rental_order" ("asset_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_rental_order_renter" ON "rental_order" ("renter_user_id")`,
    );

    // Dvojitá rezervace: žádný překryv období na téže věci v blokujících stavech.
    await queryRunner.query(`
      ALTER TABLE "rental_order" ADD CONSTRAINT "excl_rental_order_overlap"
      EXCLUDE USING gist ("asset_id" WITH =, "period" WITH &&)
      WHERE (status IN ('awaiting_payment','paid','confirmed','picked_up'))
    `);

    await queryRunner.query(`ALTER TABLE "rental_order" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "rental_order" FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "rental_order"
      USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
    `);
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON "rental_order" TO "tagery_app"`,
    );

    // --- Nájemce zakládá objednávku (cross-tenant, obchází RLS) ---
    // Amounts jsou spočtené server-side (důvěryhodné, jen tagery_app volá).
    // Funkce re-validuje, že inzerát je published, a dovodí tenant/asset/currency.
    // Překryv termínů → EXCLUDE vyhodí SQLSTATE 23P01 (TS mapuje na 409).
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION create_rental_order(
        p_listing_id uuid, p_renter_user_id uuid, p_renter_profile_id uuid,
        p_start timestamptz, p_end timestamptz, p_days integer,
        p_rent numeric, p_deposit numeric, p_total numeric, p_note text
      ) RETURNS uuid
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
      DECLARE
        v_tenant uuid; v_asset uuid; v_currency text; v_status text; v_id uuid;
      BEGIN
        SELECT tenant_id, asset_id, currency, status
          INTO v_tenant, v_asset, v_currency, v_status
          FROM rental_listing WHERE id = p_listing_id;
        IF v_tenant IS NULL OR v_status <> 'published' THEN
          RAISE EXCEPTION 'listing_not_available' USING ERRCODE = 'P0001';
        END IF;
        INSERT INTO rental_order (
          tenant_id, listing_id, asset_id, renter_user_id, renter_profile_id,
          starts_at, ends_at, days, status, rent_amount, deposit_amount, total, currency, renter_note
        ) VALUES (
          v_tenant, p_listing_id, v_asset, p_renter_user_id, p_renter_profile_id,
          p_start, p_end, p_days, 'awaiting_payment', p_rent, p_deposit, p_total, v_currency, p_note
        ) RETURNING id INTO v_id;
        RETURN v_id;
      END;
      $$;
    `);
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION create_rental_order(uuid,uuid,uuid,timestamptz,timestamptz,integer,numeric,numeric,numeric,text) TO "tagery_app"`,
    );

    // --- Renter portál „Moje výpůjčky" (self-scoped napříč firmami) ---
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION my_rental_orders(p_user_id uuid)
      RETURNS TABLE (
        order_id uuid, status text, starts_at timestamptz, ends_at timestamptz, days integer,
        rent_amount numeric, deposit_amount numeric, total numeric, currency text,
        listing_title text, listing_slug text, asset_name text,
        tenant_name text, tenant_slug text, pickup text, created_at timestamptz
      )
      LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
        SELECT o.id, o.status, o.starts_at, o.ends_at, o.days,
          o.rent_amount, o.deposit_amount, o.total, o.currency,
          l.title, l.slug, a.name, t.name, t.slug, loc.name, o.created_at
        FROM rental_order o
          JOIN rental_listing l ON l.id = o.listing_id
          JOIN tenants t ON t.id = o.tenant_id
          JOIN assets a ON a.id = o.asset_id
          LEFT JOIN locations loc ON loc.id = l.pickup_location_id
        WHERE o.renter_user_id = p_user_id
        ORDER BY o.created_at DESC
      $$;
    `);
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION my_rental_orders(uuid) TO "tagery_app"`,
    );

    // --- Veřejná dostupnost inzerátu (obsazené termíny pro kalendář) ---
    // Vrací blokující období pro VĚC daného inzerátu (napříč inzeráty téže věci),
    // jen je-li inzerát published. Žádná privátní data nájemce neúniknou.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public_listing_availability(p_listing_id uuid)
      RETURNS TABLE (starts_at timestamptz, ends_at timestamptz)
      LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
        SELECT o.starts_at, o.ends_at
        FROM rental_listing l
          JOIN rental_order o ON o.asset_id = l.asset_id
        WHERE l.id = p_listing_id AND l.status = 'published'
          AND o.status IN ('awaiting_payment','paid','confirmed','picked_up')
          AND o.ends_at > now()
        ORDER BY o.starts_at
      $$;
    `);
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION public_listing_availability(uuid) TO "tagery_app"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS public_listing_availability(uuid)`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS my_rental_orders(uuid)`);
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS create_rental_order(uuid,uuid,uuid,timestamptz,timestamptz,integer,numeric,numeric,numeric,text)`,
    );
    await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "rental_order"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rental_order"`);
  }
}
