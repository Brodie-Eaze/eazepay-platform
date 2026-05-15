import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_FILTER, APP_GUARD, Reflector } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule, JwtAuthGuard } from '@eazepay/service-auth';
import { UserModule } from '@eazepay/service-user';
import { AdminModule } from '@eazepay/service-admin';
import { ApplicationModule } from '@eazepay/service-application';
import { AuditModule } from '@eazepay/service-audit';
import { ComplianceDocModule } from '@eazepay/service-compliance-doc';
import { LenderModule } from '@eazepay/service-lender';
import { OrchestrationModule } from '@eazepay/service-orchestration';
import { MerchantModule } from '@eazepay/service-merchant';
import { NotificationModule } from '@eazepay/service-notification';
import { PaymentModule } from '@eazepay/service-payment';
import { RiskModule } from '@eazepay/service-risk';
import { WebhookModule } from '@eazepay/service-webhook';
import { HealthController } from '../health/health.controller.js';
import { loadEnv } from '../config/env.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisModule } from '../redis/redis.module.js';
import { RedisService } from '../redis/redis.service.js';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor.js';
import { ProblemExceptionFilter } from '../common/filters/problem-exception.filter.js';
import { RequestIdMiddleware } from '../common/middleware/request-id.middleware.js';
import { OrchestrationPostSubmitAdapter } from './post-submit.adapter.js';
import { PaymentContractedHookAdapter } from './contracted-hook.adapter.js';
import { ApplicationLinkController } from './application-link.controller.js';
import { ESignWebhookController } from './esign-webhook.controller.js';
import { HighsaleWebhookController } from './highsale-webhook.controller.js';
import { ObjectStorageModule } from './object-storage.module.js';
import { DevStorageController } from './dev-storage.controller.js';
import { ConsumerDocumentDownloadController } from './document-download.controller.js';

