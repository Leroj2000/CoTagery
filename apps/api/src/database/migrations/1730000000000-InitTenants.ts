import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bootstrap migrace (EPIC-00): minimální tabulka `tenants`, aby fungovala
 * migrační + seed pipeline. Plný doménový model tenantů přijde v EPIC-03.
 */
export class InitTenants1730000000000 implements MigrationInterface {
  name = 'InitTenants1730000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tenants" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" text NOT NULL,
        "type" text NOT NULL DEFAULT 'mixed',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tenants"`);
  }
}
