import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantContextService } from '../../core/tenancy/tenant-context.service';
import { RenterProfile } from './entities/renter-profile.entity';
import type { CreateRenterDto } from './dto/rental.dto';
import type { VerificationLevel } from './verification';

/**
 * RenterProfile je platformový (bez RLS) – čte/píše se přes tenant manager,
 * ale tabulka nemá politiku, takže je viditelná napříč tenanty (ADR-0005).
 */
@Injectable()
export class RentersService {
  constructor(private readonly context: TenantContextService) {}

  private repo(): Repository<RenterProfile> {
    return this.context.manager.getRepository(RenterProfile);
  }

  create(dto: CreateRenterDto): Promise<RenterProfile> {
    return this.repo().save(
      this.repo().create({
        email: dto.email,
        displayName: dto.displayName,
        phone: dto.phone ?? null,
      }),
    );
  }

  async get(id: string): Promise<RenterProfile> {
    const renter = await this.repo().findOne({ where: { id } });
    if (!renter) throw new NotFoundException('Nájemce neexistuje');
    return renter;
  }

  async verify(id: string, level: VerificationLevel): Promise<RenterProfile> {
    const renter = await this.get(id);
    renter.verificationLevel = level;
    return this.repo().save(renter);
  }
}
