import { SetMetadata } from '@nestjs/common';

export const ADMIN_ONLY_KEY = 'admin_only';

/**
 * Mark a route handler (or controller) as restricted to admin users.
 * Enforced by AdminGuard in apps/api. Pairs with @ApiBearerAuth on the
 * route — requires bearer auth first, then admin elevation.
 */
export const AdminOnly = (): MethodDecorator & ClassDecorator =>
  SetMetadata(ADMIN_ONLY_KEY, true);
