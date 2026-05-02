import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// KYC initiation reuses the profile that already exists. No body required
// at MVP; the endpoint is a POST so we can attach an idempotency key.
export const StartKycSchema = z.object({}).strict();

export class StartKycDto extends createZodDto(StartKycSchema) {}
