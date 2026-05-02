import { z } from 'zod';
import { UsStateSchema, UsZipSchema } from '@eazepay/shared-types';

/**
 * Beneficial owner PII v1. Same envelope-encrypted blob pattern as
 * ConsumerProfile. Storing legal name, DOB, address, SSN-last-4 only
 * (full SSN goes through the tokenisation vault when it ships).
 */
export const BoPiiV1Schema = z.object({
  legalName: z.object({
    first: z.string().min(1).max(100),
    middle: z.string().max(100).optional(),
    last: z.string().min(1).max(100),
  }),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ssnLast4: z.string().regex(/^\d{4}$/).optional(),
  address: z.object({
    line1: z.string().min(1).max(200),
    line2: z.string().max(200).optional(),
    city: z.string().min(1).max(100),
    state: UsStateSchema,
    zip: UsZipSchema,
  }),
});

export type BoPiiV1 = z.infer<typeof BoPiiV1Schema>;
export const BO_PII_SCHEMA_VERSION = 1;
