import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateApplicationSchema = z.object({
  category: z.enum([
    'auto',
    'home_improvement',
    'medical',
    'retail',
    'personal',
    'consolidation',
  ]),
  /** Cents (integer string or integer). Floats banned by domain rule. */
  requestedAmountCents: z
    .union([z.number().int().positive(), z.string().regex(/^\d+$/)])
    .transform((v) => BigInt(v)),
  termMonths: z.number().int().min(1).max(120),
  purposeDetail: z.string().max(500).optional(),
  channel: z.enum(['consumer_direct', 'merchant_link', 'merchant_widget']).default('consumer_direct'),
  merchantId: z.string().uuid().optional(),
});

export class CreateApplicationDto extends createZodDto(CreateApplicationSchema) {}
