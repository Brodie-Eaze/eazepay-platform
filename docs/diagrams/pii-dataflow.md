# PII data flow

Where PII enters the system, where it gets encrypted, who can read it,
and the retention boundary. Required reading for SOC 2 + any engineer
touching `ConsumerProfile`, `BeneficialOwner`, `HighsaleSnapshot`, or
any audit row.

```mermaid
flowchart LR
  subgraph Untrusted["Consumer browser<br/>(UNTRUSTED)"]
    direction TB
    Form["Apply form<br/><br/>SSN (full)<br/>DOB<br/>Legal name<br/>Address<br/>Income<br/>Employment<br/>Bank account"]
  end

  subgraph Wire["Network (TLS 1.3)"]
    HTTPS["HTTPS POST<br/>/v1/applications"]
  end

  subgraph APITrust["apps/api (TRUSTED, EPHEMERAL — never logs PII)"]
    direction TB
    Validate["Zod validation<br/>+ field-length caps<br/>+ format checks"]
    Vault["PiiVaultService<br/><br/>AES-256-GCM<br/>per-row DEK<br/>KEK from AWS KMS<br/>AAD = scope + rowId<br/><br/>seal() / sealOpaque()"]
    Redact["pino redact<br/><br/>SSN, DOB, name,<br/>address, phone, email,<br/>account, routing<br/>NEVER reach logs"]
  end

  subgraph Storage["Postgres (encrypted at rest by managed provider + envelope encrypted by app)"]
    direction TB
    Profile["ConsumerProfile<br/><br/>piiCiphertext<br/>piiNonce<br/>dataKeyCiphertext<br/>kekId<br/>piiSchemaVersion"]
    Snapshot["HighsaleSnapshot<br/><br/>payloadCiphertext<br/>(opaque envelope,<br/>AAD = applicationId)"]
    BO["BeneficialOwner<br/><br/>piiCiphertext<br/>AAD = beneficialOwnerId<br/>(per-row discriminator,<br/>SEC-019)"]
    Audit["audit_outbox<br/><br/>action + actorId + targetId<br/>before/after JSON<br/><br/>typed payload contract:<br/>banned-field validator<br/>refuses ssn/dob/name/etc"]
  end

  subgraph ReadPaths["Read paths (CONTROLLED)"]
    direction TB
    Me["GET /v1/me<br/><br/>Default: MASKED<br/>(SSN ***-**-1234,<br/>DOB year only,<br/>address line1 ***,<br/>ZIP3 only)<br/><br/>?reveal=full<br/>requires step-up MFA<br/>(SEC-023)"]
    AdminUnmask["Admin JIT unmask<br/><br/>Dual-control<br/>(requester signs +<br/>second admin co-approves)<br/><br/>Writes audit row<br/>admin.pii.unmask.read<br/>with field list + reason"]
    LenderOut["Lender adapter<br/><br/>Normalised subset only:<br/>- SSN-last-4 (never full)<br/>- DOB year (never full DOB)<br/>- Address ZIP<br/>- Income band<br/>- Employment YoS<br/><br/>Full PII never leaves<br/>apps/api process"]
    HighsaleOut["Highsale soft-pull<br/><br/>Full PII required<br/>(it's a credit bureau pull)<br/><br/>HMAC-signed,<br/>per-request audit row,<br/>FCRA permissible-purpose<br/>recorded"]
  end

  Form -->|HTTPS + CSRF| HTTPS
  HTTPS --> Validate
  Validate --> Vault
  Vault -->|sealed envelope| Profile
  Vault -->|sealed envelope| Snapshot
  Vault -->|sealed envelope| BO
  Vault -->|action only,<br/>no PII fields| Audit
  Validate -.->|never| Redact
  Profile -->|JIT decrypt + mask| Me
  Snapshot -->|JIT decrypt + mask| Me
  Profile -->|dual-control decrypt| AdminUnmask
  BO -->|dual-control decrypt| AdminUnmask
  Vault -->|normalised projection| LenderOut
  Vault -->|full PII,<br/>signed| HighsaleOut

  classDef untrusted fill:#ffe9e9,stroke:#c44,color:#000
  classDef wire fill:#fff5e9,stroke:#c80,color:#000
  classDef trusted fill:#e9ffe9,stroke:#080,color:#000
  classDef storage fill:#e9f0ff,stroke:#36c,color:#000
  classDef read fill:#f5e9ff,stroke:#80c,color:#000

  class Form untrusted
  class HTTPS wire
  class Validate,Vault,Redact trusted
  class Profile,Snapshot,BO,Audit storage
  class Me,AdminUnmask,LenderOut,HighsaleOut read
```

## What's NEVER allowed

- Full SSN in any log line, anywhere, ever.
- Full PII (`legalName`, `address.line1`, `phone`, `email`) in any `audit_outbox.before/after` payload. The typed payload contract refuses these at write time (SEC-040).
- Plaintext PII in any Postgres column. Every PII field goes through `PiiVaultService.seal()` or `sealOpaque()` before insert.
- PII in URL paths or query strings. Consumer-side routing uses opaque application UUIDs only.
- PII in webhook payloads to lenders. Adapters send a normalised subset (SSN-last-4, DOB year, ZIP). Full PII goes only to Highsale (where it's needed for the bureau pull) and DocuSign (where it's needed for the loan agreement).

## Retention

| Record                                                  | Retention                                      | Why                                                               |
| ------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------- |
| `ConsumerProfile.piiCiphertext` (funded loans)          | 7 years post-funding                           | Loan agreement retention. Federal + state record-keeping.         |
| `ConsumerProfile.piiCiphertext` (declined applications) | 25 months post-decline                         | FCRA Adverse Action Notice retention period (2 years + a buffer). |
| `HighsaleSnapshot.payloadCiphertext`                    | 25 months from inquiry                         | Mirrors the Adverse Action retention.                             |
| `audit_outbox` rows                                     | 7 years                                        | SOC 2 evidence + regulator query window.                          |
| Application logs (pino)                                 | 30 days                                        | Operational + incident review. PII redacted at write.             |
| OTP codes (Redis)                                       | TTL 10 minutes                                 | Only the consumer's challenge window.                             |
| Webhook payloads                                        | 90 days for delivered, 30 days for dead-letter | Operator review for failed deliveries.                            |

## Decryption — who, when, how

Three legitimate decrypt paths. Anyone else reading PII is a bug or an
incident.

1. **Consumer reads their own profile.** `GET /v1/me?reveal=full` after a fresh step-up MFA challenge captured within the last 5 minutes. Audit row: `user.pii.self_reveal`.
2. **Admin reads under dual control.** Two distinct admin sessions must approve. Requester signs (justification + field list). Second admin co-signs (timestamp + decision). Both write audit rows. Decrypt happens server-side and returns the projected fields only. Never bulk.
3. **Outbound to Highsale.** The full PII envelope is unwrapped in-memory only at the moment of the soft-pull request. The unwrapped payload goes into the HTTPS body, never to disk, never to logs, never to a queue.

## Engineer rules

If you're touching PII in code, do this:

- Never deserialize PII into a plain object that survives past the immediate request handler.
- Use `PiiVaultService` for every read AND write. Don't reach into the ciphertext columns directly.
- If you need to log a PII-bearing field, run it through the `mask()` helper in `services/user/src/internal/pii-mask.ts` first.
- If you're adding a new column that holds PII, add the field name to the banned-keys list in `services/audit/src/audit-payload.ts` AND update this diagram.
- If you're calling a new external provider, draft the AAD + the normalised subset in a PR comment BEFORE writing code. Get sign-off.
