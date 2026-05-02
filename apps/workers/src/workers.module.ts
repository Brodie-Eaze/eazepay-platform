import { Module, Logger, type OnModuleDestroy, type OnModuleInit, Injectable } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import { PrismaClient } from '@prisma/client';
import { AuditModule } from '@eazepay/service-audit';
import { PaymentModule } from '@eazepay/service-payment';
import { WebhookModule } from '@eazepay/service-webhook';

/**
 * Standalone Prisma provider for the worker process. Single
 * connection pool, no HTTP listener, no Redis (the workers don't
 * touch the idempotency hot path; they just drain queues).
 */
@Injectable()
class WorkerPrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerPrismaService.name);
  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma (workers) connected');
  }
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: { level: process.env['LOG_LEVEL'] ?? 'info' },
    }),
    ScheduleModule.forRoot(),
    AuditModule.forRoot({
      prismaToken: WorkerPrismaService,
      sink: (process.env['AUDIT_SINK'] as 'local-fs' | 'dynamodb' | undefined) ?? 'local-fs',
      localFsRoot: process.env['AUDIT_LOCAL_FS_ROOT'] ?? './tmp/audit-sink',
      drainEnabled: true,
      isDevelopment: process.env['NODE_ENV'] !== 'production',
    }),
    WebhookModule.forRoot({
      prismaToken: WorkerPrismaService,
      dispatcherEnabled: true,
    }),
    PaymentModule.forRoot({
      prismaToken: WorkerPrismaService,
      provider: 'mock',
      bankAccountProvider: 'mock',
      collectionCronEnabled: true,
      isDevelopment: process.env['NODE_ENV'] !== 'production',
    }),
  ],
  providers: [WorkerPrismaService],
})
export class WorkersModule {}
