import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { DelayedError, Worker, type Job, type ConnectionOptions } from 'bullmq';
import type { Redis } from 'ioredis';
import type { PiiVaultService } from '@eazepay/service-user';
import type { CronLeaderService } from '@eazepay/service-audit';
import { LOCK_ID_WEBHOOK_DISPATCHER } from '@eazepay/service-audit';
import {
  DISPATCHER_CRON_OPTIONS,
  type DispatcherCronOptions,
  PRISMA,
  WEBHOOK_QUEUE_REDIS,
} from './tokens.js';
import type { WebhookQueueService } from './queue.service.js';
import {
  WEBHOOK_DELIVERY_QUEUE_NAME,
  WORKER_CONCURRENCY,
  PER_MERCHANT_CONCURRENCY,
  type WebhookDeliveryJobData,
} from './queue.service.js';
import { computeSignature, webhookSecretAadContext } from './webhook-signing.js';

const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 12; // 12 attempts * exponential backoff ≈ 24h
const REQUEST_TIMEOUT_MS = 10_000;
const CIRCUIT_BREAK_THRESHOLD = 20; // consecutive failures → endpoint paused

/**
 * SEC-035 — Cron-driven outbound webhook DISPATCHER.
 *
 * Pre-fix architecture: this class POSTed each candidate row inline on
 * the elected leader replica's cron thread. One slow merchant blocked
 * every subsequent delivery in the batch for a full minute.
 *
 * Post-fix architecture: this class is now ENQUEUE-ONLY. It selects due
 * candidates and pushes them into the BullMQ
 * `eazepay.webhook.deliveries` queue keyed by merchant id. The actual
 * HTTP POST + claim-then-attempt logic lives in {@link WebhookWorker}
 * (below), which runs on EVERY replica with a per-merchant concurrency
 * cap. Slow merchants back-pressure their own queue partition; fast
 * merchants stay fast.
 *
 * Leader election (advisory lock + env flag + per-cron kill-switch) gates
 * this class ONLY. Workers are not leader-gated — they benefit from
 * horizontal scale.
 */
@Injectable()
export class WebhookDispatcher {
  private readonly logger = new Logger(WebhookDispatcher.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(DISPATCHER_CRON_OPTIONS) private readonly options: DispatcherCronOptions,
    private readonly cronLeader: CronLeaderService,
    private readonly queue: WebhookQueueService,
  ) {}

  // Every minute. Tight enough that latency is reasonable, sparse
  // enough that we don't hammer the DB on a quiet system.
  //
  // Three-layer guard. ALL must allow the tick to fire:
  //   1. Postgres advisory lock (PRIMARY). pg_try_advisory_lock at
  //      LOCK_ID_WEBHOOK_DISPATCHER — only ONE replica per tick
  //      acquires. Real distributed lock; survives env-flag
  //      misconfiguration.
  //   2. cronLeader env flag (secondary kill-switch).
  //   3. dispatcherEnabled per-cron kill-switch.
  // Layers 2 + 3 are also enforced at provider-registration time in
  // {@link WebhookModule.forRoot}; this handler-entry check is defense
  // in depth.
  @Cron(CronExpression.EVERY_MINUTE)
  async runMinute(): Promise<void> {
    if (!this.options.cronLeader) return;
    if (!this.options.dispatcherEnabled) return;
    const lock = await this.cronLeader.tryAcquireLock(LOCK_ID_WEBHOOK_DISPATCHER);
    if (!lock.held) return;
    try {
      await this.drain();
    } finally {
      await lock.releaseFn();
    }
  }

