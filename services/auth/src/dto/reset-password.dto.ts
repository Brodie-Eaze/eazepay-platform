import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const PasswordSchema = z
  .string()
  .min(12, 'must be at least 12 characters')
  .max(128)
  .regex(/[A-Z]/, 'must contain an uppercase letter')
  .regex(/[a-z]/, 'must contain a lowercase letter')
  .regex(/[0-9]/, 'must contain a digit')
  .regex(/[^A-Za-z0-9]/, 'must contain a symbol');

/**
 * Complete the password reset. Mirrors verify-otp's shape so the
 * client can share form code — challengeId carries the OTP context,
 * `code` is the 6-digit OTP value, `newPassword` is what the user
 * just typed. The OTP is single-use + 30-min TTL (enforced in
 * AuthService.resetPassword).
 */
export const ResetPasswordSchema = z
  .object({
    challengeId: z.string().uuid(),
    code: z.string().regex(/^\d{6}$/, 'must be a 6-digit code'),
    newPassword: PasswordSchema,
  })
  .strict();

export class ResetPasswordDto extends createZodDto(ResetPasswordSchema) {}
