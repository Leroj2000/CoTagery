import { Injectable, OnModuleInit } from '@nestjs/common';
import type { ModuleType } from '@tagery/shared';
import {
  ModuleRegistry,
  type ModuleHandler,
  type ScanResponse,
} from '../../core/domain/module-handler';
import type { DigitalObject } from '../../core/domain/entities/digital-object.entity';
import { ProductsService } from './products.service';

/**
 * Handler pro sken product objektu (EPIC-08). Registruje se do ModuleRegistry;
 * resolver ho volá v tenant kontextu, takže může načíst produkt přes RLS.
 */
@Injectable()
export class ProductHandler implements ModuleHandler, OnModuleInit {
  readonly moduleType: ModuleType = 'product';

  constructor(
    private readonly registry: ModuleRegistry,
    private readonly products: ProductsService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async handleScan(object: DigitalObject): Promise<ScanResponse> {
    const product = await this.products.getByObject(object.id);
    return {
      kind: 'json',
      body: {
        type: 'product',
        product: product
          ? {
              name: product.name,
              brand: product.brand,
              gtin: product.gtin,
              description: product.description,
              ingredients: product.ingredients,
              origin: product.origin,
              careInstructions: product.careInstructions,
            }
          : null,
      },
    };
  }
}
