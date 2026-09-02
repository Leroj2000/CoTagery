import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import sharp from 'sharp';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { STORAGE, type StoragePort } from '../../storage/storage.port';
import { Person } from '../entities/person.entity';
import type { CreatePersonDto, UpdatePersonDto } from './dto/people.dto';

/** Osoby (Party) tenantu – oddělené od uživatelských účtů. Tenant-scoped (RLS). */
@Injectable()
export class PeopleService {
  constructor(
    private readonly context: TenantContextService,
    @Inject(STORAGE) private readonly storage: StoragePort,
  ) {}

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
        photoFileKey: null,
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

  // --- Profilová fotka (avatar) ---

  /** Nahraje/nahradí profilovou fotku osoby (sharp: EXIF rotace, avatar JPEG). */
  async setPhoto(id: string, buffer: Buffer, mime: string): Promise<Person> {
    const person = await this.get(id);
    if (!mime.startsWith('image/')) throw new BadRequestException('Soubor není obrázek');
    const processed = await this.processPhoto(buffer);
    const key = `people/${this.context.tenantId}/${id}/${randomUUID()}.jpg`;
    await this.storage.put(key, processed, 'image/jpeg');
    const oldKey = person.photoFileKey;
    person.photoFileKey = key;
    const saved = await this.repo().save(person);
    if (oldKey) {
      await this.storage.del(oldKey).catch(() => undefined);
    }
    return saved;
  }

  /** Smaže profilovou fotku osoby (soubor z úložiště + `photo_file_key = NULL`). */
  async deletePhoto(id: string): Promise<Person> {
    const person = await this.get(id);
    const oldKey = person.photoFileKey;
    if (!oldKey) return person;
    person.photoFileKey = null;
    const saved = await this.repo().save(person);
    await this.storage.del(oldKey).catch(() => undefined);
    return saved;
  }

  /** Vrátí soubor profilové fotky osoby (respektuje tenant scope přes RLS). */
  async getPhotoFile(id: string): Promise<{ buffer: Buffer; mime: string }> {
    const person = await this.get(id);
    if (!person.photoFileKey) throw new NotFoundException('Osoba nemá fotku');
    return { buffer: await this.storage.get(person.photoFileKey), mime: 'image/jpeg' };
  }

  /** Normalizuje nahranou fotku na čtvercový avatar JPEG (max 512×512). */
  private async processPhoto(buffer: Buffer): Promise<Buffer> {
    try {
      return await sharp(buffer, { failOn: 'none' })
        .rotate() // aplikuje EXIF orientaci (jinak by fotka z mobilu byla otočená)
        .resize(512, 512, { fit: 'cover' })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer();
    } catch {
      throw new BadRequestException(
        'Obrázek se nepodařilo zpracovat (nepodporovaný formát nebo poškozený soubor).',
      );
    }
  }
}
