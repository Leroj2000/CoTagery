import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Asset nesting (§14): kontejnerové věci (dodávka, kufr) mohou obsahovat další
 * věci. `can_contain_assets` označí kontejner, `parent_asset_id` váže věc do něj.
 */
export class AssetNesting1820000000000 implements MigrationInterface {
  name = 'AssetNesting1820000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "can_contain_assets" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "parent_asset_id" uuid REFERENCES "assets"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_assets_parent" ON "assets" ("parent_asset_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "assets" DROP COLUMN IF EXISTS "parent_asset_id"`);
    await queryRunner.query(`ALTER TABLE "assets" DROP COLUMN IF EXISTS "can_contain_assets"`);
  }
}
