import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ResendOtpSchema = z.object({
  challengeId: z.string().uuid(),
});

export class ResendOtpDto extends createZodDto(ResendOtpSchema) {}
