# @eazepay/workers

Standalone cron + queue worker process.

## What it does

Runs the scheduled background work that is too important — and too
chatty — to live in the API request path: the daily repayment
collection cron, the outbound merchant webhook dispatcher, and the
audit-outbox drain that pushes hash-chained records to the immutable
sink. No HTTP listener; this is a headless Nest
`createApplicationContext` lifecycle.

## Stack

- NestJS 10 (headless `createApplicationContext`)
- `@nestjs/schedule` cron triggers
- Node 20+, ESM-only
- No port — not an HTTP server
- Prisma 5 (single connection pool, no Redis)
- Pino structured logs

## Run locally

```bash
pnpm --filter @eazepay/workers dev
```

It starts immediately; watch the logs for `EazePay workers process
started — collection cron, webhook dispatcher, audit drain`.

## Routes / surface

Not an HTTP server. Schedulers exposed:

- `PaymentModule.collectionCron` — daily ACH/RTP draw against
  scheduled repayments
- `WebhookModule.dispatcher` — outbound merchant webhook delivery
  with exponential backoff
- `AuditModule.drain` — drain `AuditOutbox` rows to the immutable
  hash-chained sink (DynamoDB in prod, local-fs in dev)

## Environment

Copy `.env.example` to `.env`. Key vars:

- `DATABASE_URL` — Postgres connection string (required)
- `NODE_ENV` — `development` | `production`
- `LOG_LEVEL` — `info` (default), `debug`, `trace`, etc.
- `AUDIT_SINK` — `local-fs` (dev) or `dynamodb` (prod)
- `AUDIT_LOCAL_FS_ROOT` — directory when `AUDIT_SINK=local-fs`

All three internal schedulers run with `enabled: true` in this
process (that's the whole point of `workers`). In `apps/api`, the
matching `*_ENABLED` env flags should be `false` in production so
crons only fire here.

## Testing

```bash
pnpm --filter @eazepay/workers typecheck
```

(No vitest target yet; the schedulers are covered by tests inside
`@eazepay/service-payment`, `@eazepay/service-webhook`,
`@eazepay/service-audit`.)

## Deploy

Production: a separate ECS Fargate service with `desired_count=1`.
This guarantees each cron tick fires exactly once. Migration target
for HA: leader election via Postgres advisory locks or DynamoDB
conditional update, or EventBridge cron → SQS pattern.

## Related

- `@eazepay/service-payment` — collection cron source
- `@eazepay/service-webhook` — dispatcher source
- `@eazepay/service-audit` — drain source
- Shares the Postgres database with `apps/api`
