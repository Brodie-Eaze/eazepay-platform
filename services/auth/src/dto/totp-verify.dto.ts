import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Login-time TOTP verify. Carried on the existing MFA challenge id so
 * the login → verify-otp flow can dispatch to either the SMS/email
 * code path (verify-otp.dto.ts) or the TOTP path based on which the
 * user has enrolled. A 6-digit numeric value falls through to TOTP,
 * a 10-hex / xxxxx-xxxxx string falls through to recovery-code.
 */
export const TotpVerifySchema = z.object({
  challengeId: z.string().uuid(),
  /**
   * Either a 6-digit TOTP code OR a recovery code. We allow up to 32
   * characters so the formatted `xxxxx-xxxxx` form parses too — the
   * service strips formatting before comparison.
   */
  code: z.string().min(6).max(32),
  deviceId: z.string().min(8).max(128),
});

export class TotpVerifyDto extends createZodDto(TotpVerifySchema) {}
