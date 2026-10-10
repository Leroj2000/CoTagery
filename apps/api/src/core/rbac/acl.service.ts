import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import type { ObjectPermissionLevel } from '@tagery/shared';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { DigitalObject } from '../domain/entities/digital-object.entity';
import { ObjectPermission } from './entities/object-permission.entity';
import { highestPermission, permissionMeets } from './permission-rank';
import type { RequestUser } from '../auth/jwt-auth.guard';
import { AuthzService } from './authz.service';

/** Úroveň administrátora – od ní výš má role implicitně přístup ke všem objektům. */
const ADMIN_RANK = 80;
import type { GrantPermissionDto } from './dto/grant-permission.dto';

@Injectable()
export class AclService {
  constructor(
    private readonly context: TenantContextService,
    private readonly authz: AuthzService,
  ) {}

  private repo(): Repository<ObjectPermission> {
    return this.context.manager.getRepository(ObjectPermission);
  }

  private async assertObject(objectId: string): Promise<void> {
    const object = await this.context.manager
      .getRepository(DigitalObject)
      .findOne({ where: { id: objectId } });
    if (!object) throw new NotFoundException('Objekt neexistuje');
  }

  list(objectId: string): Promise<ObjectPermission[]> {
    return this.repo().find({ where: { digitalObjectId: objectId } });
  }

  async grant(objectId: string, dto: GrantPermissionDto): Promise<ObjectPermission> {
    await this.assertObject(objectId);
    const existing = await this.repo().findOne({
      where: {
        digitalObjectId: objectId,
        subjectType: dto.subjectType,
        subjectId: dto.subjectId,
      },
    });
    const entity =
      existing ??
      this.repo().create({
        tenantId: this.context.tenantId,
        digitalObjectId: objectId,
        subjectType: dto.subjectType,
        subjectId: dto.subjectId,
      });
    entity.permission = dto.permission;
    entity.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    return this.repo().save(entity);
  }

  async revoke(permissionId: string): Promise<void> {
    const perm = await this.repo().findOne({ where: { id: permissionId } });
    if (!perm) throw new NotFoundException('Oprávnění neexistuje');
    await this.repo().remove(perm);
  }

  /**
   * Má uživatel na objektu alespoň `required`?
   * Vlastník/administrátor (úroveň ≥ admin, aktuální role z členství) mají
   * implicitně vše; jinak dle ObjectPermission (user + tenant-wide).
   */
  async check(
    objectId: string,
    user: RequestUser,
    required: ObjectPermissionLevel,
  ): Promise<boolean> {
    if ((await this.authz.roleInfo(user)).rank >= ADMIN_RANK) return true;

    const now = Date.now();
    const perms = await this.repo().find({ where: { digitalObjectId: objectId } });
    const applicable = perms
      .filter(
        (p) =>
          (p.subjectType === 'user' && p.subjectId === user.userId) || p.subjectType === 'tenant',
      )
      .filter((p) => !p.expiresAt || p.expiresAt.getTime() > now)
      .map((p) => p.permission);

    const best = highestPermission(applicable);
    return best !== null && permissionMeets(best, required);
  }
}
