/**
 * Transactional outbox — Prisma side.
 *
 * WHY THIS EXISTS
 * ---------------
 * The Drizzle helper at `apps/partner-portal/lib/outbox.ts` takes a
 * Drizzle `TxHandle` and is therefore only usable from the partner
 * portal BFF. The NestJS services (`services/payment`,
 * `services/webhook`, `services/notification`) run on Prisma and
 * cannot share that handle — they open their own
 * `prisma.$transaction(async (tx) => ...)`.
 *
 * This helper provides the same enqueue semantics with a
 * `Prisma.TransactionClient` instead. Both sides INSERT into the
 * SAME `outbox_events` table (apps/api and apps/partner-portal share
 * one `DATABASE_URL`), so the single drain worker in
 * `apps/partner-portal/lib/workers/outbox-drain.ts` picks rows up
 * regardless of which side enqueued them.
 *
 * INVARIANT — TRANSACTIONAL ENQUEUE ONLY
 * --------------------------------------
 * The function takes `Prisma.TransactionClient`, not `PrismaClient`,
 * for the same reason the Drizzle side takes `TxHandle`: callers
 * cannot accidentally enqueue outside a transaction and lose
 * atomicity with the business write. If a caller needs to seed an
 * outbox row without a business write (tests), they should open a
 * one-statement `prisma.$transaction([prisma.outboxEvent.create({...})])`
 * — NOT call this helper with the top-level client.
 *
 * OBSERVABILITY
 * -------------
 * This module has no logger dep (integrations-core is a port-only
 * lib with zero runtime deps beyond node + Prisma types). Callers
 * are expected to log around their business write; the returned
 * `id` is the correlation handle.
 */

import { type Prisma } from '@prisma/client';
import type { OutboxKind, OutboxPayload } from '@eazepay/shared-types';

export interface EnqueueOutboxPrismaInput {
  kind: OutboxKind;
  /** Handler-specific payload. The drain worker re-parses per `kind`;
   *  the table stores it verbatim as jsonb.
   *
   *  SECURITY: payload is persisted verbatim. Do NOT stash raw PII;
   *  hash / tokenise identifiers before they land here per the
   *  safe-log deny-list convention shared with the Drizzle side. */
  payload: OutboxPayload;
}

export interface EnqueueOutboxPrismaResult {
  id: string;
}

/**
 * Insert a row into `outbox_events` inside the caller's Prisma
 * transaction. Mirrors `enqueueOutbox` from the Drizzle side; the
 * two helpers MUST stay signature-compatible so a future move
 * between ORMs is mechanical.
 *
 * Returns the new row id so the caller can correlate it with its
 * business entity logs.
 */
export async function enqueueOutboxPrisma(
  tx: Prisma.TransactionClient,
  input: EnqueueOutboxPrismaInput,
): Promise<EnqueueOutboxPrismaResult> {
  const row = await tx.outboxEvent.create({
    data: {
      kind: input.kind,
      // Prisma maps the camelCase `payloadJson` field back to the
      // physical `payload_json` jsonb column via `@map` in
      // schema.prisma. Cast through `Prisma.InputJsonValue` because
      // `OutboxPayload` is a loose union and Prisma's input type is
      // narrower than `unknown`.
      payloadJson: input.payload as Prisma.InputJsonValue,
    },
    select: { id: true },
  });

  return { id: row.id };
}
