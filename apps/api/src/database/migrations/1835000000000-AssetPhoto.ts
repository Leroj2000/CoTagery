import { MigrationInterface, QueryRunner } from 'typeorm';

/** Fotografie věci: klíč v úložišti (StoragePort) + MIME typ. */
export class AssetPhoto1835000000000 implements MigrationInterface {
  name = 'AssetPhoto1835000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "photo_key" text`);
    await queryRunner.query(`ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "photo_mime" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "assets" DROP COLUMN IF EXISTS "photo_mime"`);
    await queryRunner.query(`ALTER TABLE "assets" DROP COLUMN IF EXISTS "photo_key"`);
  }
}
