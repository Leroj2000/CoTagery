import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { Person } from '../entities/person.entity';
import type { CreatePersonDto, UpdatePersonDto } from './dto/people.dto';

/** Osoby (Party) tenantu – oddělené od uživatelských účtů. Tenant-scoped (RLS). */
@Injectable()
export class PeopleService {
  constructor(private readonly context: TenantContextService) {}

  private repo(): Repository<Person> {
    return this.context.manager.getRepository(Person);
  }

  list(): Promise<Person[]> {
    return this.repo().find({ order: { createdAt: 'DESC' }, take: 500 });
  }

  create(dto: CreatePersonDto): Promise<Person> {
    return this.repo().save(
      this.repo().create({
        tenantId: this.context.tenantId,
        name: dto.name,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        company: dto.company ?? null,
        userId: null,
      }),
    );
  }

  async get(id: string): Promise<Person> {
    const person = await this.repo().findOne({ where: { id } });
    if (!person) throw new NotFoundException('Osoba neexistuje');
    return person;
  }

  async update(id: string, dto: UpdatePersonDto): Promise<Person> {
    const person = await this.get(id);
    if (dto.name !== undefined) person.name = dto.name;
    if (dto.email !== undefined) person.email = dto.email || null;
    if (dto.phone !== undefined) person.phone = dto.phone || null;
    if (dto.company !== undefined) person.company = dto.company || null;
    return this.repo().save(person);
  }
}
