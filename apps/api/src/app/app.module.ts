import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule, JwtAuthGuard } from '@eazepay/service-auth';
import { UserModule } from '@eazepay/service-user';
import { AdminModule } from '@eazepay/service-admin';
import { ApplicationModule } from '@eazepay/service-application';
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
import { OrchestrationPostSubmitAdapter } from './post-submit.adapter.js';
import { PaymentContractedHookAdapter } from './contracted-hook.adapter.js';
import { ApplicationLinkController } from './application-link.controller.js';
import { ESignWebhookController } from './esign-webhook.controller.js';
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
      dispatcherEnabled: env.WEBHOOK_DISPATCHER_ENABLED,
    }),
    LenderModule.forRoot({
      prismaToken: PrismaService,
      adapters: ['buzzpay', 'mock_prime'],
    }),
    MerchantModule.forRoot({
      prismaToken: PrismaService,
      kybProvider: env.KYB_PROVIDER,
      isDevelopment: env.NODE_ENV === 'development',
    }),
    OrchestrationModule.forRoot({ prismaToken: PrismaService }),
    ScheduleModule.forRoot(),
    PaymentModule.forRoot({
      prismaToken: PrismaService,
      provider: env.PAYMENT_PROVIDER,
      bankAccountProvider: env.BANK_ACCOUNT_PROVIDER,
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
        transport:
          env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
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
    ConsumerDocumentDownloadController,
    ...(env.OBJECT_STORAGE === 'local-fs' ? [DevStorageController] : []),
  ],
  providers: [
    OrchestrationPostSubmitAdapter,
    PaymentContractedHookAdapter,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    { provide: APP_FILTER, useClass: ProblemExceptionFilter },
  ],
})
export class AppModule {}
