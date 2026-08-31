import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { IsNull, Repository } from 'typeorm';
import { TenantContextService } from '../../core/tenancy/tenant-context.service';
import { MembershipTier } from '../membership/entities/membership-tier.entity';
import { MembershipBenefit } from '../membership/entities/membership-benefit.entity';
import { WalletCode, type WalletKind } from './entities/wallet-code.entity';
import type { CreateWalletCodeDto } from './dto/wallet.dto';

/** Read-only kód agregovaný z jiného modulu (nelze editovat v klíčence). */
export interface AggregatedCode {
  id: string;
  source: 'membership';
  kind: WalletKind;
  label: string;
  detail: string | null;
}

export interface WalletView {
  personal: WalletCode[];
  shared: WalletCode[];
  aggregated: AggregatedCode[];
}

@Injectable()
export class WalletService {
  constructor(private readonly context: TenantContextService) {}

  private repo<T extends object>(entity: { new (): T }): Repository<T> {
    return this.context.manager.getRepository(entity);
  }

  private requireUser(): string {
    const userId = this.context.userId;
    if (!userId) throw new ForbiddenException('Chybí kontext uživatele.');
    return userId;
  }

  /** Osobní kódy uživatele + celofiremní sdílené + agregace z modulů. */
  async list(): Promise<WalletView> {
    const userId = this.requireUser();
    const repo = this.repo(WalletCode);
    const [personal, shared, aggregated] = await Promise.all([
      repo.find({ where: { userId }, order: { createdAt: 'DESC' } }),
      repo.find({ where: { userId: IsNull() }, order: { createdAt: 'DESC' } }),
      this.aggregateFromModules(),
    ]);
    return { personal, shared, aggregated };
  }

  /** Vytvoří kód. `shared=true` = celofiremní (gating na controlleru). */
  create(dto: CreateWalletCodeDto, shared: boolean): Promise<WalletCode> {
    const repo = this.repo(WalletCode);
    return repo.save(
      repo.create({
        tenantId: this.context.tenantId!,
        userId: shared ? null : this.requireUser(),
        label: dto.label.trim(),
        kind: dto.kind,
        format: dto.format,
        value: dto.value.trim(),
        note: dto.note?.trim() || null,
      }),
    );
  }

  /** Smaže osobní kód – jen vlastník. Sdílené jdou přes deleteShared. */
  async deletePersonal(id: string): Promise<void> {
    const userId = this.requireUser();
    const repo = this.repo(WalletCode);
    const code = await repo.findOne({ where: { id } });
    if (!code) throw new NotFoundException('Kód nenalezen.');
    if (code.userId !== userId) throw new ForbiddenException('Není tvůj kód.');
    await repo.delete({ id });
  }

  /** Smaže celofiremní sdílený kód (gating na controlleru). */
  async deleteShared(id: string): Promise<void> {
    const repo = this.repo(WalletCode);
    const code = await repo.findOne({ where: { id } });
    if (!code) throw new NotFoundException('Kód nenalezen.');
    if (code.userId !== null) throw new ForbiddenException('Není celofiremní kód.');
    await repo.delete({ id });
  }

  /** Membership benefity → slevové/přístupové kódy (read-only). */
  private async aggregateFromModules(): Promise<AggregatedCode[]> {
    const [benefits, tiers] = await Promise.all([
      this.repo(MembershipBenefit).find(),
      this.repo(MembershipTier).find(),
    ]);
    const tierName = new Map(tiers.map((t) => [t.id, t.name]));
    return benefits.map((b) => {
      const tier = tierName.get(b.tierId) ?? 'Tier';
      const isAccess = b.kind === 'zone_access';
      let label: string;
      switch (b.kind) {
        case 'discount_percent':
          label = `${tier} • sleva ${b.value ?? '?'} %`;
          break;
        case 'special_price':
          label = `${tier} • cena ${b.value ?? '?'} Kč`;
          break;
        case 'free':
          label = `${tier} • zdarma`;
          break;
        case 'zone_access':
          label = `${tier} • vstup ${b.targetKey ?? 'do zóny'}`;
          break;
        default:
          label = tier;
      }
      return {
        id: b.id,
        source: 'membership' as const,
        kind: (isAccess ? 'access' : 'discount') as WalletKind,
        label,
        detail: b.description ?? b.targetKey,
      };
    });
  }
}
