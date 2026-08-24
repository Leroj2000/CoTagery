import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../core/auth/entities/user.entity';
import type { RequestUser } from '../../core/auth/jwt-auth.guard';

/**
 * Vpustí jen platform-admina (ADR-0009). Běží PO `JwtAuthGuard` (ten naplní
 * `req.user`); ověří `is_platform_admin` z DB podle `sub` – nezávisle na tom,
 * v jaké organizaci je identita zrovna přihlášená. `users` nemá RLS.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const userId = req.user?.userId;
    if (!userId) throw new ForbiddenException('Není platform-admin');
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user?.isPlatformAdmin) throw new ForbiddenException('Není platform-admin');
    return true;
  }
}
