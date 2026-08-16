import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '../../core/tenancy/tenant-context.service';
import { RenterProfile } from './entities/renter-profile.entity';
import { Item } from './entities/item.entity';
import { Loan } from './entities/loan.entity';
import { RentalReview } from './entities/rental-review.entity';
import { meetsLevel, rollingAverage } from './verification';
import type { CreateItemDto, CreateLoanDto, CreateReviewDto } from './dto/rental.dto';

@Injectable()
export class RentalService {
  constructor(private readonly context: TenantContextService) {}

  createItem(dto: CreateItemDto): Promise<Item> {
    const repo = this.context.manager.getRepository(Item);
    return repo.save(
      repo.create({
        tenantId: this.context.tenantId,
        name: dto.name,
        serialNumber: dto.serialNumber ?? null,
        pricePerDay: dto.pricePerDay ?? '0',
        deposit: dto.deposit ?? '0',
        requiredVerificationLevel: dto.requiredVerificationLevel ?? 'contact',
      }),
    );
  }

  listItems(): Promise<Item[]> {
    return this.context.manager.getRepository(Item).find({ order: { createdAt: 'DESC' } });
  }

  async createLoan(itemId: string, dto: CreateLoanDto): Promise<Loan> {
    const items = this.context.manager.getRepository(Item);
    const item = await items.findOne({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Věc neexistuje');

    // Věc nelze půjčit, pokud je už vypůjčená (stav se odvozuje z workflow).
    if (item.status === 'loaned') {
      throw new BadRequestException('Věc je již vypůjčená');
    }

    const renter = await this.context.manager
      .getRepository(RenterProfile)
      .findOne({ where: { id: dto.renterProfileId } });
    if (!renter) throw new NotFoundException('Nájemce neexistuje');

    // Ověření identity musí splňovat požadovanou úroveň věci (ADR-0005).
    if (!meetsLevel(renter.verificationLevel, item.requiredVerificationLevel)) {
      throw new BadRequestException(
        `Nájemce má úroveň ověření '${renter.verificationLevel}', věc vyžaduje '${item.requiredVerificationLevel}'`,
      );
    }

    const repo = this.context.manager.getRepository(Loan);
    const loan = await repo.save(
      repo.create({
        tenantId: this.context.tenantId,
        itemId,
        renterProfileId: dto.renterProfileId,
        rentalStart: dto.rentalStart ? new Date(dto.rentalStart) : null,
        rentalEnd: dto.rentalEnd ? new Date(dto.rentalEnd) : null,
        status: 'active',
      }),
    );

    // Odvozený stav věci: půjčením přechází na 'loaned'.
    item.status = 'loaned';
    await items.save(item);
    return loan;
  }

  /** Vrácení věci: uzavře půjčku a vrátí věc zpět do assetu (available). */
  async returnLoan(loanId: string): Promise<Loan> {
    return this.closeLoan(loanId, 'returned');
  }

  /** Zrušení půjčky: uzavře půjčku a uvolní věc (available). */
  async cancelLoan(loanId: string): Promise<Loan> {
    return this.closeLoan(loanId, 'cancelled');
  }

  private async closeLoan(loanId: string, status: 'returned' | 'cancelled'): Promise<Loan> {
    const loans = this.context.manager.getRepository(Loan);
    const loan = await loans.findOne({ where: { id: loanId } });
    if (!loan) throw new NotFoundException('Půjčka neexistuje');
    if (loan.status === 'returned' || loan.status === 'cancelled') {
      throw new BadRequestException('Půjčka je již uzavřená');
    }

    loan.status = status;
    if (status === 'returned') loan.returnedAt = new Date();
    await loans.save(loan);

    // Odvozený stav věci: vrácením/zrušením se uvolní zpět do assetu.
    const items = this.context.manager.getRepository(Item);
    const item = await items.findOne({ where: { id: loan.itemId } });
    if (item) {
      item.status = 'available';
      await items.save(item);
    }
    return loan;
  }

  async submitReview(loanId: string, dto: CreateReviewDto): Promise<RentalReview> {
    const loan = await this.context.manager.getRepository(Loan).findOne({ where: { id: loanId } });
    if (!loan) throw new NotFoundException('Půjčka neexistuje');

    const reviews = this.context.manager.getRepository(RentalReview);
    const review = await reviews.save(
      reviews.create({
        tenantId: this.context.tenantId,
        loanId,
        direction: dto.direction,
        renterProfileId: loan.renterProfileId,
        rating: dto.rating,
        comment: dto.comment ?? null,
      }),
    );

    // Hodnocení nájemce se propíše do platformové reputace (rolling avg).
    if (dto.direction === 'lessor_to_renter') {
      const renters = this.context.manager.getRepository(RenterProfile);
      const renter = await renters.findOne({ where: { id: loan.renterProfileId } });
      if (renter) {
        const newAvg = rollingAverage(Number(renter.ratingAvg), renter.ratingCount, dto.rating);
        renter.ratingAvg = newAvg.toFixed(2);
        renter.ratingCount += 1;
        await renters.save(renter);
      }
    }
    return review;
  }
}
