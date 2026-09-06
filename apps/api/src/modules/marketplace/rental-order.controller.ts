import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/rbac/permissions.guard';
import { RequirePermission } from '../../core/rbac/require-permission.decorator';
import { RequireModule } from '../../core/rbac/require-module.decorator';
import { RentalOrderService, type OwnerOrderView } from './rental-order.service';
import { OwnerActionDto } from './dto/order.dto';
import type { RentalOrder } from './entities/rental-order.entity';

/** Majitel: příchozí objednávky + lifecycle (EPIC-19 F2/F3). */
@Controller('rental-orders')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequireModule('rental')
export class RentalOrderController {
  constructor(private readonly orders: RentalOrderService) {}

  @Get()
  @RequirePermission('rental.item.manage')
  list(): Promise<OwnerOrderView[]> {
    return this.orders.listForOwner();
  }

  /** Posun objednávky ve stavovém automatu (potvrdit platbu / předat / vrátit / …). */
  @Post(':id/transition')
  @RequirePermission('rental.item.manage')
  transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OwnerActionDto,
  ): Promise<RentalOrder> {
    return this.orders.ownerTransition(id, dto.action, {
      depositReturned: dto.depositReturned,
      note: dto.note,
    });
  }
}
