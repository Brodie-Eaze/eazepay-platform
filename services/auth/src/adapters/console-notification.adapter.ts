import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { NotificationGateway, OtpDeliveryInput } from '../ports/notification.port.js';

/**
 * DEV ONLY. Records the fact that an OTP was delivered without ever
 * emitting the code itself or the raw destination — both are sensitive
 * (SEC-022). Engineers running the dev flow can read the live code
 * directly from Redis under `otp:<challengeId>` (the auth service
 * writes it there with a short TTL). Production must use a real
 * adapter and the console adapter must be removed from DI in
 * non-development environments (enforced in AuthModule via NODE_ENV
 * check).
 */
@Injectable()
export class ConsoleNotificationAdapter implements NotificationGateway {
  private readonly logger = new Logger(ConsoleNotificationAdapter.name);

  async deliverOtp(input: OtpDeliveryInput): Promise<void> {
    // Hash the destination (phone / email) so we can correlate logs to
    // a flow without logging PII. 8 hex chars = 32 bits, enough to
    // disambiguate dev traffic without making the value reversible at
    // a glance.
    const destinationHash = createHash('sha256').update(input.to).digest('hex').slice(0, 8);
    this.logger.warn(
      `[DEV-ONLY] OTP delivered for ${input.purpose} via ${input.channel} to <${destinationHash}> (TTL ${input.ttlSeconds}s). Read the code from Redis at otp:<challengeId>.`,
    );
  }
}
