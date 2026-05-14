# EazePay

Embedded financial infrastructure that unifies payments and finance at
checkout. Consumer + merchant ecosystem with internal lender (BuzzPay,
by TrueTopia) wrapped behind a multi-lender orchestration layer.

**Status:** scaffold-grade backend + frontends + infra. Read
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the foundation
document this code implements.

## Topology

```
apps/
├── api                  Public + BFF (NestJS + Fastify, port 3000)
├── workers              Standalone crons (collection / webhooks / audit drain)
├── webhooks             Standalone inbound webhook receiver (port 3010, blast-radius isolation)
├── consumer-web         Next.js — hosted apply page, fallback web flow (3001)
├── consumer-mobile      React Native (Expo) — iOS + Android
├── merchant-dashboard   Next.js — merchant operator UI (3002)
├── admin-console        Next.js — internal ops + compliance (3003)
├── partner-portal       Next.js — landing pages + operator portal +
│                        brand-scoped merchant views (3004) — deployed
│                        to Railway, see RAILWAY_DEPLOY.md
└── developer-portal     Next.js — lender developer hub (3005)

services/                @eazepay/service-* packages, modular monolith
├── auth                 Cognito + custom session/device layer
├── user                 ConsumerProfile + PII vault (envelope encryption)
├── merchant             KYB + beneficial owners + application links
├── application          Lifecycle state machine (XState v5)
├── orchestration        Lender waterfall + decisioning + risk gate
├── lender               LenderAdapter port + BuzzPay + external mocks
├── payment              Disbursement + repayment + collection cron
├── notification         Multi-channel dispatch + in-app inbox
├── compliance-doc       Adverse Action Notice renderer + Document store
├── risk                 Composite risk scoring + RiskFlag taxonomy
├── audit                AuditOutbox drain → hash-chained immutable sink
├── webhook              Outbound merchant webhooks + dispatcher cron
├── admin                Admin queue + decline override + JIT PII unmask
├── analytics            Aggregations + reporting reads (placeholder)
├── compliance           FCRA/ECOA/TILA enforcement + audit (placeholder)
├── decision             Standalone decisioning engine (placeholder)
├── document             Generic document store / KYC artifacts (placeholder)
├── featureflag          Feature flag evaluation (placeholder)
└── integration          External system integration layer (placeholder)

libs/
├── shared-types         Money (BigInt cents), branded ids, Zod primitives
├── shared-utils         Problem (RFC 7807), AES-GCM + envelope encryption,
│                        ObjectStorage port + LocalFs adapter, hash helpers
├── ui                   Design tokens (light + dark) + web component lib
├── api-client           Framework-free fetch client for every frontend
├── feature-flags-sdk    Client-side flag hook (server in services/featureflag)
├── observability        Pino + OpenTelemetry setup helpers
└── testing              Shared test utilities + fixtures

infra/terraform/
├── modules              network / aurora / ecs-service / kms / s3-bucket /
│                        cloudfront-waf / redis
└── envs/{dev,staging,prod}

docs/
├── ARCHITECTURE.md      The CTO blueprint (US, ~1500 lines)
├── adr/                 Architecture decision records
└── runbooks/            local-development, incident-response, terraform-bootstrap
```

## Quick start for engineers

```bash
# 1. Install everything (pnpm workspaces).
pnpm install

# 2. Browse the deployed surface without any backend running.
pnpm --filter @eazepay/partner-portal dev
# → http://localhost:3004/landing/medpay
# → http://localhost:3004/landing/tradepay
# → http://localhost:3004/landing/coachpay
# → http://localhost:3004/sign-in
# → http://localhost:3004/   (master operator command centre)

# 3. Bring up the backend stack (Postgres + Redis via docker-compose).
docker compose up -d
pnpm --filter @eazepay/api prisma:migrate:dev
pnpm --filter @eazepay/api dev
# → http://localhost:3000        REST API
# → http://localhost:3000/docs   Swagger

# 4. Run the worker process if you want crons to fire locally.
pnpm --filter @eazepay/workers dev
```

Full local setup details + troubleshooting in
[`docs/runbooks/local-development.md`](docs/runbooks/local-development.md).

## Deployed environments

| Surface | Environment | URL |
|---|---|---|
| `partner-portal` | Railway production | https://eazepay-platform-production.up.railway.app |

See [`RAILWAY_DEPLOY.md`](RAILWAY_DEPLOY.md) for the deploy recipe,
env vars, and route-by-audience reference.

## What works

End-to-end in dev with mock providers wired:

- Register → KYC → Application → Submit
- Orchestration (decision + risk gate + lender waterfall)
- Offer ranking + acceptance + e-sign
- Disbursement + repayment scheduling + daily collection
- Admin queue + decline override (Reg B / FCRA reason codes,
  dual-control on amounts ≥ $25k)
- JIT PII unmask with second-admin approval + per-read audit
- Adverse Action Notice PDF with retention-tagged storage
- Outbound merchant webhooks (HMAC-shaped, retries with backoff)
- Audit drain to hash-chained immutable sink

## What's mocked / pending

- Real provider adapters (Cognito, Plaid, Alloy, Stripe / Modern
  Treasury, DocuSign, Twilio, SES, APNs/FCM, Sift, Middesk, bureau).
- Bank-partner contract (6–12 month critical path; not a code
  problem).
- Production AWS account + Terraform apply (modules ready, envs
  composed; bootstrap docs at `infra/runbooks/terraform-bootstrap.md`).
- App store submissions / NMLS licenses / SOC 2 audit.
- Production-grade UI design + copy.

## Contributing

PRs require:
- Test coverage on regulated state changes (state machine, risk
  decisions, money flows).
- An ADR for any new architecturally-load-bearing choice.
- An audit row written in the same TX as any regulated mutation.
- No raw money math in floats. `BigInt` cents, always.

License: proprietary; see `LICENSE`.
