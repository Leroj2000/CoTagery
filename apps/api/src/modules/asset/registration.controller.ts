import {
  Body,
  Controller,
  Post,
  UseGuards,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { createHash } from 'node:crypto';
import { JwtAuthGuard, type RequestUser } from '../../core/auth/jwt-auth.guard';
import { CurrentUser } from '../../core/auth/decorators';
import { PermissionsGuard } from '../../core/rbac/permissions.guard';
import { RequirePermission } from '../../core/rbac/require-permission.decorator';
import { AuthzService } from '../../core/rbac/authz.service';
import { TenantContextService } from '../../core/tenancy/tenant-context.service';
import { DigitalObject } from '../../core/domain/entities/digital-object.entity';
import { Location } from '../../core/domain/entities/location.entity';
import { DataCarriersService } from '../../core/domain/carriers/data-carriers.service';
import { AssetService } from './asset.service';
import { CreateAssetDto } from './dto/asset.dto';

export class RegisterAssetDto extends CreateAssetDto {
  @IsUUID() requestId!: string;
  @IsIn(['generate', 'adopt', 'claim', 'none']) identifierMode!:
    'generate' | 'adopt' | 'claim' | 'none';
  @IsOptional() @IsIn(['qr', 'nfc', 'hybrid']) carrierType?: 'qr' | 'nfc' | 'hybrid';
  @IsOptional() @IsString() @MaxLength(2048) code?: string;
}

/** One transaction for the item, identifier and home. Retry never creates a second item. */
@Controller('asset-registration')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RegistrationController {
  constructor(
    private readonly assets: AssetService,
    private readonly context: TenantContextService,
    private readonly carriers: DataCarriersService,
    private readonly authz: AuthzService,
  ) {}

  @Post()
  @RequirePermission('asset.item.create')
  async register(@Body() dto: RegisterAssetDto, @CurrentUser() user: RequestUser) {
    if (dto.identifierMode !== 'none') await this.authz.assert(user, 'carrier.item.manage');
    if (!dto.name.trim()) throw new BadRequestException('Vyplň název položky.');
    const manager = this.context.manager;
    const digest = createHash('sha256')
      .update(JSON.stringify(Object.entries(dto).sort(([a], [b]) => a.localeCompare(b))))
      .digest('hex');
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `register:${this.context.tenantId}:${dto.requestId}`,
    ]);
    const previous: { id: string; metadata: Record<string, string> }[] = await manager.query(
      `SELECT id, metadata FROM digital_objects WHERE metadata->>'registrationId' = $1`,
      [dto.requestId],
    );
    if (previous.length) {
      if (
        previous[0].metadata.registrationActor !== user.userId ||
        previous[0].metadata.registrationDigest !== digest
      )
        throw new ConflictException(
          'Tento pokus už byl uložen s jinými údaji. Otevři seznam položek.',
        );
      const asset = await this.assets.getByObject(previous[0].id);
      if (!asset) throw new ConflictException('Uložená položka již není dostupná.');
      return { asset, carriers: await this.carriers.listForObject(asset.digitalObjectId) };
    }
    const scope = this.context.scope;
    if (dto.homeLocationId) {
      const place = await manager.getRepository(Location).findOneBy({ id: dto.homeLocationId });
      if (!place) throw new BadRequestException('Vybrané místo není dostupné.');
    }
    if (scope.type !== 'ORGANIZATION') {
      if (scope.type !== 'LOCATION_TREE' || !scope.ref || !dto.homeLocationId)
        throw new BadRequestException('Vyber místo ve svěřené části firmy.');
      const allowed: { id: string }[] = await manager.query(
        `WITH RECURSIVE sub AS (
        SELECT id FROM locations WHERE id=$1 UNION SELECT l.id FROM locations l JOIN sub ON l.parent_id=sub.id
      ) SELECT id FROM sub WHERE id=$2`,
        [scope.ref, dto.homeLocationId],
      );
      if (!allowed.length) throw new BadRequestException('Místo je mimo tvůj přístup.');
    }
    const { requestId, identifierMode, carrierType, code, ...data } = dto;
    const asset = await this.assets.create({ ...data, name: data.name.trim() });
    if (identifierMode === 'generate')
      await this.carriers.createForObject(asset.digitalObjectId, { carrierType });
    if (identifierMode === 'adopt' || identifierMode === 'claim') {
      if (!code?.trim()) throw new BadRequestException('Načti nebo vyplň identifikátor.');
      if (identifierMode === 'adopt')
        await this.carriers.adoptExternal(asset.digitalObjectId, {
          externalCode: code.trim(),
          carrierType,
        });
      else {
        const carrier = await this.carriers.findByCode(code.trim());
        if (!carrier || carrier.digitalObjectId)
          throw new BadRequestException('Kód není volný štítek této firmy.');
        await this.carriers.claim(carrier.publicCode, asset.digitalObjectId);
      }
    }
    await manager.getRepository(DigitalObject).update(asset.digitalObjectId, {
      metadata: {
        registrationId: requestId,
        registrationActor: user.userId,
        registrationDigest: digest,
      },
    });
    return { asset, carriers: await this.carriers.listForObject(asset.digitalObjectId) };
  }
}
