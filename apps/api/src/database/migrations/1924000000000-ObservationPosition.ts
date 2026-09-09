import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ObservationPosition1924000000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE asset_observations ADD COLUMN capture_context jsonb`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE asset_observations DROP COLUMN capture_context`);
  }
}
