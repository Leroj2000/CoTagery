import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { DataSource, Repository } from 'typeorm';
import { AuthService } from './auth.service';
import type { User } from './entities/user.entity';
import type { RefreshToken } from './entities/refresh-token.entity';

function build() {
  const users = { findOne: jest.fn(), update: jest.fn() } as unknown as Repository<User>;
  const refreshTokens = {
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    create: jest.fn((x: unknown) => x),
  } as unknown as Repository<RefreshToken>;
  const resetTokens = {
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    create: jest.fn((x: unknown) => x),
  };
  const actionTokens = {
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    create: jest.fn((x: unknown) => x),
  };
  const mail = { sendPasswordReset: jest.fn() };
  // my_memberships() → prázdné = fallback na domovskou org uživatele.
  const dataSource = { query: jest.fn().mockResolvedValue([]) } as unknown as DataSource;
  const exp = Math.floor(Date.now() / 1000) + 900;
  const jwt = {
    signAsync: jest.fn().mockResolvedValue('signed.jwt.token'),
    decode: jest.fn().mockReturnValue({ exp }),
    verifyAsync: jest.fn(),
  } as unknown as JwtService;
  const config = { get: jest.fn().mockReturnValue('15m') } as unknown as ConfigService;
  return {
    svc: new AuthService(
      users,
      refreshTokens,
      resetTokens as never,
      actionTokens as never,
      dataSource,
      jwt,
      config,
      mail as never,
    ),
    users,
    refreshTokens,
    actionTokens,
    jwt,
  };
}

describe('AuthService', () => {
  it('login odmítne špatné heslo', async () => {
    const { svc, users } = build();
    const passwordHash = await AuthService.hashPassword('spravne-heslo');
    (users.findOne as jest.Mock).mockResolvedValue({ id: 'u1', passwordHash, status: 'active' });

    await expect(svc.login('a@b.cz', 'spatne-heslo')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('login vydá token pár při správném heslu', async () => {
    const { svc, users, refreshTokens } = build();
    const passwordHash = await AuthService.hashPassword('demo1234');
    (users.findOne as jest.Mock).mockResolvedValue({
      id: 'u1',
      tenantId: 't1',
      tenantRole: 'OWNER',
      passwordHash,
      status: 'active',
    });

    const pair = await svc.login('a@b.cz', 'demo1234');
    expect(pair.accessToken).toBeDefined();
    expect(pair.refreshToken).toBeDefined();
    expect(pair.expiresIn).toBeGreaterThan(0);
    expect(refreshTokens.save).toHaveBeenCalledTimes(1);
  });

  it('refresh detekuje reuse revokovaného tokenu a revokuje vše', async () => {
    const { svc, refreshTokens, jwt } = build();
    (jwt.verifyAsync as jest.Mock).mockResolvedValue({ sub: 'u1', tenantId: 't1', jti: 'j1' });
    (refreshTokens.findOne as jest.Mock).mockResolvedValue({
      jti: 'j1',
      userId: 'u1',
      revokedAt: new Date(),
    });

    await expect(svc.refresh('token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(refreshTokens.update).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1' }),
      expect.objectContaining({ revokedAt: expect.any(Date) }),
    );
  });

  it('ověřovací odkaz aktivuje účet právě jednou', async () => {
    const { svc, users, actionTokens } = build();
    actionTokens.findOne.mockResolvedValue({ id: 'a1', userId: 'u1' });
    actionTokens.update
      .mockResolvedValueOnce({ affected: 1 })
      .mockResolvedValueOnce({ affected: 0 });

    await svc.confirmEmail('dostatecne-dlouhy-overovaci-token');
    expect(users.update).toHaveBeenCalledWith({ id: 'u1' }, { status: 'active' });
    await expect(svc.confirmEmail('dostatecne-dlouhy-overovaci-token')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
