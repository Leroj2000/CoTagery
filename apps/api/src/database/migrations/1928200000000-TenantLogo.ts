import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Logo firmy (PNG) – vkládá se doprostřed QR kódů a na štítky. */
export class TenantLogo1928200000000 implements MigrationInterface {
  name = 'TenantLogo1928200000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE tenants ADD COLUMN logo_file_key text`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE tenants DROP COLUMN logo_file_key`);
  }
}
