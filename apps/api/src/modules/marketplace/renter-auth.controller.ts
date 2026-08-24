import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { RenterAuthService, type RenterSession } from './renter-auth.service';
import { CurrentRenter, RenterJwtGuard, type RequestRenter } from './renter-jwt.guard';

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
  constructor(private readonly auth: RenterAuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto): Promise<RenterSession> {
    return this.auth.register(dto.email, dto.password, dto.name);
  }

  @Post('login')
  login(@Body() dto: RenterLoginDto): Promise<RenterSession> {
    return this.auth.login(dto.email, dto.password);
  }

  @Get('me')
  @UseGuards(RenterJwtGuard)
  me(@CurrentRenter() renter: RequestRenter): { id: string; email: string; name: string } {
    return { id: renter.userId, email: renter.email, name: renter.name };
  }
}
