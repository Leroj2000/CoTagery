import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/rbac/permissions.guard';
import { RequirePermission } from '../../core/rbac/require-permission.decorator';
import { RentalOrderService, type OwnerOrderView } from './rental-order.service';

/** Majitel: příchozí objednávky půjčovny jeho firmy (EPIC-19 F2). */
@Controller('rental-orders')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RentalOrderController {
  constructor(private readonly orders: RentalOrderService) {}

  @Get()
  @RequirePermission('rental.item.manage')
  list(): Promise<OwnerOrderView[]> {
    return this.orders.listForOwner();
  }
}
