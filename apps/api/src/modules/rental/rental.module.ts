import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RenterProfile } from './entities/renter-profile.entity';
import { Item } from './entities/item.entity';
import { Loan } from './entities/loan.entity';
import { RentalReview } from './entities/rental-review.entity';
import { RentersService } from './renters.service';
import { RentalService } from './rental.service';
import { RentalController } from './rental.controller';

/** EPIC-10 Rental – půjčování + ověření nájemce + platformová reputace (ADR-0005). */
@Module({
  imports: [TypeOrmModule.forFeature([RenterProfile, Item, Loan, RentalReview])],
  controllers: [RentalController],
  providers: [RentersService, RentalService],
})
export class RentalModule {}
