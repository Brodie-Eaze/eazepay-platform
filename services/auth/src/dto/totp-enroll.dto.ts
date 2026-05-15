import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Two payload shapes — init-enrol takes nothing (the user is already
 * authenticated, we read their id from the session), verify-enrol
 * carries the secret we returned from init + the 6-digit code the
 * user just produced from their authenticator app.
 *
 * The `secret` field carries the base32 string we minted in the init
 * step — clients hold it for the duration of the QR-scan flow then
 * forget it. We accept it on the verify call rather than re-issuing
 * because the secret MUST NOT touch our DB until we've confirmed the
 * user controls the authenticator (see commitEnrolment docstring on
 * services/auth/src/internal/totp.service.ts for the threat model).
 */
export const TotpEnrollInitSchema = z.object({});

export class TotpEnrollInitDto extends createZodDto(TotpEnrollInitSchema) {}

export const TotpEnrollVerifySchema = z.object({
  secret: z.string().min(16).max(64),
  code: z.string().regex(/^\d{6}$/, 'must be a 6-digit code'),
  /**
   * Recovery codes the client cached from the init response. We
   * hash + persist them here so the user's break-glass codes
   * survive the round-trip. If the client supplies different codes
   * to those we returned, that's a client bug — we still accept
   * them because the codes are minted client-side after init and
   * never recoverable post-init.
   */
  recoveryCodesPlaintext: z
    .array(z.string().min(8).max(32))
    .length(10, 'expected exactly 10 recovery codes'),
});

export class TotpEnrollVerifyDto extends createZodDto(TotpEnrollVerifySchema) {}
