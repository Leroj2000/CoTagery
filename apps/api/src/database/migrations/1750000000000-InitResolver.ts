import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * EPIC-05 Resolver: scan_events + SECURITY DEFINER funkce.
 *
 * Resolver čte nosič podle public_code BEZ tenant kontextu (veřejný hot path),
 * a zapisuje ScanEvent taktéž bez kontextu. Obojí přes SECURITY DEFINER funkce
 * vlastněné superuserem → obejdou RLS jen pro tuto úzkou operaci (ADR-0001/0002).
 * scan_events mají RLS pro ČTENÍ (analytika EPIC-06 = tenant vidí své).
 */
export class InitResolver1750000000000 implements MigrationInterface {
  name = 'InitResolver1750000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "scan_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "digital_object_id" uuid,
        "data_carrier_id" uuid,
        "carrier_type" text,
        "event_type" text NOT NULL DEFAULT 'scan',
        "ip_address" text,
        "user_agent" text,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_scan_events_tenant" ON "scan_events" ("tenant_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_scan_events_object" ON "scan_events" ("digital_object_id")`,
    );
    await queryRunner.query(`ALTER TABLE "scan_events" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "scan_events" FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "scan_events"
      USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
    `);
    await queryRunner.query(`GRANT SELECT, INSERT ON "scan_events" TO "tagery_app"`);

    // Lookup nosiče podle public_code – obchází RLS (běží jako vlastník).
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION resolve_carrier(p_code text)
      RETURNS TABLE (
        carrier_id uuid, tenant_id uuid, digital_object_id uuid,
        carrier_type text, carrier_status text,
        module_type text, object_status text,
        valid_from timestamptz, valid_to timestamptz, primary_url text, slug text
      )
      LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
        SELECT dc.id, dc.tenant_id, dc.digital_object_id, dc.carrier_type, dc.status,
               d.module_type, d.status, d.valid_from, d.valid_to, d.primary_url, d.slug
        FROM data_carriers dc
        JOIN digital_objects d ON d.id = dc.digital_object_id
        WHERE dc.public_code = p_code
      $$;
    `);
    await queryRunner.query(`REVOKE ALL ON FUNCTION resolve_carrier(text) FROM PUBLIC`);
    await queryRunner.query(`GRANT EXECUTE ON FUNCTION resolve_carrier(text) TO "tagery_app"`);

    // Zápis ScanEventu – obchází RLS (resolver nemá tenant kontext).
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION log_scan(
        p_tenant uuid, p_object uuid, p_carrier uuid,
        p_carrier_type text, p_event_type text, p_ip text, p_ua text
      )
      RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
        INSERT INTO scan_events
          (tenant_id, digital_object_id, data_carrier_id, carrier_type, event_type, ip_address, user_agent)
        VALUES (p_tenant, p_object, p_carrier, p_carrier_type, p_event_type, p_ip, p_ua);
      $$;
    `);
    await queryRunner.query(
      `REVOKE ALL ON FUNCTION log_scan(uuid, uuid, uuid, text, text, text, text) FROM PUBLIC`,
    );
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION log_scan(uuid, uuid, uuid, text, text, text, text) TO "tagery_app"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS log_scan(uuid, uuid, uuid, text, text, text, text)`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS resolve_carrier(text)`);
    await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "scan_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "scan_events"`);
  }
}
