import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
// Value import (not type-only): NestJS DI resolves constructor params
// via emitted decorator metadata, which requires a runtime reference.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PiiVaultService } from '@eazepay/service-user';
import { EVENT_CHANNEL, PRISMA, REDIS_PUB } from './internal/tokens.js';
import { assertSafePayload } from './internal/sanitiser.js';
import type { PublishInput, PublishedEvent, EventKind } from './events.types.js';

/**
 * EventsService — central publisher for the fleet-wide event bus.
 *
 * Contract:
 *   1. publish() is ALWAYS called with a transaction-scoped Prisma
 *      client (`prisma.$transaction(async (tx) => { ... ; events.publish(tx, ...) })`).
 *      If the transaction rolls back, the event is rolled back with
 *      it — invariant: no state change ships without its event, and
 *      no event ships without its state change.
 *   2. After the transaction commits, the caller's code path returns
 *      to NestJS, which lets the response stream emit; the Redis
 *      broadcast happens BEFORE the DB transaction commits (best-
 *      effort early notification) so subscribers see the event
 *      ~immediately. If the transaction rolls back, subscribers
 *      may have seen a phantom event — they reconcile via the
 *      event_log on reconnect (the row will simply not exist).
 *      Acceptable trade-off documented in ADR-0019.
 *   3. Payload is sanitised on every call. Anything that looks like
 *      PII throws synchronously, failing the transaction. Free-text
 *      PII rides in `payloadPii` which is envelope-encrypted with
 *      AAD bound to the event uuid before persist.
 *   4. SSE subscribers consume from Redis pub/sub (low-latency) for
 *      live events; on reconnect they replay missed events from
 *      event_log (catchup) via `listSince()`.
 */
@Injectable()
export class EventsService {
  private readonly log = new Logger(EventsService.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(REDIS_PUB) private readonly pub: Redis,
    @Inject(EVENT_CHANNEL) private readonly channel: string,
    private readonly vault: PiiVaultService,
  ) {}

  /**
   * Publish an event. MUST be called from inside a Prisma
   * transaction — pass the `tx` handle from `prisma.$transaction()`
   * as the first argument so the event row commits atomically with
   * the caller's state change.
   */
  async publish(tx: Prisma.TransactionClient, input: PublishInput): Promise<PublishedEvent> {
    assertSafePayload(input.payload, '');

    let piiEnc: string | undefined;
    // Reserve uuid up-front so the AAD on the encrypted blob is
    // bound to the event row before it exists. We use crypto.randomUUID
    // via Prisma's @default(uuid()) — but we need the uuid for AAD,
    // so generate it client-side.
    const uuid = cryptoRandomUuid();
    if (input.payloadPii !== undefined && input.payloadPii !== '') {
      piiEnc = await this.vault.sealOpaque(input.payloadPii, {
        entity: 'event_log',
        field: 'payloadPii',
        eventUuid: uuid,
      });
    }

    const row = await tx.eventLog.create({
      data: {
        uuid,
        kind: input.kind,
        merchantId: input.merchantId,
        targetType: input.targetType,
        targetId: input.targetId,
        actorId: input.actorId,
        actorLabel: input.actorLabel,
        payload: input.payload as Prisma.InputJsonValue,
        payloadPiiEnc: piiEnc,
      },
    });

    const wire: PublishedEvent = {
      uuid: row.uuid,
      id: row.id.toString(),
      kind: row.kind as EventKind,
      merchantId: row.merchantId,
      targetType: row.targetType,
      targetId: row.targetId,
      actorId: row.actorId,
      actorLabel: row.actorLabel,
      payload: row.payload as Record<string, never>,
      at: row.at.toISOString(),
    };

    // Best-effort fan-out — SSE handlers may receive before commit;
    // on rollback they'll fail their next reconciliation read.
    // Documented in ADR-0019. Wrapped in a fire-and-forget so a Redis
    // outage doesn't fail the calling transaction.
    this.pub.publish(this.channel, JSON.stringify(wire)).catch((err: unknown) => {
      this.log.warn(
        `Redis publish failed (event ${wire.uuid}); subscribers will catch up via replay`,
        err instanceof Error ? err.stack : err,
      );
    });

    return wire;
  }

  /**
   * Catchup query — SSE handler calls this on reconnect with the
   * client's `Last-Event-ID` header (decoded to BigInt). Optionally
   * scoped to a merchantId for partner subscribers; master callers
   * pass null. Capped at 500 rows to bound recovery time.
   */
  async listSince(
    afterId: bigint,
    scope: { merchantId: string | null; master: boolean },
    limit = 500,
  ): Promise<PublishedEvent[]> {
    const where: Prisma.EventLogWhereInput = {
      id: { gt: afterId },
    };
    if (!scope.master) {
      // Partner: only events for their merchant OR null-tenant master-
      // only events (which they never see — extra defensive belt).
      where.merchantId = scope.merchantId;
    }
    const rows = await this.prisma.eventLog.findMany({
      where,
      orderBy: { id: 'asc' },
      take: limit,
    });
    return rows.map((row) => ({
      uuid: row.uuid,
      id: row.id.toString(),
      kind: row.kind as EventKind,
      merchantId: row.merchantId,
      targetType: row.targetType,
      targetId: row.targetId,
      actorId: row.actorId,
      actorLabel: row.actorLabel,
      payload: row.payload as Record<string, never>,
      at: row.at.toISOString(),
    }));
  }

  /**
   * Recent events for a specific target — e.g. fetching the latest
   * 50 events for one application to seed the live ticker on first
   * load before the SSE catches up.
   */
  async listForTarget(
    targetType: string,
    targetId: string,
    scope: { merchantId: string | null; master: boolean },
    limit = 50,
  ): Promise<PublishedEvent[]> {
    const where: Prisma.EventLogWhereInput = { targetType, targetId };
    if (!scope.master) where.merchantId = scope.merchantId;
    const rows = await this.prisma.eventLog.findMany({
      where,
      orderBy: { id: 'desc' },
      take: limit,
    });
    return rows.reverse().map((row) => ({
      uuid: row.uuid,
      id: row.id.toString(),
      kind: row.kind as EventKind,
      merchantId: row.merchantId,
      targetType: row.targetType,
      targetId: row.targetId,
      actorId: row.actorId,
      actorLabel: row.actorLabel,
      payload: row.payload as Record<string, never>,
      at: row.at.toISOString(),
    }));
  }
}

/** Pluck a uuid client-side so we can bind AAD to it before persist. */
function cryptoRandomUuid(): string {
  return randomUUID();
}
