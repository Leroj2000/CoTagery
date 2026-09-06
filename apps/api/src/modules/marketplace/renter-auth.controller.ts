import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Ip,
  Post,
  UseGuards,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { RenterAuthService, type RenterSession } from './renter-auth.service';
import { CurrentRenter, RenterJwtGuard, type RequestRenter } from './renter-jwt.guard';
import { RateLimitService } from '../../core/resolver/rate-limit.service';

class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;

  @IsString()
  @MaxLength(200)
  name!: string;
}

class RenterLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

/** Veřejná auth nájemce (EPIC-19 F2, rozh. C). Oddělené od org auth (/auth). */
@Controller('renter/auth')
export class RenterAuthController {
  constructor(
    private readonly auth: RenterAuthService,
    private readonly rateLimit: RateLimitService,
  ) {}

  private async limit(kind: string, ip: string, email: string, count: number): Promise<void> {
    const identity = createHash('sha256')
      .update(email.trim().toLowerCase())
      .digest('hex')
      .slice(0, 24);
    const allowed = await Promise.all([
      this.rateLimit.allow(`renter:${kind}:ip:${ip}`, count * 3, 15 * 60),
      this.rateLimit.allow(`renter:${kind}:identity:${identity}`, count, 15 * 60),
    ]);
    if (allowed.includes(false)) {
      throw new HttpException(
        'Příliš mnoho pokusů. Zkuste to později.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  @Post('register')
  async register(@Body() dto: RegisterDto, @Ip() ip: string): Promise<RenterSession> {
    await this.limit('register', ip, dto.email, 5);
    return this.auth.register(dto.email, dto.password, dto.name);
  }

  @Post('login')
  async login(@Body() dto: RenterLoginDto, @Ip() ip: string): Promise<RenterSession> {
    await this.limit('login', ip, dto.email, 10);
    return this.auth.login(dto.email, dto.password);
  }

  @Get('me')
  @UseGuards(RenterJwtGuard)
  me(@CurrentRenter() renter: RequestRenter): { id: string; email: string; name: string } {
    return { id: renter.userId, email: renter.email, name: renter.name };
  }
}
