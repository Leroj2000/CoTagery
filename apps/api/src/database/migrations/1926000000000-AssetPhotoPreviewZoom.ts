import { MigrationInterface, QueryRunner } from 'typeorm';

export class AssetPhotoPreviewZoom1926000000000 implements MigrationInterface {
  name = 'AssetPhotoPreviewZoom1926000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE asset_photos ADD COLUMN preview_zoom double precision NOT NULL DEFAULT 1`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE asset_photos DROP COLUMN preview_zoom`);
  }
}
