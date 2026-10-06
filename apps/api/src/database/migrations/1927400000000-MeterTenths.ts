import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Hour meters commonly report tenths of an hour; vehicle kilometres remain integer in validation. */
export class MeterTenths1927400000000 implements MigrationInterface {
  name = 'MeterTenths1927400000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE asset_meter_readings
      ALTER COLUMN value TYPE numeric(12,1) USING value::numeric(12,1)`);
    await q.query(`ALTER TABLE asset_services
      ALTER COLUMN meter_value TYPE numeric(12,1) USING meter_value::numeric(12,1)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM asset_meter_readings WHERE value<>trunc(value))
        OR EXISTS (SELECT 1 FROM asset_services WHERE meter_value<>trunc(meter_value))
      THEN RAISE EXCEPTION 'Cannot roll back fractional meter readings without data loss';
      END IF;
    END $$`);
    await q.query(`ALTER TABLE asset_meter_readings
      ALTER COLUMN value TYPE integer USING value::integer`);
    await q.query(`ALTER TABLE asset_services
      ALTER COLUMN meter_value TYPE integer USING meter_value::integer`);
  }
}
