import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import { User } from './entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { OrgMembership } from './entities/membership.entity';
import { RoleAssignment } from './entities/role-assignment.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([User, RefreshToken, OrgMembership, RoleAssignment, PasswordResetToken]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard, JwtModule],
})
export class AuthModule {}
