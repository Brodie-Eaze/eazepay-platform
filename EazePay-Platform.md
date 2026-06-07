# EazePay Platform

**Project:** EazePay Platform — the standalone platform monorepo (this repo).
**What this file is:** the single source of project context for anyone (human or agent) working in this repo — high-signal overview, current state, conventions, and gotchas. For full product detail see [`EazePay-Platform-PRD.md`](./EazePay-Platform-PRD.md).

**Last updated:** June 2026 · **Owner:** Brodie · **Status:** Active — sprinting to first real consumer loan end-to-end (target end of July)

---

## 1. What EazePay is

EazePay is the **agentic financial infrastructure behind a family of vertical brands**. It is the orchestration layer — not the lender, not the card processor. It captures a customer, qualifies them on real financial data, and routes only pre-qualified applications to lenders, then settles funds merchant-direct.

**Verticals (brand wrappers over one rail):**

- **MedPay** — medical & elective care (regenerative, dental, med spa, derm, vision, fertility, cosmetic, vet). **Live / medical-led.**
- **TradePay** — home & trade services (roofing, HVAC, solar, remodel). Built.
- **CoachPay** — coaching & high-ticket programs. Built.
- **VetPay** — veterinary care. Built.

Same capture → qualify → route → marketplace → settle rail underneath all of them.

## 2. The rail (how it works)

```
Pixie (lead capture + smart routing; Meta/Google/Instagram + point of sale)
   → HighSale (soft-pull enrichment: credit, income, available credit, DTI; zero score impact)
   → Smart routing (high-ticket / low-ticket funnel, on the financial data)
   → Sales call (where it lifts conversion)
   → Finance application (complete, consented file)
   → Decision engine + Lender marketplace (ranked, parallel, FCRA/Reg B reason codes)
   → Merchant-direct payout (lender funds the business)
```

- **Pixie** = the intelligent lead-capture form (smart routing built in).
- **HighSale** = the soft-pull / financial-enrichment engine + agents.
- **MiCamp** = card processing (EazePay is a registered ISO) — a **separate rail** from the loan path.
- **Decision engine** = our own waterfall/propensity layer (the thing being built to beat Skeps). Reason codes are FCRA §615 / Reg B §1002.9 compliant.

## 3. Repo structure & stack

```
eazepay/
├── apps/
│   ├── api/              NestJS — core backend, all business logic
│   ├── checkout/         Next.js — public checkout widget + consumer apply flow
│   ├── merchant-portal/  Next.js — authenticated partner/merchant dashboard
│   ├── admin-portal/     Next.js — internal ops "command centre"
│   └── marketing/        Next.js — public marketing site
├── packages/
│   ├── database/         Prisma + PostgreSQL schema
│   ├── shared/           Zod schemas, shared types, state machines, compliance (reason codes)
│   ├── ui/               Shared React components (Shadcn/Radix)
│   └── intel-types/      Intelligence/enrichment types (productTypes placeholder lives here)
└── infrastructure/       Terraform (AWS modules) + Railway config
```

**Stack:** NestJS 10 · Next.js 14 (App Router) · PostgreSQL 16 (Prisma) · Redis 7 + BullMQ · Clerk (auth) · MiCamp (cards) · HighSale (soft-pull) · SendGrid · Twilio.

**Local dev ports:** API 3001 · merchant-portal 3002 · admin-portal 3003 · checkout 3004 · marketing 3005.

**Run:** `pnpm install` → `docker compose up` (Postgres+Redis) → `pnpm db:push` → `pnpm dev`. Monorepo is pnpm + Turborepo.

## 4. Hosting

- **Production today: Railway** (deploys from `origin/main` → `eazepay-platform-production.up.railway.app`).
- **AWS** Terraform is written (VPC/ECS/RDS/ElastiCache/ALB/CloudFront/WAF) but **AWS is a post-launch decision** — do not migrate before the first real loans are flowing.

## 5. Current launch focus (read before planning work)

Goal: **a real consumer completes a loan end-to-end on staging** — apply → soft-pull consent → intake → real offers → all offers shown → render loan doc → click confirm → lender funds the merchant. **No mocks on the lender path.** Plus: merchant logs in with real auth and onboards.

