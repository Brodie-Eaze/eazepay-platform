import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const BillingConfigPatchSchema = z
  .object({
    cycle: z.enum(['monthly', 'weekly', 'paused']).optional(),
    /** Monthly 1-28 (avoids 29-31 short-month edge cases), weekly 0-6. */
    dayOfPeriod: z.number().int().min(0).max(28).optional(),
    /** Pass empty string to clear the override and fall back to merchant.email. */
    sendToEmail: z.string().email().or(z.literal('')).optional(),
    autoSend: z.boolean().optional(),
    /** Empty string clears. Capped at 1k chars so it can't be abused as bulk storage. */
    paymentLinkTemplate: z.string().max(1024).optional(),
    note: z.string().max(2048).optional(),
  })
  .strict();

export class BillingConfigPatchDto extends createZodDto(BillingConfigPatchSchema) {}
