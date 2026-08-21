import { Body, Controller, Get, HttpCode, NotFoundException, Post, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService, type MembershipView, type TokenPair } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { SwitchOrgDto } from './dto/switch-org.dto';
import { ConfirmResetDto, RequestResetDto } from './dto/password-reset.dto';
import { JwtAuthGuard, type RequestUser } from './jwt-auth.guard';
import { CurrentUser } from './decorators';
import { User } from './entities/user.entity';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  @Post('login')
  login(@Body() dto: LoginDto): Promise<TokenPair> {
    return this.auth.login(dto.email, dto.password);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto): Promise<TokenPair> {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.auth.logout(dto.refreshToken);
  }

  /** Zapomenuté heslo: pošle odkaz (vždy 200, nezveřejňuje existenci účtu). */
  @Post('password-reset/request')
  @HttpCode(200)
  async requestReset(@Body() dto: RequestResetDto): Promise<{ ok: true }> {
    await this.auth.requestPasswordReset(dto.email);
    return { ok: true };
  }

  /** Nastaví nové heslo dle jednorázového tokenu z odkazu. */
  @Post('password-reset/confirm')
  @HttpCode(200)
  async confirmReset(@Body() dto: ConfirmResetDto): Promise<{ ok: true }> {
    await this.auth.confirmPasswordReset(dto.token, dto.newPassword);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() current: RequestUser): Promise<{
    user: { id: string; email: string; name: string };
    tenantId: string;
    tenantRole: string;
  }> {
    const user = await this.users.findOne({ where: { id: current.userId } });
    if (!user) throw new NotFoundException('Uživatel neexistuje');
    return {
      user: { id: user.id, email: user.email, name: user.name },
      tenantId: current.tenantId,
      tenantRole: current.tenantRole,
    };
  }

  /** Přehled všech organizací, kde je identita registrovaná (Fáze 0.2). */
  @Get('memberships')
  @UseGuards(JwtAuthGuard)
  memberships(@CurrentUser() current: RequestUser): Promise<MembershipView[]> {
    return this.auth.listMemberships(current.userId);
  }

  /** Přepnutí aktivní organizace – vydá nové tokeny pro zvolené členství. */
  @Post('switch-org')
  @UseGuards(JwtAuthGuard)
  switchOrg(
    @CurrentUser() current: RequestUser,
    @Body() dto: SwitchOrgDto,
  ): Promise<TokenPair> {
    return this.auth.switchOrg(current.userId, dto.organizationId);
  }
}
