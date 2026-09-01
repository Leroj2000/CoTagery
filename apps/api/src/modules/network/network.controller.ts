import {
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  CurrentRenter,
  RenterJwtGuard,
  type RequestRenter,
} from '../marketplace/renter-jwt.guard';
import { NetworkService, type FollowedTenant } from './network.service';

/**
 * EPIC-21 síť – follow graf nájemce. Vyžaduje renter token (scope='renter').
 * Sledovat lze jen firmu opt-in v síti (`tenants.network_listed`).
 */
@Controller('network')
@UseGuards(RenterJwtGuard)
export class NetworkController {
  constructor(private readonly network: NetworkService) {}

  @Get('follows')
  follows(@CurrentRenter() renter: RequestRenter): Promise<FollowedTenant[]> {
    return this.network.followed(renter.userId);
  }

  @Post('follows/:tenantId')
  @HttpCode(204)
  async follow(
    @CurrentRenter() renter: RequestRenter,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ): Promise<void> {
    const ok = await this.network.follow(renter.userId, tenantId);
    if (!ok) throw new NotFoundException('Firma není v síti dostupná.');
  }

  @Delete('follows/:tenantId')
  @HttpCode(204)
  unfollow(
    @CurrentRenter() renter: RequestRenter,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ): Promise<void> {
    return this.network.unfollow(renter.userId, tenantId);
  }
}
