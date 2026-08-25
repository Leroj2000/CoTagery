import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Manuály a návody k položce (asset_manuals) – dokumentace k obsluze věci.
 * Zdroj: upload / kamera / AI (webhook do n8n). Dokud AI stahuje, řádek má
 * `status='fetching'` a `file_key=null`. Tenant-scoped, RLS.
 *
 * `asset_manual_lookup` je SECURITY DEFINER – AI callback nemá JWT a podle
 * manualId dohledá tenanta (obchází RLS, jako billing_subscription_lookup).
 */
export class AssetManuals1909000000000 implements MigrationInterface {
  name = 'AssetManuals1909000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "asset_manuals" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "asset_id" uuid NOT NULL REFERENCES "assets"("id") ON DELETE CASCADE,
        "title" text NOT NULL,
        "file_key" text,
        "mime" text,
        "size_bytes" bigint,
        "source" text NOT NULL DEFAULT 'upload',
        "source_url" text,
        "status" text NOT NULL DEFAULT 'ready',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_asset_manuals_asset" ON "asset_manuals" ("asset_id")`,
    );

    await queryRunner.query(`ALTER TABLE "asset_manuals" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "asset_manuals" FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "asset_manuals"
      USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
    `);
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON "asset_manuals" TO "tagery_app"`,
    );

    // AI callback nemá JWT: podle manualId dohledá tenanta (obchází RLS).
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION asset_manual_lookup(p_manual uuid)
      RETURNS TABLE (manual_id uuid, tenant_id uuid)
      LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
        SELECT m.id, m.tenant_id
        FROM asset_manuals m
        WHERE m.id = p_manual
      $$;
    `);
    await queryRunner.query(`REVOKE ALL ON FUNCTION asset_manual_lookup(uuid) FROM PUBLIC`);
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION asset_manual_lookup(uuid) TO "tagery_app"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS asset_manual_lookup(uuid)`);
    await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "asset_manuals"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "asset_manuals"`);
  }
}
