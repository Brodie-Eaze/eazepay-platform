# docs/ — Navigation index

A map of everything in this directory. Read top-to-bottom for orientation; skip to the row you care about.

## Start here

| File | What it is |
|---|---|
| [`../README.md`](../README.md) | Repo root README — platform overview, topology, quick start, deployment. |
| [`../HANDOFF.md`](../HANDOFF.md) | 1-page engineer orientation. |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | **The CTO blueprint.** ~1300 lines, US-spec, US-jurisdiction. Single source of architectural truth for product vision, compliance posture, domain model, API spec, security model, observability, and roadmap. Read before changing anything load-bearing. |

## API contracts

| File | What it is |
|---|---|
| [`bff-contract.md`](bff-contract.md) | The contract between every frontend (mobile, web, partner-portal) and `apps/api`. Lives separately from the OpenAPI source so the BFF can evolve independently from the public API spec. |

## Architecture Decision Records

17 ADRs under [`adr/`](adr/). Each captures a single load-bearing decision (context, decision, alternatives, consequences, compliance notes). Numbered, immutable once accepted — supersede with a new ADR rather than editing an old one.

| # | Title | Status |
|---|---|---|
| [0000](adr/0000-template.md) | Template | — |
| [0001](adr/0001-monorepo.md) | Hybrid monorepo (Nx) + separate infra and design-system repos | Accepted |
| [0002](adr/0002-backend-nestjs.md) | NestJS (Node 20 LTS, TypeScript) for backend services | Accepted |
| [0003](adr/0003-mobile-react-native.md) | React Native + TypeScript for mobile | Accepted |
| [0004](adr/0004-aurora-postgres.md) | Aurora PostgreSQL 16 as primary OLTP | Accepted |
| [0005](adr/0005-auth-cognito.md) | AWS Cognito + custom session/device layer for consumer & merchant auth | Accepted |
| [0006](adr/0006-iac-terraform.md) | Terraform for infrastructure-as-code on AWS | Accepted |
| [0007](adr/0007-orchestration-hybrid.md) | Hybrid lender orchestration (parallel within tier, waterfall across) | Accepted |
| [0008](adr/0008-bank-partner-vs-state-licensed.md) | Lending model — bank-partner first, with state-licensed fallback | Proposed |
| [0009](adr/0009-ach-origination-path.md) | ACH origination via Modern Treasury (or partner-bank direct) | Proposed |
| [0010](adr/0010-modular-monolith-with-extraction-paths.md) | Modular monolith with explicit extraction paths | Accepted |
| [0011](adr/0011-immutable-audit-via-outbox.md) | Audit via transactional outbox + hash-chained sink | Accepted |
| [0012](adr/0012-money-as-bigint-cents.md) | Money is integer cents (BigInt), serialised as string-of-integer | Accepted |
| [0013](adr/0013-fair-routing-default.md) | Fair Routing as the Default Sort (ECOA / UDAAP defensibility) | Accepted |
| [0014](adr/0014-rfc-7807-problem-details.md) | RFC 7807 Problem Details for HTTP API Errors | Accepted |
| [0015](adr/0015-idempotency-keys.md) | Idempotency Keys on Every Write | Accepted |
| [0016](adr/0016-pii-vault-envelope-encryption.md) | PII Vault — Envelope Encryption with Per-Row Data Keys | Accepted |
| [0017](adr/0017-jit-pii-unmask.md) | Just-in-Time PII Unmask with Dual Control | Accepted |

See the full ADR index + write-up policy in [`adr/README.md`](adr/README.md).

## Runbooks

Operational playbooks. Read these on the way into an incident or a fresh-checkout setup.

| File | When to read |
|---|---|
| [`runbooks/local-development.md`](runbooks/local-development.md) | First time setting the repo up locally, or chasing a "works on my machine" issue. |
| [`runbooks/incident-response.md`](runbooks/incident-response.md) | The instant something looks like an incident. Severity, communication, postmortem. |
| [`../infra/runbooks/terraform-bootstrap.md`](../infra/runbooks/terraform-bootstrap.md) | Bootstrapping the AWS account + Terraform backend the first time. (Lives in `infra/runbooks/` because it's infra-specific.) |

## Governance

| File | What it is |
|---|---|
| [`../CONTRIBUTING.md`](../CONTRIBUTING.md) | PR requirements + ADR policy + commit message style. |
| [`../CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md) | Code of conduct. |
| [`../SECURITY.md`](../SECURITY.md) | Responsible disclosure + threat model. |
| [`../CHANGELOG.md`](../CHANGELOG.md) | Release history. |
| [`../LICENSE`](../LICENSE) | Proprietary licence. |
| [`../RAILWAY_DEPLOY.md`](../RAILWAY_DEPLOY.md) | Full Railway deploy recipe for the production `partner-portal` service. |

## Service & app docs

Every `apps/*` and `services/*` package has its own `README.md`. Find the one you care about under the relevant folder; the index for each is in the root README's topology section.

| Layer | Where |
|---|---|
| Apps | [`../apps/*/README.md`](../apps/) — 7 entries (api, partner-portal, consumer-web, merchant-dashboard, admin-console, consumer-mobile, webhooks) |
| Services | [`../services/*/README.md`](../services/) — 13 entries |
| Libs | [`../libs/*/README.md`](../libs/) — 4 entries |
| Infra | [`../infra/README.md`](../infra/README.md), [`../infra/runbooks/`](../infra/runbooks/) |
| Tools | [`../tools/README.md`](../tools/README.md) |
