import { Injectable, Logger } from '@nestjs/common';
import type { NotificationGateway, OtpDeliveryInput } from '../ports/notification.port.js';

/**
 * DEV ONLY. Logs the OTP code to stdout so engineers can complete flows
 * without hooking SES/Twilio. Production must use a real adapter and the
 * console adapter must be removed from DI in non-development environments
 * (enforced in AuthModule via NODE_ENV check).
 */
@Injectable()
export class ConsoleNotificationAdapter implements NotificationGateway {
  private readonly logger = new Logger(ConsoleNotificationAdapter.name);

  async deliverOtp(input: OtpDeliveryInput): Promise<void> {
    this.logger.warn(
      `[DEV-ONLY] OTP for ${input.purpose} via ${input.channel} → ${input.to}: ${input.code} (TTL ${input.ttlSeconds}s)`,
    );
  }
}
