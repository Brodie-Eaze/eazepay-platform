import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { WorkersModule } from './workers.module.js';

/**
 * Standalone worker process.
 *
 * Runs ONLY the cron-driven schedulers — NOT an HTTP listener. Uses
 * NestFactory.createApplicationContext for the headless lifecycle.
 *
 * Production deployment:
 *   - One ECS service running this entrypoint with desired_count=1
 *     so the cron only fires once per cron tick.
 *   - In a multi-replica HA topology, the schedulers acquire a
 *     leader-election lock (Postgres advisory or DynamoDB
 *     conditional update). Today we rely on desired_count=1 +
 *     EventBridge cron → SQS as the production migration target.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkersModule, {
    bufferLogs: true,
  });
  Logger.log(
    'EazePay workers process started — collection cron, webhook dispatcher, audit drain',
    'Bootstrap',
  );

  const shutdown = async (signal: string): Promise<void> => {
    Logger.log(`Received ${signal}, shutting down`, 'Bootstrap');
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Workers bootstrap failed', err);
  process.exit(1);
});
