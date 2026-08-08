import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import type { Product } from './product.entity';

@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Post()
  create(@Body() dto: CreateProductDto): Promise<Product> {
    return this.products.create(dto);
  }

  @Get('by-object/:objectId')
  getByObject(@Param('objectId', ParseUUIDPipe) objectId: string): Promise<Product | null> {
    return this.products.getByObject(objectId);
  }
}
