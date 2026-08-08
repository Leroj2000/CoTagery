import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantContextService } from '../../core/tenancy/tenant-context.service';
import { DigitalObject } from '../../core/domain/entities/digital-object.entity';
import { Product } from './product.entity';
import type { CreateProductDto } from './dto/create-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly context: TenantContextService) {}

  private repo(): Repository<Product> {
    return this.context.manager.getRepository(Product);
  }

  async create(dto: CreateProductDto): Promise<Product> {
    const object = await this.context.manager
      .getRepository(DigitalObject)
      .findOne({ where: { id: dto.digitalObjectId } });
    if (!object) throw new NotFoundException('DigitalObject neexistuje');

    const product = this.repo().create({
      tenantId: this.context.tenantId,
      digitalObjectId: dto.digitalObjectId,
      name: dto.name,
      gtin: dto.gtin ?? null,
      brand: dto.brand ?? null,
      description: dto.description ?? null,
      ingredients: dto.ingredients ?? null,
      origin: dto.origin ?? null,
      careInstructions: dto.careInstructions ?? null,
    });
    return this.repo().save(product);
  }

  getByObject(objectId: string): Promise<Product | null> {
    return this.repo().findOne({ where: { digitalObjectId: objectId } });
  }
}
