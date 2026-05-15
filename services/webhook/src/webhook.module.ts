import type { DynamicModule, Provider } from '@nestjs/common';
import { Module } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import { CronLeaderService } from '@eazepay/service-audit';
import { WebhookService } from './webhook.service.js';
import { WebhookEndpointController } from './webhook-endpoint.controller.js';
import { WebhookDispatcher, WebhookWorker } from './internal/dispatcher.service.js';
import { WebhookQueueService } from './internal/queue.service.js';
import { WEBHOOK_PUBLISHER } from './ports/webhook-publisher.port.js';
import { DISPATCHER_CRON_OPTIONS, PRISMA, WEBHOOK_QUEUE_REDIS } from './internal/tokens.js';

export interface WebhookModuleOptions {
  prismaToken: symbol | string | (abstract new (...args: never[]) => PrismaClient);
  /** ioredis client used by the BullMQ queue + worker. Reuses the
   *  shared API Redis connection so we don't open a second pool per
   *  replica. Passed as a token so the API layer can wire its
   *  RedisService.client into the BullMQ queue. */
  redisToken: symbol | string | (abstract new (...args: never[]) => { client: Redis });
  /** Umbrella leader gate — set by the caller from `env.CRON_LEADER`.
   *  When false on a replica, NO cron in this process fires, even if
   *  `dispatcherEnabled` is true. Multi-replica safety lives here.
   *  Note: this gates only the CRON; the WORKER runs on every replica
   *  irrespective of leader status (SEC-035). */
  cronLeader: boolean;
  /** Per-cron kill-switch for the outbound webhook dispatcher.
   *  Independent of `cronLeader` so an operator can pause webhook
   *  delivery during an incident without disabling other crons. Both
   *  flags must be true for the CRON to run. The worker keeps running
   *  — pause that separately by deleting Redis keys if needed. */
  dispatcherEnabled: boolean;
}

@Module({})
export class WebhookModule {
  static forRoot(options: WebhookModuleOptions): DynamicModule {
    const prisma: Provider = { provide: PRISMA, useExisting: options.prismaToken as never };
    // BullMQ queue + worker need an ioredis client. The API layer
    // exposes its RedisService instance — we reach for `.client`
    // through a useFactory so the WebhookModule itself doesn't have to
    // know the RedisService class.
    const redis: Provider = {
      provide: WEBHOOK_QUEUE_REDIS,
      useFactory: (svc: { client: Redis }) => svc.client,
      inject: [options.redisToken as never],
    };
    const providers: Provider[] = [
      prisma,
      redis,
      WebhookService,
      // SEC-035 — queue is constructed on EVERY replica (workers need
      // to read from it). The dispatcher cron only adds items.
      WebhookQueueService,
      // SEC-035 — worker runs on every replica, NOT leader-gated.
      // Horizontal scale shrinks delivery latency; per-merchant rate
      // limiting bounds noisy-neighbour blast radius.
      WebhookWorker,
      { provide: WEBHOOK_PUBLISHER, useExisting: WebhookService },
    ];
    // Provider-registration gate: cron class is only instantiated when
    // BOTH flags are true. We still inject the options into the cron
    // service so the handler-entry guard inside it is defensive even if
    // a future caller wires it up under different conditions.
    const cronShouldRun = options.cronLeader && options.dispatcherEnabled;
    if (cronShouldRun) {
      providers.push({
        provide: DISPATCHER_CRON_OPTIONS,
        useValue: {
          cronLeader: options.cronLeader,
          dispatcherEnabled: options.dispatcherEnabled,
        },
      });
      // Postgres advisory-lock leader election — PRIMARY mechanism
      // that makes the cron safe against env-flag misconfiguration.
      providers.push(CronLeaderService);
      providers.push(WebhookDispatcher);
    }
    return {
      module: WebhookModule,
      // Global so any service can inject WEBHOOK_PUBLISHER without
      // re-importing the dispatcher / endpoint configuration.
      global: true,
      controllers: [WebhookEndpointController],
      providers,
      exports: [WebhookService, WEBHOOK_PUBLISHER],
    };
  }
}
