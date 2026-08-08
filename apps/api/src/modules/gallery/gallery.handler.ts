import { Injectable, OnModuleInit } from '@nestjs/common';
import type { ModuleType } from '@tagery/shared';
import {
  ModuleRegistry,
  type ModuleHandler,
  type ScanResponse,
} from '../../core/domain/module-handler';
import type { DigitalObject } from '../../core/domain/entities/digital-object.entity';
import { GalleryService } from './gallery.service';

/** Sken galerie → info o galerii + počet nahraných souborů (EPIC-11). */
@Injectable()
export class GalleryHandler implements ModuleHandler, OnModuleInit {
  readonly moduleType: ModuleType = 'gallery';

  constructor(
    private readonly registry: ModuleRegistry,
    private readonly gallery: GalleryService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async handleScan(object: DigitalObject): Promise<ScanResponse> {
    const gallery = await this.gallery.getByObject(object.id);
    if (!gallery) {
      return { kind: 'json', body: { type: 'gallery', gallery: null } };
    }
    const uploadCount = await this.gallery.countUploads(gallery.id);
    return {
      kind: 'json',
      body: {
        type: 'gallery',
        gallery: { id: gallery.id, name: gallery.name, isPrivate: gallery.isPrivate },
        uploadCount,
      },
    };
  }
}
