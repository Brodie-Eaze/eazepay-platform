import { createZodDto } from 'nestjs-zod';
import { PiiV1Schema } from '../pii.types.js';

export const UpdateProfileSchema = PiiV1Schema;

export class UpdateProfileDto extends createZodDto(UpdateProfileSchema) {}
