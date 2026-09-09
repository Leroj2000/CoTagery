import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AssetPhotoPreview1925000000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE asset_photos ADD COLUMN preview_x double precision NOT NULL DEFAULT 50`,
    );
    await q.query(
      `ALTER TABLE asset_photos ADD COLUMN preview_y double precision NOT NULL DEFAULT 50`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE asset_photos DROP COLUMN preview_x`);
    await q.query(`ALTER TABLE asset_photos DROP COLUMN preview_y`);
  }
}
