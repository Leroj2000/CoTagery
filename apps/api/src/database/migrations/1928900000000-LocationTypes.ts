import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Typy míst spravované firmou: řádek = přepsání systémového typu (název, skrytí,
 * pořadí) nebo vlastní typ firmy (`c_…`, kategorie, mřížka). Bez řádků platí
 * systémový katalog (`@tagery/shared` SYSTEM_LOCATION_TYPES).
 */
export class LocationTypes1928900000000 implements MigrationInterface {
  name = 'LocationTypes1928900000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE location_types (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      key text NOT NULL CHECK (key ~ '^[a-z][a-z0-9_]{1,40}$'),
      name text,
      category text CHECK (category IS NULL OR category IN ('place','storage')),
      grid boolean,
      hidden boolean NOT NULL DEFAULT false,
      sort_order integer,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (tenant_id, key))`);
    await q.query(`ALTER TABLE location_types ENABLE ROW LEVEL SECURITY`);
    await q.query(`ALTER TABLE location_types FORCE ROW LEVEL SECURITY`);
    await q.query(`CREATE POLICY tenant_isolation ON location_types
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)`);
    await q.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON location_types TO tagery_app`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE location_types`);
  }
}
