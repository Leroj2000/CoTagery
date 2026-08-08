import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './entities/tenant.entity';
import { Location } from './entities/location.entity';
import { Group } from './entities/group.entity';
import { GroupMember } from './entities/group-member.entity';
import { LocationsController } from './locations/locations.controller';
import { LocationsService } from './locations/locations.service';

/** Jádro doménového modelu (EPIC-03). Locations jako první CRUD nad RLS. */
@Module({
  imports: [TypeOrmModule.forFeature([Tenant, Location, Group, GroupMember])],
  controllers: [LocationsController],
  providers: [LocationsService],
})
export class DomainModule {}
