import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/rbac/permissions.guard';
import { RequirePermission } from '../../core/rbac/require-permission.decorator';
import { RentalListingService } from './rental-listing.service';
import { CreateListingDto, UpdateListingDto } from './dto/listing.dto';
import type { RentalListing } from './entities/rental-listing.entity';

/** Admin správa inzerátů půjčovny (EPIC-19 F1). Gate: rental.item.manage. */
@Controller('rental-listings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RentalListingController {
  constructor(private readonly listings: RentalListingService) {}

  @Get()
  @RequirePermission('rental.item.manage')
  list(): Promise<RentalListing[]> {
    return this.listings.list();
  }

  @Get(':id')
  @RequirePermission('rental.item.manage')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<RentalListing> {
    return this.listings.get(id);
  }

  @Post()
  @RequirePermission('rental.item.manage')
  create(@Body() dto: CreateListingDto): Promise<RentalListing> {
    return this.listings.create(dto);
  }

  @Patch(':id')
  @RequirePermission('rental.item.manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateListingDto,
  ): Promise<RentalListing> {
    return this.listings.update(id, dto);
  }

  @Post(':id/publish')
  @RequirePermission('rental.item.manage')
  publish(@Param('id', ParseUUIDPipe) id: string): Promise<RentalListing> {
    return this.listings.setPublished(id, true);
  }

  @Post(':id/unpublish')
  @RequirePermission('rental.item.manage')
  unpublish(@Param('id', ParseUUIDPipe) id: string): Promise<RentalListing> {
    return this.listings.setPublished(id, false);
  }

  @Delete(':id')
  @RequirePermission('rental.item.manage')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.listings.remove(id);
  }
}
