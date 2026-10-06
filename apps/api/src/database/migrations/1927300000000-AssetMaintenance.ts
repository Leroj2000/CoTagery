import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AssetMaintenance1927300000000 implements MigrationInterface {
  name = 'AssetMaintenance1927300000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE asset_categories ADD COLUMN equipment_kind text NOT NULL DEFAULT 'general'
      CHECK (equipment_kind IN ('general','vehicle','machine'))`);
    // Legacy assets with an exact category-name match regain the catalogue link.
    await q.query(`UPDATE assets a SET category_id=c.id FROM asset_categories c
      WHERE a.category_id IS NULL AND a.tenant_id=c.tenant_id AND a.category=c.name`);
    await q.query(`ALTER TABLE asset_services ADD COLUMN plan_code text`);
    await q.query(`ALTER TABLE asset_services ADD COLUMN meter_value integer
      CHECK (meter_value IS NULL OR meter_value BETWEEN 0 AND 1000000000)`);
    await q.query(`CREATE INDEX asset_services_plan_latest
      ON asset_services(tenant_id,asset_id,plan_code,performed_at DESC)
      WHERE plan_code IS NOT NULL`);
    await q.query(`CREATE TABLE asset_meter_readings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      value integer NOT NULL CHECK (value BETWEEN 0 AND 1000000000),
      observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      deleted_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE INDEX asset_meter_readings_latest
      ON asset_meter_readings(tenant_id,asset_id,observed_at DESC) WHERE deleted_at IS NULL`);
    await q.query(`CREATE TABLE asset_maintenance_rules (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      code text NOT NULL,
      interval_units integer NOT NULL CHECK (interval_units BETWEEN 1 AND 1000000),
      interval_months integer CHECK (interval_months IS NULL OR interval_months BETWEEN 1 AND 120),
      description text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(tenant_id,asset_id,code)
    )`);
    for (const table of ['asset_meter_readings', 'asset_maintenance_rules']) {
      await q.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await q.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
      await q.query(`CREATE POLICY tenant_isolation ON ${table}
        USING (tenant_id=current_setting('app.tenant_id',true)::uuid)
        WITH CHECK (tenant_id=current_setting('app.tenant_id',true)::uuid)`);
      await q.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ${table} TO tagery_app`);
    }
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE asset_maintenance_rules`);
    await q.query(`DROP TABLE asset_meter_readings`);
    await q.query(`DROP INDEX asset_services_plan_latest`);
    await q.query(`ALTER TABLE asset_services DROP COLUMN meter_value`);
    await q.query(`ALTER TABLE asset_services DROP COLUMN plan_code`);
    await q.query(`ALTER TABLE asset_categories DROP COLUMN equipment_kind`);
  }
}
