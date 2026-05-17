import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { BoPiiV1Schema } from '../bo-pii.types.js';

export const AddBeneficialOwnerSchema = z
  .object({
    pii: BoPiiV1Schema,
    ownershipPct: z.number().int().min(0).max(100),
    isControlling: z.boolean().default(false),
  })
  // SEC-117: reject unknown root fields. Nested `pii` schema lives in
  // bo-pii.types and is shared with the vault open/seal path — strict
  // is applied only at the DTO root so the vault stays flexible.
  .strict();

export class AddBeneficialOwnerDto extends createZodDto(AddBeneficialOwnerSchema) {}
