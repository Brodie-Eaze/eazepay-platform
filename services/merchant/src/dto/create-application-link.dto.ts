import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateApplicationLinkSchema = z
  .object({
    category: z
      .enum(['auto', 'home_improvement', 'medical', 'retail', 'personal', 'consolidation'])
      .optional(),
    amountHintCents: z
      .union([z.number().int().positive(), z.string().regex(/^\d+$/)])
      .transform((v) => BigInt(v))
      .optional(),
    customerEmail: z.string().trim().email().optional(),
    /** E.164 — keep loose; consumer flow re-validates. */
    customerPhone: z
      .string()
      .regex(/^\+[1-9]\d{6,14}$/)
      .optional(),
    /** Minutes until expiry. Default 1 day. Cap 7 days for the link's blast radius. */
    expiresInMinutes: z
      .number()
      .int()
      .min(15)
      .max(7 * 24 * 60)
      .default(24 * 60),
  })
  // SEC-117: reject unknown fields.
  .strict();

export class CreateApplicationLinkDto extends createZodDto(CreateApplicationLinkSchema) {}
