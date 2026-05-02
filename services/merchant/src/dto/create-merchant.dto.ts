import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { UsStateSchema } from '@eazepay/shared-types';

export const CreateMerchantSchema = z.object({
  legalName: z.string().min(1).max(200),
  dba: z.string().max(200).optional(),
  /** EIN — XX-XXXXXXX. Optional at creation; required before KYB. */
  ein: z
    .string()
    .regex(/^\d{2}-\d{7}$/, 'must match EIN format XX-XXXXXXX')
    .optional(),
  formationState: UsStateSchema.optional(),
  naicsCode: z.string().regex(/^\d{6}$/).optional(),
  mcc: z.string().regex(/^\d{4}$/).optional(),
  industry: z.string().max(100).optional(),
  website: z.string().url().max(200).optional(),
});

export class CreateMerchantDto extends createZodDto(CreateMerchantSchema) {}
