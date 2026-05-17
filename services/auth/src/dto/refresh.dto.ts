import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const RefreshSchema = z
  .object({
    refreshToken: z.string().min(32).max(4096),
    deviceId: z.string().min(8).max(128),
  })
  // SEC-117: reject unknown fields rather than silently dropping them.
  .strict();

export class RefreshDto extends createZodDto(RefreshSchema) {}
