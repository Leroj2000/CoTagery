import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Perzistentní cache reverzního geokódování – souřadnice se nepřekládají při každém zobrazení. */
export class ObservationAddress1928100000000 implements MigrationInterface {
  name = 'ObservationAddress1928100000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE asset_observations
      ADD COLUMN address_label text,
      ADD COLUMN address_provider text,
      ADD COLUMN address_resolved_at timestamptz`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE asset_observations
      DROP COLUMN address_resolved_at,
      DROP COLUMN address_provider,
      DROP COLUMN address_label`);
  }
}
