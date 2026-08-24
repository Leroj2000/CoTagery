import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  StreamableFile,
} from '@nestjs/common';
import { RentalListingService, type PublicCatalogItem } from './rental-listing.service';
import { RentalOrderService, type AvailabilityPeriod } from './rental-order.service';
import { QuoteDto } from './dto/order.dto';
import type { Quote } from './order-pricing';

/**
 * Veřejný (bez auth) katalog půjčovny – vzor resolveru. Čte přes SECURITY DEFINER
 * funkce (jen published), mimo tenant kontext. Fotky se streamují jen pro
 * publikované inzeráty. Cena (quote) i dostupnost jsou veřejné (náhled před
 * objednáním); samotné vytvoření objednávky vyžaduje účet nájemce (rozh. C).
 */
@Controller('public/rental')
export class PublicRentalController {
  constructor(
    private readonly listings: RentalListingService,
    private readonly orders: RentalOrderService,
  ) {}

  @Get(':tenantSlug')
  catalog(@Param('tenantSlug') tenantSlug: string): Promise<PublicCatalogItem[]> {
    return this.listings.publicCatalog(tenantSlug);
  }

  @Get(':tenantSlug/detail/:listingSlug')
  detail(
    @Param('tenantSlug') tenantSlug: string,
    @Param('listingSlug') listingSlug: string,
  ): Promise<unknown> {
    return this.listings.publicListing(tenantSlug, listingSlug);
  }

  @Get('listings/:listingId/photos/:idx')
  async photo(
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Param('idx', ParseIntPipe) idx: number,
  ): Promise<StreamableFile> {
    const { buffer, mime } = await this.listings.publicPhoto(listingId, idx);
    return new StreamableFile(buffer, { type: mime });
  }

  @Get('listings/:listingId/availability')
  availability(
    @Param('listingId', ParseUUIDPipe) listingId: string,
  ): Promise<AvailabilityPeriod[]> {
    return this.orders.availability(listingId);
  }

  @Post('quote')
  quote(@Body() dto: QuoteDto): Promise<Quote> {
    return this.orders.quote(dto.tenantSlug, dto.listingSlug, dto.startsAt, dto.endsAt);
  }
}
