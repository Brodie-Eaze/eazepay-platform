import { createZodDto } from 'nestjs-zod';
import { PiiV1Schema } from '../pii.types.js';

// SEC-117: .strict() at the DTO layer rejects unknown root-level fields
// (no mutation of PiiV1Schema itself — the vault open/seal path keeps
// the original non-strict schema for forward-compat blob shapes).
export const UpdateProfileSchema = PiiV1Schema.strict();

export class UpdateProfileDto extends createZodDto(UpdateProfileSchema) {}
