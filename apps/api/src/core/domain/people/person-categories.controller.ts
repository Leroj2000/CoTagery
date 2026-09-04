import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { RequirePermission } from '../../rbac/require-permission.decorator';
import { PersonCategoriesService } from './person-categories.service';
import { CreatePersonCategoryDto } from './dto/person-category.dto';
import type { PersonCategory } from '../entities/person-category.entity';

/** Číselník kategorií osob – správa v podsekci „Lidé" (jen core.person.manage). */
@Controller('person-categories')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PersonCategoriesController {
  constructor(private readonly categories: PersonCategoriesService) {}

  @Get()
  list(): Promise<PersonCategory[]> {
    return this.categories.list();
  }

  @Post()
  @RequirePermission('core.person.manage')
  create(@Body() dto: CreatePersonCategoryDto): Promise<PersonCategory> {
    return this.categories.create(dto);
  }

  @Delete(':id')
  @RequirePermission('core.person.manage')
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.categories.remove(id);
  }
}
