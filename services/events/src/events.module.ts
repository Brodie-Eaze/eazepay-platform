import type { DynamicModule, Provider } from '@nestjs/common';
import { Global, Module } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { UserModule } from '@eazepay/service-user';
import { AuthModule } from '@eazepay/service-auth';
import { EventsService } from './events.service.js';
import { EventsSubscriber } from './events.subscriber.js';
import { EventStreamController } from './event-stream.controller.js';
import { ApplicationStreamController } from './application-stream.controller.js';
import { EVENT_CHANNEL, PRISMA, REDIS_PUB, REDIS_SUB } from './internal/tokens.js';

export interface EventsModuleOptions {
  prismaToken: symbol | string | (abstract new (...args: never[]) => PrismaClient);
  /** Existing RedisService — `.client` is the shared ioredis used for pub.
   *  We construct a separate `.duplicate()` client for sub (Redis pub/sub
   *  semantics require a dedicated subscriber connection). */
  redisToken: symbol | string | (abstract new (...args: never[]) => { client: unknown });
  /** Channel name for the broadcast. Default 'eaze.events'. */
  channel?: string;
  /** Feature gate. When false, the module registers nothing — no
   *  SSE routes, no Redis sub. Matches the BILLING_ENABLED pattern. */
  enabled?: boolean;
}

@Global()
@Module({})
export class EventsModule {
  static forRoot(options: EventsModuleOptions): DynamicModule {
    if (options.enabled !== true) {
      return { module: EventsModule };
    }

    const prisma: Provider = { provide: PRISMA, useExisting: options.prismaToken as never };

    const channel: Provider = {
      provide: EVENT_CHANNEL,
      useValue: options.channel ?? 'eaze.events',
    };

    const pub: Provider = {
      provide: REDIS_PUB,
      inject: [options.redisToken as never],
      useFactory: (redis: { client: unknown }) => redis.client,
    };

    const sub: Provider = {
      provide: REDIS_SUB,
      inject: [options.redisToken as never],
      useFactory: (redis: { client: { duplicate: () => unknown } }) => redis.client.duplicate(),
    };

    return {
      module: EventsModule,
      imports: [AuthModule, UserModule],
      controllers: [EventStreamController, ApplicationStreamController],
      providers: [prisma, channel, pub, sub, EventsService, EventsSubscriber],
      exports: [EventsService],
    };
  }
}
