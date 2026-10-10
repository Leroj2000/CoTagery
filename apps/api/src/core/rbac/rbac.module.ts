import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ObjectPermission } from './entities/object-permission.entity';
import { Permission } from './entities/permission.entity';
import { Role } from './entities/role.entity';
import { RolePermission } from './entities/role-permission.entity';
import { OrganizationModule } from './entities/organization-module.entity';
import { AuditEvent } from './entities/audit-event.entity';
import { Policy } from './entities/policy.entity';
import { PolicyAssignment } from './entities/policy-assignment.entity';
import { AclService } from './acl.service';
import { AuthzService } from './authz.service';
import { ModulesService } from './modules.service';
import { AuditService } from './audit.service';
import { PolicyService } from './policy.service';
import { RbacController } from './rbac.controller';
import { AuthzController } from './authz.controller';
import { ModulesController } from './modules.controller';
import { AuditController } from './audit.controller';
import { PolicyController } from './policy.controller';
import { RolesGuard } from './roles.guard';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { PermissionsGuard } from './permissions.guard';

/** EPIC-06 RBAC-ACL + EPIC-18 permissions/authorize()/entitlementy/policy/audit. */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ObjectPermission, Permission, Role, RolePermission, OrganizationModule,
      AuditEvent, Policy, PolicyAssignment,
    ]),
  ],
  controllers: [
    RbacController,
    AuthzController,
    ModulesController,
    AuditController,
    PolicyController,
    RolesController,
  ],
  providers: [
    AclService,
    AuthzService,
    ModulesService,
    AuditService,
    PolicyService,
    RolesService,
    RolesGuard,
    PermissionsGuard,
  ],
  exports: [
    AclService,
    AuthzService,
    ModulesService,
    AuditService,
    PolicyService,
    RolesService,
    RolesGuard,
    PermissionsGuard,
  ],
})
export class RbacModule {}
