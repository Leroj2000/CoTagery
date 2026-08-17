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
import { RolesGuard, RequireRole } from '../../core/rbac/roles.guard';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/asset.dto';
import type { Category } from './entities/category.entity';

/** Číselník kategorií věcí. */
@Controller('categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  list(): Promise<Category[]> {
    return this.categories.list();
  }

  @Post()
  @RequireRole('EDITOR')
  create(@Body() dto: CreateCategoryDto): Promise<Category> {
    return this.categories.create(dto);
  }

  @Patch(':id')
  @RequireRole('EDITOR')
  rename(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCategoryDto): Promise<Category> {
    return this.categories.rename(id, dto);
  }

  @Delete(':id')
  @RequireRole('EDITOR')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.categories.remove(id);
  }
}
