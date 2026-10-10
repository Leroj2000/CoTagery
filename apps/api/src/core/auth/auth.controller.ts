import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  NotFoundException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
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
import {
  AcceptInviteDto,
  ConfirmAccountActionDto,
  RegisterOrganizationDto,
} from './dto/onboarding.dto';
import { RateLimitService } from '../resolver/rate-limit.service';
import { AuthzService } from '../rbac/authz.service';

interface RequestAddress {
  ip?: string;
  socket?: { remoteAddress?: string };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly rateLimit: RateLimitService,
    private readonly authz: AuthzService,
  ) {}

  private clientIp(request: RequestAddress): string {
    return request.ip ?? request.socket?.remoteAddress ?? 'unknown';
  }

  private identity(value: string): string {
    return createHash('sha256').update(value.trim().toLowerCase()).digest('hex').slice(0, 24);
  }

  private async assertRateLimit(key: string, limit: number, seconds: number): Promise<void> {
    if (!(await this.rateLimit.allow(`auth:${key}`, limit, seconds))) {
      throw new HttpException(
        'Příliš mnoho pokusů. Zkuste to později.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Req() request: RequestAddress): Promise<TokenPair> {
    const ip = this.clientIp(request);
    await Promise.all([
      this.assertRateLimit(`login:ip:${ip}`, 30, 15 * 60),
      this.assertRateLimit(`login:identity:${this.identity(dto.email)}`, 10, 15 * 60),
    ]);
    return this.auth.login(dto.email, dto.password);
  }

  @Post('register')
  @HttpCode(201)
  async register(
    @Body() dto: RegisterOrganizationDto,
    @Req() request: RequestAddress,
  ): Promise<{ ok: true }> {
    await this.assertRateLimit(`register:ip:${this.clientIp(request)}`, 5, 60 * 60);
    await this.auth.registerOrganization(dto);
    return { ok: true };
  }

  @Post('verify-email')
  async verifyEmail(
    @Body() dto: ConfirmAccountActionDto,
    @Req() request: RequestAddress,
  ): Promise<{ ok: true }> {
    await this.assertRateLimit(`verify:ip:${this.clientIp(request)}`, 20, 60 * 60);
    await this.auth.confirmEmail(dto.token);
    return { ok: true };
  }

  @Post('accept-invite')
  async acceptInvite(
    @Body() dto: AcceptInviteDto,
    @Req() request: RequestAddress,
  ): Promise<{ ok: true }> {
    await this.assertRateLimit(`invite:ip:${this.clientIp(request)}`, 20, 60 * 60);
    await this.auth.acceptInvitation(dto.token, dto.password);
    return { ok: true };
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
  async requestReset(
    @Body() dto: RequestResetDto,
    @Req() request: RequestAddress,
  ): Promise<{ ok: true }> {
    const ip = this.clientIp(request);
    await Promise.all([
      this.assertRateLimit(`reset:ip:${ip}`, 10, 60 * 60),
      this.assertRateLimit(`reset:identity:${this.identity(dto.email)}`, 5, 60 * 60),
    ]);
    await this.auth.requestPasswordReset(dto.email);
    return { ok: true };
  }

  /** Nastaví nové heslo dle jednorázového tokenu z odkazu. */
  @Post('password-reset/confirm')
  @HttpCode(200)
  async confirmReset(
    @Body() dto: ConfirmResetDto,
    @Req() request: RequestAddress,
  ): Promise<{ ok: true }> {
    await this.assertRateLimit(`reset-confirm:ip:${this.clientIp(request)}`, 20, 60 * 60);
    await this.auth.confirmPasswordReset(dto.token, dto.newPassword);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() current: RequestUser): Promise<{
    user: { id: string; email: string; name: string };
    tenantId: string;
    tenantRole: string;
    roleName: string;
    isPlatformAdmin: boolean;
  }> {
    const user = await this.users.findOne({ where: { id: current.userId } });
    if (!user) throw new NotFoundException('Uživatel neexistuje');
    // Aktuální role z členství (token může nést roli starou až 15 min).
    const role = await this.authz.roleInfo(current);
    return {
      user: { id: user.id, email: user.email, name: user.name },
      tenantId: current.tenantId,
      tenantRole: role.key,
      roleName: role.name,
      isPlatformAdmin: user.isPlatformAdmin,
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
  switchOrg(@CurrentUser() current: RequestUser, @Body() dto: SwitchOrgDto): Promise<TokenPair> {
    return this.auth.switchOrg(current.userId, dto.organizationId);
  }
}
