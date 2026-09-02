import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Mřížka regálu/skříně. `grid_rows`/`grid_cols` na rodiči (rack/cabinet) definují
 * rozdělení; buňky jsou child lokace se souřadnicí `cell_row`/`cell_col`. Položka
 * se do buňky umístí přes `home_location_id` = buňka (žádný nový model umístění).
 */
export class LocationGrid1917000000000 implements MigrationInterface {
  name = 'LocationGrid1917000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "grid_rows" integer`);
    await queryRunner.query(`ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "grid_cols" integer`);
    await queryRunner.query(`ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "cell_row" integer`);
    await queryRunner.query(`ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "cell_col" integer`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_locations_cell_parent" ON "locations" ("parent_id", "cell_row", "cell_col")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "ix_locations_cell_parent"`);
    await queryRunner.query(`ALTER TABLE "locations" DROP COLUMN IF EXISTS "cell_col"`);
    await queryRunner.query(`ALTER TABLE "locations" DROP COLUMN IF EXISTS "cell_row"`);
    await queryRunner.query(`ALTER TABLE "locations" DROP COLUMN IF EXISTS "grid_cols"`);
    await queryRunner.query(`ALTER TABLE "locations" DROP COLUMN IF EXISTS "grid_rows"`);
  }
}
