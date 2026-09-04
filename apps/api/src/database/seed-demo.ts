import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { TenantContextService } from '../core/tenancy/tenant-context.service';
import { MembershipService } from '../modules/membership/membership.service';
import { BillingService } from '../modules/billing/billing.service';
import { DigitalObjectsService } from '../core/domain/objects/digital-objects.service';
import { DataCarriersService } from '../core/domain/carriers/data-carriers.service';
import { AccessControlService } from '../core/access/access-control.service';
import { UsersService } from '../core/domain/users/users.service';
import { GroupsService } from '../core/domain/groups/groups.service';
import { TenantService } from '../core/domain/tenant/tenant.service';
import { Member } from '../modules/membership/entities/member.entity';
import { DataCarrier } from '../core/domain/entities/data-carrier.entity';
import { Subscription } from '../modules/billing/entities/subscription.entity';
import { ScanEvent } from '../core/domain/entities/scan-event.entity';

/**
 * Demo seed (varianta A – „co ukazovat"): naplní demo tenant realistickými daty
 * přes reálné služby (žádné raw SQL) – tiery, členové, členství, karta, pool
 * identifikátorů (vč. self-aktivace), produkty, přístupový bod + audit, předplatné +
 * faktura, uživatelé, skupina, skeny pro analytiku. Idempotentní.
 *
 * Předpoklad: `pnpm --filter @tagery/api seed` (demo tenant + owner) proběhl.
 */
async function seedDemo(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const ds = app.get(DataSource);
  const ctx = app.get(TenantContextService);

  const tenants = await ds.query(`SELECT id FROM tenants WHERE name = $1`, ['Demo Tenant']);
  if (tenants.length === 0) {
    console.error('Demo tenant chybí – spusť nejdřív `pnpm --filter @tagery/api seed`.');
    await app.close();
    process.exit(1);
  }
  const tenantId = tenants[0].id as string;

  await ctx.runInTenant(tenantId, async () => {
    const memberships = app.get(MembershipService);
    const billing = app.get(BillingService);
    const objects = app.get(DigitalObjectsService);
    const carriers = app.get(DataCarriersService);
    const access = app.get(AccessControlService);
    const users = app.get(UsersService);
    const groups = app.get(GroupsService);
    const tenant = app.get(TenantService);

    const existing = await ctx.manager.getRepository(Member).findOne({ where: { email: 'jana@demo.cz' } });
    if (existing) {
      console.log('Demo data už existují – přeskočeno.');
      return;
    }

    // Branding
    await tenant.update({ name: 'Demo Tenant', brandingDomain: 'tagy.demo.cz' });

    // Tiery + benefity
    const basic = await memberships.createTier({ name: 'Basic', level: 1, price: '0', validityDays: 365 });
    const vip = await memberships.createTier({
      name: 'VIP',
      level: 10,
      price: '990',
      validityDays: 365,
      graceDays: 14,
      zoneKeys: ['vip'],
    });
    await memberships.addBenefit(vip.id, { kind: 'discount_percent', value: '20', description: '20 % na vše' });
    await memberships.addBenefit(vip.id, { kind: 'zone_access', targetKey: 'vip', description: 'Vstup do VIP zóny' });

    // Členové + členství
    const jana = await memberships.createMember({ name: 'Jana Nováková', email: 'jana@demo.cz' });
    const petr = await memberships.createMember({ name: 'Petr Svoboda', email: 'petr@demo.cz' });
    const eva = await memberships.createMember({ name: 'Eva Dvořáková', email: 'eva@demo.cz' });
    const janaMembership = await memberships.issueMembership({ memberId: jana.id, tierId: vip.id });
    await memberships.issueMembership({ memberId: petr.id, tierId: basic.id });

    // Produkty + identifikátory
    const kava = await objects.create({ moduleType: 'product', slug: 'demo-kava-etiopie' });
    const tricko = await objects.create({ moduleType: 'product', slug: 'demo-tricko-bio' });
    await carriers.createForObject(kava.id, { carrierType: 'qr' });
    await carriers.createForObject(tricko.id, { carrierType: 'qr' });

    // Pool identifikátorů: 5 běžných + 3 self-aktivační (PIN)
    const pool = await carriers.generateBatch({ count: 5 });
    const selfAct = await carriers.generateBatch({ count: 3, selfActivatable: true, moduleTemplate: 'contact' });
    console.log(
      'Self-aktivační identifikátory (kód/PIN k tisku):',
      selfAct.map((g) => `${g.carrier.publicCode}:${g.pin}`).join(', '),
    );

    // VIP karta pro Janu na jeden identifikátor z poolu
    const cardCarrierId = pool[0].carrier.id;
    await memberships.issueCard(janaMembership.id, { dataCarrierId: cardCarrierId });
    const cardCarrier = await ctx.manager.getRepository(DataCarrier).findOne({ where: { id: cardCarrierId } });

    // Přístupový bod + audit (sken VIP karty u brány)
    const gate = await access.create({ name: 'Hlavní brána', zoneKey: 'vip', direction: 'in' });
    for (let i = 0; i < 3; i++) {
      await access.evaluate(gate.id, 'membership', cardCarrierId);
    }

    // Předplatné pro Evu (VIP) + simulace zaplacené faktury
    const checkout = await billing.checkout({ memberId: eva.id, tierId: vip.id });
    const sub = await billing.getSubscription(checkout.subscriptionId);
    sub.status = 'active';
    if (sub.membershipId) {
      const renewed = await memberships.renew(sub.membershipId);
      sub.currentPeriodEnd = renewed.validTo;
    }
    await ctx.manager.getRepository(Subscription).save(sub);
    await billing.recordPaidInvoice(sub, false);

    // Uživatelé + skupina
    const editor = await users.invite({ email: 'editor@demo.cz', name: 'Editor Demo', tenantRole: 'EDITOR' });
    await users.invite({ email: 'viewer@demo.cz', name: 'Viewer Demo', tenantRole: 'VIEWER' });
    console.log('Pozvaný editor (dočasné heslo):', editor.tempPassword);
    const seedUser = { userId: editor.user.id, tenantId, tenantRole: 'OWNER' as const };
    const group = await groups.create(seedUser, { name: 'Zaměstnanci', type: 'user' });
    await groups.addMember(seedUser, group.id, { userId: editor.user.id });

    // Skeny pro analytiku (dashboard graf)
    const scanRepo = ctx.manager.getRepository(ScanEvent);
    const mkScans = (objectId: string, type: string, n: number): ScanEvent[] =>
      Array.from({ length: n }, () =>
        scanRepo.create({ tenantId, digitalObjectId: objectId, carrierType: type, eventType: 'scan' }),
      );
    await scanRepo.save([
      ...mkScans(kava.id, 'qr', 7),
      ...mkScans(tricko.id, 'qr', 4),
      ...(cardCarrier?.digitalObjectId ? mkScans(cardCarrier.digitalObjectId, 'nfc', 5) : []),
    ]);

    console.log('Demo data vytvořena ✔');
  });

  await app.close();
}

seedDemo()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Demo seed selhal:', err);
    process.exit(1);
  });
