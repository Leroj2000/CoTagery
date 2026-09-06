import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  RentalOrderService,
  type RenterOrderView,
  type RenterPaymentView,
} from './rental-order.service';
import { CreateOrderDto, RenterIssueDto } from './dto/order.dto';
import { CurrentRenter, RenterJwtGuard, type RequestRenter } from './renter-jwt.guard';
import type { Quote } from './order-pricing';
import { RateLimitService } from '../../core/resolver/rate-limit.service';

/** Objednávky nájemce (EPIC-19 F2/F3). Vyžaduje renter token (rozh. C). */
@Controller('renter/orders')
@UseGuards(RenterJwtGuard)
export class RenterOrderController {
  constructor(
    private readonly orders: RentalOrderService,
    private readonly rateLimit: RateLimitService,
  ) {}

  private async limit(key: string, count: number, seconds: number): Promise<void> {
    if (!(await this.rateLimit.allow(`renter:${key}`, count, seconds))) {
      throw new HttpException(
        'Příliš mnoho požadavků. Zkuste to později.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  @Get()
  myOrders(@CurrentRenter() renter: RequestRenter): Promise<RenterOrderView[]> {
    return this.orders.myOrders(renter.userId);
  }

  @Post()
  async create(
    @CurrentRenter() renter: RequestRenter,
    @Body() dto: CreateOrderDto,
  ): Promise<{ orderId: string; quote: Quote }> {
    await this.limit(`orders:${renter.userId}`, 20, 60 * 60);
    return this.orders.createOrder(renter, dto);
  }

  @Get(':id/payment')
  payment(
    @CurrentRenter() renter: RequestRenter,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RenterPaymentView> {
    return this.orders.renterPayment(id, renter.userId);
  }

  @Get(':id/payment/qr.png')
  async paymentQr(
    @CurrentRenter() renter: RequestRenter,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StreamableFile> {
    const png = await this.orders.renterPaymentQr(id, renter.userId);
    return new StreamableFile(png, { type: 'image/png' });
  }

  @Post(':id/issue')
  async reportIssue(
    @CurrentRenter() renter: RequestRenter,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenterIssueDto,
  ): Promise<{ issueId: string }> {
    await this.limit(`issues:${renter.userId}`, 20, 60 * 60);
    return this.orders.createRenterIssue(renter.userId, id, dto.kind, dto.description);
  }
}
