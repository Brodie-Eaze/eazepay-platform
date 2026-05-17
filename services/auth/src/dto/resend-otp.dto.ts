import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ResendOtpSchema = z
  .object({
    challengeId: z.string().uuid(),
  })
  // SEC-117: reject unknown fields rather than silently dropping them.
  .strict();

export class ResendOtpDto extends createZodDto(ResendOtpSchema) {}
