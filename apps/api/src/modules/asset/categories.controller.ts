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
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/asset.dto';
import type { Category } from './entities/category.entity';

/** Číselník kategorií věcí. */
@Controller('categories')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @RequirePermission('asset.item.view')
  list(): Promise<Category[]> {
    return this.categories.list();
  }

  @Post()
  @RequirePermission('asset.category.manage')
  create(@Body() dto: CreateCategoryDto): Promise<Category> {
    return this.categories.create(dto);
  }

  @Patch(':id')
  @RequirePermission('asset.category.manage')
  rename(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCategoryDto): Promise<Category> {
    return this.categories.rename(id, dto);
  }

  @Delete(':id')
  @RequirePermission('asset.category.manage')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.categories.remove(id);
  }
}
