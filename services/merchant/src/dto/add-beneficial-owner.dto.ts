import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { BoPiiV1Schema } from '../bo-pii.types.js';

export const AddBeneficialOwnerSchema = z.object({
  pii: BoPiiV1Schema,
  ownershipPct: z.number().int().min(0).max(100),
  isControlling: z.boolean().default(false),
});

export class AddBeneficialOwnerDto extends createZodDto(AddBeneficialOwnerSchema) {}
