/**
 * Port that lets AuthService dispatch the password-reset email without
 * directly depending on service-email.
 *
 * Why a port: service-auth is consumed by apps/api, where we want to
 * compose AuthModule + EmailModule cleanly. A direct
 * `import {BrandedEmailService} from '@eazepay/service-email'` would
 * make AuthModule depend on EmailModule, which is fine here but
 * leaks the abstraction (tests for AuthService would have to wire the
 * full email stack). The port keeps the test surface minimal.
 *
 * Host app (apps/api) provides a thin adapter that delegates to
 * BrandedEmailService.sendPasswordReset(...). See
 * `apps/api/src/app/adapters/branded-email-password-reset.adapter.ts`.
 */
export interface PasswordResetEmailDispatcher {
  send(input: {
    /** Brand the reset email should be styled with. */
    brand: 'medpay' | 'tradepay' | 'coachpay' | 'direct' | 'master';
    to: string;
    recipientName: string;
    /** Brand-scoped reset URL (`/v/<brand>/auth/reset?token=...`). */
    resetUrl: string;
    /** 6-digit OTP that pairs with the URL. */
    resetCode: string;
    /** Where the request originated ("San Francisco · 8.8.8.8"). */
    requestOrigin: string;
    /** Per-operation idempotency token. The OTP challenge id is a
     *  natural fit here — replaying the same challenge mustn't send
     *  duplicate emails. */
    idempotencyKey: string;
  }): Promise<void>;
}

export const PASSWORD_RESET_EMAIL_DISPATCHER = Symbol('PASSWORD_RESET_EMAIL_DISPATCHER');
