# EazePay — Engineer Handoff

A 1-page orientation. Skim this first, then drop into
[`README.md`](README.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## What this is

EazePay is a **multi-vertical embedded financing marketplace** — not
a payment processor. Three consumer-facing brand verticals
(**MedPay** dental/medical/vet/cosmetic, **TradePay** roofing/HVAC/
solar/home-improvement, **CoachPay** high-ticket coaches/consultants/
course creators) route every application through a **52-lender
parallel waterfall** wrapped in a **7-agent decisioning layer**
(PRISM intake · VEGA enrichment · ORACLE scoring · HELIX routing ·
NEXUS lender marketplace · FLUX funding · ECHO attribution).
Bank-partner originated (Cross River / WebBank / Celtic / FinWise),
FCRA / ECOA / TILA / Reg B + E compliant, US-only. The bank/lender
disburses direct to the merchant on e-sign — EazePay does not hold
the loan, does not service repayments, does not carry routine-default
risk.

Today's status: **`apps/partner-portal` is live on Railway** at
https://eazepay-platform-production.up.railway.app — it hosts every
public-facing surface (landings, apply flows, lender hub, docs)
**and** the authenticated portals (master operator, brand-scoped
merchant views) on one Next.js service. The backend (13 service
modules in `services/`) is implemented and runs locally; ECS-Fargate
/ Vercel / EAS deploy is the target for the rest. Bank-partner
contract + state-license footprint remain the critical commercial
path, not a code problem.

## Repo layout

| Top-level | What lives there |
|---|---|
| `apps/` | 7 boundary processes — `api` (NestJS BFF, :3000), `partner-portal` (Next.js, :3004, deployed to Railway), `consumer-web` (:3001), `merchant-dashboard` (:3002), `admin-console` (:3003), `consumer-mobile` (Expo), `webhooks` (NestJS, :3010). Each has its own `README.md`. |
| `services/` | 13 `@eazepay/service-*` packages — modular-monolith business logic: auth, user, merchant, application, orchestration, lender, payment, notification, compliance-doc, risk, audit, webhook, admin. |
| `libs/` | 4 shared packages: `shared-types` (Money/BigInt cents, branded IDs, `BRANDS`), `shared-utils` (Problem details, envelope encryption, idempotency), `api-client` (framework-free fetch + typed client), `ui` (tokens + Tailwind preset + web component lib). |
| `docs/` | `ARCHITECTURE.md` (CTO blueprint, ~1300 lines), `INDEX.md` (docs navigation), `bff-contract.md`, 17 ADRs + template, runbooks (local-development, incident-response). |
| `infra/` | Terraform modules + per-env compositions for dev / staging / prod (composed, not applied — Railway is today's deploy target). |
| `tools/` | Nx generators + repo scripts (reserved). |

It's an Nx + pnpm workspaces monorepo. Node 20+, ESM-only,
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

# 4. Inbound webhooks (optional, separate process for blast-radius isolation).
pnpm --filter @eazepay/webhooks dev                    # http://localhost:3010
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

Production target for the rest: ECS Fargate (api, webhooks) +
Vercel (consumer-web, merchant-dashboard, admin-console) + EAS
Build (consumer-mobile). Terraform modules in `infra/terraform/modules/`
are ready; envs in `infra/terraform/envs/` are composed but not applied.

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
