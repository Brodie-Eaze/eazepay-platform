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
├── webhooks             Standalone inbound webhook receiver (blast-radius isolation)
├── consumer-mobile      React Native (Expo) — iOS + Android
├── consumer-web         Next.js — hosted apply page, fallback web flow (3001)
├── merchant-dashboard   Next.js — merchant operator UI (3002)
└── admin-console        Next.js — internal ops + compliance (3003)

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
└── admin                Admin queue + decline override + JIT PII unmask

libs/
├── shared-types         Money (BigInt cents), branded ids, Zod primitives
├── shared-utils         Problem (RFC 7807), AES-GCM + envelope encryption,
│                        ObjectStorage port + LocalFs adapter, hash helpers
├── ui                   Design tokens (light + dark) + web component lib
└── api-client           Framework-free fetch client for every frontend

infra/terraform/
├── modules              network / aurora / ecs-service / kms / s3-bucket /
│                        cloudfront-waf / redis
└── envs/{dev,staging,prod}

docs/
├── ARCHITECTURE.md      The CTO blueprint (US, ~1500 lines)
├── adr/                 12 architecture decision records
└── runbooks/            local-development, incident-response, terraform-bootstrap
```

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

## Quick start

See [`docs/runbooks/local-development.md`](docs/runbooks/local-development.md).

## Contributing

PRs require:
- Test coverage on regulated state changes (state machine, risk
  decisions, money flows).
- An ADR for any new architecturally-load-bearing choice.
- An audit row written in the same TX as any regulated mutation.
- No raw money math in floats. `BigInt` cents, always.

License: proprietary; see `LICENSE`.
