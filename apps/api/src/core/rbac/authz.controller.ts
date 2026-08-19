import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard, type RequestUser } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators';
import { AuthzService, type AuthzDecision } from './authz.service';

class CheckPermissionDto {
  @IsString()
  @MaxLength(128)
  permission!: string;
}

/** Introspekce autorizace (EPIC-18 1.3): moje permissions + test rozhodnutí. */
@Controller('authz')
@UseGuards(JwtAuthGuard)
export class AuthzController {
  constructor(private readonly authz: AuthzService) {}

  /** Efektivní permissions přihlášené identity v aktivní organizaci (pro UI). */
  @Get('my-permissions')
  myPermissions(@CurrentUser() user: RequestUser): Promise<string[]> {
    return this.authz.listPermissions(user);
  }

  /** Test rozhodnutí pro konkrétní permission (allow/deny + reasonCode). */
  @Post('check')
  check(
    @CurrentUser() user: RequestUser,
    @Body() dto: CheckPermissionDto,
  ): Promise<AuthzDecision> {
    return this.authz.can(user, dto.permission);
  }
}
