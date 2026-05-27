/**
 * Provider webhook event schemas — shared single source of truth.
 *
 * The webhook-processor (apps/partner-portal/lib/workers/webhook-processor.ts)
 * dispatches inbound deliveries to typed handlers. To keep the dispatch
 * compile-time exhaustive AND runtime fail-loud, every supported event
 * shape is declared here as a Zod discriminated union. The handler does:
 *
 *     const event = MicampWebhookEventSchema.parse({ type, ...body });
 *     switch (event.type) { ... }   // exhaustive
 *
 * A parse failure → `MalformedWebhookError` (extends
 * IntegrationErrorException(MalformedResponse)) → surfaces in the DLQ
 * per the fail-loud webhook posture. We do NOT want a silent ack on a
 * payload whose shape doesn't match the contract — that hides a real
 * partner integration drift.
 *
 * The TypeScript types are derived via `z.infer<>` so the schema is the
 * single source of truth; adding a new event type only requires
 * extending the union here and the switch in the handler. The
 * exhaustiveness check (`never`) catches forgotten branches at build.
 *
 * Previously these types were inline declarations on the adapter
 * modules (lib/micamp/client.ts + lib/highsale/client.ts) — moved here
 * so the schema lives next to other cross-cutting type contracts and so
 * the worker doesn't reach into an app-internal module.
 */

import { z } from 'zod';

/* ---------- MiCamp ---------- */

/**
 * MiCamp rate card snapshot embedded on `mid.underwriting.approved`.
 * Mirrors the adapter-side `RateCard` interface but kept as a Zod schema
 * here so the webhook parse round-trips without a separate type guard.
 */
export const RateCardSchema = z.object({
  interchangeBps: z.number().int().nonnegative(),
  processorBps: z.number().int().nonnegative(),
  perTransactionCents: z.number().int().nonnegative(),
  monthlyFeeCents: z.number().int().nonnegative().nullable(),
  settlementDays: z.number().int().nonnegative(),
});

export const MicampWebhookEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('mid.underwriting.approved'),
    midId: z.string().min(1),
    micampMid: z.string().min(1),
    rateCard: RateCardSchema,
  }),
  z.object({
    type: z.literal('mid.underwriting.rejected'),
    midId: z.string().min(1),
    reason: z.string(),
  }),
  z.object({
    type: z.literal('mid.post_underwriting'),
    midId: z.string().min(1),
    thresholdCents: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('payment.captured'),
    transactionId: z.string().min(1),
    midId: z.string().min(1),
    amountCents: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('payment.refunded'),
    transactionId: z.string().min(1),
    midId: z.string().min(1),
    amountCents: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('settlement.paid'),
    midId: z.string().min(1),
    payoutDate: z.string().min(1),
    netCents: z.number().int(),
  }),
]);

export type MicampWebhookEvent = z.infer<typeof MicampWebhookEventSchema>;

/* ---------- HighSale ---------- */

export const HighsaleTierSchema = z.enum(['A', 'B', 'C', 'D']);

export const HighsaleWebhookEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('pull.completed'),
    pullId: z.string().min(1),
    subAccountId: z.string().min(1),
    tier: HighsaleTierSchema,
  }),
  z.object({
    type: z.literal('pull.failed'),
    pullId: z.string().min(1),
    subAccountId: z.string().min(1),
    reason: z.string(),
  }),
  z.object({
    type: z.literal('subaccount.suspended'),
    subAccountId: z.string().min(1),
    reason: z.string(),
  }),
  z.object({
    type: z.literal('milly.invoice.issued'),
    subAccountId: z.string().min(1),
    amountCents: z.number().int().nonnegative(),
    periodEnd: z.string().min(1),
  }),
  z.object({
    type: z.literal('milly.invoice.paid'),
    subAccountId: z.string().min(1),
    amountCents: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('milly.invoice.failed'),
    subAccountId: z.string().min(1),
    amountCents: z.number().int().nonnegative(),
    reason: z.string(),
  }),
]);

export type HighsaleWebhookEvent = z.infer<typeof HighsaleWebhookEventSchema>;
