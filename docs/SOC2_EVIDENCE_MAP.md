# SOC 2 evidence map - EazePay platform

> Purpose. This is the document the operator hands the SOC 2 auditor on
> day 1 of fieldwork. It maps each of the five Trust Service Criteria
> (TSC) to the concrete code paths that implement the relevant
> controls. Every row points at a file the auditor can open and read.
>
> Honesty principle. The final section ("Controls NOT yet implemented")
> lists controls the auditor will ask about that we have NOT yet
> shipped. We list them up front because auditors prefer honest gaps
> over hidden ones, and because reading this document does not depend
> on the auditor's good will.
>
> Last updated: 2026-05-15.
> Audit period: TBD - operator confirms with auditor on engagement.
> Trust Service Criteria evaluated: Security, Availability, Processing
> Integrity, Confidentiality, Privacy.

---

## 1. Security (Common Criteria - CC6, CC7, CC8)

The Security TSC covers logical access, system operations, change
management, and risk mitigation. Below are the implementing code paths.

| Control                                   | File path                                                                                                            | What it does                                                                                                                                                            |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JWT auth guard (mandatory on every route) | `services/auth/src/guards/jwt-auth.guard.ts`                                                                         | Rejects requests without a valid bearer token. Configured globally in `apps/api/src/app/app.module.ts` via `APP_GUARD`.                                                 |
| Session revocation check                  | `services/auth/src/internal/session.service.ts`                                                                      | Every authenticated request looks up `Session.revokedAt`; tokens for disabled / removed admins stop working immediately. SEC-009.                                       |
| Atomic session rotation                   | `services/auth/src/auth.service.ts` (refresh path)                                                                   | Refresh-token rotation runs inside a single Postgres transaction so a race cannot mint two valid access tokens from one refresh. SEC-011.                               |
| Global rate limiter                       | `apps/api/src/app/app.module.ts` (ThrottlerModule block)                                                             | Three tiers (5 req/s, 30 req/10s, 120 req/min) per IP. Backed by Redis so the limit is fleet-wide, not per replica.                                                     |
| Per-route rate limits                     | `@Throttle({ short, medium, long })` decorators on auth + OTP + webhook controllers                                  | Tighter caps on the surfaces an attacker is most likely to target.                                                                                                      |
| Security headers (helmet)                 | `apps/api/src/main.ts` (`app.register(helmet, { ... })`)                                                             | HSTS 2y + preload, CSP `default-src 'self'`, frame-ancestors `none`, nosniff, Referrer-Policy, X-DNS-Prefetch-Control: off. SEC-006.                                    |
| Security headers (partner-portal)         | `apps/partner-portal/next.config.mjs` (`headers()` block)                                                            | Same set of headers on every Next.js response. SEC-006.                                                                                                                 |
| CORS allowlist (no wildcards in prod)     | `apps/api/src/main.ts` (`enableCors` block)                                                                          | Exact origin set unioned with explicit regex patterns. Lovable wildcards removed for production. SEC-047.                                                               |
| Inbound webhook HMAC verification         | `services/webhook/src/webhook.service.ts`, `services/webhook/src/internal/webhook-signing.ts`                        | Every inbound webhook signature is HMAC-SHA256 verified against the per-source secret. Replay window enforced via timestamp + Redis seen-set. SEC-031.                  |
| Outbound webhook HMAC signing             | `services/webhook/src/internal/webhook-signing.ts`                                                                   | Outbound dispatches sign with the raw secret (envelope-decrypted at send time), not the secret hash. SEC-002.                                                           |
| SSRF blocklist (IPv4 + IPv6)              | `services/webhook/src/webhook.service.ts` (`isPrivateOrReservedHost`, lines around 55 and 112)                       | Blocks loopback, RFC1918, link-local (169.254.x - AWS / GCP metadata), IPv6 ULA (`fc00::/7`), IPv6 link-local (`fe80::/10`), and IPv4-mapped IPv6 equivalents. SEC-004. |
| PII vault (envelope encryption)           | `services/user/src/internal/pii-vault.service.ts`                                                                    | AES-256-GCM per-row data-encryption key, wrapped by a KEK from KeyManager. ADR-0016 records the design decision.                                                        |
| Audit chain (append-only, hash-linked)    | `services/audit/src/audit-drain.service.ts`, `services/audit/src/audit-payload.ts`                                   | Every state-changing action emits an audit row whose hash chains to the previous row. Tampering is detectable on replay.                                                |
| Idempotency interceptor (user-bound)      | `apps/api/src/common/interceptors/idempotency.interceptor.ts`                                                        | Idempotency keys are scoped to the authenticated user so one user cannot replay another user's mutation. SEC-014.                                                       |
| Open-redirect guard                       | `apps/partner-portal/middleware.ts` (`safeFrom`), `apps/partner-portal/app/(auth)/sign-in/page.tsx` (`safeRedirect`) | The `from=` query parameter on sign-in is normalised to a same-origin path before any `router.push`. SEC-008.                                                           |
| Stack trace redaction in prod             | `apps/api/src/common/filters/problem-exception.filter.ts`                                                            | Production responses ship a stable error code and short message - never the underlying stack. SEC-051.                                                                  |
| Swagger UI gated                          | `apps/api/src/main.ts` (Swagger gating block)                                                                        | Production refuses to mount `/docs`. Staging requires `SWAGGER_DOCS_USER` + `SWAGGER_DOCS_PASS` basic auth or refuses to mount. SEC-046.                                |

