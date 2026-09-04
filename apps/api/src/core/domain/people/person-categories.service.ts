import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { PersonCategory } from '../entities/person-category.entity';
import type { CreatePersonCategoryDto } from './dto/person-category.dto';

/** Číselník kategorií osob (tenant-scoped přes RLS). */
@Injectable()
export class PersonCategoriesService {
  constructor(private readonly context: TenantContextService) {}

  private repo(): Repository<PersonCategory> {
    return this.context.manager.getRepository(PersonCategory);
  }

  list(): Promise<PersonCategory[]> {
    return this.repo().find({ order: { name: 'ASC' } });
  }

  create(dto: CreatePersonCategoryDto): Promise<PersonCategory> {
    const repo = this.repo();
    return repo.save(
      repo.create({
        tenantId: this.context.tenantId,
        name: dto.name.trim(),
        color: dto.color ?? null,
      }),
    );
  }

  async remove(id: string): Promise<void> {
    const cat = await this.repo().findOne({ where: { id } });
    if (!cat) throw new NotFoundException('Kategorie neexistuje');
    // FK ON DELETE SET NULL → zařazení osob/uživatelů se uvolní.
    await this.repo().delete({ id });
  }
}
