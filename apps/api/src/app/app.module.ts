import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_FILTER, APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule, JwtAuthGuard } from '@eazepay/service-auth';
import { UserModule } from '@eazepay/service-user';
import { HealthController } from '../health/health.controller.js';
import { loadEnv } from '../config/env.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisModule } from '../redis/redis.module.js';
import { RedisService } from '../redis/redis.service.js';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor.js';
import { ProblemExceptionFilter } from '../common/filters/problem-exception.filter.js';

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
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    { provide: APP_FILTER, useClass: ProblemExceptionFilter },
  ],
})
export class AppModule {}
