import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { RentalOrderService, type RenterOrderView } from './rental-order.service';
import { CreateOrderDto } from './dto/order.dto';
import { CurrentRenter, RenterJwtGuard, type RequestRenter } from './renter-jwt.guard';
import type { Quote } from './order-pricing';

/** Objednávky nájemce (EPIC-19 F2). Vyžaduje renter token (rozh. C). */
@Controller('renter/orders')
@UseGuards(RenterJwtGuard)
export class RenterOrderController {
  constructor(private readonly orders: RentalOrderService) {}

  @Get()
  myOrders(@CurrentRenter() renter: RequestRenter): Promise<RenterOrderView[]> {
    return this.orders.myOrders(renter.userId);
  }

  @Post()
  create(
    @CurrentRenter() renter: RequestRenter,
    @Body() dto: CreateOrderDto,
  ): Promise<{ orderId: string; quote: Quote }> {
    return this.orders.createOrder(renter, dto);
  }
}
