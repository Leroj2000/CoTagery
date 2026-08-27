import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * EPIC-19+ – důvod selhání AI stažení manuálu (`asset_manuals.failure_reason`).
 * Umožní UI ukázat srozumitelnou hlášku (např. „málo detailů o položce") místo
 * holého „failed", a slouží i pro timeout pojistku zaseknutých `fetching` řádků.
 */
export class AssetManualFailureReason1910000000000 implements MigrationInterface {
  name = 'AssetManualFailureReason1910000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "asset_manuals" ADD COLUMN IF NOT EXISTS "failure_reason" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "asset_manuals" DROP COLUMN IF EXISTS "failure_reason"`);
  }
}
