import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Unauthorized } from '@eazepay/shared-utils';
import { TokenService } from '../internal/token.service.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import type { SessionContext } from '../auth.types.js';

/**
 * Verifies the access JWT and attaches `req.user` (SessionContext).
 * Routes opt out via @Public(). Apply globally via APP_GUARD.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      user?: SessionContext;
      ip?: string;
    }>();

    const auth = req.headers['authorization'];
    const header = Array.isArray(auth) ? auth[0] : auth;
    if (!header?.startsWith('Bearer ')) {
      throw Unauthorized({ code: 'missing_bearer' });
    }
    const token = header.slice('Bearer '.length).trim();
    if (!token) throw Unauthorized({ code: 'missing_bearer' });

    try {
      const claims = await this.tokens.verifyAccess(token);
      req.user = {
        userId: claims.sub,
        sessionId: claims.sid,
        ipAddress: req.ip,
        userAgent: (req.headers['user-agent'] as string | undefined) ?? undefined,
      };
      return true;
    } catch (err) {
      this.logger.debug({ err }, 'jwt verify failed');
      throw Unauthorized({ code: 'invalid_token' });
    }
  }
}
