import { createHash, randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import type { TenantRole } from '@tagery/shared';
import { User } from './entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';

export interface AccessPayload {
  sub: string;
  tenantId: string;
  tenantRole: TenantRole;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(RefreshToken) private readonly refreshTokens: Repository<RefreshToken>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, password: string): Promise<TokenPair> {
    const user = await this.users.findOne({ where: { email, status: 'active' } });
    if (!user || !(await argonVerify(user.passwordHash, password))) {
      throw new UnauthorizedException('Neplatné přihlašovací údaje');
    }
    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const payload = await this.verifyRefresh(refreshToken);
    const stored = await this.refreshTokens.findOne({ where: { jti: payload.jti } });
    if (!stored) throw new UnauthorizedException('Neznámý refresh token');

    // Reuse detekce: použití již revokovaného tokenu = možná krádež → revokuj vše.
    if (stored.revokedAt) {
      await this.revokeAllForUser(stored.userId);
      throw new UnauthorizedException('Refresh token byl již použit');
    }
    if (stored.tokenHash !== this.hashToken(refreshToken)) {
      throw new UnauthorizedException('Neplatný refresh token');
    }
    if (stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token expiroval');
    }

    const user = await this.users.findOne({ where: { id: stored.userId, status: 'active' } });
    if (!user) throw new UnauthorizedException('Uživatel neexistuje nebo je neaktivní');

    stored.revokedAt = new Date();
    await this.refreshTokens.save(stored);
    return this.issueTokens(user);
  }

  async logout(refreshToken: string): Promise<void> {
    const payload = await this.verifyRefresh(refreshToken).catch(() => null);
    if (!payload) return; // idempotentní
    await this.refreshTokens.update(
      { jti: payload.jti, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  static async hashPassword(password: string): Promise<string> {
    return argonHash(password); // @node-rs/argon2 default = Argon2id
  }

  private async issueTokens(user: User): Promise<TokenPair> {
    const accessPayload: AccessPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      tenantRole: user.tenantRole,
    };
    const accessToken = await this.jwt.signAsync(accessPayload, {
      expiresIn: (this.config.get<string>('JWT_ACCESS_TTL') ?? '15m') as JwtSignOptions['expiresIn'],
    });

    const jti = randomUUID();
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, tenantId: user.tenantId, jti },
      {
        expiresIn: (this.config.get<string>('JWT_REFRESH_TTL') ??
          '30d') as JwtSignOptions['expiresIn'],
      },
    );

    const refreshDecoded = this.jwt.decode(refreshToken) as { exp: number };
    await this.refreshTokens.save(
      this.refreshTokens.create({
        jti,
        userId: user.id,
        tenantId: user.tenantId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(refreshDecoded.exp * 1000),
        revokedAt: null,
      }),
    );

    const accessDecoded = this.jwt.decode(accessToken) as { exp: number };
    return {
      accessToken,
      refreshToken,
      expiresIn: accessDecoded.exp - Math.floor(Date.now() / 1000),
    };
  }

  private async verifyRefresh(token: string): Promise<{ sub: string; tenantId: string; jti: string }> {
    try {
      return await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Neplatný nebo expirovaný refresh token');
    }
  }

  private async revokeAllForUser(userId: string): Promise<void> {
    await this.refreshTokens.update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
