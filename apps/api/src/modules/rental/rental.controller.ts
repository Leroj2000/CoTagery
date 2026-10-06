import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/rbac/permissions.guard';
import { AllowAuthenticatedOnly, RequirePermission } from '../../core/rbac/require-permission.decorator';
import { RequireModule } from '../../core/rbac/require-module.decorator';
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
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequireModule('rental')
export class RentalController {
  constructor(
    private readonly renters: RentersService,
    private readonly rental: RentalService,
  ) {}

  // --- Platformoví nájemci (sdílená reputace) ---
  @Post('renters')
  @RequirePermission('rental.item.manage')
  createRenter(@Body() dto: CreateRenterDto): Promise<RenterProfile> {
    return this.renters.create(dto);
  }

  @Get('renters/:id')
  @AllowAuthenticatedOnly()
  getRenter(@Param('id', ParseUUIDPipe) id: string): Promise<RenterProfile> {
    return this.renters.get(id);
  }

  @Post('renters/:id/verify')
  @RequirePermission('rental.renter.verify')
  verifyRenter(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyRenterDto,
  ): Promise<RenterProfile> {
    return this.renters.verify(id, dto.level);
  }

  // --- Rental (tenant-scoped) ---
  @Get('rental/items')
  @AllowAuthenticatedOnly()
  listItems(): Promise<Item[]> {
    return this.rental.listItems();
  }

  @Post('rental/items')
  @RequirePermission('rental.item.manage')
  createItem(@Body() dto: CreateItemDto): Promise<Item> {
    return this.rental.createItem(dto);
  }

  @Post('rental/items/:itemId/loans')
  @RequirePermission('rental.item.manage')
  createLoan(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: CreateLoanDto,
  ): Promise<Loan> {
    return this.rental.createLoan(itemId, dto);
  }

  @Post('rental/loans/:loanId/return')
  @RequirePermission('rental.item.manage')
  returnLoan(@Param('loanId', ParseUUIDPipe) loanId: string): Promise<Loan> {
    return this.rental.returnLoan(loanId);
  }

  @Post('rental/loans/:loanId/cancel')
  @RequirePermission('rental.item.manage')
  cancelLoan(@Param('loanId', ParseUUIDPipe) loanId: string): Promise<Loan> {
    return this.rental.cancelLoan(loanId);
  }

  @Post('rental/loans/:loanId/reviews')
  @RequirePermission('rental.item.manage')
  submitReview(
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @Body() dto: CreateReviewDto,
  ): Promise<RentalReview> {
    return this.rental.submitReview(loanId, dto);
  }
}
