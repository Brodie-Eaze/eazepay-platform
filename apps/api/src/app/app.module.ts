import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from '@eazepay/service-auth';
import { HealthController } from '../health/health.controller.js';
import { loadEnv } from '../config/env.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RedisModule } from '../redis/redis.module.js';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor.js';
import { ProblemExceptionFilter } from '../common/filters/problem-exception.filter.js';

const env = loadEnv();

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    AuthModule,
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
  controllers: [HealthController],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    { provide: APP_FILTER, useClass: ProblemExceptionFilter },
  ],
})
export class AppModule {}
