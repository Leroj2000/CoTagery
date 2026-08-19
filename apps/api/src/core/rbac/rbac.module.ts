import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ObjectPermission } from './entities/object-permission.entity';
import { Permission } from './entities/permission.entity';
import { Role } from './entities/role.entity';
import { RolePermission } from './entities/role-permission.entity';
import { AclService } from './acl.service';
import { RbacController } from './rbac.controller';
import { RolesGuard } from './roles.guard';

/** EPIC-06 RBAC-ACL + EPIC-18 permission katalog (roles/permissions jako data). */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ObjectPermission, Permission, Role, RolePermission])],
  controllers: [RbacController],
  providers: [AclService, RolesGuard],
  exports: [AclService, RolesGuard],
})
export class RbacModule {}
