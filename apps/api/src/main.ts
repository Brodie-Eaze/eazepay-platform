import 'reflect-metadata';
import { config as loadDotenv } from 'dotenv';
loadDotenv();
import { loadEnv } from './config/env.js';
import { startTracing, stopTracing } from './observability/tracing.js';

// Fastify's default JSON serializer cannot encode BigInt. We encode as
// strings so callers always receive money columns as strings — matching
// the OpenAPI contract and avoiding precision loss across language
// boundaries that don't have BigInt.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

// Tracing must start before NestFactory so auto-instrumentation patches modules at import time.
const env = loadEnv();
startTracing(env.OTEL_SERVICE_NAME, env.OTEL_EXPORTER_OTLP_ENDPOINT);

import type { NestFastifyApplication } from '@nestjs/platform-fastify';
const { NestFactory } = await import('@nestjs/core');
const { FastifyAdapter } = await import('@nestjs/platform-fastify');
const { DocumentBuilder, SwaggerModule } = await import('@nestjs/swagger');
const { ValidationPipe, Logger } = await import('@nestjs/common');
const { Logger: PinoLogger } = await import('nestjs-pino');
const { AppModule } = await import('./app/app.module.js');

const bootstrap = async (): Promise<void> => {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true, bodyLimit: 1024 * 1024 }),
    // rawBody: true gives webhook handlers access to req.rawBody for
    // HMAC signature verification (e-sign, lender, payment providers).
    { bufferLogs: true, rawBody: true },
  );

  app.useLogger(app.get(PinoLogger));
  app.setGlobalPrefix('v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS allowlist = exact origins (CORS_ORIGINS) ∪ regex patterns
  // (CORS_ORIGIN_PATTERNS). The patterns let us approve every Lovable
  // preview without enumerating each commit hash. Same-origin and
  // missing-Origin requests fall through to allow (callback(null, true))
  // because Fastify's cors plugin already handles those defensively.
  const exact = new Set(env.CORS_ORIGINS);
  const patterns = env.CORS_ORIGIN_PATTERNS;
  app.enableCors({
    origin: (origin, cb): void => {
      if (!origin) {
        cb(null, true);
        return;
      }
      if (exact.has(origin)) {
        cb(null, true);
        return;
      }
      if (patterns.some((p) => p.test(origin))) {
        cb(null, true);
        return;
      }
      cb(new Error('cors_origin_not_allowed'), false);
    },
    credentials: true,
  });

  if (env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('EazePay API')
      .setDescription('Public + internal API surface for the EazePay platform')
      .setVersion('0.0.0')
      .addBearerAuth()
      .addApiKey({ type: 'apiKey', name: 'X-Api-Key', in: 'header' }, 'apiKey')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(env.PORT, '0.0.0.0');
  Logger.log(`EazePay API listening on :${env.PORT} (${env.NODE_ENV})`, 'Bootstrap');
};

const shutdown = async (signal: string): Promise<void> => {
  Logger.log(`Received ${signal}, shutting down`, 'Bootstrap');
  await stopTracing();
  process.exit(0);
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Bootstrap failed', err);
  process.exit(1);
});
