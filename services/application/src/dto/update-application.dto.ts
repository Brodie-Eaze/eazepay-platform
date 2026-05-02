import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** Mutable fields while in `draft`. After submission the application is
 *  immutable except via lifecycle events. */
export const UpdateApplicationSchema = z
  .object({
    requestedAmountCents: z
      .union([z.number().int().positive(), z.string().regex(/^\d+$/)])
      .transform((v) => BigInt(v))
      .optional(),
    termMonths: z.number().int().min(1).max(120).optional(),
    purposeDetail: z.string().max(500).optional(),
    category: z
      .enum(['auto', 'home_improvement', 'medical', 'retail', 'personal', 'consolidation'])
      .optional(),
  })
  .strict();

export class UpdateApplicationDto extends createZodDto(UpdateApplicationSchema) {}
