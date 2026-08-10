import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * EPIC-17 Billing: billing_customers, subscriptions, invoices,
 * billing_webhook_events, platform_usage_meters (tenant-scoped, RLS).
 * `billing_subscription_lookup` je SECURITY DEFINER – webhook bez JWT podle něj
 * najde tenanta/předplatné (obdoba `activation_lookup`).
 */
export class InitBilling1800000000000 implements MigrationInterface {
  name = 'InitBilling1800000000000';

  private readonly rlsTables = [
    'billing_customers',
    'subscriptions',
    'invoices',
    'billing_webhook_events',
    'platform_usage_meters',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "billing_customers" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "member_id" uuid,
        "psp_customer_ref" text NOT NULL,
        "email" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_billing_customers_psp" ON "billing_customers" ("psp_customer_ref")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "subscriptions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "billing_customer_id" uuid NOT NULL REFERENCES "billing_customers"("id") ON DELETE CASCADE,
        "membership_id" uuid,
        "tier_id" uuid NOT NULL,
        "status" text NOT NULL DEFAULT 'incomplete',
        "psp_subscription_ref" text NOT NULL,
        "current_period_end" timestamptz,
        "cancel_at_period_end" boolean NOT NULL DEFAULT false,
        "grace_until" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_subscriptions_psp" ON "subscriptions" ("psp_subscription_ref")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "invoices" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "subscription_id" uuid NOT NULL REFERENCES "subscriptions"("id") ON DELETE CASCADE,
        "psp_invoice_ref" text NOT NULL,
        "amount_net" numeric NOT NULL DEFAULT 0,
        "vat_amount" numeric NOT NULL DEFAULT 0,
        "vat_rate" numeric NOT NULL DEFAULT 21,
        "reverse_charge" boolean NOT NULL DEFAULT false,
        "currency" text NOT NULL DEFAULT 'CZK',
        "status" text NOT NULL DEFAULT 'open',
        "period_start" timestamptz,
        "period_end" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_invoices_subscription" ON "invoices" ("subscription_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_invoices_psp" ON "invoices" ("psp_invoice_ref")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "billing_webhook_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "psp_event_ref" text NOT NULL,
        "event_type" text NOT NULL,
        "payload" jsonb NOT NULL DEFAULT '{}',
        "processed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_webhook_events_psp" ON "billing_webhook_events" ("psp_event_ref")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "platform_usage_meters" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "period" text NOT NULL,
        "metric" text NOT NULL,
        "quantity" integer NOT NULL DEFAULT 0,
        "reported_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_usage_meters_tenant_period_metric" ON "platform_usage_meters" ("tenant_id", "period", "metric")`,
    );

    for (const table of this.rlsTables) {
      await queryRunner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
      await queryRunner.query(`
        CREATE POLICY "tenant_isolation" ON "${table}"
        USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
        WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
      `);
      await queryRunner.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON "${table}" TO "tagery_app"`,
      );
    }

    // Webhook nemá JWT: najde tenanta/předplatné přes SECURITY DEFINER (obchází RLS).
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION billing_subscription_lookup(p_ref text)
      RETURNS TABLE (subscription_id uuid, tenant_id uuid)
      LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
        SELECT s.id, s.tenant_id
        FROM subscriptions s
        WHERE s.psp_subscription_ref = p_ref
      $$;
    `);
    await queryRunner.query(
      `REVOKE ALL ON FUNCTION billing_subscription_lookup(text) FROM PUBLIC`,
    );
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION billing_subscription_lookup(text) TO "tagery_app"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS billing_subscription_lookup(text)`);
    for (const table of this.rlsTables) {
      await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "${table}"`);
    }
    await queryRunner.query(`DROP TABLE IF EXISTS "platform_usage_meters"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "billing_webhook_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invoices"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "subscriptions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "billing_customers"`);
  }
}