### References

- `docs/compliance/access-review.md` - quarterly logical-access review (CC6.2, CC6.3).
- `docs/compliance/change-management.md` - CI gates, deploy approval, emergency change (CC8.1).
- `docs/compliance/vendor-management.md` - sub-processor inventory + onboarding / termination (CC9.2).
- `docs/compliance/incident-response-drill.md` - tabletop drill template + worked example (CC7.4, CC7.5).
- `docs/runbooks/observability.md` - tracing backend wiring; trace signals feed CC7.1 monitoring evidence.

---

## 2. Availability (CC7.2, CC7.3, A1)

The Availability TSC covers system performance, capacity, and recovery.

| Control                                  | File path                                                                                                 | What it does                                                                                                                                      |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Liveness + readiness health check        | `apps/api/src/health/health.controller.ts`                                                                | `GET /v1/health/live` and `GET /v1/health/ready` return JSON status. Railway uses readiness as its restart trigger.                               |
| Cron leader election                     | `apps/api/src/app/app.module.ts` (`CRON_LEADER` env wired into AuditModule, WebhookModule, PaymentModule) | Exactly one replica runs scheduled jobs; the others stay stateless API workers. Prevents duplicate dispatches under horizontal scale.             |
| Webhook circuit breaker                  | `services/webhook/src/internal/dispatcher.service.ts` (lines around 133, 263)                             | After N consecutive failures the endpoint is auto-paused with `reason: 'consecutive_failures'`, freeing the dispatcher to deliver healthy queues. |
| Retry-with-backoff for outbound webhooks | `services/webhook/src/internal/dispatcher.service.ts`                                                     | Exponential backoff capped to a maximum delay; idempotent receivers can safely re-process.                                                        |
| Database connection-pool guards          | `apps/api/src/prisma/prisma.service.ts`                                                                   | Prisma client respects `DATABASE_CONNECTION_LIMIT`; pool exhaustion fails fast rather than queuing indefinitely.                                  |
| Trust proxy + request body limit         | `apps/api/src/main.ts` (`new FastifyAdapter({ trustProxy: true, bodyLimit: 1024 * 1024 })`)               | 1 MB request cap stops body-bomb DoS; trust proxy lets the rate limiter see the real client IP behind Railway's edge.                             |

### References

- `docs/SLO.md` - five SLOs with error budgets, measurement windows, and breach actions (A1.1).
- `docs/compliance/business-continuity.md` - RTO/RPO targets, backup procedure, quarterly restore drill, failover plan (A1.2, A1.3).
- `docs/runbooks/incident-response.md` - severity matrix and playbooks (CC7.4).
- `docs/runbooks/observability.md` - tracing + log signals used to detect availability incidents.

