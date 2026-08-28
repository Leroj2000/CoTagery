import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Technické specifikace položky získané „přes AI" (EPIC-19+). Na rozdíl od manuálů
 * (soubory) jde o strukturovaná data (pole {label,value}) dohledaná z webu –
 * spolehlivější než hledat volně stažitelný PDF. Jeden set specifikací na položku
 * (unique asset_id). Stav fetching→ready/failed jako u manuálů; callback z n8n
 * dohledá tenanta přes SECURITY DEFINER (bez JWT).
 */
export class AssetSpecs1911000000000 implements MigrationInterface {
  name = 'AssetSpecs1911000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "asset_specs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "asset_id" uuid NOT NULL REFERENCES "assets"("id") ON DELETE CASCADE,
        "specs" jsonb,
        "source_url" text,
        "status" text NOT NULL DEFAULT 'fetching',
        "failure_reason" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_asset_specs_asset" ON "asset_specs" ("tenant_id", "asset_id")`,
    );
    await queryRunner.query(`ALTER TABLE "asset_specs" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "asset_specs" FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "asset_specs"
      USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
    `);
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON "asset_specs" TO "tagery_app"`,
    );

    // Callback z n8n běží bez JWT → dohledání tenanta k spec řádku (obchází RLS).
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION asset_spec_lookup(p_id uuid)
      RETURNS TABLE (spec_id uuid, tenant_id uuid)
      LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
        SELECT id, tenant_id FROM asset_specs WHERE id = p_id
      $$;
    `);
    await queryRunner.query(`GRANT EXECUTE ON FUNCTION asset_spec_lookup(uuid) TO "tagery_app"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS asset_spec_lookup(uuid)`);
    await queryRunner.query(`DROP TABLE IF EXISTS "asset_specs"`);
  }
}
