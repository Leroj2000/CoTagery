/** Database integration check; every write is rolled back. */
import assert from 'node:assert/strict';
import { DataSource } from 'typeorm';
import { Asset } from '../src/modules/asset/entities/asset.entity';
import { Category } from '../src/modules/asset/entities/category.entity';
import { MeterReading } from '../src/modules/asset/entities/meter-reading.entity';

async function main() {
  const db = new DataSource({
    type: 'postgres',
    url: process.env.APP_DATABASE_URL,
    entities: [Asset, Category, MeterReading],
  });
  await db.initialize();
  const runner = db.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  try {
    const [tenant] = await runner.query(`SELECT id FROM tenants WHERE name='Demo Tenant'`);
    const [other] = await runner.query(`SELECT id FROM tenants WHERE id<>$1 LIMIT 1`, [tenant?.id]);
    assert(tenant && other, 'Two organizations are required');
    await runner.query(`SELECT set_config('app.tenant_id',$1,true)`, [tenant.id]);
    const [asset] = await runner.query(`SELECT id FROM assets LIMIT 1`);
    assert(asset, 'A demo asset is required');
    const [category] = await runner.query(
      `INSERT INTO asset_categories(tenant_id,name,equipment_kind)
      VALUES($1,'Rollback maintenance '||gen_random_uuid()::text,'vehicle') RETURNING id`,
      [tenant.id],
    );
    await runner.query(`UPDATE assets SET category_id=$1 WHERE id=$2`, [category.id, asset.id]);
    const joined = await runner.manager
      .getRepository(Asset)
      .createQueryBuilder('a')
      .innerJoin(Category, 'c', 'c.id=a.categoryId')
      .where("c.equipment_kind IN ('vehicle','machine')")
      .andWhere('a.id=:id', { id: asset.id })
      .getOne();
    assert.equal(joined?.id, asset.id, 'category join used by attention must resolve');
    const [reading] = await runner.query(
      `INSERT INTO asset_meter_readings(tenant_id,asset_id,value)
      VALUES($1,$2,120000) RETURNING id`,
      [tenant.id, asset.id],
    );
    await runner.query(`UPDATE asset_categories SET equipment_kind='machine' WHERE id=$1`, [
      category.id,
    ]);
    const [fractional] = await runner.query(
      `INSERT INTO asset_meter_readings(tenant_id,asset_id,value)
      VALUES($1,$2,120000.5) RETURNING id`,
      [tenant.id, asset.id],
    );
    const mapped = await runner.manager
      .getRepository(MeterReading)
      .findOne({ where: { id: fractional.id } });
    assert.equal(mapped?.value, 120000.5, 'tenths of machine hours must round-trip as numbers');
    const [rule] = await runner.query(
      `INSERT INTO asset_maintenance_rules
      (tenant_id,asset_id,code,interval_units,interval_months,description)
      VALUES($1,$2,'regular',15000,12,'Test interval') RETURNING id`,
      [tenant.id, asset.id],
    );
    const [service] = await runner.query(
      `INSERT INTO asset_services
      (tenant_id,asset_id,kind,performed_at,plan_code,meter_value)
      VALUES($1,$2,'service','2025-01-01','regular',100000) RETURNING id`,
      [tenant.id, asset.id],
    );
    assert(reading && rule && service);
    await runner.query('SAVEPOINT invalid_meter');
    try {
      await runner.query(
        `INSERT INTO asset_meter_readings(tenant_id,asset_id,value)
        VALUES($1,$2,-1)`,
        [tenant.id, asset.id],
      );
      throw new Error('Negative meter value was accepted');
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('check constraint')) throw error;
    } finally {
      await runner.query('ROLLBACK TO SAVEPOINT invalid_meter');
    }
    await runner.query(`UPDATE asset_meter_readings SET deleted_at=now() WHERE id=$1`, [
      reading.id,
    ]);
    const active = await runner.query(
      `SELECT id FROM asset_meter_readings
      WHERE id=$1 AND deleted_at IS NULL`,
      [reading.id],
    );
    assert.equal(active.length, 0, 'deleted readings must not be active');
    await runner.query(`SELECT set_config('app.tenant_id',$1,true)`, [other.id]);
    for (const [table, id] of [
      ['asset_meter_readings', reading.id],
      ['asset_maintenance_rules', rule.id],
      ['asset_services', service.id],
    ]) {
      const foreign = await runner.query(`SELECT id FROM ${table} WHERE id=$1`, [id]);
      assert.equal(foreign.length, 0, `${table} crossed tenant isolation`);
    }
    console.log(
      'PASS: category kind, meter constraint/deletion, service linkage and tenant isolation.',
    );
  } finally {
    await runner.rollbackTransaction();
    await runner.release();
    await db.destroy();
    console.log('All integration test changes rolled back.');
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
