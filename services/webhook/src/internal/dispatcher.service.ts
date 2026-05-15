import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PiiVaultService } from '@eazepay/service-user';
import {
  DISPATCHER_CRON_OPTIONS,
  type DispatcherCronOptions,
  PRISMA,
} from './tokens.js';
import { computeSignature, webhookSecretAadContext } from './webhook-signing.js';

const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 12; // 12 attempts * exponential backoff ≈ 24h
const REQUEST_TIMEOUT_MS = 10_000;
const CIRCUIT_BREAK_THRESHOLD = 20; // consecutive failures → endpoint paused

/**
 * Cron-driven outbound webhook dispatcher.
 *
 * Selects pending deliveries whose nextAttemptAt has elapsed, signs
 * each payload with the endpoint's secret (HMAC-SHA256), POSTs with a
 * 10-second timeout, and records the outcome.
 *
 * Failure handling:
 *  - 2xx          → status=delivered, lastDeliveredAt updated,
 *                   consecutiveFailures reset to 0.
 *  - 4xx (non 408) → terminal failure (status=failed). Client misconfig
 *                   is the merchant's problem; we don't keep retrying.
 *  - 5xx / 408 / network → status=pending, nextAttemptAt scheduled
 *                   with exponential backoff, attempts++.
 *  - When attempts >= MAX_ATTEMPTS → status=dead_letter.
 *  - When endpoint.consecutiveFailures >= threshold → endpoint paused
 *    automatically; merchant must rotate / fix and reactivate.
 *
 * Hard rules:
 *  - One in-flight attempt per delivery per cron tick. We claim rows
 *    via update-with-where guard before issuing the HTTP call.
 *  - The HMAC signature header is `X-EazePay-Signature: sha256=<hex>`
 *    over `<timestamp>.<payload-bytes>`. Timestamp + tolerance window
 *    in the X-EazePay-Timestamp header — same shape as Stripe / Square.
 */
@Injectable()
export class WebhookDispatcher {
  private readonly logger = new Logger(WebhookDispatcher.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    private readonly vault: PiiVaultService,
    @Inject(DISPATCHER_CRON_OPTIONS) private readonly options: DispatcherCronOptions,
  ) {}

  // Every minute. Tight enough that latency is reasonable, sparse
  // enough that we don't hammer the DB on a quiet system.
  //
  // Handler-entry guard. Two flags, both must be true:
  //  - cronLeader: only the elected leader replica should run timed
  //    crons. Other replicas would do duplicate DB work and clutter
  //    metrics — the row-claim transactions bound correctness, not
  //    cost.
  //  - dispatcherEnabled: per-cron kill-switch so an operator can
  //    pause webhook delivery during an incident without disabling
  //    audit drain / collection.
  // Both gates are also enforced at provider-registration time in
  // {@link WebhookModule.forRoot} — this is defense in depth so a
  // hot-reloaded config (or a future runtime toggle) can't accidentally
  // fire the cron.
  @Cron(CronExpression.EVERY_MINUTE)
  async runMinute(): Promise<void> {
    if (!this.options.cronLeader) return;
    if (!this.options.dispatcherEnabled) return;
    await this.drain();
  }

  /** Public for /admin trigger and tests. */
  async drain(): Promise<{ attempted: number; delivered: number; failed: number }> {
    const candidates = await this.prisma.webhookDelivery.findMany({
      where: {
        status: 'pending',
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
        endpoint: { status: 'active' },
      },
      include: { endpoint: true },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
    });

    let delivered = 0;
    let failed = 0;
    for (const d of candidates) {
      // Claim the row: only proceed if we successfully transitioned
      // pending → in_flight. A second worker on the same row no-ops.
      const claim = await this.prisma.webhookDelivery.updateMany({
        where: { id: d.id, status: 'pending' },
        data: { status: 'in_flight' },
      });
      if (claim.count === 0) continue;

      const result = await this.attempt(d);
      if (result.terminal && result.delivered) delivered++;
      else if (result.terminal) failed++;
    }

    return { attempted: candidates.length, delivered, failed };
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
      return this.recordOutcome(
        d,
        attempts,
        null,
        'endpoint_secret_unmigrated_rotate_required',
      );
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
      this.logger.error(
        `webhook endpoint ${d.endpoint.id} secret decrypt failed: ${msg}`,
      );
      return this.recordOutcome(
        d,
        attempts,
        null,
        `endpoint_secret_decrypt_failed: ${msg}`,
      );
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
