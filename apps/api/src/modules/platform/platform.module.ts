import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../core/auth/entities/user.entity';
import { PlatformService } from './platform.service';
import { PlatformController } from './platform.controller';
import { PlatformAdminGuard } from './platform-admin.guard';

/**
 * Platform-admin vrstva (ADR-0009): zakládání a přehled všech firem. Odděleno od
 * tenant-scoped /admin. AuthService/JwtModule jsou globální (AuthModule).
 */
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [PlatformController],
  providers: [PlatformService, PlatformAdminGuard],
})
export class PlatformModule {}
