import { Controller, Get, Param, ParseIntPipe, ParseUUIDPipe, StreamableFile } from '@nestjs/common';
import { RentalListingService, type PublicCatalogItem } from './rental-listing.service';

/**
 * Veřejný (bez auth) katalog půjčovny – vzor resolveru. Čte přes SECURITY DEFINER
 * funkce (jen published), mimo tenant kontext. Fotky se streamují jen pro
 * publikované inzeráty.
 */
@Controller('public/rental')
export class PublicRentalController {
  constructor(private readonly listings: RentalListingService) {}

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
}
