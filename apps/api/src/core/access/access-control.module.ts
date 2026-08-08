import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessPoint } from './entities/access-point.entity';
import { AccessEvent } from './entities/access-event.entity';
import { AccessControlService } from './access-control.service';
import { AccessPointsController } from './access-points.controller';
import { AccessRegistry } from './entitlement';

/** EPIC-15 Access-Control: sdílená schopnost řízení vstupu (ADR-0006). */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AccessPoint, AccessEvent])],
  controllers: [AccessPointsController],
  providers: [AccessControlService, AccessRegistry],
  exports: [AccessRegistry],
})
export class AccessControlModule {}
