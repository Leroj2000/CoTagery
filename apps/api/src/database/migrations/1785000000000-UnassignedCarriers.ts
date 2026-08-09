import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Předgenerované nepřiřazené nosiče: digital_object_id smí být NULL (pool),
 * resolve_carrier přejde na LEFT JOIN, aby resolver poznal "unassigned" kód.
 */
export class UnassignedCarriers1785000000000 implements MigrationInterface {
  name = 'UnassignedCarriers1785000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "data_carriers" ALTER COLUMN "digital_object_id" DROP NOT NULL`,
    );
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
        LEFT JOIN digital_objects d ON d.id = dc.digital_object_id
        WHERE dc.public_code = p_code
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Návrat na INNER JOIN.
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
    await queryRunner.query(
      `ALTER TABLE "data_carriers" ALTER COLUMN "digital_object_id" SET NOT NULL`,
    );
  }
}