const env = loadEnv();

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    AuthModule.forRoot({
      provider: env.AUTH_PROVIDER,
      isDevelopment: env.NODE_ENV === 'development',
      prismaToken: PrismaService,
      redisToken: RedisService,
      config: {
        jwtIssuer: env.JWT_ISSUER,
        jwtAudience: env.JWT_AUDIENCE,
        jwtAccessSecret: env.JWT_ACCESS_SECRET,
        accessTokenTtlSeconds: env.ACCESS_TOKEN_TTL_SECONDS,
        refreshTokenTtlSeconds: env.REFRESH_TOKEN_TTL_SECONDS,
      },
    }),
    UserModule.forRoot({
      prismaToken: PrismaService,
      keyManager: env.KEY_MANAGER,
      localKekHex: env.LOCAL_KEK_HEX,
      kycProvider: env.KYC_PROVIDER,
      isDevelopment: env.NODE_ENV === 'development',
    }),
    NotificationModule.forRoot({
      prismaToken: PrismaService,
      isDevelopment: env.NODE_ENV === 'development',
      channels: { email: 'console', sms: 'console', push: 'console' },
    }),
    RiskModule.forRoot({
      prismaToken: PrismaService,
      deviceProvider: env.DEVICE_RISK_PROVIDER,
      identityProvider: env.IDENTITY_RISK_PROVIDER,
      isDevelopment: env.NODE_ENV === 'development',
    }),
    ObjectStorageModule,
    ComplianceDocModule.forRoot({
      prismaToken: PrismaService,
      bucket: env.COMPLIANCE_DOC_BUCKET,
    }),
    AdminModule.forRoot({ prismaToken: PrismaService }),
    WebhookModule.forRoot({
      prismaToken: PrismaService,
      // SEC-035 — BullMQ queue + worker reuse the shared API ioredis
      // client (no second pool per replica). The factory in
      // WebhookModule.forRoot calls `.client` on the injected service.
      redisToken: RedisService,
      // CRON_LEADER is the umbrella gate — see config/env.ts. Set true
      // on exactly one replica in production. The per-cron
      // `dispatcherEnabled` is the fine-grained kill-switch.
      cronLeader: env.CRON_LEADER,
      dispatcherEnabled: env.WEBHOOK_DISPATCHER_ENABLED,
    }),
    AuditModule.forRoot({
      prismaToken: PrismaService,
      sink: env.AUDIT_SINK,
      localFsRoot: env.AUDIT_LOCAL_FS_ROOT,
      cronLeader: env.CRON_LEADER,
      drainEnabled: env.AUDIT_DRAIN_ENABLED,
      isDevelopment: env.NODE_ENV === 'development',
    }),
    LenderModule.forRoot({
      prismaToken: PrismaService,
      // Scaffold adapters (us_bank, engine_tech, queen_street) throw
      // `pending_api_credentials` at quote() time until env keys are
      // configured. The orchestration engine records this as a per-lender
      // failure and the application proceeds with offers from configured
      // lenders. See services/lender/src/adapters/us-bank.adapter.ts
      // (and siblings) for the docstring listing what to fill in once
      // each API contract is signed.
      adapters: ['buzzpay', 'mock_prime', 'us_bank', 'engine_tech', 'queen_street'],
    }),
    MerchantModule.forRoot({
      prismaToken: PrismaService,
      kybProvider: env.KYB_PROVIDER,
      isDevelopment: env.NODE_ENV === 'development',
    }),
    OrchestrationModule.forRoot({ prismaToken: PrismaService }),
    ScheduleModule.forRoot(),
    // Global rate limiting — three tiers. Per-route decorators
    // (`@Throttle({ short: { limit, ttl } })` etc) tighten further on
    // auth/login/webhook surfaces.
    //
    /* Counters live in Redis so the limit is enforced across the whole
       fleet, not per replica. With the default in-memory storage each
       pod counts independently and N replicas turn "120 req/min/IP"
       into "120 * N req/min/IP" — silently 10x at 10 replicas. The
       Redis storage adapter writes counters to the same key namespace
       on every replica, so the limit is a true global ceiling no
       matter how many pods are running. We reach into RedisService.client
       (the underlying ioredis instance, exported as a public readonly
       field — see apps/api/src/redis/redis.service.ts) and hand it
       straight to ThrottlerStorageRedisService. */
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisService],
      useFactory: (redis: RedisService) => ({
        throttlers: [
          { name: 'short', ttl: 1_000, limit: 5 }, // 5 req/sec/IP — burst guard
          { name: 'medium', ttl: 10_000, limit: 30 }, // 30 req/10s/IP — spike guard
          { name: 'long', ttl: 60_000, limit: 120 }, // 120 req/min/IP — sustained
        ],
        storage: new ThrottlerStorageRedisService(redis.client),
      }),
    }),
    PaymentModule.forRoot({
      prismaToken: PrismaService,
      provider: env.PAYMENT_PROVIDER,
      bankAccountProvider: env.BANK_ACCOUNT_PROVIDER,
      cronLeader: env.CRON_LEADER,
      collectionCronEnabled: env.COLLECTION_CRON_ENABLED,
      isDevelopment: env.NODE_ENV === 'development',
    }),
    ApplicationModule.forRoot({
      prismaToken: PrismaService,
      postSubmitHookToken: OrchestrationPostSubmitAdapter,
      contractedHookToken: PaymentContractedHookAdapter,
      esignProvider: env.ESIGN_PROVIDER,
      isDevelopment: env.NODE_ENV === 'development',
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: env.LOG_LEVEL,
        transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
        // PII redaction baseline. Tighten in dedicated logging service.
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers["x-api-key"]',
            '*.password',
            '*.passwordHash',
            '*.ssn',
            '*.dob',
            '*.cardNumber',
            '*.cvv',
            '*.routingNumber',
            '*.accountNumber',
          ],
          censor: '[redacted]',
        },
      },
    }),
  ],
  controllers: [
    HealthController,
    ApplicationLinkController,
    ESignWebhookController,
    HighsaleWebhookController,
    ConsumerDocumentDownloadController,
    ...(env.OBJECT_STORAGE === 'local-fs' ? [DevStorageController] : []),
  ],
  providers: [
    Reflector,
    OrchestrationPostSubmitAdapter,
    PaymentContractedHookAdapter,
    // Rate limiter runs BEFORE the JWT guard so unauthenticated floods
    // can't burn CPU on token validation. Order matters in NestJS:
    // guards execute in the order they appear in this array.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    { provide: APP_FILTER, useClass: ProblemExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  // SEC-051 — request-id middleware runs FIRST so every log line +
  // every Problem+JSON response carries the same correlation id. We
  // honour an inbound `X-Request-Id` if the caller supplied one
  // (partner-portal sets one) and mint a UUID otherwise.
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
