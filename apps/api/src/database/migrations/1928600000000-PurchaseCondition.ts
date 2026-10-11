import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Použité zboží: pořízení dostane stav (nové/použité) a datum prvního uvedení
 * do provozu; záruka základ začátku (`purchase` / `in_service` / `custom`).
 * Stávající záruky se začátkem = datum pořízení dostanou základ `purchase`
 * (dosud to byl výchozí začátek), ostatní zůstanou ruční.
 */
export class PurchaseCondition1928600000000 implements MigrationInterface {
  name = 'PurchaseCondition1928600000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE asset_purchases
      ADD COLUMN condition text NOT NULL DEFAULT 'new' CHECK (condition IN ('new', 'used')),
      ADD COLUMN in_service_on date`);
    await q.query(`ALTER TABLE asset_warranties
      ADD COLUMN start_basis text NOT NULL DEFAULT 'custom'
        CHECK (start_basis IN ('purchase', 'in_service', 'custom'))`);
    await q.query(`UPDATE asset_warranties w SET start_basis = 'purchase'
      FROM asset_purchases p
      WHERE p.tenant_id = w.tenant_id AND p.asset_id = w.asset_id
        AND w.starts_on IS NOT NULL AND w.starts_on = p.purchased_on`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE asset_warranties DROP COLUMN start_basis`);
    await q.query(`ALTER TABLE asset_purchases DROP COLUMN in_service_on, DROP COLUMN condition`);
  }
}
