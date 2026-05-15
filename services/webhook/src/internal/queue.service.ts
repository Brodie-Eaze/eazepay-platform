import type { OnModuleDestroy } from '@nestjs/common';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Queue, type ConnectionOptions } from 'bullmq';
import type { Redis } from 'ioredis';
import { WEBHOOK_QUEUE_REDIS } from './tokens.js';

/**
 * SEC-035 — per-merchant webhook delivery partitioning.
 *
 * Pre-fix architecture: `WebhookDispatcher.drain()` ran a single serial
 * `for (const d of candidates)` loop on the elected leader replica.
 * One slow merchant endpoint (a customer pushing payload through a
 * sync-blocking pipeline, a misbehaving Cloudflare worker, an
 * intermittent DNS resolution) blocked delivery for EVERY other
 * merchant for the full BATCH_SIZE iteration. Fast merchants paid for
 * one bad neighbour.
 *
 * Post-fix architecture:
 *   - The cron tick (leader-only, gated by advisory lock + env flag)
 *     ENQUEUES each due delivery into the BullMQ queue
 *     `eazepay.webhook.deliveries`. The job name carries the
 *     merchantId so a per-merchant worker rate limiter can throttle
 *     hot tenants without affecting the rest. The job data carries
 *     the deliveryId; the worker re-fetches the row so the payload
 *     stays out of Redis where it would expand the secrets blast
 *     radius.
 *   - The WebhookWorker (this file's sibling, see WebhookWorkerService)
 *     runs on EVERY replica (not leader-gated) — workers benefit from
 *     horizontal scale, the lock just elects who enqueues.
 *   - Per-merchant concurrency cap = 2 (configurable via
 *     PER_MERCHANT_CONCURRENCY). Global worker concurrency = 10.
 *     A slow merchant maxes out their 2 slots and back-pressures
 *     their own jobs; the other 8 slots stay free for other tenants.
 *
 * Why BullMQ:
 *   - Redis is already in the stack (rate limiter, idempotency cache).
 *   - At-least-once delivery semantics match the existing claim-then-
 *     attempt logic — duplicate deliveries are already bounded by the
 *     pending → in_flight transition guard inside WebhookDispatcher.
 *   - Built-in retry / exponential backoff is unused here because the
 *     existing WebhookDelivery row carries its own attempts +
 *     nextAttemptAt — the cron re-discovers due rows after the worker
 *     reschedules them. Keep both layers separate to preserve the
 *     existing dashboard-replay UX.
 */
export const WEBHOOK_DELIVERY_QUEUE_NAME = 'eazepay.webhook.deliveries';

/** Per-merchant concurrency cap. Set higher if a partner reliably
 *  bursts 1000+ events / minute. Lower if a partner repeatedly bumps
 *  up against our consecutive-failure circuit breaker. */
export const PER_MERCHANT_CONCURRENCY = 2;

/** Global worker concurrency across all jobs in the queue, per replica.
 *  10 × N replicas = effective fleet-wide ceiling. */
export const WORKER_CONCURRENCY = 10;

export interface WebhookDeliveryJobData {
  /** WebhookDelivery.id — the worker re-fetches the row at start to
   *  avoid Redis as a payload store. */
  deliveryId: string;
  /** Owning merchant — copied into job data so the worker doesn't have
   *  to JOIN to know which merchant's concurrency slot to occupy. */
  merchantId: string;
  /** Endpoint id — same rationale. */
  endpointId: string;
}

@Injectable()
export class WebhookQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(WebhookQueueService.name);
  readonly queue: Queue<WebhookDeliveryJobData>;

  constructor(@Inject(WEBHOOK_QUEUE_REDIS) private readonly redis: Redis) {
    const connection: ConnectionOptions = this.redis;
    this.queue = new Queue<WebhookDeliveryJobData>(WEBHOOK_DELIVERY_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        // The WebhookDelivery row holds the canonical retry schedule;
        // BullMQ retries would double-count attempts. We let the
        // cron re-discover failed rows on the next tick.
        attempts: 1,
        removeOnComplete: { count: 1_000, age: 24 * 3600 },
        removeOnFail: { count: 1_000, age: 7 * 24 * 3600 },
      },
    });
  }

  /**
   * Enqueue one delivery for the worker pool. Idempotency: the
   * deliveryId is the BullMQ jobId, so two cron ticks that both pick
   * up the same row collapse to ONE enqueue. This matches the
   * pending → in_flight DB claim — if the row hasn't transitioned,
   * we can safely re-enqueue without doubling the work.
   */
  async enqueueDelivery(data: WebhookDeliveryJobData): Promise<void> {
    await this.queue.add(
      // Job name carries merchantId so worker-side rate limiting can
      // group on it without re-reading job data on every queue scan.
      `merchant:${data.merchantId}`,
      data,
      {
        jobId: data.deliveryId,
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.queue.close();
    } catch (err) {
      this.logger.warn({ err }, 'webhook queue close failed');
    }
  }
}
