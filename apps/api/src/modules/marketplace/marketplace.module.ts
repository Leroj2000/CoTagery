import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RentalListing } from './entities/rental-listing.entity';
import { RentalListingService } from './rental-listing.service';
import { RentalListingController } from './rental-listing.controller';
import { PublicRentalController } from './public-rental.controller';

/**
 * EPIC-19 – veřejná půjčovna / marketplace (F1): publikace Věcí jako inzeráty +
 * veřejný katalog (SECURITY DEFINER, bez auth). Oddělené od interního EPIC-10 Rental.
 */
@Module({
  imports: [TypeOrmModule.forFeature([RentalListing])],
  controllers: [RentalListingController, PublicRentalController],
  providers: [RentalListingService],
  exports: [RentalListingService],
})
export class MarketplaceModule {}
