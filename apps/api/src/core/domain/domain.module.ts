import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './entities/tenant.entity';
import { Location } from './entities/location.entity';
import { Group } from './entities/group.entity';
import { GroupMember } from './entities/group-member.entity';
import { Person } from './entities/person.entity';
import { PersonCategory } from './entities/person-category.entity';
import { CategoryLink } from './entities/category-link.entity';
import { DigitalObject } from './entities/digital-object.entity';
import { DataCarrier } from './entities/data-carrier.entity';
import { ScanEvent } from './entities/scan-event.entity';
import { LocationsController } from './locations/locations.controller';
import { LocationsService } from './locations/locations.service';
import { DigitalObjectsController } from './objects/digital-objects.controller';
import { DigitalObjectsService } from './objects/digital-objects.service';
import { DataCarriersController } from './carriers/data-carriers.controller';
import { DataCarriersService } from './carriers/data-carriers.service';
import { QrService } from './carriers/qr.service';
import { UsersController } from './users/users.controller';
import { UsersService } from './users/users.service';
import { GroupsController } from './groups/groups.controller';
import { GroupsService } from './groups/groups.service';
import { TenantController } from './tenant/tenant.controller';
import { TenantService } from './tenant/tenant.service';
import { PeopleController } from './people/people.controller';
import { PeopleService } from './people/people.service';
import { PersonCategoriesController } from './people/person-categories.controller';
import { PersonCategoriesService } from './people/person-categories.service';
import { CategoryLinksService } from './people/category-links.service';
import { ModuleRegistry } from './module-handler';

/** Jádro doménového modelu (EPIC-03, EPIC-04). */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tenant,
      Location,
      Group,
      GroupMember,
      Person,
      PersonCategory,
      CategoryLink,
      DigitalObject,
      DataCarrier,
      ScanEvent,
    ]),
  ],
  controllers: [
    LocationsController,
    DigitalObjectsController,
    DataCarriersController,
    UsersController,
    GroupsController,
    TenantController,
    PeopleController,
    PersonCategoriesController,
  ],
  providers: [
    LocationsService,
    DigitalObjectsService,
    DataCarriersService,
    QrService,
    UsersService,
    GroupsService,
    TenantService,
    PeopleService,
    PersonCategoriesService,
    CategoryLinksService,
    ModuleRegistry,
  ],
  exports: [ModuleRegistry, DataCarriersService],
})
export class DomainModule {}
