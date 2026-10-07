import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { RequirePermission } from '../../rbac/require-permission.decorator';
import { PeopleService, type PersonView } from './people.service';
import { CreatePersonDto, SetCategoriesDto, UpdatePersonDto } from './dto/people.dto';
import type { Person } from '../entities/person.entity';

interface UploadedFileLike {
  buffer: Buffer;
  mimetype: string;
}

/** Profilová fotka osoby: jen obrázky, max 8 MB (upload limit + MIME allowlist). */
const MAX_AVATAR_BYTES = 8 * 1024 * 1024;

function imageOnlyFilter(
  _req: unknown,
  file: { mimetype: string },
  callback: (error: Error | null, acceptFile: boolean) => void,
): void {
  if (!file.mimetype.startsWith('image/')) {
    callback(new BadRequestException('Nepodporovaný typ souboru (povoleny jen obrázky)'), false);
    return;
  }
  callback(null, true);
}

/** Osoby (Party) – lidé bez nutnosti účtu (dokument §12). */
@Controller('people')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PeopleController {
  constructor(private readonly people: PeopleService) {}

  @Get()
  @RequirePermission('core.person.view')
  list(): Promise<PersonView[]> {
    return this.people.list();
  }

  @Post()
  @RequirePermission('core.person.manage')
  create(@Body() dto: CreatePersonDto): Promise<Person> {
    return this.people.create(dto);
  }

  @Patch(':id')
  @RequirePermission('core.person.manage')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePersonDto): Promise<Person> {
    return this.people.update(id, dto);
  }

  /** Nahradí kategorie osoby (many-to-many). */
  @Patch(':id/categories')
  @RequirePermission('core.person.manage')
  async setCategories(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetCategoriesDto,
  ): Promise<{ ok: true }> {
    await this.people.setCategories(id, dto.categoryIds);
    return { ok: true };
  }

  // --- Profilová fotka (avatar) ---

  /** Nahraje/nahradí profilovou fotku osoby (multipart, pole „file"). */
  @Post(':id/photo')
  @RequirePermission('core.person.manage')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_AVATAR_BYTES },
      fileFilter: imageOnlyFilter,
    }),
  )
  async setPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: UploadedFileLike,
  ): Promise<Person> {
    if (!file) throw new BadRequestException('Chybí soubor (pole "file")');
    return this.people.setPhoto(id, file.buffer, file.mimetype);
  }

  /** Vrátí soubor profilové fotky osoby (tenant-scoped přes RLS). */
  @Get(':id/photo')
  @RequirePermission('core.person.view')
  async photo(@Param('id', ParseUUIDPipe) id: string): Promise<StreamableFile> {
    const { buffer, mime } = await this.people.getPhotoFile(id);
    return new StreamableFile(buffer, { type: mime });
  }

  /** Smaže profilovou fotku osoby (soubor + photo_file_key = NULL). */
  @Delete(':id/photo')
  @RequirePermission('core.person.manage')
  deletePhoto(@Param('id', ParseUUIDPipe) id: string): Promise<Person> {
    return this.people.deletePhoto(id);
  }
}
