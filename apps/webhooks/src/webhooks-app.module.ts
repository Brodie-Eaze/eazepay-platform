import { Module, Logger, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { PrismaClient } from '@prisma/client';
import { AuthModule } from '@eazepay/service-auth';
import { ApplicationModule } from '@eazepay/service-application';
import { ESignWebhookController } from './controllers/esign-webhook.controller.js';

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
        jwtAccessSecret: process.env['JWT_ACCESS_SECRET'] ?? 'dev-secret-replace-me-32-bytes-aaa',
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
