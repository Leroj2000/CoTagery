import { Module } from '@nestjs/common';
import { NetworkService } from './network.service';
import { NetworkController } from './network.controller';
import { NetworkPublicController } from './network-public.controller';

/**
 * EPIC-21 síť/discovery nad půjčovnou. F1: follow graf nájemce (renter-scoped)
 * nad SECURITY DEFINER funkcemi. Opt-in viditelnost firmy (`tenants.network_listed`)
 * se spravuje přes stávající `PATCH /tenant` (TenantController).
 */
@Module({
  controllers: [NetworkController, NetworkPublicController],
  providers: [NetworkService],
})
export class NetworkModule {}
