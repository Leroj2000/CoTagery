import { Injectable } from '@nestjs/common';
import { In, Repository } from 'typeorm';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { CategoryLink, type CategorySubject } from '../entities/category-link.entity';

/** Správa many-to-many zařazení subjektů (osoba/uživatel) do kategorií. */
@Injectable()
export class CategoryLinksService {
  constructor(private readonly context: TenantContextService) {}

  private repo(): Repository<CategoryLink> {
    return this.context.manager.getRepository(CategoryLink);
  }

  /** Mapa subjectId → categoryIds[] pro danou sadu subjektů. */
  async mapFor(subjectType: CategorySubject, subjectIds: string[]): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    if (subjectIds.length === 0) return map;
    const links = await this.repo().find({
      where: { subjectType, subjectId: In(subjectIds) },
    });
    for (const l of links) {
      const arr = map.get(l.subjectId) ?? [];
      arr.push(l.categoryId);
      map.set(l.subjectId, arr);
    }
    return map;
  }

  /** Nahradí kompletní sadu kategorií subjektu (idempotentní sync). */
  async set(subjectType: CategorySubject, subjectId: string, categoryIds: string[]): Promise<void> {
    const repo = this.repo();
    const want = [...new Set(categoryIds)];
    const existing = await repo.find({ where: { subjectType, subjectId } });
    const have = new Set(existing.map((l) => l.categoryId));
    const toAdd = want.filter((c) => !have.has(c));
    const toRemove = existing.filter((l) => !want.includes(l.categoryId));
    if (toRemove.length > 0) await repo.remove(toRemove);
    if (toAdd.length > 0) {
      await repo.save(
        toAdd.map((categoryId) =>
          repo.create({ tenantId: this.context.tenantId, categoryId, subjectType, subjectId }),
        ),
      );
    }
  }
}
