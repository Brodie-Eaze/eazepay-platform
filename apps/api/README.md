# @eazepay/api

EazePay public API + BFF (NestJS on Fastify).

## What it does

The single HTTP surface for every consumer-facing app, merchant
operator UI, admin console, and lender integration. It wires the
modular-monolith `@eazepay/service-*` packages together behind a
Fastify-on-NestJS adapter, exposes the public REST API under `/v1/*`,
serves the BFF endpoints that the Next.js frontends call, and bundles
inbound webhook handlers (Highsale, e-sign), Swagger docs, and the
health check.

## Stack

- NestJS 10 on Fastify (`@nestjs/platform-fastify`)
- Node 20+, ESM-only (`"type": "module"`)
- Port `3000` (configurable via `PORT`)
- Prisma 5 (Postgres) + ioredis (sessions / idempotency)
- Pino structured logs (`nestjs-pino`)
- OpenTelemetry auto-instrumentation (OTLP HTTP exporter)
- Swagger / OpenAPI at `/docs` (dev only)

## Run locally

```bash
pnpm --filter @eazepay/api dev
```

The app starts on `http://localhost:3000`. Swagger UI is at
`http://localhost:3000/docs`.

## Routes / surface

- `POST /v1/auth/*` — register, login, refresh, OTP
- `GET|POST /v1/applications/*` — application lifecycle (XState v5)
- `POST /v1/applications/:id/submit` — orchestration entrypoint
- `GET|POST /v1/merchants/*` — KYB, beneficial owners, application links
- `POST /v1/payment-methods/*` — bank account verification
- `GET /v1/loans/*` — disbursement, repayment schedule
- `GET|POST /v1/admin/*` — admin queue, decline override, PII unmask
- `POST /v1/webhooks/highsale` — Highsale inbound HMAC-verified ingest
- `POST /v1/webhooks/esign` — e-sign provider callbacks
- `GET /v1/dev-storage/*` — LocalFs presigned download served by API in dev
- `GET /v1/health/*` — liveness + readiness

## Environment

Copy `.env.example` (in repo root or each frontend) to `.env`. Key
vars validated by `src/config/env.ts` (Zod):

- `DATABASE_URL` — Postgres connection string
- `REDIS_URL` — Redis (sessions + idempotency)
- `JWT_ACCESS_SECRET` — 32+ char access-token secret
- `LOCAL_KEK_HEX` — 64 hex chars (PII envelope encryption KEK; dev only)
- `AUTH_PROVIDER` — `local` (default) or `cognito`
- `KYC_PROVIDER` / `KYB_PROVIDER` / `ESIGN_PROVIDER` /
  `PAYMENT_PROVIDER` / `BANK_ACCOUNT_PROVIDER` — `mock` or real adapter
- `CORS_ORIGINS` — comma-separated allowlist of exact origins
- `CORS_ORIGIN_PATTERNS` — regex allowlist (used for Lovable previews)
- `COLLECTION_CRON_ENABLED` / `WEBHOOK_DISPATCHER_ENABLED` /
  `AUDIT_DRAIN_ENABLED` — per-process cron flags (production: keep
  these `false` here, run them in `@eazepay/workers` instead)
- `HIGHSALE_WEBHOOK_SECRET` — HMAC shared secret (required outside dev)
- `OTEL_EXPORTER_OTLP_ENDPOINT` — OTLP traces sink

See `src/config/env.ts` for the complete authoritative schema.

## Testing

```bash
pnpm --filter @eazepay/api test
```

## Deploy

Production: ECS Fargate service behind an ALB. In production the cron
flags above are set `false` here; the `@eazepay/workers` process owns
all schedulers. Health check: `/v1/health`. Prisma migrations are
applied via `prisma migrate deploy` in the release pipeline.

## Related

- Consumes every `@eazepay/service-*` package from `services/`
- Used by `consumer-web`, `consumer-mobile`, `merchant-dashboard`,
  `admin-console`, `partner-portal`, `developer-portal`
- Talks to Postgres + Redis (`infra/terraform/modules/aurora`,
  `infra/terraform/modules/redis`)
