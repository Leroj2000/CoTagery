import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, MoreThan, Repository } from 'typeorm';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import type { TenantRole } from '@tagery/shared';
import { User } from './entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { MailService } from '../mail/mail.service';

export interface AccessPayload {
  sub: string;
  /** Aktivní organizace (= tenant pro RLS). */
  tenantId: string;
  tenantRole: TenantRole;
  membershipId?: string | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** Řádek z my_memberships() – identity-layer přehled napříč organizacemi. */
interface MembershipRow {
  membership_id: string;
  organization_id: string;
  organization_name: string;
  role: TenantRole;
  status: string;
  created_at: string;
}

export interface MembershipView {
  membershipId: string;
  organizationId: string;
  organizationName: string;
  role: TenantRole;
  status: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(RefreshToken) private readonly refreshTokens: Repository<RefreshToken>,
    @InjectRepository(PasswordResetToken)
    private readonly resetTokens: Repository<PasswordResetToken>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  /**
   * Požádá o reset hesla: pokud e-mail patří účtu, vytvoří jednorázový token
   * (hash v DB) a pošle odkaz. Vždy vrací bez chyby (nezveřejňuje existenci účtu).
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.users.findOne({ where: { email, status: 'active' } });
    if (!user) return; // no user enumeration
    const raw = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h
    await this.resetTokens.save(
      this.resetTokens.create({ userId: user.id, tokenHash: this.hashToken(raw), expiresAt, usedAt: null }),
    );
    const base = this.config.get<string>('PUBLIC_WEB_URL') ?? 'http://localhost:3000';
    await this.mail.sendPasswordReset({
      to: user.email,
      name: user.name,
      url: `${base}/reset-password?token=${raw}`,
    });
  }

  /** Nastaví nové heslo dle jednorázového tokenu a revokuje všechny relace. */
  async confirmPasswordReset(token: string, newPassword: string): Promise<void> {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('Heslo musí mít alespoň 8 znaků');
    }
    const stored = await this.resetTokens.findOne({
      where: { tokenHash: this.hashToken(token), usedAt: IsNull(), expiresAt: MoreThan(new Date()) },
    });
    if (!stored) throw new BadRequestException('Neplatný nebo expirovaný odkaz');

    const user = await this.users.findOne({ where: { id: stored.userId } });
    if (!user) throw new BadRequestException('Uživatel neexistuje');

    user.passwordHash = await AuthService.hashPassword(newPassword);
    await this.users.save(user);
    stored.usedAt = new Date();
    await this.resetTokens.save(stored);
    // Bezpečnost: zneplatni existující session a další nepoužité reset tokeny.
    await this.revokeAllForUser(user.id);
    await this.resetTokens.update({ userId: user.id, usedAt: IsNull() }, { usedAt: new Date() });
  }

  /** Členství identity napříč organizacemi (obchází per-tenant RLS, filtr dle user_id). */
  private myMemberships(userId: string): Promise<MembershipRow[]> {
    return this.dataSource.query('SELECT * FROM my_memberships($1)', [userId]);
  }

  /** Přehled „moje organizace" pro přihlášenou identitu (Fáze 0.2). */
  async listMemberships(userId: string): Promise<MembershipView[]> {
    const rows = await this.myMemberships(userId);
    return rows.map((m) => ({
      membershipId: m.membership_id,
      organizationId: m.organization_id,
      organizationName: m.organization_name,
      role: m.role,
      status: m.status,
    }));
  }

  async login(email: string, password: string): Promise<TokenPair> {
    const user = await this.users.findOne({ where: { email, status: 'active' } });
    if (!user || !(await argonVerify(user.passwordHash, password))) {
      throw new UnauthorizedException('Neplatné přihlašovací údaje');
    }
    // Výchozí aktivní org = domovská (user.tenantId), jinak první členství.
    const ms = await this.myMemberships(user.id);
    const chosen = ms.find((m) => m.organization_id === user.tenantId) ?? ms[0] ?? null;
    return this.issueTokens(user, chosen);
  }

  /** Přepnutí aktivní organizace – jen do org, kde má identita členství. */
  async switchOrg(userId: string, organizationId: string): Promise<TokenPair> {
    const user = await this.users.findOne({ where: { id: userId, status: 'active' } });
    if (!user) throw new UnauthorizedException('Uživatel neexistuje nebo je neaktivní');
    const chosen = (await this.myMemberships(userId)).find(
      (m) => m.organization_id === organizationId,
    );
    if (!chosen) throw new ForbiddenException('Nemáš členství v této organizaci');
    return this.issueTokens(user, chosen);
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

    // Zachovej aktivní org z refresh tokenu, pokud tam identita stále má členství.
    const ms = await this.myMemberships(user.id);
    const chosen =
      ms.find((m) => m.organization_id === stored.tenantId) ??
      ms.find((m) => m.organization_id === user.tenantId) ??
      ms[0] ??
      null;
    return this.issueTokens(user, chosen);
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

  /**
   * Vydá tokeny pro danou aktivní organizaci (z membershipu). Fallback na
   * domovskou org uživatele, pokud membership chybí (defenzivně před 0.3).
   */
  private async issueTokens(user: User, membership: MembershipRow | null): Promise<TokenPair> {
    const orgId = membership?.organization_id ?? user.tenantId;
    const role = membership?.role ?? user.tenantRole;
    const membershipId = membership?.membership_id ?? null;

    const accessPayload: AccessPayload = {
      sub: user.id,
      tenantId: orgId,
      tenantRole: role,
      membershipId,
    };
    const accessToken = await this.jwt.signAsync(accessPayload, {
      expiresIn: (this.config.get<string>('JWT_ACCESS_TTL') ?? '15m') as JwtSignOptions['expiresIn'],
    });

    const jti = randomUUID();
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, tenantId: orgId, jti },
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
        tenantId: orgId,
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
