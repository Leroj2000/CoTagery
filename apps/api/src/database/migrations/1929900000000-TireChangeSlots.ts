import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Termíny přezutí pneumatik (varianta B – vlastní tabulky, ne calendar_events).
 *
 * - `tire_change_slots` = vypsaný termín firmy (kapacita = počet vozidel).
 * - `tire_change_bookings` = rezervace vozidla na termín. Vozidlo smí mít nejvýš
 *   jednu aktivní rezervaci (partial unique), kapacitu hlídá služba zámkem řádku
 *   termínu (SELECT … FOR UPDATE).
 * - Oprávnění: `asset.tireslot.manage` (správa termínů, rezervace za kohokoli,
 *   „Hotovo“) a `asset.tireslot.book` (rezervace vlastních vozidel; všechny
 *   systémové role kromě scan_only). Aditivní migrace.
 */
export class TireChangeSlots1929900000000 implements MigrationInterface {
  name = 'TireChangeSlots1929900000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE tire_change_slots (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      starts_at timestamptz NOT NULL,
      ends_at timestamptz NOT NULL,
      location text,
      note text,
      capacity integer NOT NULL DEFAULT 1 CHECK (capacity BETWEEN 1 AND 100),
      season text CHECK (season IN ('winter','summer')),
      created_by uuid REFERENCES users(id) ON DELETE SET NULL,
      cancelled_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CHECK (ends_at > starts_at))`);
    await q.query(
      `CREATE INDEX ix_tire_change_slots_start ON tire_change_slots (tenant_id, starts_at)`,
    );
    await q.query(`CREATE TABLE tire_change_bookings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      slot_id uuid NOT NULL REFERENCES tire_change_slots(id) ON DELETE CASCADE,
      asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      person_id uuid REFERENCES people(id) ON DELETE SET NULL,
      status text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked','cancelled','done')),
      created_by uuid REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      cancelled_at timestamptz,
      cancelled_by uuid REFERENCES users(id) ON DELETE SET NULL,
      completed_at timestamptz,
      completed_by uuid REFERENCES users(id) ON DELETE SET NULL)`);
    await q.query(
      `CREATE UNIQUE INDEX ux_tire_booking_one_active ON tire_change_bookings (tenant_id, asset_id) WHERE status = 'booked'`,
    );
    await q.query(
      `CREATE INDEX ix_tire_change_bookings_slot ON tire_change_bookings (tenant_id, slot_id)`,
    );
    for (const t of ['tire_change_slots', 'tire_change_bookings']) {
      await q.query(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`);
      await q.query(`ALTER TABLE ${t} FORCE ROW LEVEL SECURITY`);
      await q.query(`CREATE POLICY tenant_isolation ON ${t}
        USING (tenant_id = current_setting('app.tenant_id',true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.tenant_id',true)::uuid)`);
      await q.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${t} TO tagery_app`);
    }
    await q.query(`
      INSERT INTO permissions (key, module_key, resource, action, sensitivity) VALUES
        ('asset.tireslot.book', 'asset', 'tireslot', 'book', 'normal'),
        ('asset.tireslot.manage', 'asset', 'tireslot', 'manage', 'normal')
      ON CONFLICT (key) DO NOTHING`);
    // Systémové šablony (owner/admin mají vše implicitně); upravené kopie firem
    // je nedostanou automaticky (ADR 0013).
    await q.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r JOIN permissions p
        ON (r.key <> 'scan_only' AND p.key = 'asset.tireslot.book')
        OR (r.key IN ('owner', 'admin', 'manager') AND p.key = 'asset.tireslot.manage')
      WHERE r.tenant_id IS NULL
      ON CONFLICT DO NOTHING`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS tire_change_bookings`);
    await q.query(`DROP TABLE IF EXISTS tire_change_slots`);
    await q.query(`DELETE FROM permissions WHERE key LIKE 'asset.tireslot.%'`);
  }
}
