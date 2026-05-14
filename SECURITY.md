# Security Policy

EazePay handles consumer non-public personal information (NPI) for credit
origination and servicing. This document explains how we protect that data,
how to report a vulnerability, and the controls our infrastructure inherits
from the same posture we use to satisfy our bank-partner audits and our
SOC 2 program.

## Reporting a vulnerability

**Email:** `security@eazepay.com` (or `security@eazepay.test` in non-prod).

For high-severity issues, encrypt with our PGP key (fingerprint listed at
[`https://eazepay.com/.well-known/security.txt`](https://eazepay.com/.well-known/security.txt)).
Please do not file public GitHub issues for security bugs — open a private
GitHub Security Advisory or use the contact above.

We acknowledge within **one business day** and provide a fix or mitigation
plan within **5 business days for critical / high** and **15 business days
for medium / low**. We publish post-mortems and CVE entries for any issue
that affected production data, on a 90-day disclosure clock.

A safe-harbor scope is published at `.well-known/security.txt`. Researchers
acting in good faith and within scope will not be subject to legal action.

## Supported versions

The `main` branch is the only supported version. Patch releases are cut
from `main` and tagged `vMAJOR.MINOR.PATCH`. We maintain a 90-day window
for in-place upgrades; older tags receive critical security backports
only.

## Threat model summary

Detailed model: [`docs/security/threat-model.md`](docs/security/threat-model.md).

| Asset class | Sensitivity | Primary control |
|---|---|---|
| Consumer NPI (SSN, DOB, address, financial accounts) | **Restricted** | Envelope encryption (KMS-wrapped data keys) + deterministic SIV for searchable fields + JIT unmask with dual control |
| Authentication credentials | **Restricted** | Argon2id at rest, never logged, rotated on suspect signals |
| Loan agreements, bureau reports, IDV images | **Restricted** | Object Lock + KMS + retention-tagged S3 |
| Decision artefacts (input snapshot + policy version) | **Confidential** | Hash-chained append-only audit log to S3 Object Lock + DynamoDB |
| Merchant / partner business data | **Confidential** | Tenant-scoped row filters; never cross-leaked in webhooks or BFF reads |
| Application telemetry (no PII) | **Internal** | OpenTelemetry → SIEM, PII redaction at the logger |
| Public marketing surfaces | **Public** | Standard web hygiene |

## Boundary security

- **Inbound TLS:** TLS 1.3 only on every public surface. HSTS preloaded.
- **Service-to-service:** mTLS inside the VPC. Cross-service tokens are
  short-lived (≤ 5 min) and audience-scoped.
- **Egress:** allowlist per service via VPC endpoints + egress NACLs.
  No service calls the public internet except integration adapters with
  named partner allowlists.
- **WAF:** AWS WAF managed-rule sets (core, Linux, SQLi, Bot Control) +
  custom rate limits per route class. Rules are versioned with code in
  [`infra/terraform/modules/waf`](infra/terraform/modules/waf).
- **Headers:** see
  [`apps/api/src/common/middleware/security-headers.middleware.ts`](apps/api/src/common/middleware/security-headers.middleware.ts).

## Data protection

- **Encryption in transit:** TLS 1.3 external, mTLS internal. Cipher
  suite allowlist defined in
  [`infra/terraform/modules/alb`](infra/terraform/modules/alb).
- **Encryption at rest:** every datastore is KMS-encrypted with a CMK
  scoped to the workload. Per-row data keys (DEKs) for NPI fields are
  wrapped by the workload KEK. Rotation is automatic for managed keys
  and quarterly for our CMKs.
- **PII vault:** [`services/user/src/internal/pii-vault.service.ts`](services/user/src/internal/pii-vault.service.ts).
  Envelope encryption with per-row AAD; AES-256-GCM; data keys generated
  via KMS GenerateDataKey and never written in plaintext.
- **Searchable PII:** deterministic AES-SIV (RFC 5297) with a per-tenant
  pepper, so we can look up by email / phone / EIN without leaking
  plaintext to the database engine. Plaintext lives in process memory
  for the duration of a single decrypt call only.
- **Tokenisation:** PAN never enters our perimeter; we collect cards via
  the processor's iframe / hosted-fields and store only a processor token
  on `PaymentMethod.tokenRef`.

## Access control

- **Authentication:** Cognito user pool for consumers + Okta SSO for the
  workforce. Hardware key (WebAuthn) required for admin roles. SMS as
  step-up only (not primary).
- **Authorisation:** RBAC + ABAC on every BFF route. The orchestration
  service, the lender adapters, and the audit drain run under separate
  IAM roles with explicit least-privilege policies.
- **Just-in-time PII unmask:** a second admin must approve, the grant
  expires in 30 minutes, every read is written to the audit log with the
  reason code and the inputs the reader saw. See
  [`docs/runbooks/pii-unmask.md`](docs/runbooks/pii-unmask.md).
- **Workforce access reviews:** quarterly for everyone, monthly for
  anyone with prod data access.

## Secrets management

- AWS Secrets Manager + Parameter Store. **No** secrets in environment
  variables in production; the API resolves on boot via IAM-scoped IRSA.
- Local dev secrets live in `.env.local` (gitignored) generated by
  [`docs/runbooks/local-development.md`](docs/runbooks/local-development.md).
- Rotation: DB credentials 30 days, API keys 90 days, KMS data keys
  hourly (per-row), webhook signing secrets on partner request.
- Pre-commit secret scan via Gitleaks (runs in CI and locally via
  Husky).

## Logging & audit

- Structured JSON via Pino with a deny-list redaction pipeline; see
  the `redact` block in
  [`apps/api/src/app/app.module.ts`](apps/api/src/app/app.module.ts).
- Application logs ship to the SIEM after the redactor; no NPI may leave
  the workload boundary in cleartext.
- Domain events that touch money, identity, or decisioning are written
  through the transactional outbox to a hash-chained immutable sink (S3
  Object Lock + DynamoDB stream, 7-year retention). The chain head is
  Merkle-rooted into our weekly evidence pack.
- CloudTrail in a dedicated audit account; write-once S3 bucket.

## Incident response

Runbook: [`docs/runbooks/incident-response.md`](docs/runbooks/incident-response.md).

Severity is set by impact (consumer NPI exposure, money movement, RTO
breach) and notification clocks are:

| Trigger | Audience | SLA |
|---|---|---|
| NPI confirmed exposed | Security officer + counsel + DPO | Immediate |
| > 500 consumers impacted | FTC under GLBA Safeguards | 30 days |
| NY consumer affected | NYDFS Part 500 | 72 hours |
| State-by-state notification | Per state AG matrix | Statutory minimum |
| Bank-partner notification | Per partner-bank agreement | Often 24 hours |
| Postmortem to leadership | Internal | 14 days |

## Vendor and supply-chain security

- Every third-party with NPI access has a signed DPA, current SOC 2
  Type II evidence, and an annual review.
- Container images are pinned by digest and scanned with Trivy in CI.
- Dependencies are reviewed via Dependabot, `pnpm audit` in CI, and
  GitHub Dependency Review on pull requests.
- We publish SBOMs (CycloneDX) for every release tag.

## Compliance posture

- **SOC 2 Type II** — controls mapped at
  [`docs/soc2/controls.md`](docs/soc2/controls.md), evidence repository
  in [`docs/soc2/`](docs/soc2/).
- **PCI DSS** — SAQ A by virtue of tokenising at the PSP boundary.
- **GLBA Safeguards Rule (2023)** — WISP signed by CISO; control map
  in [`docs/soc2/policies/`](docs/soc2/policies/).
- **NYDFS Part 500** — applies to consumers + partner banks resident in
  New York; controls aligned.
- **State privacy** — CCPA / CPRA + multi-state DSAR pipeline.
- **Bank-partner audit** — quarterly MIS pack delivered automatically;
  evidence build is [`docs/runbooks/bank-partner-evidence.md`](docs/runbooks/bank-partner-evidence.md).

## What we don't do

- We do not collect data we don't need. The data-minimisation guard in
  [`docs/policies/data-classification.md`](docs/policies/data-classification.md)
  is enforced at code review.
- We do not log NPI. The Pino redact list and the `MaskedField`
  component are the two seams; anything new touching NPI requires an
  ADR.
- We do not run our own crypto. Application-layer envelope encryption
  uses Node's `crypto` (a vetted primitive); we don't roll our own
  ciphers, KDFs, or HMAC schemes.
- We do not allow long-lived API credentials anywhere in production.
  Everything is IAM-role or short-lived JWT.

---

If you're a researcher or a partner-bank security team and need a
controls walkthrough, the contact is `security@eazepay.com`. We're happy
to share our SOC 2 report and threat model under NDA.
