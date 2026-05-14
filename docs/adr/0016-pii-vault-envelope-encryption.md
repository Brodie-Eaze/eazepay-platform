# ADR-0016: PII Vault — Envelope Encryption with Per-Row Data Keys

- **Status:** Accepted
- **Date:** 2026-03-08
- **Deciders:** Head of Engineering, CISO (acting), Compliance Lead
- **Supersedes:** —

## Context

EazePay stores consumer non-public personal information (NPI): legal
name, date of birth, SSN, address, bank-account details, identity
documents, employment information. GLBA Safeguards (2023 update),
NYDFS Part 500, state privacy law, and our bank-partner contracts all
require encryption at rest with key-management practices that survive
external audit.

Database-engine-level encryption alone is not sufficient because:

1. A snapshot exfiltration (e.g. via a misconfigured replica or an
   admin with full Postgres access) returns plaintext.
2. There is no per-field unmask audit — every read is the same access.
3. Rotation requires a full re-write of every row.
4. There is no path to "deterministic encryption" for searchable PII
   (email, phone, EIN) without leaking plaintext to the engine.

## Decision

NPI is encrypted at the **application layer** with envelope encryption
and per-row data keys. The vault implementation is
[`services/user/src/internal/pii-vault.service.ts`](../../services/user/src/internal/pii-vault.service.ts).

Scheme:

1. The workload holds a 32-byte Key-Encryption Key (KEK) — in dev a
   hex value from `LOCAL_KEK_HEX`; in prod a KMS-managed customer
   master key referenced by alias.
2. For each NPI write, we mint a fresh 32-byte Data-Encryption Key
   (DEK) and use it to encrypt the plaintext with **AES-256-GCM**.
   Associated Authenticated Data (AAD) = `<entity>:<row_id>:<field>`,
   binding a ciphertext to its row + field.
3. The DEK is then encrypted by the KEK (also AES-256-GCM, separate
   AAD suffix `:dek`) and stored alongside the ciphertext.
4. We store a single base64 envelope per field:
   `version(1) || iv(12) || tag(16) || kek_iv(12) || kek_tag(16) || encrypted_dek(32) || ciphertext(*)`.
5. We also store a 12-character SHA-256 fingerprint of the plaintext,
   so an operator can confirm rotation occurred without revealing the
   value.

For **searchable** PII (email, phone, EIN), we additionally store a
deterministic ciphertext computed via **AES-SIV (RFC 5297)** with a
per-tenant pepper. Deterministic = same plaintext + same pepper →
same ciphertext, enabling exact-match lookups via a unique index
without leaking plaintext to the database engine. Range queries are
not possible on those columns (a property — by design).

Keys live in **AWS KMS** in production with rotation set to automatic
(annual) for the KEK. DEKs are minted per write and are never
written in plaintext; they exist only inside the encryption process
memory for the duration of a single operation.

## Alternatives considered

- **Postgres TDE only.** Rejected — re-implements the threat we're
  defending against (admin reads, snapshot exfil).
- **Column-level encryption with one shared DEK.** Rejected — single
  key compromise = catastrophic. Per-row DEKs limit blast radius.
- **External tokenisation vault (Skyflow / VGS).** Strong option, but
  adds a critical-path third-party for every PII read. Revisit at
  V1 if our partner-bank audits require it; until then,
  application-layer envelope encryption is the bar.
- **CockroachDB / Aurora native KMS integration.** Useful but
  insufficient — doesn't give us per-row DEKs or the AAD binding.

## Consequences

- Easier: rotation. Re-encrypting a row's DEK without touching the
  ciphertext is a single KMS call.
- Easier: audit. The Pino redactor + JIT unmask flow + per-row
  fingerprints give an external auditor a clean evidence trail.
- Easier: breach scoping. An exposed snapshot is ciphertext + wrapped
  DEKs; without the KEK in KMS, the data is useless.
- Harder: queries. Range queries on PII are explicitly not supported.
  We accept this; range queries on PII are an anti-pattern.
- Harder: cost. KMS calls per write + a couple of crypto ops per read.
  Real-world cost is low (~1ms per envelope at the 99th percentile);
  measured in load tests.

## Compliance / risk notes

- **GLBA Safeguards Rule § 314.4(c)(1):** "Implement and periodically
  review access controls, including technical and, as appropriate,
  physical controls" — per-field unmask + dual-control approval
  satisfy the access-control requirement.
- **NYDFS Part 500.15:** encryption of NPI in transit and at rest;
  documented exceptions with compensating controls — none required
  for our scheme.
- **SOC 2 CC6.1, CC6.6, CC6.7:** logical access, encryption, and
  audit trail. This ADR + the unmask runbook are the evidence pack.
- **State privacy (CCPA / CPRA, CDPA, CPA, …):** encryption is one
  of the safe-harbour conditions for a breach not triggering
  notification. We meet the standard.
- **Bank-partner expectations:** Cross River, FinWise, Lead, Celtic
  all require encryption with rotation, KMS-managed keys, and a
  written WISP. This ADR is referenced from the WISP and the partner
  evidence pack.
