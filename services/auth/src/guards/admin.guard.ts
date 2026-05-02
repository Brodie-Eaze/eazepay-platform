import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { Forbidden, Unauthorized } from '@eazepay/shared-utils';
import { ADMIN_ONLY_KEY } from './admin.decorator.js';
import { PRISMA } from '../internal/tokens.js';
import type { SessionContext } from '../auth.types.js';

/**
 * Verifies the authenticated user has User.isAdmin = true. Apply via
 * @AdminOnly() on the controller / handler. Always pair with the global
 * JwtAuthGuard — this guard ASSUMES req.user is already populated.
 *
 * Production swap: Cognito groups + JIT elevation per docs/ARCHITECTURE.md
 * §16. Today's flag is the MVP shape; the surface is the same.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  private readonly logger = new Logger(AdminGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @Inject(PRISMA) private readonly prisma: PrismaClient,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean | undefined>(
      ADMIN_ONLY_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!required) return true;

    const req = ctx.switchToHttp().getRequest<{ user?: SessionContext }>();
    if (!req.user?.userId) throw Unauthorized({ code: 'unauthenticated' });

    const u = await this.prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { isAdmin: true, status: true },
    });
    if (!u) throw Unauthorized({ code: 'user_not_found' });
    if (u.status !== 'active') {
      throw Forbidden({ code: 'account_unavailable' });
    }
    if (!u.isAdmin) {
      this.logger.warn({ userId: req.user.userId }, 'admin access denied');
      throw Forbidden({ code: 'admin_required' });
    }
    return true;
  }
}
