import { Module, Logger, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { PrismaClient } from '@prisma/client';
import { AuthModule } from '@eazepay/service-auth';
import { ApplicationModule } from '@eazepay/service-application';
import { ESignWebhookController } from './controllers/esign-webhook.controller.js';

// ──────────────────────────────────────────────────────────────────────
// JWT secret validation (SEC-010). The webhook process MUST refuse to
// boot without a real, sufficiently-strong JWT_ACCESS_SECRET.
//
// Previously this module fell back to a hardcoded literal when the env
// var was unset. That literal lived in source control, so anyone with
// repo access could forge a valid JWT for any user against any
// environment that happened to ship without the env var set — including
// production if a deploy misconfiguration silently dropped it.
//
// Defence:
//   • Read once, at module import time (= process boot).
//   • Reject undefined, empty, or short (<32 byte) values.
//   • Throw a clear, actionable error so deploy logs surface the problem
//     immediately — better a refusing-to-start container than a silently-
//     compromised one.
//   • Mirror the zod `string().min(32)` rule used by apps/api/src/config/env.ts
//     so both services have the same secret-strength contract.
// ──────────────────────────────────────────────────────────────────────
const resolveJwtAccessSecret = (): string => {
  const secret = process.env['JWT_ACCESS_SECRET'];
  if (!secret || secret.trim().length === 0) {
    throw new Error(
      'JWT_ACCESS_SECRET is not set. The webhooks process refuses to boot ' +
        'without a real JWT signing secret — a missing secret used to fall ' +
        'back to a hardcoded literal, which would let any reader of the ' +
        'source forge tokens. Set JWT_ACCESS_SECRET to a 32+ byte random ' +
        'string (e.g. `openssl rand -hex 32`) before starting.',
    );
  }
  if (secret.length < 32) {
    throw new Error(
      `JWT_ACCESS_SECRET is too short (${secret.length} chars). Must be ` +
        '32 or more characters to provide adequate signing strength. ' +
        'Regenerate with `openssl rand -hex 32`.',
    );
  }
  return secret;
};

const JWT_ACCESS_SECRET = resolveJwtAccessSecret();

@Injectable()
class WebhookPrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WebhookPrismaService.name);
  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma (webhooks) connected');
  }
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

@Module({
  imports: [
    LoggerModule.forRoot({ pinoHttp: { level: process.env['LOG_LEVEL'] ?? 'info' } }),
    AuthModule.forRoot({
      provider: 'local',
      isDevelopment: process.env['NODE_ENV'] !== 'production',
      prismaToken: WebhookPrismaService,
      // No Redis on the webhook process — sessions are not used here.
      redisToken: 'unused',
      config: {
        jwtIssuer: 'https://auth.eazepay.local',
        jwtAudience: 'eazepay-api',
        // SEC-010: validated at module import (see resolveJwtAccessSecret
        // above). No fallback — boot fails before this line if unset.
        jwtAccessSecret: JWT_ACCESS_SECRET,
        accessTokenTtlSeconds: 900,
        refreshTokenTtlSeconds: 86400 * 30,
      },
    }),
    ApplicationModule.forRoot({
      prismaToken: WebhookPrismaService,
      esignProvider: 'mock',
      isDevelopment: process.env['NODE_ENV'] !== 'production',
    }),
  ],
  controllers: [ESignWebhookController],
  providers: [WebhookPrismaService],
})
export class WebhooksAppModule {}