  /**
   * Public for /admin trigger and tests. Selects due rows and enqueues
   * a BullMQ job per row. The worker pool ({@link WebhookWorker}) does
   * the actual HTTP POST.
   *
   * Returns an `enqueued` count (instead of the old delivered/failed)
   * because per-job outcomes are asynchronous from this method's POV.
   * The admin replay UX still surfaces per-row outcomes via the
   * WebhookDelivery.status field, which the worker updates inline.
   */
  async drain(): Promise<{ attempted: number; enqueued: number }> {
    const candidates = await this.prisma.webhookDelivery.findMany({
      where: {
        status: 'pending',
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
        endpoint: { status: 'active' },
      },
      include: { endpoint: { select: { merchantId: true } } },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
    });

    let enqueued = 0;
    for (const d of candidates) {
      try {
        await this.queue.enqueueDelivery({
          deliveryId: d.id,
          merchantId: d.endpoint.merchantId,
          endpointId: d.endpointId,
        });
        enqueued++;
      } catch (err) {
        this.logger.error(
          { err, deliveryId: d.id },
          'webhook delivery enqueue failed — will retry on next tick',
        );
      }
    }

    return { attempted: candidates.length, enqueued };
  }
}

/**
 * SEC-035 — BullMQ-backed webhook delivery WORKER.
 *
 * Runs on EVERY API replica (not leader-gated). Pulls jobs from the
 * `eazepay.webhook.deliveries` queue, performs the same claim-then-
 * attempt logic that lived inline in WebhookDispatcher pre-fix:
 *
 *   1. Atomic pending → in_flight transition. Two workers on the same
 *      jobId no-op (only one wins the row claim).
 *   2. Decrypt endpoint secret (AAD-bound to endpoint.id).
 *   3. HMAC-SHA256 sign `<timestamp>.<body>`.
 *   4. POST with 10s timeout.
 *   5. Record outcome — success / retry / dead-letter / circuit-break.
 *
 * Per-merchant rate limiting strategy:
 *   BullMQ OSS doesn't have native per-group concurrency. We emulate
 *   it with an in-process per-merchant in-flight counter. When a
 *   merchant's slot count reaches PER_MERCHANT_CONCURRENCY (2), we
 *   call `worker.rateLimit(duration)` and return without processing —
 *   BullMQ re-queues the job. A slow merchant maxes out their 2 slots
 *   and back-pressures themselves; the worker's other 8 slots
 *   (concurrency 10 - 2 in-flight) stay free for everyone else.
 *
 * NB: this is a per-replica counter. Fleet-wide per-merchant
 * concurrency = PER_MERCHANT_CONCURRENCY × N replicas. Acceptable
 * because the goal is "isolate slow tenants", not "global rate
 * limiting" — those guarantees are already provided by the underlying
 * merchant's endpoint capacity.
 */
