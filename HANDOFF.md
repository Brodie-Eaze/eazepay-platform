# EazePay — Engineer Handoff

A 1-page orientation. Skim this first, then drop into
[`README.md`](README.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## What this is

EazePay is embedded financial infrastructure that unifies payments
and finance at checkout. A consumer + merchant ecosystem with an
internal lender (BuzzPay, by TrueTopia) wrapped behind a multi-lender
orchestration layer. Today's repo is scaffold-grade — end-to-end
flows work in dev with mock provider adapters; production wiring,
the bank-partner contract, and licenses are the remaining critical
path.

## Repo layout

| Top-level | What lives there |
|---|---|
| `apps/` | 9 user-facing or boundary processes (API, workers, webhooks receiver, 5 Next.js apps, 1 Expo app). Each has its own `README.md`. |
| `services/` | 19 `@eazepay/service-*` packages — modular-monolith business logic (auth, user, merchant, application, orchestration, lender, payment, notification, risk, audit, webhook, admin, compliance-doc, plus 6 placeholders). Each has its own `README.md`. |
| `libs/` | 7 shared packages: `shared-types`, `shared-utils`, `ui`, `api-client`, `feature-flags-sdk`, `observability`, `testing`. |
| `docs/` | `ARCHITECTURE.md` (the CTO blueprint, ~1500 lines), `bff-contract.md`, 18 ADRs, runbooks. |
| `infra/` | Terraform modules + per-env compositions for dev / staging / prod. |
| `tools/` | NX generators + repo scripts. |

It's an NX + pnpm workspaces monorepo. Node 20+, ESM-only,
TypeScript everywhere.

## Quick start

```bash
# 1. Install everything.
pnpm install

# 2. See the deployed surface with no backend dependency.
pnpm --filter @eazepay/partner-portal dev
# → http://localhost:3004/landing/medpay (and /tradepay, /coachpay)

# 3. Bring up the backend.
docker compose up -d                                   # Postgres + Redis
pnpm --filter @eazepay/api prisma:migrate:dev
pnpm --filter @eazepay/api dev                         # http://localhost:3000

# 4. Run cron workers locally.
pnpm --filter @eazepay/workers dev
```

Each frontend has an `.env.example` — copy to `.env.local` and point
`NEXT_PUBLIC_API_URL` at your local API.

## How to deploy

Today: **only `partner-portal` is deployed**, to Railway.

```bash
railway up                # build via root Dockerfile, deploy
railway logs --follow     # tail
railway domain            # provision public URL
```

Live at https://eazepay-platform-production.up.railway.app.
Full recipe in [`RAILWAY_DEPLOY.md`](RAILWAY_DEPLOY.md).

Production target for the rest: ECS Fargate (api, workers, webhooks)
+ Vercel (consumer-web, merchant-dashboard, admin-console,
developer-portal) + EAS Build (consumer-mobile). Terraform modules
in `infra/terraform/modules/` are ready; envs in
`infra/terraform/envs/` are composed but not applied.

## Where to find what — top 10 paths

1. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — the foundation
   document. Read this before changing anything load-bearing.
2. [`docs/adr/`](docs/adr/) — 17 decision records on why we chose
   modular-monolith, BigInt cents, immutable audit outbox, JIT PII
   unmask, RFC 7807 problem details, idempotency keys, fair-routing
   default, etc.
3. [`apps/api/src/main.ts`](apps/api/src/main.ts) — the API
   bootstrap; CORS, OpenAPI, tracing, BigInt JSON encoding.
4. [`apps/api/src/config/env.ts`](apps/api/src/config/env.ts) —
   the authoritative env schema (Zod). Single source of truth for
   every config knob the backend respects.
5. [`apps/api/src/app/app.module.ts`](apps/api/src/app/app.module.ts) —
   how all `@eazepay/service-*` modules get composed.
6. [`services/application/src/state-machine.ts`](services/application/src/state-machine.ts) —
   the application lifecycle (XState v5).
7. [`services/orchestration/src/orchestration.service.ts`](services/orchestration/src/orchestration.service.ts) —
   the decision + risk + lender waterfall.
8. [`apps/partner-portal/`](apps/partner-portal/) — the Railway-deployed
   app: landings + apply flows + operator portal in one Next.js
   service. See its README for the route conventions.
9. [`docs/runbooks/local-development.md`](docs/runbooks/local-development.md) —
   detailed local setup.
10. [`docs/runbooks/incident-response.md`](docs/runbooks/incident-response.md) —
    incident process.

## Open items / TODO list

Surfaced during the handoff sweep (cleanup of these is engineering's
call, not blocking handoff):

- `apps/api/src/health/health.controller.ts:16` — `TODO`: wire DB
  ping, Redis ping, downstream lender SLA snapshot into the health
  check.
- `apps/api/src/app/highsale-webhook.controller.ts:39` — `TODO`:
  graduate the inbound Highsale payload from a `payloadCiphertext`
  column to full `PiiVaultService` envelope encryption.
- `services/auth/src/auth.service.ts:53` — `TODO`: implement the
  re-send-OTP endpoint.
- `apps/consumer-mobile/src/screens/HomeScreen.tsx:30` — `TODO`:
  surface a proper error UX on the home screen.
- `apps/partner-portal/next.config.mjs` — `typescript.ignoreBuildErrors`
  and `eslint.ignoreDuringBuilds` are both `true`. Legacy errors in
  unrelated `/api` routes and the auth area need cleanup so this
  can flip back to `false`.

Sweep results (handoff QA):

- `Pixie` references: only inside `apps/partner-portal/components/VerticalLandingPage.tsx`
  (the back-card AI agent panel + the "Pixie pickup rate" metric).
  All other surfaces are clean.
- `EAZE Pay` / `Med Pay` / `Trade Pay` (with space): only in code
  comments and one historical icon docstring (`libs/ui/src/web/Icon.tsx`).
  No user-facing copy hits.
- `RTP` / `T+0` / `PCI SAQ` in `apps/partner-portal/app/landing/`: 0 hits.
- Stray `console.log` in production paths: 0. The four `console.error`
  hits are all in bootstrap entry-points (`apps/{api,workers,webhooks}/src/main.ts`
  and `apps/api/src/config/env.ts`), and are the intended fail-loud
  channel before pino is wired up. Leave them.

## Conventions worth knowing on day 1

- Money is always `BigInt` cents. No floats. Ever.
  ([`ADR-0012`](docs/adr/0012-money-as-bigint-cents.md))
- Every regulated mutation writes an audit row in the same TX.
  ([`ADR-0011`](docs/adr/0011-immutable-audit-via-outbox.md))
- Error responses follow RFC 7807 Problem Details.
  ([`ADR-0014`](docs/adr/0014-rfc-7807-problem-details.md))
- Write endpoints accept an idempotency key.
  ([`ADR-0015`](docs/adr/0015-idempotency-keys.md))
- PII is envelope-encrypted at rest, masked by default on read.
  ([`ADR-0016`](docs/adr/0016-pii-vault-envelope-encryption.md),
  [`ADR-0017`](docs/adr/0017-jit-pii-unmask.md))
- Architecturally load-bearing decisions need a new ADR.
