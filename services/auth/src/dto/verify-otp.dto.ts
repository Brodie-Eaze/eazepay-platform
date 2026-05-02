import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const VerifyOtpSchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/, 'must be a 6-digit code'),
  deviceId: z.string().min(8).max(128),
});

export class VerifyOtpDto extends createZodDto(VerifyOtpSchema) {}
