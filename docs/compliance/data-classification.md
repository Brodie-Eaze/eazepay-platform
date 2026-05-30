# Data classification matrix

> SOC 2 C1 (Confidentiality) + Privacy P1 — Inventory of every field
> family in the platform, with retention, encryption, and access tier.
> Owner: CCO + Engineering. Last reviewed: 2026-05-15.

## Classification levels

- **PII** — Personally identifiable information regulated under GLBA /
  state privacy laws (CCPA, NYDFS Part 500).
- **NPI** — Non-public personal information specifically called out by
  GLBA (bank account, SSN, financial history).
- **Internal** — Sensitive operational data not directly tied to a
  consumer (audit chain, secrets, system metrics with no PII).
- **Public** — Safe to share externally (release notes, marketing copy).

## Field family matrix

| Field family                               | Storage location                         | Classification                                             | Retention                                  | Encrypted at rest                                           | Access tier                                            |
| ------------------------------------------ | ---------------------------------------- | ---------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------ |
| `ConsumerProfile.ssn`                      | `services/user` + PII vault              | PII / NPI                                                  | 25 mo declined, 7 yr funded                | Yes (envelope, per-row DEK)                                 | Dual-control admin reveal only                         |
| `ConsumerProfile.dob`                      | `services/user` + PII vault              | PII                                                        | Same as SSN                                | Yes (envelope)                                              | Dual-control admin reveal only                         |
| `ConsumerProfile.address`                  | `services/user` + PII vault              | PII                                                        | Same as SSN                                | Yes (envelope)                                              | Operator (masked) / admin (reveal)                     |
| `ConsumerProfile.phone`                    | `services/user` (masked in default DTO)  | PII                                                        | Same as SSN                                | Yes (column-level for full; last-4 displayed)               | Operator (masked) / admin (reveal)                     |
| `ConsumerProfile.email`                    | `services/user`                          | PII (low sensitivity)                                      | Same as SSN                                | TLS in transit, plaintext at rest                           | Operator                                               |
| `ConsumerProfile.bankAccountNumber`        | `services/user` + PII vault              | NPI                                                        | 7 yr (post-funding)                        | Yes (envelope)                                              | Dual-control admin reveal only                         |
| `MerchantProfile.legalName`                | `services/merchant`                      | PII (business)                                             | While merchant active + 7 yr               | TLS in transit                                              | Operator / merchant-admin                              |
| `MerchantProfile.ein`                      | `services/merchant`                      | PII (business)                                             | Same as legalName                          | Yes (column-level)                                          | Operator (masked) / admin                              |
| `MerchantProfile.beneficialOwners[]`       | `services/merchant`                      | PII                                                        | Same as legalName                          | Yes (envelope for SSN field)                                | Dual-control reveal for SSNs                           |
| `applications.consumer_first/_last` (edge) | partner-portal Postgres `applications`   | PII (sPII)                                                 | Same as Application                        | Yes (envelope, per-row DEK; AAD bound to row id — PRIV-002) | Operator / partner scoped (masked "First L." in lists) |
| `applications.consumer_email` (edge)       | partner-portal Postgres `applications`   | PII                                                        | Same as Application                        | Yes (envelope, per-row DEK — PRIV-002) + HMAC blind index   | Operator / partner scoped                              |
| `applications.consumer_phone` (edge)       | partner-portal Postgres `applications`   | PII                                                        | Same as Application                        | Yes (envelope, per-row DEK — PRIV-002)                      | Operator / partner scoped                              |
| `Application.status`                       | `services/application`                   | Internal                                                   | Same as ConsumerProfile                    | TLS in transit                                              | Operator / merchant scoped                             |
| `Application.declineReasons[]`             | `services/application`                   | Internal (references PII context)                          | Same as Application                        | TLS in transit                                              | Operator / merchant scoped                             |
| `AuditOutbox.*` (every row)                | `audit_outbox` table                     | Internal (hashed PII refs)                                 | 7 yr immutable                             | TLS in transit; hash-chained for tamper detection           | System write; admin read with audited-read interceptor |
| `HighsaleSnapshot.creditTier`              | `services/orchestration`                 | Internal                                                   | 25 mo declined / 7 yr funded               | TLS in transit                                              | Operator                                               |
| `HighsaleSnapshot.payloadCiphertext`       | `services/orchestration` + PII vault     | PII (envelope-encrypted snapshot of submitted application) | Same as Application                        | Yes (envelope)                                              | System-only; reveal via dual-control                   |
| Inbound webhook payloads                   | `services/webhook` raw-payload retention | PII (varies by source)                                     | 90 days raw + indefinite hashed receipt    | Yes (envelope where PII present)                            | System; admin read with audit row                      |
| Outbound webhook payloads                  | `services/webhook` delivery log          | PII (mirrors customer event)                               | 90 days raw + indefinite delivery metadata | Yes (envelope where PII present)                            | System; admin read with audit row                      |
| Outbound webhook secrets                   | `WebhookEndpoint.secretCiphertext`       | Internal (secret)                                          | While endpoint active                      | Yes (envelope)                                              | System decrypt at signing time only                    |
| API request / response logs                | Pino → stdout → Railway log drain        | Internal (PII redacted by Pino redact config)              | 30 days hot, 1 yr cold                     | TLS in transit                                              | Operator                                               |
| OTP codes                                  | `services/notification` ephemeral        | NPI (short-lived secret)                                   | 10 min TTL                                 | Masked in logs (SEC-022)                                    | System-only                                            |
| Session refresh tokens                     | `services/auth` Session table            | Internal (secret)                                          | 30 d sliding                               | Hashed before storage; rotated atomically                   | System-only                                            |
| Compliance documents (AAN, TIL)            | `services/compliance-doc` object storage | PII                                                        | 7 yr FCRA                                  | TLS in transit + bucket-level encryption                    | Applicant scoped + admin                               |

## Cross-references

- Envelope encryption: `services/user/src/internal/pii-vault.service.ts`.
- Masking + JIT reveal: `services/user/src/user.service.ts` +
  `services/admin/src/interceptors/audited-read.interceptor.ts`.
- Pino redact config: `apps/api/src/app/app.module.ts` LoggerModule.
- Retention enforcement: `services/compliance-doc/` + cron purge in
  `services/application/`.