---

## 3. Processing Integrity (PI1)

The Processing Integrity TSC covers complete, valid, accurate, timely,
and authorised processing.

| Control                                               | File path                                                                                                       | What it does                                                                                                                                                                                                 |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Idempotency on every mutating route                   | `apps/api/src/common/interceptors/idempotency.interceptor.ts`                                                   | Stores `Idempotency-Key` → response hash for a TTL window. Duplicate keys return the original response so retries cannot double-process.                                                                     |
| Loan.offerId unique constraint                        | `apps/api/prisma/schema.prisma` (line ~567 `offerId String @unique`)                                            | Database-level guarantee that one offer can only fund one loan. The application catches Prisma `P2002` and translates to a typed conflict response.                                                          |
| Loan-disbursement.offerId unique constraint           | `apps/api/prisma/schema.prisma` (line ~586)                                                                     | Same protection for the disbursement entity - one loan, one disbursement record.                                                                                                                             |
| Audit outbox + hash chain                             | `services/audit/src/audit-drain.service.ts`                                                                     | All state-changing actions are written first to an audit outbox row; the drain worker hashes each row to the previous one before shipping to the long-term sink. A missing or tampered row breaks the chain. |
| Server-side schema validation (Zod + class-validator) | `apps/api/src/main.ts` (`new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`) | Unknown body fields are rejected before reaching the handler - prevents mass assignment and stops malformed requests from being silently accepted.                                                           |
| Money serialisation as strings                        | `apps/api/src/main.ts` (top - BigInt `toJSON` patch)                                                            | All cents columns ship over the wire as strings, avoiding JavaScript number-precision loss for amounts above 2^53.                                                                                           |

### References

- `docs/compliance/change-management.md` - CI gates + peer review keep processing logic from regressing (PI1.4).
- `docs/SLO.md` - latency SLOs for `/v1/applications/submit` and admin audit-log reads (PI1.5).

---

## 4. Confidentiality (C1)

The Confidentiality TSC covers protection of information designated as
confidential - PII, financial, and operational.

| Control                                   | File path                                                                                                      | What it does                                                                                                                                                                 |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Envelope encryption for PII columns       | `services/user/src/internal/pii-vault.service.ts`                                                              | Each PII column (SSN, DOB, full bank account number) is encrypted with a per-row AES-256-GCM key. The DEK is wrapped by the KEK from KeyManager.                             |
| Per-row AAD discriminator                 | `services/user/src/internal/pii-vault.service.ts` (encrypt / decrypt paths)                                    | Additional Authenticated Data binds the ciphertext to the row's primary key - copy-pasting ciphertext to a different row fails MAC verification.                             |
| KeyManager abstraction                    | `services/user/src/ports/key-manager.port.ts` + `services/user/src/adapters/local-key-manager.adapter.ts`      | Production swaps the local-KEK adapter for AWS KMS without touching the vault. ADR-0016 captures the design.                                                                 |
| Masked `/me` response                     | `services/user/src/user.service.ts` (`getMaskedSelf` / equivalent)                                             | The default user-self endpoint masks SSN to last 4, DOB to year, and the bank account to last 4. JIT unmask is a separate dual-control flow.                                 |
| JIT unmask with dual control              | `services/admin/src/admin.service.ts` + `services/admin/src/interceptors/audited-read.interceptor.ts`          | Unmask requires a second admin's approval, expires in minutes, and writes an audit row before any plaintext is returned.                                                     |
| Redacted logger config                    | `apps/api/src/app/app.module.ts` (LoggerModule `redact` block)                                                 | Pino redacts `authorization`, `cookie`, `x-api-key`, and explicit PII paths (`*.password`, `*.ssn`, `*.dob`, `*.cardNumber`, `*.cvv`, `*.routingNumber`, `*.accountNumber`). |
| OTP code masked in logs                   | `services/notification/src/internal/` (console adapter)                                                        | OTP codes are replaced with `***` in log output. SEC-022.                                                                                                                    |
| Outbound webhook secret encrypted at rest | `services/lender/src/internal/credential-vault.service.ts`, `services/webhook/src/internal/webhook-signing.ts` | Webhook secrets are PII-vault encrypted in the database and only decrypted at the moment of signing.                                                                         |

