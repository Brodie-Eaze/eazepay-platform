import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { Unauthorized } from '@eazepay/shared-utils';
import type { UserId } from '@eazepay/shared-types';
import type { SessionContext } from '../auth.types.js';

/**
 * Inject the authenticated UserId into a controller method.
 * Throws 401 if no session has been attached — paired with JwtAuthGuard.
 */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): UserId => {
  const req = ctx.switchToHttp().getRequest<{ user?: SessionContext }>();
  if (!req.user?.userId) throw Unauthorized({ code: 'unauthenticated' });
  return req.user.userId;
});

/**
 * Inject the full session context (userId + sessionId + device + ip).
 */
export const CurrentSession = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionContext => {
    const req = ctx.switchToHttp().getRequest<{ user?: SessionContext }>();
    if (!req.user) throw Unauthorized({ code: 'unauthenticated' });
    return req.user;
  },
);
