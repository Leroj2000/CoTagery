import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Veřejná self-aktivace (PIN varianta): nosič nese self_activatable flag,
 * hash aktivačního PINu a šablonu modulu. `activation_lookup` je SECURITY
 * DEFINER (obchází RLS pro veřejný /activate endpoint bez tenant kontextu).
 */
export class SelfActivation1790000000000 implements MigrationInterface {
  name = 'SelfActivation1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "data_carriers" ADD COLUMN IF NOT EXISTS "self_activatable" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "data_carriers" ADD COLUMN IF NOT EXISTS "activation_pin_hash" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "data_carriers" ADD COLUMN IF NOT EXISTS "module_template" text`,
    );

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION activation_lookup(p_code text)
      RETURNS TABLE (
        carrier_id uuid, tenant_id uuid, self_activatable boolean,
        module_template text, activation_pin_hash text, digital_object_id uuid
      )
      LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
        SELECT dc.id, dc.tenant_id, dc.self_activatable, dc.module_template,
               dc.activation_pin_hash, dc.digital_object_id
        FROM data_carriers dc
        WHERE dc.public_code = p_code
      $$;
    `);
    await queryRunner.query(`REVOKE ALL ON FUNCTION activation_lookup(text) FROM PUBLIC`);
    await queryRunner.query(`GRANT EXECUTE ON FUNCTION activation_lookup(text) TO "tagery_app"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS activation_lookup(text)`);
    await queryRunner.query(`ALTER TABLE "data_carriers" DROP COLUMN IF EXISTS "module_template"`);
    await queryRunner.query(`ALTER TABLE "data_carriers" DROP COLUMN IF EXISTS "activation_pin_hash"`);
    await queryRunner.query(`ALTER TABLE "data_carriers" DROP COLUMN IF EXISTS "self_activatable"`);
  }
}