@Injectable()
export class WebhookWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WebhookWorker.name);
  private worker?: Worker<WebhookDeliveryJobData>;
  /** Per-merchant in-flight job count. Incremented when a job starts,
   *  decremented in finally. Used by the rate-limit check at job entry. */
  private readonly inFlightByMerchant = new Map<string, number>();

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    private readonly vault: PiiVaultService,
    @Inject(WEBHOOK_QUEUE_REDIS) private readonly redis: Redis,
  ) {}

  onModuleInit(): void {
    const connection: ConnectionOptions = this.redis;
    this.worker = new Worker<WebhookDeliveryJobData>(
      WEBHOOK_DELIVERY_QUEUE_NAME,
      async (job, token) => this.process(job, token),
      {
        connection,
        concurrency: WORKER_CONCURRENCY,
      },
    );
    this.worker.on('failed', (job, err) => {
      // DelayedError is the per-merchant rate-limit signal — expected,
      // not a failure. Skip the log so it doesn't pollute the error
      // stream.
      if (err.name === 'DelayedError') return;
      this.logger.error({ jobId: job?.id, err: err.message }, 'webhook worker job failed');
    });
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.worker?.close();
    } catch (err) {
      this.logger.warn({ err }, 'webhook worker close failed');
    }
  }

  private async process(job: Job<WebhookDeliveryJobData>, token?: string): Promise<void> {
    const { deliveryId, merchantId } = job.data;

    // Per-merchant concurrency cap. If this merchant already has
    // PER_MERCHANT_CONCURRENCY jobs in flight on this replica, ask
    // BullMQ to delay this job 1s and throw the DelayedError sentinel
    // so BullMQ stops processing the current invocation and puts the
    // job in the delayed set. The slow merchant's queue depth grows
    // but the worker's other slots stay available for other merchants.
    const current = this.inFlightByMerchant.get(merchantId) ?? 0;
    if (current >= PER_MERCHANT_CONCURRENCY) {
      // 1-second cooldown — short enough to keep the queue moving,
      // long enough that a slow merchant doesn't busy-spin the worker.
      await job.moveToDelayed(Date.now() + 1_000, token);
      // DelayedError is BullMQ's signal that the processor handed the
      // job off (via moveToDelayed) and the framework should pick the
      // next job. Without this throw, BullMQ marks the job complete
      // and the delayed-set entry is orphaned.
      throw new DelayedError();
    }

    this.inFlightByMerchant.set(merchantId, current + 1);
    try {
      await this.deliver(deliveryId);
    } finally {
      const next = (this.inFlightByMerchant.get(merchantId) ?? 1) - 1;
      if (next <= 0) this.inFlightByMerchant.delete(merchantId);
      else this.inFlightByMerchant.set(merchantId, next);
    }
  }

  private async deliver(deliveryId: string): Promise<void> {
    // Re-fetch the row — payloads stay out of Redis to bound the
    // secrets blast radius if Redis is ever exfiltrated.
    const d = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { endpoint: true },
    });
    if (!d || !d.endpoint) return;

    // Claim the row: only proceed if we successfully transitioned
    // pending → in_flight. A second worker on the same row no-ops.
    const claim = await this.prisma.webhookDelivery.updateMany({
      where: { id: d.id, status: 'pending' },
      data: { status: 'in_flight' },
    });
    if (claim.count === 0) return;

    await this.attempt(d);
  }

  private async attempt(
    d: NonNullable<Awaited<ReturnType<typeof this.prisma.webhookDelivery.findFirst>>> & {
      endpoint: {
        url: string;
        secretCiphertext: string | null;
        id: string;
        consecutiveFailures: number;
      };
    },
  ): Promise<{ terminal: boolean; delivered: boolean }> {
    const attempts = d.attempts + 1;
    const idempotencyKey = randomUUID();
    const timestamp = Math.floor(Date.now() / 1000);
    const bodyJson = JSON.stringify({
      id: d.id,
      eventId: d.eventId,
      eventType: d.eventType,
      subject: d.subjectType ? { type: d.subjectType, id: d.subjectId } : null,
      data: d.payload,
      createdAt: d.createdAt.toISOString(),
    });

    // Unmigrated row: the secret was only stored as a SHA-256 hash before
    // the encrypted-secret column was added. We have no way to recover
    // the raw secret, so we can't produce a verifiable signature. Fail
    // the delivery loudly — the failure counts toward the consecutive-
    // failure circuit breaker, which auto-pauses the endpoint after 20
    // failures and prompts the merchant to call POST /rotate-secret.
    // Rotation re-seals the new raw secret into `secretCiphertext` and
    // delivery resumes on the next cron tick.
    if (!d.endpoint.secretCiphertext) {
      this.logger.warn(
        `webhook endpoint ${d.endpoint.id} has no secretCiphertext (pre-migration row) — failing delivery ${d.id} until merchant rotates`,
      );
      return this.recordOutcome(d, attempts, null, 'endpoint_secret_unmigrated_rotate_required');
    }

    // Decrypt the raw secret. AAD is bound to the endpoint id, so a
    // ciphertext lifted from one endpoint's row into another's would
    // fail the GCM auth tag check rather than silently produce a
    // wrong-secret signature.
    let secret: string;
    try {
      const plaintext = await this.vault.openOpaque(
        d.endpoint.secretCiphertext,
        webhookSecretAadContext(d.endpoint.id),
      );
      secret = plaintext.toString('utf8');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown_error';
      this.logger.error(`webhook endpoint ${d.endpoint.id} secret decrypt failed: ${msg}`);
      return this.recordOutcome(d, attempts, null, `endpoint_secret_decrypt_failed: ${msg}`);
    }

    // HMAC-SHA256 over `<timestamp>.<bodyJson>` with the RAW secret —
    // the same shape merchants verify against (see the Highsale inbound
    // verifier in apps/api for the parity pattern). Header name matches
    // the public contract; the merchant compares with timingSafeEqual.
    const signature = computeSignature(secret, timestamp, bodyJson);

    let statusCode: number | null = null;
    let lastError: string | null = null;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
      try {
        const res = await fetch(d.endpoint.url, {
          method: 'POST',
          body: bodyJson,
          headers: {
            'content-type': 'application/json',
            'idempotency-key': idempotencyKey,
            'x-eazepay-event-id': d.eventId,
            'x-eazepay-event-type': d.eventType,
            'x-eazepay-timestamp': String(timestamp),
            'x-eazepay-signature': `sha256=${signature}`,
            'user-agent': 'EazePay-Webhooks/1.0',
          },
          signal: ctrl.signal,
        });
        statusCode = res.status;
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'unknown_error';
    }

    return this.recordOutcome(d, attempts, statusCode, lastError);
  }

  private async recordOutcome(
    d: { id: string; endpointId: string; createdAt: Date },
    attempts: number,
    statusCode: number | null,
    lastError: string | null,
  ): Promise<{ terminal: boolean; delivered: boolean }> {
    const ok = statusCode !== null && statusCode >= 200 && statusCode < 300;
    const clientFatal =
      statusCode !== null && statusCode >= 400 && statusCode < 500 && statusCode !== 408;
    const willRetry = !ok && !clientFatal && attempts < MAX_ATTEMPTS;
    const terminal = ok || clientFatal || attempts >= MAX_ATTEMPTS;

    await this.prisma.$transaction(async (tx) => {
      await tx.webhookDelivery.update({
        where: { id: d.id },
        data: {
          status: ok
            ? 'delivered'
            : willRetry
              ? 'pending'
              : attempts >= MAX_ATTEMPTS
                ? 'dead_letter'
                : 'failed',
          attempts,
          lastStatusCode: statusCode,
          lastError,
          nextAttemptAt: willRetry ? this.nextAttempt(attempts) : null,
          deliveredAt: ok ? new Date() : null,
        },
      });
      if (ok) {
        await tx.webhookEndpoint.update({
          where: { id: d.endpointId },
          data: { lastDeliveredAt: new Date(), consecutiveFailures: 0 },
        });
      } else {
        const ep = await tx.webhookEndpoint.update({
          where: { id: d.endpointId },
          data: { consecutiveFailures: { increment: 1 } },
          select: { consecutiveFailures: true, status: true },
        });
        if (ep.consecutiveFailures >= CIRCUIT_BREAK_THRESHOLD && ep.status === 'active') {
          await tx.webhookEndpoint.update({
            where: { id: d.endpointId },
            data: { status: 'paused' },
          });
          await tx.auditOutbox.create({
            data: {
              actorType: 'service',
              actorId: null,
              action: 'merchant.webhook.endpoint.auto_paused',
              targetType: 'WebhookEndpoint',
              targetId: d.endpointId,
              after: { reason: 'consecutive_failures', threshold: CIRCUIT_BREAK_THRESHOLD },
            },
          });
        }
      }
    });

    return { terminal, delivered: ok };
  }

  /** Exponential backoff with jitter. Bounded to 24h horizon. */
  private nextAttempt(attempts: number): Date {
    const base = Math.min(2 ** attempts * 30, 60 * 60 * 4); // seconds; cap 4h
    const jitter = Math.floor(Math.random() * Math.max(1, base * 0.2));
    return new Date(Date.now() + (base + jitter) * 1000);
  }
}
