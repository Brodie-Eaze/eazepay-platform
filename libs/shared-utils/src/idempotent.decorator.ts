import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENT_KEY = 'idempotent';

/**
 * Mark a route handler as requiring an Idempotency-Key header.
 *
 * Enforced by IdempotencyInterceptor in apps/api. Replays cached responses
 * for repeat keys within the TTL window (default 24h); fails 409 if the same
 * key arrives with a different request body.
 */
export const Idempotent = (): MethodDecorator => SetMetadata(IDEMPOTENT_KEY, true);
