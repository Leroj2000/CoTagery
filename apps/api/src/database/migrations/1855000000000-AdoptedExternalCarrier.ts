import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adopce cizího identifikátoru jako ALIAS: carrier může nést externí kód
 * (EAN / URL / vlastní), který rozpozná JEN interní (přihlášený) skener v tenant
 * kontextu. Veřejný resolver `resolve_carrier` se NEMĚNÍ – ten dál jede výhradně
 * přes náš `public_code`, takže při adopci se současně vytvoří i náš nativní
 * carrier použitelný pro veřejný resolver.
 *
 * Unikátnost externího kódu je per-tenant (partial index) – tentýž EAN může
 * legitimně existovat u víc tenantů.
 */
export class AdoptedExternalCarrier1855000000000 implements MigrationInterface {
  name = 'AdoptedExternalCarrier1855000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "data_carriers" ADD COLUMN IF NOT EXISTS "external_code" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "data_carriers" ADD COLUMN IF NOT EXISTS "external_scheme" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "data_carriers" ADD COLUMN IF NOT EXISTS "origin" text NOT NULL DEFAULT 'native'`,
    );
    // Per-tenant unikátnost adoptovaného kódu (jen kde je vyplněný).
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "ux_data_carriers_tenant_external_code"
      ON "data_carriers" ("tenant_id", "external_code")
      WHERE "external_code" IS NOT NULL
    `);
    // Rychlý interní lookup podle externího kódu.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "ix_data_carriers_external_code"
      ON "data_carriers" ("external_code")
      WHERE "external_code" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "ix_data_carriers_external_code"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "ux_data_carriers_tenant_external_code"`);
    await queryRunner.query(`ALTER TABLE "data_carriers" DROP COLUMN IF EXISTS "origin"`);
    await queryRunner.query(`ALTER TABLE "data_carriers" DROP COLUMN IF EXISTS "external_scheme"`);
    await queryRunner.query(`ALTER TABLE "data_carriers" DROP COLUMN IF EXISTS "external_code"`);
  }
}
