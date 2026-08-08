import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DomainModule } from '../../core/domain/domain.module';
import { Product } from './product.entity';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ProductHandler } from './product.handler';

/** EPIC-08 Product modul – první modul registrující handleScan. */
@Module({
  imports: [TypeOrmModule.forFeature([Product]), DomainModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductHandler],
})
export class ProductModule {}
