# Local Development

How to bring the full platform up on a single laptop.

## Prereqs

- Node 20 LTS (use the `.nvmrc`)
- pnpm 9
- Docker (for Postgres / Redis / Jaeger via `docker-compose.yml`)
- Optional: an Expo dev environment (Xcode for iOS sim, Android Studio
  for Android)

## First-time setup

```bash
pnpm install
docker compose up -d
cp apps/api/.env.example apps/api/.env

# generate the JWT signing secret + local KEK
openssl rand -hex 32 | xargs -I{} echo "JWT_ACCESS_SECRET={}" >> apps/api/.env
openssl rand -hex 32 | xargs -I{} echo "LOCAL_KEK_HEX={}" >> apps/api/.env

pnpm --filter @eazepay/api prisma:migrate:dev --name init
```

## Run

The platform runs as **three Node processes + three browser tabs +
optionally the iOS / Android sim**. In separate terminals:

```bash
# Backend API (port 3000)
pnpm --filter @eazepay/api dev

# Workers (cron drains for collection / webhook dispatch / audit)
pnpm --filter @eazepay/workers dev

# Inbound webhook receiver (port 3010)
pnpm --filter @eazepay/webhooks-app dev

# Three Next.js frontends
pnpm --filter @eazepay/consumer-web dev      # http://localhost:3001
pnpm --filter @eazepay/merchant-dashboard dev # http://localhost:3002
pnpm --filter @eazepay/admin-console dev      # http://localhost:3003

# React Native (in apps/consumer-mobile)
pnpm --filter @eazepay/consumer-mobile start
```

## Smoke test (hits the full happy path)

1. Open Swagger at <http://localhost:3000/docs>.
2. `POST /v1/auth/register` with email + password → check the API
   process logs for the OTP code (logged by the
   ConsoleNotificationAdapter in dev).
3. `POST /v1/auth/verify-otp` with the code → returns `accessToken`.
4. Set the bearer in Swagger's auth pane.
5. `PATCH /v1/me` with a profile body.
6. `POST /v1/me/kyc/start` — mock returns approved.
7. `POST /v1/applications` with `category=personal`,
   `requestedAmountCents="500000"`, `termMonths=24`.
8. `POST /v1/applications/:id/submit` — kicks orchestration.
9. Wait ~2s, `GET /v1/applications/:id/offers` — should return the
   ranked offer list.
10. `POST /v1/applications/:id/offers/:offerId/accept` — mock e-sign
    auto-signs; the disbursement cron in `apps/workers` runs the
    money out within a minute.
11. `GET /v1/loans/:loanId/repayments` — schedule should populate.

## Tests

```bash
pnpm test
# or per-project
pnpm --filter @eazepay/service-application test
```

## Troubleshooting

- **Migrations fail on first run** — make sure docker postgres is
  healthy: `docker compose ps`.
- **`Cannot find module '@eazepay/...'`** — run `pnpm install`. Nx
  + workspace symlinks handle the rest.
- **Mobile RN won't start** — Expo is finicky on first run; check
  `expo doctor` output.
