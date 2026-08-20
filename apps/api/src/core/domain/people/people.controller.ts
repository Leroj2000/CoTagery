import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { RequirePermission } from '../../rbac/require-permission.decorator';
import { PeopleService } from './people.service';
import { CreatePersonDto, UpdatePersonDto } from './dto/people.dto';
import type { Person } from '../entities/person.entity';

/** Osoby (Party) – lidé bez nutnosti účtu (dokument §12). */
@Controller('people')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PeopleController {
  constructor(private readonly people: PeopleService) {}

  @Get()
  list(): Promise<Person[]> {
    return this.people.list();
  }

  @Post()
  @RequirePermission('core.person.manage')
  create(@Body() dto: CreatePersonDto): Promise<Person> {
    return this.people.create(dto);
  }

  @Patch(':id')
  @RequirePermission('core.person.manage')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePersonDto): Promise<Person> {
    return this.people.update(id, dto);
  }
}
