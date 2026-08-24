import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { User } from '../../core/auth/entities/user.entity';
import { RenterProfile } from '../rental/entities/renter-profile.entity';

/** Nil UUID = platformový tenant (domovská org účtů nájemců). */
export const PLATFORM_TENANT_ID = '00000000-0000-0000-0000-000000000000';

/** Access token nájemce – scope 'renter', BEZ tenant kontextu firmy. */
export interface RenterTokenPayload {
  sub: string;
  scope: 'renter';
  email: string;
  name: string;
}

export interface RenterSession {
  accessToken: string;
  expiresIn: number;
  renter: { id: string; email: string; name: string };
}

/**
 * Auth nájemce (EPIC-19 F2, rozh. C). Znovupoužívá `users` (globálně unikátní
 * e-mail, bez RLS) pro přihlašovací údaje + `renter_profiles` pro platformovou
 * reputaci (ADR-0005). Vydává token se `scope='renter'`, který NENASTAVUJE org
 * tenant kontext → nájemce nemá přístup k datům žádné firmy; svoje objednávky
 * čte/zakládá jen přes SECURITY DEFINER funkce.
 */
@Injectable()
export class RenterAuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(RenterProfile) private readonly profiles: Repository<RenterProfile>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(email: string, password: string, name: string): Promise<RenterSession> {
    const mail = email.trim().toLowerCase();
    const displayName = name.trim();
    if (!mail || !displayName) throw new BadRequestException('Vyplň jméno i e-mail');
    if (!password || password.length < 8) {
      throw new BadRequestException('Heslo musí mít alespoň 8 znaků');
    }
    const existing = await this.users.findOne({ where: { email: mail } });
    if (existing) throw new ConflictException('E-mail už je registrovaný');

    const passwordHash = await argonHash(password);
    // users nemá RLS → lze zapsat mimo tenant kontext. Domovská org = platforma.
    const user = await this.users.save(
      this.users.create({
        tenantId: PLATFORM_TENANT_ID,
        email: mail,
        name: displayName,
        passwordHash,
        tenantRole: 'SCAN_ONLY',
        status: 'active',
      }),
    );
    // Platformová identita nájemce (reputace/ověření napříč firmami).
    await this.ensureProfile(mail, displayName);
    return this.issue(user);
  }

  async login(email: string, password: string): Promise<RenterSession> {
    const mail = email.trim().toLowerCase();
    const user = await this.users.findOne({ where: { email: mail, status: 'active' } });
    if (!user || !(await argonVerify(user.passwordHash, password))) {
      throw new UnauthorizedException('Neplatné přihlašovací údaje');
    }
    await this.ensureProfile(user.email, user.name);
    return this.issue(user);
  }

  /** Vytvoří renter_profile, pokud pro e-mail ještě neexistuje (idempotentní). */
  private async ensureProfile(email: string, displayName: string): Promise<void> {
    const found = await this.profiles.findOne({ where: { email } });
    if (!found) {
      await this.profiles.save(this.profiles.create({ email, displayName }));
    }
  }

  /** Vrátí renter_profile.id pro e-mail (napojení objednávky na reputaci). */
  async profileIdForEmail(email: string): Promise<string | null> {
    const p = await this.profiles.findOne({ where: { email } });
    return p?.id ?? null;
  }

  private async issue(user: User): Promise<RenterSession> {
    const payload: RenterTokenPayload = {
      sub: user.id,
      scope: 'renter',
      email: user.email,
      name: user.name,
    };
    const accessToken = await this.jwt.signAsync(payload, {
      expiresIn: (this.config.get<string>('JWT_RENTER_TTL') ?? '7d') as JwtSignOptions['expiresIn'],
    });
    const decoded = this.jwt.decode(accessToken) as { exp: number };
    return {
      accessToken,
      expiresIn: decoded.exp - Math.floor(Date.now() / 1000),
      renter: { id: user.id, email: user.email, name: user.name },
    };
  }
}
