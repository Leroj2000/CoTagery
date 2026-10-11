import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Inventura vozidel: `inventory_checks.kind` = 'stock' (dosavadní inventura
 * skladu) nebo 'vehicle' (sepsání stavu vozidel k období od–do). Vozidla
 * inventury jsou ve `expected_asset_ids`; `vehicle_notes` = poznámky k vozidlům,
 * `vehicle_rows` = zmrazený stav při uzavření (tachometr, servis).
 * Položky dostanou SPZ (`assets.registration_plate`).
 */
export class VehicleInventory1928700000000 implements MigrationInterface {
  name = 'VehicleInventory1928700000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE assets ADD COLUMN registration_plate text`);
    await q.query(`CREATE INDEX ix_assets_registration_plate
      ON assets (tenant_id, registration_plate) WHERE registration_plate IS NOT NULL`);
    await q.query(`ALTER TABLE inventory_checks
      ADD COLUMN kind text NOT NULL DEFAULT 'stock' CHECK (kind IN ('stock', 'vehicle')),
      ADD COLUMN period_from date,
      ADD COLUMN period_to date,
      ADD COLUMN vehicle_notes jsonb NOT NULL DEFAULT '{}',
      ADD COLUMN vehicle_rows jsonb,
      ADD CONSTRAINT inventory_checks_period CHECK (
        kind <> 'vehicle' OR (period_from IS NOT NULL AND period_to IS NOT NULL AND period_from <= period_to))`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE inventory_checks
      DROP CONSTRAINT inventory_checks_period,
      DROP COLUMN vehicle_rows,
      DROP COLUMN vehicle_notes,
      DROP COLUMN period_to,
      DROP COLUMN period_from,
      DROP COLUMN kind`);
    await q.query(`DROP INDEX ix_assets_registration_plate`);
    await q.query(`ALTER TABLE assets DROP COLUMN registration_plate`);
  }
}
