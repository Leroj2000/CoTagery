import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/rbac/permissions.guard';
import { RequirePermission } from '../../core/rbac/require-permission.decorator';
import { RequireModule } from '../../core/rbac/require-module.decorator';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import type { Product } from './product.entity';

@Controller('products')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequireModule('product')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Post()
  @RequirePermission('product.item.manage')
  create(@Body() dto: CreateProductDto): Promise<Product> {
    return this.products.create(dto);
  }

  @Get('by-object/:objectId')
  @RequirePermission('product.item.manage')
  getByObject(@Param('objectId', ParseUUIDPipe) objectId: string): Promise<Product | null> {
    return this.products.getByObject(objectId);
  }
}
