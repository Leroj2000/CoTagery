import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../core/auth/entities/user.entity';
import { RenterProfile } from '../rental/entities/renter-profile.entity';
import { RentalListing } from './entities/rental-listing.entity';
import { RentalOrder } from './entities/rental-order.entity';
import { RentalListingService } from './rental-listing.service';
import { RentalOrderService } from './rental-order.service';
import { RenterAuthService } from './renter-auth.service';
import { RentalListingController } from './rental-listing.controller';
import { RentalOrderController } from './rental-order.controller';
import { PublicRentalController } from './public-rental.controller';
import { RenterAuthController } from './renter-auth.controller';
import { RenterOrderController } from './renter-order.controller';

/**
 * EPIC-19 – veřejná půjčovna / marketplace.
 * F1: publikace Věcí jako inzeráty + veřejný katalog (SECURITY DEFINER, bez auth).
 * F2: rezervace + veřejná objednávka + účet nájemce (rozh. C, renter-scoped
 * session, bez org tenant kontextu). Oddělené od interního EPIC-10 Rental.
 */
@Module({
  imports: [TypeOrmModule.forFeature([RentalListing, RentalOrder, User, RenterProfile])],
  controllers: [
    RentalListingController,
    RentalOrderController,
    PublicRentalController,
    RenterAuthController,
    RenterOrderController,
  ],
  providers: [RentalListingService, RentalOrderService, RenterAuthService],
  exports: [RentalListingService, RentalOrderService],
})
export class MarketplaceModule {}
