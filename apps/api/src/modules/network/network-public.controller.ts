import { Controller, Get, Param, Query } from '@nestjs/common';
import { NetworkService, type FeedItem, type TenantProfile } from './network.service';

/**
 * EPIC-21 F3 – veřejné objevování sítě (bez auth, jako storefront katalog).
 * Čte výhradně veřejnou projekci přes SECURITY DEFINER.
 */
@Controller('network')
export class NetworkPublicController {
  constructor(private readonly network: NetworkService) {}

  @Get('discover')
  discover(
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<FeedItem[]> {
    return this.network.discover(q ?? '', Number(limit) || 40, Number(offset) || 0);
  }

  @Get('tenants/:slug')
  async tenantProfile(@Param('slug') slug: string): Promise<TenantProfile | null> {
    return this.network.tenantProfile(slug);
  }
}
