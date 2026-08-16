import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard, RequireRole } from '../../rbac/roles.guard';
import { PeopleService } from './people.service';
import { CreatePersonDto } from './dto/people.dto';
import type { Person } from '../entities/person.entity';

/** Osoby (Party) – lidé bez nutnosti účtu (dokument §12). */
@Controller('people')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PeopleController {
  constructor(private readonly people: PeopleService) {}

  @Get()
  list(): Promise<Person[]> {
    return this.people.list();
  }

  @Post()
  @RequireRole('EDITOR')
  create(@Body() dto: CreatePersonDto): Promise<Person> {
    return this.people.create(dto);
  }
}
