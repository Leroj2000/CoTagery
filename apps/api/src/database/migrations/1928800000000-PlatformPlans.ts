import type { MigrationInterface, QueryRunner } from 'typeorm';
import { DEFAULT_PLANS } from '@tagery/shared';

/**
 * Předplatné firem vůči Tagery (EPIC-20 v2, ADR-0009):
 * - `platform_plans` – úrovně (vč. zkušební), jejich moduly/funkce, limity a ceny;
 *   mění je superadmin,
 * - `tenant_subscriptions` – předplatné firmy (1:1): úroveň, stav, období, výjimky
 *   limitů a modulů, fakturační údaje,
 * - `tenant_subscription_events` – historie změn,
 * - `platform_invoices` – faktury za předplatné (QR platba),
 * - `platform_settings` – dodavatel, DPH, zkušební doba, splatnost, grace,
 * - `storage_objects` – evidence uložených souborů a jejich velikostí (limit úložiště);
 *   existující soubory doplní API při startu (soubory vidí jen kontejner API).
 * Platformní tabulky nemají RLS ani `tenant_id` filtr na úrovni DB (jako
 * `tenants`): zapisuje jen platform-admin, firma čte vlastní řádky přes API
 * filtrované `tenant_id` z JWT.
 * `organization_modules.allowed` = projekce „úroveň ⊕ výjimka" (čte authz guard);
 * `state` zůstává volba vlastníka firmy. Stávající firmy dostanou Business bez
 * konce, ať se jim nic nevypne.
 */
export class PlatformPlans1928800000000 implements MigrationInterface {
  name = 'PlatformPlans1928800000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE platform_plans (
      key text PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9_]{1,30}$'),
      name text NOT NULL,
      description text,
      sort_order integer NOT NULL DEFAULT 0,
      price_month numeric(12,2),
      price_year numeric(12,2),
      currency text NOT NULL DEFAULT 'CZK',
      entitlements text[] NOT NULL DEFAULT '{}',
      limits jsonb NOT NULL DEFAULT '{}',
      is_public boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now())`);
    for (const p of DEFAULT_PLANS) {
      await q.query(
        `INSERT INTO platform_plans
           (key, name, description, sort_order, price_month, price_year, currency, entitlements, limits, is_public)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          p.key,
          p.name,
          p.description,
          p.sortOrder,
          p.priceMonth,
          p.priceYear,
          p.currency,
          p.entitlements,
          JSON.stringify(p.limits),
          p.isPublic,
        ],
      );
    }

    await q.query(`CREATE TABLE tenant_subscriptions (
      tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
      plan_key text NOT NULL REFERENCES platform_plans(key),
      status text NOT NULL CHECK (status IN ('trialing','active','past_due','suspended','canceled')),
      period_start date,
      period_end date,
      billing_period text NOT NULL DEFAULT 'month' CHECK (billing_period IN ('month','year','custom')),
      price_amount numeric(12,2),
      currency text NOT NULL DEFAULT 'CZK',
      payment_method text NOT NULL DEFAULT 'manual' CHECK (payment_method IN ('manual','card')),
      limit_overrides jsonb NOT NULL DEFAULT '{}',
      entitlement_overrides jsonb NOT NULL DEFAULT '{}',
      billing_details jsonb NOT NULL DEFAULT '{}',
      cancel_at_period_end boolean NOT NULL DEFAULT false,
      note text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now())`);

    await q.query(`CREATE TABLE tenant_subscription_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      type text NOT NULL,
      data jsonb NOT NULL DEFAULT '{}',
      actor_user_id uuid,
      created_at timestamptz NOT NULL DEFAULT now())`);
    await q.query(
      `CREATE INDEX ix_tenant_subscription_events ON tenant_subscription_events (tenant_id, created_at DESC)`,
    );

    await q.query(`CREATE TABLE platform_invoices (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      number text NOT NULL UNIQUE,
      variable_symbol text NOT NULL,
      issued_on date NOT NULL,
      taxable_on date NOT NULL,
      due_on date NOT NULL,
      period_from date,
      period_to date,
      plan_key text,
      description text NOT NULL,
      amount_net numeric(12,2) NOT NULL,
      vat_rate numeric(5,2),
      amount_vat numeric(12,2) NOT NULL DEFAULT 0,
      amount_gross numeric(12,2) NOT NULL,
      currency text NOT NULL DEFAULT 'CZK',
      status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','paid','canceled')),
      paid_on date,
      supplier jsonb NOT NULL,
      customer jsonb NOT NULL,
      created_by uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now())`);
    await q.query(`CREATE INDEX ix_platform_invoices_tenant ON platform_invoices (tenant_id, issued_on DESC)`);

    await q.query(`CREATE TABLE platform_settings (
      id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      data jsonb NOT NULL DEFAULT '{}',
      updated_at timestamptz NOT NULL DEFAULT now())`);
    await q.query(`INSERT INTO platform_settings (id, data) VALUES (1, $1)`, [
      JSON.stringify({
        trialDays: 14,
        graceDays: 14,
        invoiceDueDays: 14,
        vatPayer: false,
        vatRate: 21,
        supplier: { name: 'Tagery', ico: '', dic: '', address: '', email: '', iban: '' },
      }),
    ]);

    await q.query(`CREATE TABLE storage_objects (
      key text PRIMARY KEY,
      tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
      size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
      content_type text,
      deleted_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now())`);
    await q.query(
      `CREATE INDEX ix_storage_objects_tenant ON storage_objects (tenant_id) WHERE deleted_at IS NULL`,
    );

    for (const t of [
      'storage_objects',
      'platform_plans',
      'tenant_subscriptions',
      'tenant_subscription_events',
      'platform_invoices',
      'platform_settings',
    ]) {
      await q.query(`GRANT SELECT, INSERT, UPDATE ON ${t} TO tagery_app`);
    }

    // Stávající firmy: Business bez konce období (nic se nevypne).
    await q.query(`INSERT INTO tenant_subscriptions (tenant_id, plan_key, status, period_start, billing_period, price_amount)
      SELECT id, 'business', 'active', created_at::date, 'custom', NULL FROM tenants
       WHERE id <> '00000000-0000-0000-0000-000000000000'`);
    await q.query(`INSERT INTO tenant_subscription_events (tenant_id, type, data)
      SELECT tenant_id, 'migrated', '{"planKey":"business"}' FROM tenant_subscriptions`);

    await q.query(
      `ALTER TABLE organization_modules ADD COLUMN allowed boolean NOT NULL DEFAULT true`,
    );
    await q.query(`
      CREATE OR REPLACE FUNCTION org_inactive_modules(p_org uuid)
      RETURNS TABLE (module_key text)
      LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
        SELECT module_key FROM organization_modules
         WHERE tenant_id = p_org AND (state = 'inactive' OR NOT allowed)
      $$`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE OR REPLACE FUNCTION org_inactive_modules(p_org uuid)
      RETURNS TABLE (module_key text)
      LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
        SELECT module_key FROM organization_modules
         WHERE tenant_id = p_org AND state = 'inactive'
      $$`);
    await q.query(`ALTER TABLE organization_modules DROP COLUMN allowed`);
    await q.query(`DROP TABLE storage_objects`);
    await q.query(`DROP TABLE platform_settings`);
    await q.query(`DROP TABLE platform_invoices`);
    await q.query(`DROP TABLE tenant_subscription_events`);
    await q.query(`DROP TABLE tenant_subscriptions`);
    await q.query(`DROP TABLE platform_plans`);
  }
}
