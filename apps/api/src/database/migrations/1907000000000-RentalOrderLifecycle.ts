import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * EPIC-19 F3 – lifecycle objednávky + platba + custody + kauce.
 * Přidává časové značky přechodů, vazbu na Person (držitel při vyzvednutí),
 * vypořádání kauce a variabilní symbol (sekvence) pro QR/SPAYD platbu.
 */
export class RentalOrderLifecycle1907000000000 implements MigrationInterface {
  name = 'RentalOrderLifecycle1907000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Variabilní symbol – stabilní číselná sekvence (max 10 číslic pro CZ VS).
    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS "rental_order_vs_seq" START 1`);

    await queryRunner.query(`
      ALTER TABLE "rental_order"
        ADD COLUMN IF NOT EXISTS "payment_vs" bigint NOT NULL DEFAULT nextval('rental_order_vs_seq'),
        ADD COLUMN IF NOT EXISTS "renter_person_id" uuid,
        ADD COLUMN IF NOT EXISTS "deposit_returned" numeric,
        ADD COLUMN IF NOT EXISTS "paid_at" timestamptz,
        ADD COLUMN IF NOT EXISTS "picked_up_at" timestamptz,
        ADD COLUMN IF NOT EXISTS "returned_at" timestamptz,
        ADD COLUMN IF NOT EXISTS "completed_at" timestamptz,
        ADD COLUMN IF NOT EXISTS "cancelled_at" timestamptz,
        ADD COLUMN IF NOT EXISTS "settled_at" timestamptz
    `);

    // my_rental_orders: doplnit payment_vs + timestampy pro renter portál a pokyny k platbě.
    await queryRunner.query(`DROP FUNCTION IF EXISTS my_rental_orders(uuid)`);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION my_rental_orders(p_user_id uuid)
      RETURNS TABLE (
        order_id uuid, status text, starts_at timestamptz, ends_at timestamptz, days integer,
        rent_amount numeric, deposit_amount numeric, total numeric, currency text, payment_vs bigint,
        listing_title text, listing_slug text, asset_name text,
        tenant_name text, tenant_slug text, pickup text, created_at timestamptz
      )
      LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
        SELECT o.id, o.status, o.starts_at, o.ends_at, o.days,
          o.rent_amount, o.deposit_amount, o.total, o.currency, o.payment_vs,
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
    await queryRunner.query(`GRANT EXECUTE ON FUNCTION my_rental_orders(uuid) TO "tagery_app"`);

    // Pokyny k platbě nájemci (SECURITY DEFINER): objednávka + bankovní údaje majitele
    // z tenant.settings. Validuje, že objednávka patří danému nájemci (self-scoped).
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION renter_order_payment(p_order_id uuid, p_user_id uuid)
      RETURNS TABLE (
        order_id uuid, status text, total numeric, currency text, payment_vs bigint,
        listing_title text, tenant_name text, bank jsonb
      )
      LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
        SELECT o.id, o.status, o.total, o.currency, o.payment_vs,
          l.title, t.name, COALESCE(t.settings_json -> 'rentalPayment', '{}'::jsonb)
        FROM rental_order o
          JOIN rental_listing l ON l.id = o.listing_id
          JOIN tenants t ON t.id = o.tenant_id
        WHERE o.id = p_order_id AND o.renter_user_id = p_user_id
        LIMIT 1
      $$;
    `);
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION renter_order_payment(uuid, uuid) TO "tagery_app"`,
    );

    // Nájemce založí hlášení poškození (SECURITY DEFINER, cross-tenant zápis do
    // asset_issues). Gate: má objednávku na tu věc v držení/nedávno vrácenou.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION create_renter_issue(
        p_order_id uuid, p_user_id uuid, p_kind text, p_description text
      ) RETURNS uuid
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
      DECLARE v_tenant uuid; v_asset uuid; v_status text; v_id uuid;
      BEGIN
        SELECT tenant_id, asset_id, status INTO v_tenant, v_asset, v_status
          FROM rental_order WHERE id = p_order_id AND renter_user_id = p_user_id;
        IF v_tenant IS NULL THEN
          RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0001';
        END IF;
        IF v_status NOT IN ('picked_up','returned','completed') THEN
          RAISE EXCEPTION 'issue_not_allowed' USING ERRCODE = 'P0001';
        END IF;
        INSERT INTO asset_issues (tenant_id, asset_id, reported_by_id, kind, description, status)
        VALUES (v_tenant, v_asset, NULL, p_kind, p_description, 'open')
        RETURNING id INTO v_id;
        RETURN v_id;
      END;
      $$;
    `);
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION create_renter_issue(uuid, uuid, text, text) TO "tagery_app"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS create_renter_issue(uuid, uuid, text, text)`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS renter_order_payment(uuid, uuid)`);
    await queryRunner.query(`
      ALTER TABLE "rental_order"
        DROP COLUMN IF EXISTS "payment_vs",
        DROP COLUMN IF EXISTS "renter_person_id",
        DROP COLUMN IF EXISTS "deposit_returned",
        DROP COLUMN IF EXISTS "paid_at",
        DROP COLUMN IF EXISTS "picked_up_at",
        DROP COLUMN IF EXISTS "returned_at",
        DROP COLUMN IF EXISTS "completed_at",
        DROP COLUMN IF EXISTS "cancelled_at",
        DROP COLUMN IF EXISTS "settled_at"
    `);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS "rental_order_vs_seq"`);
    // my_rental_orders se obnoví předchozí migrací při revertu.
  }
}
