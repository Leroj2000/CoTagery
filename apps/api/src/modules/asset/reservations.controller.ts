import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { RolesGuard, RequireRole } from '../../core/rbac/roles.guard';
import { AssetService } from './asset.service';
import { CreateReservationDto } from './dto/asset.dto';
import type { Reservation } from './entities/reservation.entity';

/** Rezervace / požadavky na věci (§15). */
@Controller('reservations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReservationsController {
  constructor(private readonly assets: AssetService) {}

  @Get()
  list(): Promise<Reservation[]> {
    return this.assets.listReservations();
  }

  @Post()
  @RequireRole('EDITOR')
  create(@Body() dto: CreateReservationDto): Promise<Reservation> {
    return this.assets.createReservation(dto);
  }

  @Post(':id/approve')
  @RequireRole('MANAGER')
  approve(@Param('id', ParseUUIDPipe) id: string): Promise<Reservation> {
    return this.assets.setReservationStatus(id, 'approved');
  }

  @Post(':id/reject')
  @RequireRole('MANAGER')
  reject(@Param('id', ParseUUIDPipe) id: string): Promise<Reservation> {
    return this.assets.setReservationStatus(id, 'rejected');
  }

  @Post(':id/cancel')
  @RequireRole('EDITOR')
  cancel(@Param('id', ParseUUIDPipe) id: string): Promise<Reservation> {
    return this.assets.setReservationStatus(id, 'cancelled');
  }
}
