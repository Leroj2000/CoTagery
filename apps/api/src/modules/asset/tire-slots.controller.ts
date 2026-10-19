import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  TIRE_SLOT_SEASONS,
  type AssetTireBookingView,
  type TireBookingView,
  type TireSlotSeason,
  type TireSlotView,
} from '@tagery/shared';
import { CurrentUser } from '../../core/auth/decorators';
import { JwtAuthGuard, type RequestUser } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/rbac/permissions.guard';
import { RequireModule } from '../../core/rbac/require-module.decorator';
import { RequirePermission } from '../../core/rbac/require-permission.decorator';
import { TireSlotsService } from './tire-slots.service';

/** Hromadné vypsání termínů: rozmezí [startsAt, endsAt) rozdělené po durationMin. */
export class CreateTireSlotsDto {
  @IsISO8601() startsAt!: string;
  @IsISO8601() endsAt!: string;
  @Type(() => Number) @IsInt() @Min(5) @Max(1440) durationMin!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) capacity?: number;
  @IsOptional() @IsString() @MaxLength(200) location?: string;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
  @IsOptional() @IsIn(TIRE_SLOT_SEASONS) season?: TireSlotSeason;
}

export class BookTireSlotDto {
  @IsUUID() assetId!: string;
}

export class MoveTireBookingDto {
  @IsUUID() slotId!: string;
}

/** Termíny přezutí pneumatik (vozidla). */
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequireModule('vehicles')
export class TireSlotsController {
  constructor(private readonly slots: TireSlotsService) {}

  @Get('tire-slots')
  @RequirePermission('asset.tireslot.book')
  list(
    @CurrentUser() user: RequestUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<TireSlotView[]> {
    return this.slots.list(user, from, to);
  }

  @Get('tire-slots/mine')
  @RequirePermission('asset.tireslot.book')
  mine(
    @CurrentUser() user: RequestUser,
  ): Promise<{ linked: boolean; vehicles: AssetTireBookingView[] }> {
    return this.slots.mine(user);
  }

  @Post('tire-slots')
  @RequirePermission('asset.tireslot.manage')
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateTireSlotsDto,
  ): Promise<{ created: number }> {
    return this.slots.create(user, dto);
  }

  @Delete('tire-slots/:id')
  @RequirePermission('asset.tireslot.manage')
  cancelSlot(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ cancelledBookings: number }> {
    return this.slots.cancelSlot(user, id);
  }

  @Post('tire-slots/:id/book')
  @RequirePermission('asset.tireslot.book')
  book(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BookTireSlotDto,
  ): Promise<TireBookingView> {
    return this.slots.book(user, id, dto.assetId);
  }

  @Post('tire-bookings/:id/cancel')
  @RequirePermission('asset.tireslot.book')
  cancel(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ cancelled: true }> {
    return this.slots.cancel(user, id);
  }

  @Post('tire-bookings/:id/move')
  @RequirePermission('asset.tireslot.book')
  move(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoveTireBookingDto,
  ): Promise<TireBookingView> {
    return this.slots.move(user, id, dto.slotId);
  }

  @Post('tire-bookings/:id/complete')
  @RequirePermission('asset.tireslot.manage')
  complete(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ done: true; mountedSet: string | null; serviceRecordId: string }> {
    return this.slots.complete(user, id);
  }

  @Get('assets/:id/tire-booking')
  @RequirePermission('asset.tireslot.book')
  assetBooking(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AssetTireBookingView> {
    return this.slots.assetBooking(user, id);
  }
}
