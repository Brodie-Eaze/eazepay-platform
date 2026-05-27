/**
 * Transactional-outbox shared vocabulary.
 *
 * WHY THIS LIVES IN @eazepay/shared-types
 * ----------------------------------------
 * The outbox row is INSERTed from two different ORMs:
 *
 *   - Drizzle, from `apps/partner-portal/lib/outbox.ts` (the BFF that
 *     owns `apps/partner-portal/drizzle/0014_outbox.sql` and the drain
 *     worker).
 *   - Prisma, from `libs/integrations-core/src/outbox-prisma.ts` (used
 *     by the NestJS services in `services/payment`, `services/webhook`,
 *     `services/notification` — they cannot import the Drizzle helper
 *     because they cannot share its `tx` handle).
 *
 * Both sides write to the SAME `outbox_events` table, drained by the
 * SAME worker. The `kind` discriminator + payload shape therefore HAS
 * to agree across both ORMs — otherwise the drain worker hits an
 * unregistered kind or a payload it can't parse.
 *
 * Adding a new kind is a coordinated change:
 *   1. Extend `OutboxKind` here.
 *   2. Add the matching variant to `OutboxPayload`.
 *   3. Register a handler in `apps/partner-portal/lib/workers/outbox-drain.ts`.
 *
 * Renaming an existing kind is a 2-deploy migration because rows with
 * the old value may already be in flight.
 */

/**
 * Closed union of outbox dispatch kinds. STUB handlers exist for each
 * of these in `apps/partner-portal/lib/workers/outbox-drain.ts`;
 * real wiring lands in the follow-up Wave 1 tasks.
 */
export type OutboxKind = 'notification.send' | 'webhook.outbound' | 'audit.log';

/**
 * Handler-specific payload contract. Stored verbatim as jsonb; the
 * drain worker re-parses per `kind`. This union is intentionally loose
 * (Record<string, unknown> per variant) — the payload schema is owned
 * by the handler, not by enqueue callers. Tightening per-kind shapes
 * is a follow-up once the handlers stabilise (W1.2 / W1.4).
 *
 * SECURITY: payload is persisted verbatim. Do NOT stash raw PII;
 * hash / tokenise identifiers before they land in the payload per
 * the safe-log deny-list convention.
 */
export type OutboxPayload =
  | { kind: 'notification.send'; [k: string]: unknown }
  | { kind: 'webhook.outbound'; [k: string]: unknown }
  | { kind: 'audit.log'; [k: string]: unknown }
  | Record<string, unknown>;
