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
startTracing({
  serviceName: env.OTEL_SERVICE_NAME,
  otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
  nodeEnv: env.NODE_ENV,
});

import type { NestFastifyApplication } from '@nestjs/platform-fastify';
const { NestFactory } = await import('@nestjs/core');
const { FastifyAdapter } = await import('@nestjs/platform-fastify');
const { DocumentBuilder, SwaggerModule } = await import('@nestjs/swagger');
const { ValidationPipe, Logger } = await import('@nestjs/common');
const { Logger: PinoLogger } = await import('nestjs-pino');
const { AppModule } = await import('./app/app.module.js');
// @fastify/helmet lives at the underlying Fastify instance, not Nest —
// dynamic import keeps the module graph aligned with the rest of this file.
const { default: helmet } = await import('@fastify/helmet');

const bootstrap = async (): Promise<void> => {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true, bodyLimit: 1024 * 1024 }),
    // rawBody: true gives webhook handlers access to req.rawBody for
    // HMAC signature verification (e-sign, lender, payment providers).
    { bufferLogs: true, rawBody: true },
  );

  app.useLogger(app.get(PinoLogger));

  // ────────────────────────────────────────────────────────────────────
  // Security headers (SEC-006). Registered BEFORE CORS / global pipes /
  // route handlers so every response — including 4xx/5xx from validation,
  // CORS rejections, and unhandled exceptions — carries the headers.
  //
  // Why each directive matters:
  //   • CSP defaultSrc 'self'      — denies inline + cross-origin script/style
  //                                  loads if a future XSS slips through;
  //                                  defence-in-depth on top of input sanitising.
  //   • styleSrc 'unsafe-inline'   — Swagger UI ships inline styles. We only
  //                                  mount Swagger when NODE_ENV !== production
  //                                  (see below), so prod still gets a tighter
  //                                  policy in practice. Loosening here only.
  //   • imgSrc data:               — Swagger UI + Nest icons use data: URIs.
  //   • frameAncestors 'none'      — clickjacking defence; superset of the
  //                                  legacy X-Frame-Options: DENY header.
  //   • HSTS 2y + preload          — once a browser sees this header, every
  //                                  future request is forced to HTTPS even
  //                                  before the user types https://. The
  //                                  64 800 000 s = 2y satisfies the HSTS
  //                                  preload-list requirement.
  //   • Helmet's defaults also set X-Content-Type-Options: nosniff,
  //     Referrer-Policy: no-referrer, Cross-Origin-Resource-Policy: same-origin,
  //     and X-DNS-Prefetch-Control: off — all desirable for an API surface.
  // ────────────────────────────────────────────────────────────────────
  // pnpm hoists multiple fastify versions (4.28 + 4.29) into the
  // workspace because @nestjs/platform-fastify and @fastify/helmet
  // request slightly different minors. Their FastifyInstance generics
  // are nominally identical but TypeScript treats them as distinct
  // types. The `as never` cast tells tsc to skip the cross-version
  // identity check at registration; the runtime plugin contract is
  // stable so behaviour is unaffected. Resolves cleanly once Nest
  // bumps its platform-fastify peer to the same fastify minor.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await app
    .getHttpAdapter()
    .getInstance()
    .register(helmet as never, {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          // swagger-ui injects inline styles; tolerated because Swagger is
          // dev-only here. Tighten if we ever mount Swagger in production.
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      hsts: {
        maxAge: 63072000, // 2 years (HSTS preload list requirement)
        includeSubDomains: true,
        preload: true,
      },
    });

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

  // SEC-046 — Swagger UI gating.
  //
  // Threat: every non-production environment used to mount `/docs` and
  // `/docs-json` openly. Staging hosts the full prod-shaped API
  // surface; "leaking the URL to a friend" effectively means handing
  // them a complete schema dump (every endpoint, every body shape,
  // every error code, every example). That's a recon goldmine for
  // shopping a credential or token: they can craft well-formed
  // requests on the first try.
  //
  // Fix: production keeps Swagger off entirely. Development keeps it
  // open (the value of a frictionless local dev loop outweighs the
  // risk on localhost). Staging requires HTTP basic-auth against
  // SWAGGER_DOCS_USER / SWAGGER_DOCS_PASS. If either env var is
  // missing in staging, we REFUSE to mount Swagger — failing closed
  // beats accidentally shipping an open docs page.
  if (env.NODE_ENV !== 'production') {
    const shouldGateBasicAuth = env.NODE_ENV === 'staging';
    const credsConfigured = !!env.SWAGGER_DOCS_USER && !!env.SWAGGER_DOCS_PASS;

    if (shouldGateBasicAuth && !credsConfigured) {
      Logger.warn(
        'Swagger UI not mounted — SWAGGER_DOCS_USER / SWAGGER_DOCS_PASS are required in staging. Set both to enable /docs and /docs-json.',
        'Bootstrap',
      );
    } else {
      if (shouldGateBasicAuth) {
        const expected = `Basic ${Buffer.from(
          `${env.SWAGGER_DOCS_USER}:${env.SWAGGER_DOCS_PASS}`,
        ).toString('base64')}`;
        // Register a hook on the Fastify instance: when the incoming
        // URL starts with /docs (covers /docs and /docs-json), require
        // a matching Authorization header. We pre-compute the expected
        // base64 string and constant-time compare (timingSafeEqual)
        // against the supplied header so a network-adjacent attacker
        // can't time-side-channel the password.
        await app
          .getHttpAdapter()
          .getInstance()
          .addHook('onRequest', async (req, reply) => {
            const url = req.url ?? '';
            if (!url.startsWith('/docs')) return;
            const auth = req.headers['authorization'] ?? '';
            const a = Buffer.from(typeof auth === 'string' ? auth : '');
            const b = Buffer.from(expected);
            // Length mismatch → fail closed. Don't do `a===b`.
            const { timingSafeEqual } = await import('node:crypto');
            const ok = a.length === b.length && timingSafeEqual(a, b);
            if (!ok) {
              void reply.code(401).header('WWW-Authenticate', 'Basic realm="EazePay docs"').send({
                type: 'about:blank',
                title: 'Unauthorized',
                status: 401,
                code: 'docs_auth_required',
              });
            }
          });
      }
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
