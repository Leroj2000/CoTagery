import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ObjectPermission } from './entities/object-permission.entity';
import { AclService } from './acl.service';
import { RbacController } from './rbac.controller';

/** EPIC-06 RBAC-ACL: per-objektová oprávnění + enforcement (PRD §7). */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ObjectPermission])],
  controllers: [RbacController],
  providers: [AclService],
  exports: [AclService],
})
export class RbacModule {}
