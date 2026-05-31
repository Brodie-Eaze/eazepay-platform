import { z } from 'zod';

/**
 * Canonical, PII-classified client-financials contract.
 *
 * This is the validated boundary the decision engine reasons over. It
 * mirrors `PrequalInputs` in apps/partner-portal/lib/decision-engine.ts
 * field-for-field so the `/v1/decide` request is a drop-in (the portal
 * sends `{ applicationId, ...prequal }` with cents as JSON numbers).
 *
 * Cents are JSON numbers on the wire — these prequal fields are bounded
 * (loan ≤ program cap, income well under 2^53) so number is exact here.
 * The engine converts them to BigInt for fixed-point math internally so
 * decisions replay byte-identically (ADR-0012, ADR-0028); we deliberately
 * do NOT transform in this schema to keep the boundary a pure mirror.
 */

export const BRANDS = ['tradepay', 'medpay', 'coachpay', 'direct'] as const;
export type Brand = (typeof BRANDS)[number];

/** Consumer credit tier A–D, derived by the soft pull (best → worst). */
export const CONSUMER_TIERS = ['A', 'B', 'C', 'D'] as const;
export type ConsumerTier = (typeof CONSUMER_TIERS)[number];

export const canonicalPrequalSchema = z
  .object({
    tier: z.enum(CONSUMER_TIERS),
    /** Approx FICO (5-point band). NULL on thin file — NOT a decline. */
    ficoBand: z.number().int().min(300).max(850).nullable(),
    /** Debt-to-income ratio (0..1). NULL on insufficient data. */
    dti: z.number().min(0).max(1).nullable(),
    openTradelines: z.number().int().min(0).nullable(),
    /** Loan size requested by the consumer, in cents. */
    amountCents: z.number().int().positive(),
    /** Annual income in cents (self-reported, bureau-validated). */
    annualIncomeCents: z.number().int().min(0),
    /** 2-letter US state / territory (uppercase). */
    state: z.string().regex(/^[A-Z]{2}$/),
    brand: z.enum(BRANDS),
  })
  .strict();

export type CanonicalPrequal = z.infer<typeof canonicalPrequalSchema>;

/**
 * Data-classification tag per field — consumed by the PII tooling
 * (classify-before-write, encryption-at-rest, retention). Every field
 * the engine touches is classified; nothing is unclassified by default.
 */
export type DataClassification = 'pii_financial' | 'pii_quasi' | 'internal' | 'public';

export const PREQUAL_FIELD_CLASSIFICATION: Record<keyof CanonicalPrequal, DataClassification> = {
  tier: 'internal',
  ficoBand: 'pii_financial',
  dti: 'pii_financial',
  openTradelines: 'pii_financial',
  amountCents: 'pii_financial',
  annualIncomeCents: 'pii_financial',
  state: 'pii_quasi',
  brand: 'internal',
};
