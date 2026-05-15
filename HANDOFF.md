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

| Top-level   | What lives there                                                                                                                                                                                                                                                             |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/`     | 7 boundary processes — `api` (NestJS BFF, :3000), `partner-portal` (Next.js, :3004, deployed to Railway), `consumer-web` (:3001), `merchant-dashboard` (:3002), `admin-console` (:3003), `consumer-mobile` (Expo), `webhooks` (NestJS, :3010). Each has its own `README.md`. |
| `services/` | 13 `@eazepay/service-*` packages — modular-monolith business logic: auth, user, merchant, application, orchestration, lender, payment, notification, compliance-doc, risk, audit, webhook, admin.                                                                            |
| `libs/`     | 4 shared packages: `shared-types` (Money/BigInt cents, branded IDs, `BRANDS`), `shared-utils` (Problem details, envelope encryption, idempotency), `api-client` (framework-free fetch + typed client), `ui` (tokens + Tailwind preset + web component lib).                  |
| `docs/`     | `ARCHITECTURE.md` (CTO blueprint, ~1300 lines), `INDEX.md` (docs navigation), `bff-contract.md`, 17 ADRs + template, runbooks (local-development, incident-response).                                                                                                        |
| `infra/`    | Terraform modules + per-env compositions for dev / staging / prod (composed, not applied — Railway is today's deploy target).                                                                                                                                                |
| `tools/`    | Nx generators + repo scripts (reserved).                                                                                                                                                                                                                                     |

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

- ~~`apps/api/src/health/health.controller.ts:16` — `TODO`: wire DB
  ping, Redis ping, downstream lender SLA snapshot into the health
  check.~~ — closed by the final-wave quality pass. `/v1/health/ready`
  now pings Postgres (`SELECT 1`) and Redis (`PING`) with a 2 s timeout
  each, returns 503 + per-dependency status on degradation, and
  documents the Railway healthcheck-path recommendation (flip to
  `/v1/health/ready` once the API service is stable in Railway).
- ~~`apps/api/src/app/highsale-webhook.controller.ts` — Highsale
  payload encrypted via `PiiVaultService.sealOpaque` with applicationId
  AAD~~ (closed by QW-4 in the production hardening sprint).
- ~~`services/auth/src/auth.service.ts:53` — `TODO`: implement the
  re-send-OTP endpoint.~~ — closed by the final-wave quality pass.
  `POST /auth/resend-otp` lives in `services/auth/src/auth.controller.ts`,
  burns the prior challenge id, mints a fresh code through the existing
  notification adapter, inherits the SEC-012 per-identifier rate-limit,
  and writes an `auth.otp.resent` audit row. Same `OTP_THROTTLE` profile
  as verify-otp (5/min/IP).
- ~~`apps/consumer-mobile/src/screens/HomeScreen.tsx:30` — `TODO`:
  surface a proper error UX on the home screen.~~ — closed by the
  final-wave quality pass. Inline error banner (dangerBg/dangerFg
  tokens) with title + detail + Retry button replaces the silent catch.
  Falls through to `ApiError.problem.title/detail` when the failure is
  a structured Problem Details response.
- ~~`apps/partner-portal/next.config.mjs` — `typescript.ignoreBuildErrors`
  was `true`~~ — flipped to `false` after the hardening sprint took
  the whole workspace to 0 TS errors. ESLint at build is now wired
  workspace-wide via root `.eslintrc.cjs` + `pnpm run lint:check`.

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

## Recent hardening (production-readiness sprint)

Security + scale work landed before this handoff. Treat the platform
as audit-ready, not just feature-complete.

- **Security fixes closed:** 9 P0 + 10 P1/P2. Full chain-of-custody in
  [`SECURITY_AUDIT.md`](SECURITY_AUDIT.md). Headline items: SEC-031
  prod e-sign mock refusal, SEC-034 timestamp replay window on inbound
  webhooks, SEC-041 `@fastify/middie` pinned via `pnpm.overrides`,
  SEC-046 Swagger basic-auth in staging, SEC-047 prod CORS lockdown
  with superRefine boot guard.
- **Scale fixes:** `CRON_LEADER` umbrella switch (single-replica leader
  election for all three crons), tiered NestJS throttler buckets,
  `Loan.offerId` unique index, GIN index on `audit_outbox.payload`,
  batched daily collection sweep (no full-table scan).
- **New lender adapters:** US Bank (personal loans, US), Engine.Tech
  (OAuth2 client-credentials, AU + US), Queen Street (AU, Ed25519
  webhook signing). All three honour the `LenderAdapter` port and ship
  with env vars wired in `apps/api/.env.example`.
- **Partner visibility + invites:** real-time partner deal feed,
  direct-invite-link flow (`/api/onboarding/invite`), consumer-invite
  routes per brand.
- **Consumer hardening:** FCRA permissible-purpose + Reg B adverse-
  action wiring tightened; soft-pull only on intake; AAN renderer
  retention-tagged.
- **Repo cleanup:** dead-code paths removed, barrel exports flattened
  across `@eazepay/service-*` packages, `.DS_Store` purged, gitignore
  refreshed.

## Deploy day-1 checklist

- Generate secrets: `openssl rand -hex 32` for `JWT_ACCESS_SECRET`,
  `LOCAL_KEK_HEX` (or wire KMS), `HIGHSALE_WEBHOOK_SECRET`, each
  lender adapter's `*_WEBHOOK_SECRET`, and `LOCAL_FS_STORAGE_SIGNING_SECRET`.
- Set `CRON_LEADER=true` on **exactly one** API replica; `false` on
  every other. See block-comment at the top of
  [`apps/api/src/config/env.ts`](apps/api/src/config/env.ts).
- Set `CORS_ALLOWED_ORIGINS` to the explicit prod allowlist (SEC-047
  refuses boot if empty in `NODE_ENV=production`).
- Set `ESIGN_PROVIDER` to `docusign` or `dropbox_sign` (SEC-031
  refuses boot if `mock` in production).
- Leave `WEBHOOK_REPLAY_WINDOW_ENFORCED=true` (default). Disable only
  during a short partner rollover window.
- Configure `SWAGGER_DOCS_USER` + `SWAGGER_DOCS_PASS` for staging.
  Production never mounts Swagger.
- Fill `US_BANK_*`, `ENGINE_TECH_*`, `QUEEN_STREET_*` live credentials.
- Run `pnpm --filter @eazepay/api prisma:migrate:deploy` before
  switching DNS to the new revision.
- Verify Aurora multi-AZ, KMS key rotation enabled, S3 bucket private
  - VPC endpoint, WAF rules attached.

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

## Engineer day-1 follow-ups

Genuine gaps the hardening sprint flagged but didn't close. None block
launch; all are worth a half-day each before SOC 2 Type II.

- ~~**ESLint flat-config across the workspace.**~~ Closed by the
  final-wave quality pass. Root `.eslintrc.cjs` (classic config — ESLint
  8.57 because Next.js 14 still depends on it) extends
  `eslint:recommended` + `@typescript-eslint/recommended` +
  `plugin:react-hooks/recommended` + `prettier`. Lenient first-install
  rules (most categories at `warn`, `react-hooks/rules-of-hooks` at
  `error`). Run with `pnpm run lint:check`. Baseline after install: 0
  errors, 217 warnings (108 consistent-type-imports, 91 no-unused-vars,
  16 no-explicit-any, 2 exhaustive-deps). `lint-staged` now ESLint-fixes
  every staged ts/tsx/js/jsx file pre-commit. Remaining day-2 work: enable
  `@typescript-eslint/no-floating-promises` (needs `parserOptions.project`
  — type-aware lint doubles lint time so we left it off); revisit when
  the warning backlog is cleared.
- **Deploy `apps/api` to its own Railway service.** Artifacts ready:
  [`Dockerfile.api`](Dockerfile.api), [`railway.api.toml`](railway.api.toml).
  Provision Postgres + Redis on the same Railway project (both have
  free dev tiers). Step-by-step in
  [`RAILWAY_DEPLOY.md`](RAILWAY_DEPLOY.md) under "Deploying the API".
- **Swap mock adapters for production.** `services/payment` (Modern
  Treasury / Stripe / partner bank), `services/user` (KMS KeyManager),
  `services/risk` (Sift / Castle / SEON), `services/notification`
  (Twilio + SES), `services/lender` (US Bank / Engine.Tech / Queen
  Street live credentials), `services/audit` (DynamoDB sink for
  immutable chain). Each adapter throws `not_implemented` at startup
  in non-development today; that's the integration checklist.
- **Step-up MFA for `/v1/me?reveal=full`.** Endpoint refuses with 403
  `step_up_required` today; wire it through `OtpService` with a new
  `purpose: 'reveal_profile'` and a 5-minute fresh-challenge window
  (SEC-023 follow-up in [`SECURITY_AUDIT.md`](SECURITY_AUDIT.md)).
- **TOTP enrolment + recovery codes.** OTP-via-SMS/email today;
  TOTP is the next MFA hardening tier
  ([`SOC2_EVIDENCE_MAP.md`](docs/SOC2_EVIDENCE_MAP.md) §6).
- **HIBP password check.** Add a `PwnedPasswordsAdapter` to
  `services/auth` that hashes locally and queries the k-anonymity
  API. Fail-open on outage but stamp `risk_signal=hibp_unchecked`.
- **DynamoDB audit sink.** Required before SOC 2 Type II so the
  hash-chained audit log is on infrastructure the operator's audit
  account cannot tamper. Local-fs sink ships today for dev.
- **Counsel review of `/legal/*` copy.** Already production-grade
  scaffold; insert state-specific add-ons for NY / CA / MA before
  enabling those markets.
