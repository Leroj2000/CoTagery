import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ObjectPermission } from './entities/object-permission.entity';
import { Permission } from './entities/permission.entity';
import { Role } from './entities/role.entity';
import { RolePermission } from './entities/role-permission.entity';
import { AclService } from './acl.service';
import { AuthzService } from './authz.service';
import { RbacController } from './rbac.controller';
import { AuthzController } from './authz.controller';
import { RolesGuard } from './roles.guard';
import { PermissionsGuard } from './permissions.guard';

/** EPIC-06 RBAC-ACL + EPIC-18 permission katalog + centrální authorize(). */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ObjectPermission, Permission, Role, RolePermission])],
  controllers: [RbacController, AuthzController],
  providers: [AclService, AuthzService, RolesGuard, PermissionsGuard],
  exports: [AclService, AuthzService, RolesGuard, PermissionsGuard],
})
export class RbacModule {}
