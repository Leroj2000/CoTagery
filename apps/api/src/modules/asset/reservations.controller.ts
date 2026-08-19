import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/rbac/permissions.guard';
import { RequirePermission } from '../../core/rbac/require-permission.decorator';
import { AssetService } from './asset.service';
import { CreateReservationDto } from './dto/asset.dto';
import type { Reservation } from './entities/reservation.entity';

/** Rezervace / požadavky na věci (§15). */
@Controller('reservations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReservationsController {
  constructor(private readonly assets: AssetService) {}

  @Get()
  @RequirePermission('asset.reservation.view')
  list(): Promise<Reservation[]> {
    return this.assets.listReservations();
  }

  @Post()
  @RequirePermission('asset.reservation.view')
  create(@Body() dto: CreateReservationDto): Promise<Reservation> {
    return this.assets.createReservation(dto);
  }

  @Post(':id/approve')
  @RequirePermission('asset.reservation.approve')
  approve(@Param('id', ParseUUIDPipe) id: string): Promise<Reservation> {
    return this.assets.setReservationStatus(id, 'approved');
  }

  @Post(':id/reject')
  @RequirePermission('asset.reservation.approve')
  reject(@Param('id', ParseUUIDPipe) id: string): Promise<Reservation> {
    return this.assets.setReservationStatus(id, 'rejected');
  }

  @Post(':id/cancel')
  @RequirePermission('asset.reservation.view')
  cancel(@Param('id', ParseUUIDPipe) id: string): Promise<Reservation> {
    return this.assets.setReservationStatus(id, 'cancelled');
  }
}