### References

- `docs/compliance/data-classification.md` - every field family classified with encryption-at-rest, access tier (C1.1, C1.2).
- `docs/compliance/access-review.md` - quarterly review of PII-reveal permission grants.
- `docs/compliance/vendor-management.md` - vendor classification by data sensitivity.

---

## 5. Privacy (P1 - P8)

The Privacy TSC covers collection, use, retention, disclosure, and
disposal of personal information.

| Control                                     | File path                                                                                                                 | What it does                                                                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| FCRA consent capture (consumer)             | `apps/consumer-web/lib/consent.ts`                                                                                        | Captures consumer consent for the soft pull and (separately) the hard pull. Stores consent text version + timestamp + IP.                           |
| FCRA consent capture (partner-portal apply) | `apps/partner-portal/lib/consumer-consent.ts`, `apps/partner-portal/app/api/applications/consent/route.ts`                | Same consent shape, captured before any credit pull is requested.                                                                                   |
| Adverse Action Notice rendering             | `services/compliance-doc/src/render/adverse-action-pdf.ts`, `services/compliance-doc/src/notices/adverse-action.types.ts` | Generates the FCRA Section 615 AAN PDF on every decline. Includes principal decline reasons, FCRA rights notice, consumer-reporting agency contact. |
| Compliance-doc service                      | `services/compliance-doc/src/compliance-doc.service.ts`                                                                   | Centralised renderer for AAN + Truth-in-Lending. Documents are stored under an applicant-scoped object-storage prefix with signed-URL access.       |
| Masked PII display                          | `services/user/src/user.service.ts` (masked DTO mapping)                                                                  | Default UI responses ship masked values. Plaintext requires a separate unmask flow with audit logging.                                              |
| Retention: 7-year FCRA hold                 | `services/compliance-doc/` + database soft-delete column                                                                  | Document retention is enforced at the storage layer (lifecycle rules) and at the database layer (soft-delete restoration window).                   |
| Retention: 25-month declined applications   | `services/application/` + scheduled purge job (cron-leader gated)                                                         | Declined applications with no litigation hold are purged at 25 months per AAN requirement.                                                          |
| Audit trail of every PII read               | `services/admin/src/interceptors/audited-read.interceptor.ts`                                                             | Every PII read by an operator is logged with actor, target, timestamp, IP. Visible at the `/audit` operator surface.                                |

### References

- `docs/compliance/data-classification.md` - retention schedules per field family (P4, P5).
- `docs/compliance/incident-response-drill.md` - FCRA 30-day breach notification cadence (P6).
- `docs/compliance/business-continuity.md` - 7-year FCRA hold + 25-month declined application purge enforcement (P4).
- `docs/compliance/vendor-management.md` - sub-processor disclosure inputs for `/legal/privacy` (P3).

---

## 6. Controls NOT yet implemented

These are controls an SOC 2 auditor will reasonably ask about that the
platform has NOT yet implemented. Listed honestly so the operator can
either complete them before the audit window opens or scope them out of
the engagement.

