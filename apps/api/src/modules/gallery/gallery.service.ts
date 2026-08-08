import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '../../core/tenancy/tenant-context.service';
import { STORAGE, type StoragePort } from '../../core/storage/storage.port';
import { GalleryEvent } from './entities/gallery-event.entity';
import { UploadItem } from './entities/upload-item.entity';
import type { CreateGalleryDto } from './dto/create-gallery.dto';

export interface UploadedFileLike {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

@Injectable()
export class GalleryService {
  constructor(
    private readonly context: TenantContextService,
    @Inject(STORAGE) private readonly storage: StoragePort,
  ) {}

  createGallery(dto: CreateGalleryDto): Promise<GalleryEvent> {
    const repo = this.context.manager.getRepository(GalleryEvent);
    return repo.save(
      repo.create({
        tenantId: this.context.tenantId,
        digitalObjectId: dto.digitalObjectId ?? null,
        name: dto.name,
        eventDate: dto.eventDate ? new Date(dto.eventDate) : null,
        deleteAfterDays: dto.deleteAfterDays ?? null,
        isPrivate: dto.isPrivate ?? false,
      }),
    );
  }

  async get(id: string): Promise<GalleryEvent> {
    const gallery = await this.context.manager
      .getRepository(GalleryEvent)
      .findOne({ where: { id } });
    if (!gallery) throw new NotFoundException('Galerie neexistuje');
    return gallery;
  }

  getByObject(objectId: string): Promise<GalleryEvent | null> {
    return this.context.manager
      .getRepository(GalleryEvent)
      .findOne({ where: { digitalObjectId: objectId } });
  }

  listUploads(galleryId: string): Promise<UploadItem[]> {
    return this.context.manager
      .getRepository(UploadItem)
      .find({ where: { galleryEventId: galleryId }, order: { createdAt: 'ASC' } });
  }

  countUploads(galleryId: string): Promise<number> {
    return this.context.manager
      .getRepository(UploadItem)
      .count({ where: { galleryEventId: galleryId } });
  }

  async addUpload(galleryId: string, file: UploadedFileLike): Promise<UploadItem> {
    await this.get(galleryId); // ověří existenci + RLS
    const safeName = basename(file.originalname).replace(/[^\w.-]/g, '_');
    const key = `gallery/${this.context.tenantId}/${galleryId}/${randomUUID()}-${safeName}`;
    await this.storage.put(key, file.buffer, file.mimetype);

    const repo = this.context.manager.getRepository(UploadItem);
    return repo.save(
      repo.create({
        tenantId: this.context.tenantId,
        galleryEventId: galleryId,
        fileKey: key,
        mimeType: file.mimetype,
        sizeBytes: file.size ?? file.buffer.length,
        status: 'pending',
      }),
    );
  }
}