**Two tracks (do not whipsaw the team):**

- **Track A — revenue bridge (now):** fund real loans through the already-active aggregator (**Magwitch**) on the skinny consumer flow. Fastest path to revenue; de-risks lender delays. (Do **not** add a new Skeps integration to the critical path — Skeps is a competitor we're building to beat, and a new integration adds the delay we're trying to avoid.)
- **Track B — the moat (parallel):** **US Bank "Flex"** direct adapter + the bank's security/vendor review (the real long pole — start immediately) + the product-type abstraction. **Covered Care** and **CareCredit** added on the same adapter pattern as they clear.

**Scope discipline:** 1–2 lenders, no marketplace UI yet, no fancy routing, fill scaffolds / wire real providers into the ports, **feature-flag everything**. Parked adapters: ChargeAfter, CoverCare, EngineTech, Queen Street, Skeps. Deferred: KYB (Middesk), bank verification (Plaid), DocuSign (vendor), MiCamp in the loan path.

## 6. Conventions

- **Multi-tenant:** every merchant-scoped query filters by `organizationId`; portal routes go through the tenant guard. Never leak cross-tenant data.
- **Reason codes:** adverse-action reasons go through `apps/api/.../compliance/reason-code.service.ts` (bureau + lender code mapping, max 4 per Reg B). Don't hand-roll reason strings.
- **Feature flags:** new lender adapters / flows ship behind flags. Default off.
- **Audit log:** admin/state-changing actions must write to the audit trail (SOC 2 CC8.1).
- **Money:** amounts are stored in **cents** (integers). Idempotency keys on POST money/provisioning endpoints.
- **PII-first:** classify before write, encrypt sensitive fields (SSN/EIN/bank), tenant-scope, audit access. (Field-level encryption is still a gap — see below.)

## 7. Known gaps / gotchas (current truth, not aspiration)

- **Lender webhook signature verification is fail-OPEN** on the lender path (`return true`). Must be fail-closed per-lender (HMAC) **before any real loan** and for the US Bank security review.
- **Lender adapters** (US Bank/Flex, Magwitch, CareCredit as an adapter, etc.) are **not on `main`** — they live on the held decision-engine branch. Confirm the build base before pointing eng at it; merging it must not trigger a schema re-architecture.
- **Offer/quote object is installment-only** (`{ term, apr, monthly, tag? }`). **CareCredit is revolving / deferred-interest** — needs an additive `productType` discriminator (`installment | revolving_deferred_interest | bnpl`) with shape-specific fields. Backward-compatible, flagged; the one sanctioned schema change. Don't shoehorn CareCredit into installment (misleads consumer + breaks TILA/adverse-action correctness).
- **e-sign:** "render-PDF-then-confirm" still has to be **ESIGN/UETA valid** (e-consent, retainable record, attribution). Defer the DocuSign _vendor_, not e-sign compliance.
- **PII field-level encryption** marked in schema, **not yet implemented**.
- **Reporting** (`/reporting/*`) is merchant-scoped only — no platform-wide rollup, no ad-spend, no leads. The investor dashboard needs those added (see PRD).

## 8. Compliance posture

Not waiting on full SOC 2 Type 2. For US Bank: complete their **third-party/vendor security review + attestation** (the long pole) and bring everyone touching consumer data (Amala + Eaze) under written data-handling / access-control policies with a clear data-flow / who-touches-PII map. FCRA soft-pull, Reg B reason codes, and consent capture are in the rail; e-sign + webhook fail-closed + PII encryption are the open items before real money.

## 9. People

- **Brodie** — founder / product + build.
- **Sam** — product / planning.
- **Shawn, Brian** — engineering (pointed at the US Bank adapter + backend).
- **David** — needs an investor-facing metrics dashboard (revenue, ad spend, leads, sales, win/loss). Keep it off the lender critical path.

## 10. Pointers

- Full product spec: [`EazePay-Platform-PRD.md`](./EazePay-Platform-PRD.md) (v4.0).
- Lender presentation (for Covered Care): `~/eazepay-lender-deck/` → eazepay-lender-deck-production.up.railway.app.
- Current live financing stack: **HighSale + Magwitch** (active).
- In active conversation with: **US Bank** and **Covered Care** (lenders).