| Gap                                                      | Why it matters                                                                                                                                                                                                                           | Remediation owner                                                                                           |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Production KMS KeyManager adapter                        | `services/user/src/adapters/local-key-manager.adapter.ts` is the only registered KeyManager. Production needs AWS KMS (or equivalent) so the KEK is never on a node disk. ADR-0016 documents the swap point.                             | Engineering - requires an AWS account + IAM policy for the KMS key.                                         |
| DynamoDB audit sink (production)                         | `services/audit/src/adapters/local-fs-audit-sink.adapter.ts` is the only registered sink. Production needs cross-account DynamoDB so audit rows survive node loss and operator tampering. SEC-039.                                       | Engineering - requires AWS account + cross-account IAM role.                                                |
| TOTP enrolment + recovery codes                          | SMS/email OTP only. SOC 2 reviewers expect at least optional TOTP for elevated operator accounts. SEC-016.                                                                                                                               | Engineering - wire `services/auth` to a TOTP library and add the enrolment screen in `apps/partner-portal`. |
| HIBP (Have I Been Pwned) password check                  | `services/auth` enforces complexity but does not block known-breached passwords. SEC-015.                                                                                                                                                | Engineering - k-anonymity HIBP API call on every set-password.                                              |
| Step-up MFA for `/me` reveal                             | JIT unmask requires dual-control but does not currently require a fresh second factor from the requesting operator.                                                                                                                      | Engineering - reuse the OTP service for a step-up challenge before unmask.                                  |
| ~~Vendor SOC 2 attestation collection~~                  | ~~Sub-processor list exists at `/legal/privacy`; signed DPA + SOC 2 reports are not yet stored in a versioned vault.~~ Closed 2026-05-15 by `docs/compliance/vendor-management.md`. Versioned in git; quarterly review cadence captured. | Operator + Engineering - establish the vendor evidence vault before the audit window.                       |
| Background-check evidence for engineers with prod access | SOC 2 expects evidence of hiring controls for anyone with production access.                                                                                                                                                             | Operator (HR / People) - out of scope of the platform code.                                                 |
| ~~Disaster-recovery runbook + tested restore~~           | ~~`docs/runbooks/` contains operational runbooks but no tested DR cycle is recorded.~~ Closed 2026-05-15 by `docs/compliance/business-continuity.md` (RTO/RPO + quarterly drill cadence). First drill scheduled per the doc's cadence.   | Engineering - quarterly restore drill, documented in `docs/runbooks/`.                                      |
| ~~Quarterly access review~~                              | Closed 2026-05-15 by `docs/compliance/access-review.md`. Quarterly cadence + revoke SLA defined.                                                                                                                                         | CCO - first review captured per the doc's cadence.                                                          |
| ~~Change-management policy~~                             | Closed 2026-05-15 by `docs/compliance/change-management.md`. CI gates + deploy approval + emergency-change protocol documented.                                                                                                          | Engineering.                                                                                                |
| ~~Data classification matrix~~                           | Closed 2026-05-15 by `docs/compliance/data-classification.md`. Every field family classified with retention + encryption + access tier.                                                                                                  | Engineering + CCO.                                                                                          |
| ~~Incident-response tabletop drill~~                     | Closed 2026-05-15 by `docs/compliance/incident-response-drill.md` (template + worked example; 90-day cadence).                                                                                                                           | CCO + IC pool.                                                                                              |
| ~~SLO definitions~~                                      | Closed 2026-05-15 by `docs/SLO.md`. 5 SLOs with measurement, budget, action-when-breached, owner.                                                                                                                                        | Engineering lead.                                                                                           |
| ~~Tracing / observability backend~~                      | Closed 2026-05-15 by `docs/runbooks/observability.md` (OTEL config + 3 backend options) and the new `OTEL_*` env vars in `apps/api/.env.example`. Code-side wiring lives in `apps/api/src/tracing.ts`.                                   | Engineering.                                                                                                |

---

## 7. Reading order for an auditor

1. This document (`docs/SOC2_EVIDENCE_MAP.md`) - start here.
2. `SECURITY.md` - top-level security posture.
3. `SECURITY_AUDIT.md` - 2026-05-15 adversarial audit, referenced by SEC-XXX IDs throughout.
4. `docs/PEN_TEST_READINESS.md` - pen-test prep checklist with current implementation status.
5. `docs/SLO.md` - operational SLOs with error budgets.
6. `docs/compliance/` - operational policy docs (vendor management, data classification, change management, access review, incident-response drill, business continuity).
7. `docs/adr/0016-pii-vault-envelope-encryption.md` - design rationale for envelope encryption.
8. `docs/runbooks/` - operational runbooks (incident response, observability, restore, key rotation).

---

Contact: `compliance@eazepay.com` for any clarifying questions during fieldwork.
