import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Profilová fotka osoby (people.photo_file_key) – jedna fotka jako avatar.
 * Držena přímo na tabulce `people` (1 fotka, ne galerie), takže se veze se
 * stávající RLS politikou tabulky. Soubor je v úložišti (StorageModule),
 * sloupec drží jen klíč. Serverové zpracování přes sharp (avatar JPEG).
 */
export class PersonPhoto1915000000000 implements MigrationInterface {
  name = 'PersonPhoto1915000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "photo_file_key" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "people" DROP COLUMN IF EXISTS "photo_file_key"`);
  }
}
