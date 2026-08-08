import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { RentersService } from './renters.service';
import { RentalService } from './rental.service';
import {
  CreateItemDto,
  CreateLoanDto,
  CreateRenterDto,
  CreateReviewDto,
  VerifyRenterDto,
} from './dto/rental.dto';
import type { RenterProfile } from './entities/renter-profile.entity';
import type { Item } from './entities/item.entity';
import type { Loan } from './entities/loan.entity';
import type { RentalReview } from './entities/rental-review.entity';

@Controller()
@UseGuards(JwtAuthGuard)
export class RentalController {
  constructor(
    private readonly renters: RentersService,
    private readonly rental: RentalService,
  ) {}

  // --- Platformoví nájemci (sdílená reputace) ---
  @Post('renters')
  createRenter(@Body() dto: CreateRenterDto): Promise<RenterProfile> {
    return this.renters.create(dto);
  }

  @Get('renters/:id')
  getRenter(@Param('id', ParseUUIDPipe) id: string): Promise<RenterProfile> {
    return this.renters.get(id);
  }

  @Post('renters/:id/verify')
  verifyRenter(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyRenterDto,
  ): Promise<RenterProfile> {
    return this.renters.verify(id, dto.level);
  }

  // --- Rental (tenant-scoped) ---
  @Post('rental/items')
  createItem(@Body() dto: CreateItemDto): Promise<Item> {
    return this.rental.createItem(dto);
  }

  @Post('rental/items/:itemId/loans')
  createLoan(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: CreateLoanDto,
  ): Promise<Loan> {
    return this.rental.createLoan(itemId, dto);
  }

  @Post('rental/loans/:loanId/reviews')
  submitReview(
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @Body() dto: CreateReviewDto,
  ): Promise<RentalReview> {
    return this.rental.submitReview(loanId, dto);
  }
}
