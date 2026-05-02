import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from '@nestjs/common';
import { WebhooksAppModule } from './webhooks-app.module.js';

/**
 * Standalone inbound webhook receiver. Distinct from apps/api so a
 * misbehaving lender / KYC / e-sign webhook can't take down consumer
 * traffic. Per-route HMAC verification + raw-body access.
 *
 * Production deployment: separate ECS service behind its own ALB,
 * tighter rate limits, dedicated security group rules so only
 * partner IPs (where known) can reach it.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    WebhooksAppModule,
    new FastifyAdapter({ trustProxy: true, bodyLimit: 1024 * 1024 }),
    { rawBody: true, bufferLogs: true },
  );
  app.setGlobalPrefix('v1');
  await app.listen(Number(process.env['PORT'] ?? 3010), '0.0.0.0');
  Logger.log(`Inbound webhook receiver on :${process.env['PORT'] ?? 3010}`, 'Bootstrap');
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
