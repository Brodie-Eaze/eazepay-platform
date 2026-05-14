# @eazepay/webhooks-app

Standalone inbound webhook receiver.

## What it does

A dedicated HTTP listener that accepts inbound webhooks from third
parties (e-sign providers, KYC vendors, lender adapters, payment
processors). Lives in its own process so a misbehaving partner
webhook — a hostile retry storm, a poisoned payload that crashes a
handler, an OOM — cannot take down customer-facing API traffic.
Per-route HMAC signature verification with raw-body access.

## Stack

- NestJS 10 on Fastify
- Node 20+, ESM-only
- Port `3010` (configurable via `PORT`)
- Prisma 5 (separate connection pool from `apps/api`)
- Pino structured logs
- `rawBody: true` so handlers can recompute HMAC over the exact bytes
  sent by the partner

## Run locally

```bash
pnpm --filter @eazepay/webhooks-app dev
```

The app starts on `http://localhost:3010`.

## Routes / surface

- `POST /v1/webhooks/esign` — e-sign provider callbacks (DocuSign /
  Dropbox Sign / mock); HMAC-verified
- (More partner-specific receivers added under
  `src/controllers/` as adapters land)

## Environment

Copy `.env.example` to `.env`. Key vars:

- `DATABASE_URL` — Postgres connection string (required)
- `JWT_ACCESS_SECRET` — at least 32 chars; used by the embedded
  `AuthModule` for signing internally-issued service tokens
- `NODE_ENV` — `development` | `production`
- `LOG_LEVEL` — pino log level
- `PORT` — defaults to `3010`

## Testing

```bash
pnpm --filter @eazepay/webhooks-app typecheck
```

(Behavior-level tests live in the matching service packages —
e.g. `@eazepay/service-application` for the e-sign callback flow.)

## Deploy

Production: separate ECS Fargate service behind its own ALB, tighter
rate limits and security-group rules so only the known partner CIDRs
(where available) can reach this listener. Health check `/v1/health`
(planned). Crash isolation is the whole reason this process exists —
keep it minimal.

## Related

- `@eazepay/service-application` — e-sign envelope completion handler
- `@eazepay/service-auth` — token verification for partner-issued
  service credentials
- Sibling deployment of `@eazepay/api`; shares the Postgres database
