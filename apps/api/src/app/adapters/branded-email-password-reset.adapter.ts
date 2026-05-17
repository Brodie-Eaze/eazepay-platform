import { Injectable } from '@nestjs/common';
import type { PasswordResetEmailDispatcher } from '@eazepay/service-auth';
import type { BrandedEmailService } from '@eazepay/service-email';

/**
 * Adapter that bridges service-auth's `PasswordResetEmailDispatcher`
 * port to service-email's `BrandedEmailService.sendPasswordReset(...)`.
 *
 * Lives in apps/api because this is the only place both modules are
 * wired together. service-auth doesn't depend on service-email at the
 * package level (that would couple two libs that should stay
 * independently testable); the apps/api host composes them.
 */
@Injectable()
export class BrandedEmailPasswordResetAdapter implements PasswordResetEmailDispatcher {
  constructor(private readonly emails: BrandedEmailService) {}

  async send(input: {
    brand: 'medpay' | 'tradepay' | 'coachpay' | 'direct' | 'master';
    to: string;
    recipientName: string;
    resetUrl: string;
    resetCode: string;
    requestOrigin: string;
    idempotencyKey: string;
  }): Promise<void> {
    await this.emails.sendPasswordReset({
      brand: input.brand,
      to: input.to,
      idempotencyKey: input.idempotencyKey,
      vars: {
        recipientName: input.recipientName,
        resetUrl: input.resetUrl,
        resetCode: input.resetCode,
        requestOrigin: input.requestOrigin,
      },
    });
  }
}
