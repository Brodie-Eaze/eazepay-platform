import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { EmailSchema } from '@eazepay/shared-types';

/**
 * Public forgot-password trigger.
 *
 * The endpoint ALWAYS returns 202 regardless of whether the email
 * matches a real account (anti-enumeration). When the email matches,
 * we mint a 6-digit OTP + reset token, persist in Redis with 30-min
 * TTL, and dispatch a branded email via BrandedEmailService. When it
 * doesn't match, we do nothing — same response shape, same latency
 * (best-effort).
 *
 * The `brand` hint lets the BFF tell us which vertical the request
 * originated from so the email is brand-flavored. If absent, we
 * resolve from the user's primary merchant brand at lookup time.
 */
export const ForgotPasswordSchema = z
  .object({
    email: EmailSchema,
    /** Vertical hint — 'medpay' | 'tradepay' | 'coachpay'. Optional. */
    brand: z.enum(['medpay', 'tradepay', 'coachpay']).optional(),
  })
  .strict();

export class ForgotPasswordDto extends createZodDto(ForgotPasswordSchema) {}
