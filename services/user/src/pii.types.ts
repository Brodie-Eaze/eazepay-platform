import { z } from 'zod';
import { UsStateSchema, UsZipSchema } from '@eazepay/shared-types';

/**
 * PII v1 — what we encrypt into the ConsumerProfile blob.
 *
 * Fields that need to be queryable (state of residence, KYC status,
 * sanctions status, etc.) live as plain columns on ConsumerProfile.
 * Anything sensitive lives here. Schema-versioned so we can add fields
 * without rewriting all existing rows in one shot.
 *
 * Hard rule: full SSN never lives in this blob. SSN is held only in a
 * separate tokenisation vault (post-MVP). For MVP we accept and store
 * the LAST 4 ONLY, in this blob.
 */
export const PiiV1Schema = z.object({
  legalName: z.object({
    first: z.string().min(1).max(100),
    middle: z.string().max(100).optional(),
    last: z.string().min(1).max(100),
    suffix: z.string().max(20).optional(),
  }),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  ssnLast4: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
  address: z.object({
    line1: z.string().min(1).max(200),
    line2: z.string().max(200).optional(),
    city: z.string().min(1).max(100),
    state: UsStateSchema,
    zip: UsZipSchema,
  }),
});

export type PiiV1 = z.infer<typeof PiiV1Schema>;

export const PII_SCHEMA_VERSION = 1;
