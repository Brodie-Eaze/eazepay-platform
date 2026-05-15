# EazePay

> Multi-vertical embedded financing marketplace. Three consumer-facing brand verticals (MedPay, TradePay, CoachPay) routed through a 52-lender parallel waterfall with a 7-agent decisioning layer. Bank-partner originated, FCRA / ECOA / TILA / Reg B + E compliant. US jurisdiction.

**Production:** https://eazepay-platform-production.up.railway.app
**Status:** Built. `partner-portal` is live on Railway. Backend is 13 modular-monolith services composed into `apps/api`. Mobile + secondary web apps are scaffolded and run locally.

**Stack:** TypeScript (ESM) · Node 20 · NestJS (BFF/API) · Next.js 14 App Router (web) · React Native + Expo (mobile) · Prisma + Postgres · Redis · BullMQ · Tailwind + `@eazepay/ui` · Nx + pnpm workspaces · Railway (today) · ECS Fargate + Vercel (target) · Terraform.

---

## Table of contents

1. [What this platform does](#what-this-platform-does)
2. [The three brand verticals](#the-three-brand-verticals)
3. [The agentic decisioning layer](#the-agentic-decisioning-layer)
4. [Topology](#topology)
5. [Quick start](#quick-start)
6. [What runs where](#what-runs-where)
7. [Deployment](#deployment)
8. [Documentation index](#documentation-index)
9. [Conventions](#conventions)
10. [Contributing](#contributing)
11. [License](#license)

---

## What this platform does

EazePay is an **embedded financing marketplace**. It is **not** a payment processor — there are no card rails, no MDR/interchange capture, no merchant acquiring. The product is a consumer financing application that is run across a curated network of lenders and disbursed direct from the chosen lender to the merchant the moment the consumer signs an e-contract.

Every application flows through a **52-lender parallel marketplace** — BuzzPay, FinWise, Cross River Bank, engine.tech, HSP Medical, Helia Medical, SageHeal, Orion Capital, Kestrel, Atlas Career Cap, ClearPath, Summit Premier, and a long tail of prime → near-prime → subprime partners. We make a real ranked offer back to the consumer in **under 10 seconds** using soft-pull credit (FCRA permissible purpose recorded). On acceptance + e-sign, the lender of record (a chartered bank under a bank-partner agreement) disburses funds direct to the merchant. EazePay does not hold the loan, does not service repayments, and does not carry routine-default risk; the bank-partner / lender does.

Three brand verticals — **MedPay, TradePay, CoachPay** — run on top of the same orchestration engine. Each brand has its own consumer landing page (`/landing/<brand>`), its own consumer apply flow (`/apply/<brand>`), and its own brand-scoped merchant portal (`/v/<brand>/...`), but they share the entire decisioning stack, the lender marketplace, and the operator command centre underneath. The data model carries `brand` as a first-class field on Merchant, LenderProduct, LenderConnection, and Application — every record is routable, attributable, and reportable per brand.

What makes the platform defensible is the **agentic decisioning layer** wrapped around the marketplace — seven named software agents that handle intake, enrichment, scoring, routing, lender selection, funding, and attribution. They are explicit, observable, and instrumented in the operator console (`/insights`, `/v/<brand>/insights`). The pattern is modelled on AUREAN AI's named-agent architecture: each agent is a black-box service with a clear contract, a measurable outcome, and a published last-action stream the operator can audit in real time. That makes the whole platform legible to a compliance officer, a CTO, and a merchant in the same view.

> US jurisdiction, bank-partner originated. Full regulatory + privacy posture (TILA / Reg Z, ECOA / Reg B, FCRA, GLBA, EFTA / Reg E, UDAAP, MLA, SCRA, BSA/USA PATRIOT, CCPA/CPRA + state patchwork) lives in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## The three brand verticals

| Brand | Who it's for | Ticket | Positioning | Example merchants |
|---|---|---|---|---|
| **MedPay** | Dental, medical, vet, fertility, cosmetic, med-spa | $1.5k – $50k | "Patient financing that closes the case on the consult chair." Soft-pull, branded apply, same-day approval, disbursement direct to the practice. | Atlas Dental Group, Lume Aesthetics, MetroFertility |
| **TradePay** | Roofing, HVAC, solar, home improvement, contractors | $3k – $150k | "Job financing for the trades. Sign in the truck, fund the bin in the driveway." Higher tickets, longer terms, larger lender pool. | Apex Roofing, HVAC Pro, SunPath Solar |
| **CoachPay** | High-ticket coaches, consultants, course creators, certifications, masterminds | $5k – $50k | "Student financing for premium programs. Lock the seat, fund the program, the coach gets paid up front." | Atlas Mastermind, Career Cap, Certify Pro |

All three verticals share:
- The same 7 agents (PRISM → ECHO).
- The same 52-lender marketplace.
- The same bank-partner originated structure.
- The same compliance posture (FCRA / ECOA / TILA / Reg B + E, soft pull only, Adverse Action Notices on decline).

What differs per brand: the landing-page copy, the consumer apply prompts, the merchant portal navigation, the lender mix (some lenders prefer one vertical), and the attribution weighting in ECHO.

---

## The agentic decisioning layer

Seven named agents stand between the consumer click and the lender disbursement. Each is a discrete service with a typed contract, a measurable outcome, an "ONLINE/DEGRADED/OFFLINE" health state, and a streaming last-action log surfaced in the operator console.

| # | Agent | Role | What it does |
|---|---|---|---|
| 01 | **PRISM** | Intake Agent | Watches every apply-form session. Reshapes question order based on partial answers, kills friction for high-intent applicants, adds verification steps when signal looks junky. Learns which sequences convert per traffic source. |
| 02 | **VEGA** | Enrichment Agent | Orchestrates 12 enrichment providers in parallel — identity, address, employment, income, bank, device. Picks the cheapest source likely to match, falls back automatically on failure, dedupes identity collisions across vendors. |
| 03 | **ORACLE** | Scoring Agent | Runs a calibrated propensity model trained on the merchant's closed-won outcomes. Retrains nightly on every disposition logged. Surfaces drift before it affects revenue. |
| 04 | **HELIX** | Routing Agent | Matches every qualified applicant to the right rep, not just the next available. Learns which reps close which tiers, is capacity-aware (vacation, lunch, underperformance), routes around bottlenecks without anyone asking. |
| 05 | **NEXUS** | Lender Marketplace Agent | Runs the 52-lender parallel waterfall, prime → subprime. Soft pull only. Learns which lenders approve which profiles, watches stip rates in real time, reroutes around lenders that tighten overnight. |
| 06 | **FLUX** | Funding Agent | Disbursement orchestration. Presents BNPL / POS finance / ACH / card options based on the lender's approval, retries failed payments intelligently, reconciles every settled cent back to the originating ad campaign. (Note: previously labelled "Payment Agent" — the platform does not process payments, FLUX orchestrates the lender → merchant funds path.) |
| 07 | **ECHO** | Attribution Agent | Closes the marketing loop. Holds pixel events until the applicant clears qualification, then fires weighted conversions back to Meta and Google via server-side CAPI. Uploads closed-won deals as offline conversions. Cleanest training signal an ad account will ever see. |

The agent layer is visible in three places:
- **Landing pages** — `app/landing/{medpay,tradepay,coachpay}/page.tsx` — public-facing marketing view of what each agent does, with live "last action" cards.
- **Operator insights** — `app/insights/page.tsx` and `app/v/[brand]/insights/page.tsx` — institutional decisioning dashboard with per-agent health, throughput, drift, and audit-grade history.
- **Service implementations** — split across `services/orchestration`, `services/risk`, `services/lender`, `services/payment`, `services/application`, with the operator surface served by the BFF in `apps/api`.

---

## Topology

```
EazePay App/
├── apps/                  7 boundary processes (5 Next.js + 1 Expo + 1 Node)
├── services/              13 modular-monolith service packages
├── libs/                  4 shared packages
├── docs/                  ARCHITECTURE.md + 17 ADRs + runbooks + BFF contract
├── infra/                 Terraform modules + per-env composition + runbooks
├── tools/                 Nx generators + repo scripts
├── Dockerfile             3-stage standalone build for the partner-portal
├── railway.toml           Railway deploy config (single service)
├── docker-compose.yml     Local Postgres + Redis
├── nx.json                Nx project graph config
├── pnpm-workspace.yaml    Workspace globs
├── tsconfig.base.json     Root TS config
└── README / HANDOFF / CONTRIBUTING / CHANGELOG / LICENSE / SECURITY / RAILWAY_DEPLOY
```

### `apps/` — 7 boundary processes

| App | Framework | Port | What it does |
|---|---|---|---|
| **`api`** | NestJS + Fastify | 3000 | Public REST API + BFF for every frontend. All backend logic is composed here from `@eazepay/service-*` modules. OpenAPI at `/docs`. |
| **`partner-portal`** | Next.js 14 (App Router) | 3004 | **The main deployed app.** Hosts the consumer-facing surfaces (brand landings, apply flows, lender hub) **and** the authenticated portals (master operator command centre, brand-scoped merchant portals). See URL taxonomy below. Deployed to Railway. |
| **`consumer-web`** | Next.js | 3001 | Standalone consumer apply experience. Functional sibling to `/apply/<brand>` inside partner-portal — less prominent today. |
| **`merchant-dashboard`** | Next.js | 3002 | Standalone merchant surface. Functional sibling to `/v/<brand>/...` inside partner-portal. |
| **`admin-console`** | Next.js | 3003 | Internal ops + compliance console. Underwriting queue, JIT PII unmask, Adverse Action review, compliance evidence. |
| **`consumer-mobile`** | React Native (Expo) | — | iOS + Android consumer app. EAS Build target; not yet submitted to stores. |
| **`webhooks`** | NestJS | 3010 | Inbound webhook receiver — kept as its own process for blast-radius isolation from the main API. |

### `partner-portal` URL taxonomy

```
PUBLIC (no auth)
  /landing/{medpay|tradepay|coachpay}   Brand-specific public marketing landings
  /apply/{brand}                        Branded consumer apply flow (signed ref token)
  /lenders                              Public lender developer hub
  /lenders/[id]                         Per-lender detail page
  /docs                                 API reference + curl examples
  /sign-in                              Auth (Master Account OR brand portal)
  /welcome                              New-merchant onboarding entry
  /onboarding/*                         Onboarding wizards

BRAND-SCOPED MERCHANT PORTAL (auth, scoped to one brand)
  /v/{brand}                            Brand dashboard (KPIs, recent activity)
  /v/{brand}/applications               Applications list (clickable rows)
  /v/{brand}/applications/[id]          Real-time deal detail (XState snapshot)
  /v/{brand}/insights                   Brand-scoped agentic insights
  /v/{brand}/settlements                Settlement / payout view (brand-scoped)
  /v/{brand}/transactions               Brand-scoped transaction history
  /v/{brand}/send-link                  Send a branded apply link
  /v/{brand}/submit                     Operator-assisted submit flow
  /v/{brand}/team                       Merchant team + RBAC
  /v/{brand}/settings                   Brand-scoped settings
  /v/{brand}/api-keys                   Publishable + secret keys
  /v/{brand}/integrations               Integration catalog

MASTER OPERATOR (auth, cross-brand)
  /                                     Master command centre (KPIs, today's funded volume)
  /insights                             Institutional decisioning dashboard (all 7 agents)
  /partners                             Partner directory
  /applications                         Applications by partner
  /lender-marketplace                   Lender registry + product config
  /lender-marketplace/access            Per-partner lender overrides
  /marketplaces                         Marketplace registry (brand × lender × product)
  /control-panel                        Partner management
  /onboarding-pipeline                  Master view of partners in onboarding
  /approvals                            Approval queue (dual-control on amounts ≥ $25k)
  /payouts                              Master payout view
  /reports                              Reporting + exports
  /events                               Event stream viewer
  /dead-letter                          Dead-letter queue (failed webhooks etc.)
  /webhooks                             Outbound webhook config + recent deliveries
  /admin                                Admin tools (impersonation, JIT PII unmask)
  /eaze-ai                              EAZE AI in-portal assistant
  /eaze-affiliate, /eaze-processing,
  /eaze-med-pay, /trade-pay, /coach-pay,
  /dialerpay, /ez-check                 Product/brand integration pages

PUBLIC API (Next.js route handlers)
  /api/v1/*                             Marketplace, lender, integration endpoints
```

### `services/` — 13 packages, modular monolith

Each service is a `@eazepay/service-*` NestJS module composed into `apps/api`. The boundary is enforced by Nx project graph, not by network calls — extraction to its own service is a deploy-time decision, not a code-time one ([ADR-0010](docs/adr/0010-modular-monolith-with-extraction-paths.md)).

| Service | What it owns |
|---|---|
| `auth` | Registration, login, OTP, sessions, MFA, device binding (Cognito + custom session/device layer) |
| `user` | ConsumerProfile + PII vault (envelope encryption via KMS-wrapped data keys) |
| `merchant` | KYB + beneficial owners + application links + brand membership |
| `application` | Application lifecycle state machine (XState v5) — `services/application/src/state-machine.ts` |
| `orchestration` | Lender waterfall + decisioning + risk gate. The brain. NEXUS lives here. |
| `lender` | LenderAdapter port + BuzzPay adapter + external lender mocks + registry |
| `payment` | Disbursement + repayment scheduling + daily collection cron. FLUX lives here. |
| `notification` | Multi-channel dispatch (push / email / SMS / in-app) + in-app inbox |
| `compliance-doc` | Adverse Action Notice renderer + Document store (retention-tagged) |
| `risk` | Composite risk scoring + RiskFlag taxonomy. Feeds ORACLE. |
| `audit` | AuditOutbox drain → hash-chained immutable sink ([ADR-0011](docs/adr/0011-immutable-audit-via-outbox.md)) |
| `webhook` | Outbound merchant webhooks + dispatcher cron + HMAC signing |
| `admin` | Admin queue + decline override (Reg B / FCRA reason codes) + JIT PII unmask |

### `libs/` — 4 shared packages

| Lib | What it ships |
|---|---|
| `shared-types` | `Money` (BigInt cents), branded IDs, Zod primitives, `BRANDS` registry — single source of truth for `BrandCode = 'tradepay' \| 'medpay' \| 'coachpay' \| 'direct'`. |
| `shared-utils` | RFC 7807 `Problem` details ([ADR-0014](docs/adr/0014-rfc-7807-problem-details.md)), AES-GCM + envelope encryption ([ADR-0016](docs/adr/0016-pii-vault-envelope-encryption.md)), `ObjectStorage` port + `LocalFs` adapter, hash helpers, ULID, idempotency decorator. |
| `api-client` | Framework-free `fetch` client + typed `EazePayApiClient` + `TokenStore` interface. Consumed by every frontend (mobile, web, partner-portal). |
| `ui` | Design tokens (light + dark) + Tailwind preset + web component library (`@eazepay/ui/web`) + RN bindings stubbed (`@eazepay/ui/native`). |

### `docs/`

| File | What it is |
|---|---|
| `ARCHITECTURE.md` | The CTO blueprint. ~1300 lines, US-spec, US-jurisdiction, written to survive scrutiny from a Series A CTO, a CFPB exam team, a bank-partner compliance officer, a state regulator, an external SOC 2 auditor, and a lender partner's risk team simultaneously. Read this before changing anything load-bearing. |
| `INDEX.md` | Navigation index for the whole `docs/` tree. |
| `bff-contract.md` | BFF / API contract between frontends and `apps/api`. |
| `adr/` | 17 architecture decision records + a template. Numbered, immutable once accepted. |
| `runbooks/` | Operational playbooks (local development, incident response). Infra-specific runbooks live in `infra/runbooks/`. |

### `infra/`

| Path | What's there |
|---|---|
| `terraform/modules/` | Reusable modules — network, aurora, ecs-service, kms, s3-bucket, cloudfront-waf, redis. |
| `terraform/envs/{dev,staging,prod}` | Per-env composition. Composed but not applied (no AWS account is owning the apply yet — Railway is today's deploy target). |
| `runbooks/` | Infra-specific runbooks (e.g. terraform-bootstrap). |
| `README.md` | Overview of the infra story (target architecture, what's modeled, what's pending). |

### `tools/`

| Path | What's there |
|---|---|
| `generators/` | Nx generators for new services / components (reserved — not populated yet). |
| `scripts/` | Repo maintenance scripts (reserved). |
| `README.md` | Overview of available tooling. |

### Root governance files

`README.md` (this file) · `HANDOFF.md` (1-page engineer orientation) · `CONTRIBUTING.md` · `CODE_OF_CONDUCT.md` · `CHANGELOG.md` · `LICENSE` (proprietary) · `SECURITY.md` (responsible disclosure + threat model) · `RAILWAY_DEPLOY.md` (full deploy recipe).

---

## Quick start

```bash
# 1. Install everything (pnpm workspaces, Node 20+, pnpm 9+)
pnpm install

# 2. Browse the deployed surface with no backend running.
pnpm --filter @eazepay/partner-portal dev
# → http://localhost:3004
# Landings:  /landing/medpay  /landing/tradepay  /landing/coachpay
# Apply:     /apply/medpay    /apply/tradepay    /apply/coachpay
# Operator:  /                /insights          /lender-marketplace
# Auth:      /sign-in

# 3. Bring up the backend stack.
docker compose up -d                          # Postgres + Redis
cp apps/api/.env.example apps/api/.env        # configure env
pnpm --filter @eazepay/api prisma:migrate:dev
pnpm --filter @eazepay/api dev                # http://localhost:3000, /docs Swagger

# 4. Inbound webhooks (optional, separate process for blast-radius isolation).
pnpm --filter @eazepay/webhooks dev           # http://localhost:3010
```

Each frontend has an `.env.example` — copy to `.env.local` and point `NEXT_PUBLIC_API_URL` at the running API.

Full local setup details + troubleshooting in [`docs/runbooks/local-development.md`](docs/runbooks/local-development.md).

---

## What runs where

| Surface | Local port | Production today |
|---|---|---|
| `partner-portal` | 3004 | **Live** at https://eazepay-platform-production.up.railway.app (Railway) |
| `api` | 3000 | Not deployed (target: ECS Fargate) |
| `webhooks` | 3010 | Not deployed (target: ECS Fargate, separate task) |
| `consumer-web` | 3001 | Not deployed (target: Vercel) |
| `merchant-dashboard` | 3002 | Not deployed (target: Vercel) |
| `admin-console` | 3003 | Not deployed (target: Vercel, separate auth domain) |
| `consumer-mobile` | — | Not submitted (target: App Store / Play Store via EAS Build) |

Today the **single deployed surface is `partner-portal`** — it hosts every public-facing route (landings, apply flows, lender hub, docs) **and** the authenticated portals (master operator, brand-scoped merchant views) on one Railway service.

---

## Deployment

### Today: Railway (partner-portal only)

```bash
railway up                # build via root Dockerfile, deploy
railway logs --follow     # tail
railway domain            # provision public URL
```

- Builder: repo-root `Dockerfile` — 3-stage standalone build (deps → builder → runner)
- Image size: ~150 MB (Next.js standalone output, not the 1GB+ pnpm store)
- Build time: typically 90–120 s
- Health check: `/sign-in` (200 once Next.js is ready)
- Restart policy: on-failure, 3 retries
- Env vars: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_BFF_ROOT`; `PORT` / `NODE_ENV` / `NEXT_TELEMETRY_DISABLED` auto-injected by Railway / Dockerfile

Full recipe in [`RAILWAY_DEPLOY.md`](RAILWAY_DEPLOY.md).

### Target: AWS via Terraform

- **`api`, `webhooks`** → ECS Fargate (private subnets, ALB-fronted, behind WAF)
- **`consumer-web`, `merchant-dashboard`, `admin-console`** → Vercel
- **`consumer-mobile`** → EAS Build → App Store + Play Store
- **Data plane** → Aurora PostgreSQL (multi-AZ, encrypted, KMS-wrapped data keys), ElastiCache Redis (private), S3 (private + VPC endpoint), KMS, Secrets Manager
- **Edge** → CloudFront + WAF (AWS Managed + custom rules)
- **Regions** → `us-east-1` primary, `us-west-2` warm-standby DR (Aurora Global Database)
- **Accounts** → AWS Organizations: `prod`, `staging`, `dev`, `sandbox`, `audit`, `security`, `shared-services`

Modules are in [`infra/terraform/modules/`](infra/terraform/modules/), per-env composition in [`infra/terraform/envs/`](infra/terraform/envs/). Not yet applied — Railway is today's deploy target. Bootstrap recipe in [`infra/runbooks/terraform-bootstrap.md`](infra/runbooks/terraform-bootstrap.md).

---

## Documentation index

| Doc | Why you'd read it |
|---|---|
| [`HANDOFF.md`](HANDOFF.md) | 1-page engineer orientation. Start here. |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | The CTO blueprint. The single source of truth for product vision, compliance posture, domain model, API spec, security model, observability, and roadmap. |
| [`docs/INDEX.md`](docs/INDEX.md) | Navigation index for the docs tree. |
| [`docs/adr/`](docs/adr/) | 17 architecture decision records. The "why" behind every load-bearing choice. |
| [`docs/bff-contract.md`](docs/bff-contract.md) | BFF / API contract between frontends and `apps/api`. |
| [`docs/runbooks/local-development.md`](docs/runbooks/local-development.md) | Detailed local setup + troubleshooting. |
| [`docs/runbooks/incident-response.md`](docs/runbooks/incident-response.md) | Incident process — triage, communicate, postmortem. |
| [`RAILWAY_DEPLOY.md`](RAILWAY_DEPLOY.md) | Full Railway deploy recipe (CLI setup, env vars, route-by-audience reference). |
| [`infra/README.md`](infra/README.md) | Terraform structure + target AWS topology. |
| [`SECURITY.md`](SECURITY.md) | Responsible disclosure + threat model. |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | PR requirements + ADR policy. |

---

## Conventions

Day-1 rules to internalise:

- **Money is always `BigInt` cents.** No floats. Ever. ([ADR-0012](docs/adr/0012-money-as-bigint-cents.md))
- **Every regulated mutation writes an audit row in the same TX.** ([ADR-0011](docs/adr/0011-immutable-audit-via-outbox.md))
- **Error responses follow RFC 7807 Problem Details.** ([ADR-0014](docs/adr/0014-rfc-7807-problem-details.md))
- **Write endpoints accept an idempotency key.** ([ADR-0015](docs/adr/0015-idempotency-keys.md))
- **PII is envelope-encrypted at rest, masked by default on read.** Unmask requires reason code + per-read audit. ([ADR-0016](docs/adr/0016-pii-vault-envelope-encryption.md), [ADR-0017](docs/adr/0017-jit-pii-unmask.md))
- **Lender routing default is fair, not revenue-optimal.** ECOA / UDAAP defensibility. ([ADR-0013](docs/adr/0013-fair-routing-default.md))
- **Soft delete only on regulated rows.** `status = 'archived'`, never `DELETE` (retention obligations).
- **Architecturally load-bearing decisions need a new ADR.** Numbered `NNNN-kebab-title.md`, accepted via PR.

---

## Contributing

PRs require:
- Test coverage on regulated state changes (state machine, risk decisions, money flows).
- An ADR for any new architecturally-load-bearing choice.
- An audit row written in the same TX as any regulated mutation.
- No raw money math in floats. `BigInt` cents, always.
- RFC 7807 errors on every public endpoint.
- Idempotency key on every write endpoint.

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the full policy.

---

## License

Proprietary. See [`LICENSE`](LICENSE).
