import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantContextService } from '../../core/tenancy/tenant-context.service';
import { Category } from './entities/category.entity';
import { Asset } from './entities/asset.entity';
import type { CreateCategoryDto, UpdateCategoryDto } from './dto/asset.dto';

/** Číselník kategorií věcí. Tenant-scoped přes RLS. */
@Injectable()
export class CategoriesService {
  constructor(private readonly context: TenantContextService) {}

  private repo(): Repository<Category> {
    return this.context.manager.getRepository(Category);
  }

  list(): Promise<Category[]> {
    return this.repo().find({ order: { name: 'ASC' } });
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    const existing = await this.repo().findOne({ where: { name: dto.name } });
    if (existing) throw new BadRequestException('Kategorie s tímto názvem už existuje');
    return this.repo().save(
      this.repo().create({
        tenantId: this.context.tenantId,
        name: dto.name,
        color: dto.color ?? null,
      }),
    );
  }

  /** Přejmenování – propíše nový název i do denormalizovaného pole na věcech. */
  async rename(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const cat = await this.get(id);
    cat.name = dto.name;
    const saved = await this.repo().save(cat);
    await this.context.manager
      .getRepository(Asset)
      .update({ categoryId: id }, { category: dto.name });
    return saved;
  }

  /** Smazání – věcem se kategorie odpojí (categoryId → null, název zůstane text). */
  async remove(id: string): Promise<void> {
    const cat = await this.get(id);
    await this.context.manager
      .getRepository(Asset)
      .update({ categoryId: id }, { categoryId: null });
    await this.repo().remove(cat);
  }

  async get(id: string): Promise<Category> {
    const cat = await this.repo().findOne({ where: { id } });
    if (!cat) throw new NotFoundException('Kategorie neexistuje');
    return cat;
  }
}
