import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rental: stav věci (available/loaned) + čas vrácení půjčky. Stav se odvozuje
 * z workflow (LOAN → loaned, RETURN/CANCEL → available), aby bylo jasné, zda je
 * položka vypůjčená nebo zpět v assetu. Existující aktivní půjčky nastaví
 * příslušné věci na `loaned` (dopočet).
 */
export class RentalItemStatus1805000000000 implements MigrationInterface {
  name = 'RentalItemStatus1805000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rental_items" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'available'`,
    );
    await queryRunner.query(
      `ALTER TABLE "rental_loans" ADD COLUMN IF NOT EXISTS "returned_at" timestamptz`,
    );
    // Dopočet: věci s aktivní půjčkou označ jako vypůjčené.
    await queryRunner.query(`
      UPDATE "rental_items" i
      SET "status" = 'loaned'
      WHERE EXISTS (
        SELECT 1 FROM "rental_loans" l
        WHERE l."item_id" = i."id" AND l."status" = 'active'
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "rental_loans" DROP COLUMN IF EXISTS "returned_at"`);
    await queryRunner.query(`ALTER TABLE "rental_items" DROP COLUMN IF EXISTS "status"`);
  }
}
