# ADR-0033: Decision persistence, the durable §615(a) basis, and the P6/P7 split

- **Status:** Accepted
- **Date:** 2026-05-31
- **Deciders:** Brodie + Builder Council
- **Relates to:** ADR-0011 (immutable audit via outbox), ADR-0012 (money as BigInt cents), ADR-0015 (idempotency keys), ADR-0016 (PII-vault envelope encryption), ADR-0027 (decision-engine placement / module-first), ADR-0028 (decision semantics / replay), ADR-0029 (fairness posture), ADR-0030 (credit-data ingestion), ADR-0031 (catalog-only prequal), ADR-0032 (reason aggregation / disposition)

## Context

P0.5–P5 produced a **pure, replayable** decision: `runDecision` (P4) →
`aggregateDecision` (P5) yields a typed `AggregatedDecision` plus the
`EngineConfigSnapshot` it was computed under. Nothing is persisted yet.

Three regulators force durable persistence, and each wants a _different_ record:

1. **FCRA §615(a) + 12 CFR 1002.12(b) (ECOA/Reg B).** When credit is denied we
   must be able to reconstruct **why** — the specific principal reasons and the
   **key factors adversely affecting the score** — and retain that basis for
   **25 months** after adverse action. This record contains the consumer's
   financial profile: it is **PII** and must be encrypted at rest
   ([[0016-pii-vault-envelope-encryption]]).
2. **SR 11-7 (model governance) + ADR-0028 (replay).** The exact `policyVersion`
   / `ruleVersion` / `scorerVersion` / `effectiveCatalogSnapshotId` a decision
   ran under must be pinned, so the decision replays byte-identically and an
   examiner can tie a given adverse-action notice to a specific engine version.
3. **ADR-0011 (immutable audit).** Every regulated mutation writes an
   `AuditOutbox` row **in the same transaction**; a drain copies it into the
   append-only, hash-chained sink. The outbox row must carry **no raw PII**
   (SEC-040 `validateAuditPayload`) — it references the subject by id and lets
   unmask-with-approval reads project PII later.

Two more forces shape the design:

- **ADR-0015 idempotency.** `/v1/decide` is a state-creating write; a retried
  request must not produce a second decision record. The portal does **not**
  send an `Idempotency-Key` header for decide today, so the key must be
  **derived** from the request body.
- **ADR-0027 module-first / standalone-ready.** The engine must not couple to a
  sibling service (it already reaches `services/user`'s vault only through a
  port). Persistence and encryption are therefore **ports**, with the pure core
  importing nothing but `@eazepay/shared-utils` and its own modules.

### The tooling constraint that forces a phase split

This work lives in the held worktree `feat/decision-engine`. The worktree's
`node_modules` does **not** resolve `@prisma/client`, and `pnpm exec prisma` is
unavailable here (pnpm per-package install; the generated client + CLI live in
the main checkout). Every prior phase verified green precisely because the pure
engine imports no Prisma. Regenerating the workspace-shared Prisma client
mid-build — while everything is **HELD** pre-merge — would be inappropriate and
dirty the very thing we promised to keep extremely clean.

## Decision

Split the persistence work cleanly along the **pure-core / infrastructure**
seam (the same seam ADR-0027 and ADR-0031 already use):

- **P6 (this ADR) ships everything that is verifiable in the worktree without a
  database:** the additive Prisma **schema models** (declaration only, not
  migrated), the engine's **pure persistence core**, its **ports**
  (`DecisionRepositoryPort`, `BasisCipherPort`), an **in-memory adapter** + a
  test cipher, and **DB-free vitest** coverage.
- **P7 ships the infrastructure binding:** the Prisma `DecisionRepositoryPort`
  adapter, the migration SQL + `prisma generate`, the `PiiVaultService`-backed
  `BasisCipherPort`, and the **dual-write → reconcile** rollout — all alongside
  the `/v1/decide` handler that consumes them, where a full install belongs.

This is ports-and-adapters done honestly: the port + in-memory adapter **prove
the design now**; the Prisma adapter is an _additional binding added with its
consumer_, **not** a half-finished stub.

### Data model — three additive tables, two reused

```
DecisionRecord   queryable spine, NO PII   — disposition, version pins,
                                              reason CODES, fingerprints,
                                              counts, both retention stamps
DecisionBasis    encrypted §615(a) basis    — opaque envelope ciphertext +
                 (PII)                        fingerprint + inputsHash; 1:1
DecisionDlq      encrypted dead-letter      — ciphertext of the intended write
                 (may contain PII)            when the same-txn persist fails
AuditOutbox      REUSED (ADR-0011)          — one PII-free row, same txn
IdempotencyRecord REUSED (ADR-0015)         — derived-key replay backstop
```

- **`DecisionRecord`** holds only data that is safe to retain long and query
  often: `disposition` (the ADR-0032 union, stored verbatim/uppercase so shadow
  comparison is exact), the four version pins, the ordered **Reg B reason
  codes** (closed Model Form C-1 taxonomy — codes, not consumer PII; mirrors
  `RiskAssessment.reasonCodes`), an `offerCount`, the `basisFingerprint`
  (SHA-256 anchor), and **both** retention timestamps. It is the table
  disparate-impact monitoring (ADR-0029) and adverse-action reproduction read,
  with **no decryption required**.
- **`DecisionBasis`** is the FCRA basis. Its `ciphertext` is the
  envelope-encrypted, canonical-JSON basis: the **prequal echo** (PII), the
  disposition, the ordered reasons, the included-offer summary, **and the
  scorer's signed per-factor breakdown — the §615(a) key factors** — plus the
  version pins, snapshot id, config digest and catalog fingerprint. It carries
  its own `inputsHash` (proves the basis belongs to this request, mirroring
  `HighsaleSnapshot.inputsHash`) and a `schemaVersion`.
- **`DecisionDlq`** is the durability net (see _failure semantics_). It stores
  the **already-encrypted** intended write — never plaintext — so a repair tool
  can reconcile without leaking PII.

### Same-transaction write + failure semantics

The durable write of one decision is **`DecisionRecord` + `DecisionBasis` +
`AuditOutbox` + `IdempotencyRecord`, atomic** ([[0011-immutable-audit-via-outbox]]).
The **adapter owns atomicity** (Prisma `$transaction` in P7; the in-memory
adapter commits all rows together or none). The pure orchestrator
`persistDecision` enforces this protocol:

```
1. key = applicationId + ":" + stableJsonSha256(request)        // derived idempotency
2. existing = repo.findByIdempotencyKey(key)
     if existing → return { ...existing, replayed: true }        // ADR-0015 replay
3. seal the basis BEFORE the txn:  ciphertext = cipher.seal(plaintext, aad)
     if seal throws → DecisionPersistenceError (recompute-on-retry; never DLQ plaintext)
4. repo.persist({ record, basis, audit, idempotency })           // atomic
5. on persist failure:
     repo.deadLetter({ ciphertext, ... })  (best effort)
     throw DecisionPersistenceError (preserve original cause; never swallow)
```

- **Encryption happens _before_ the transaction**, so the DLQ — written only on
  a `persist` failure — always has ciphertext and never has to touch plaintext.
- **`persist` is all-or-nothing.** A thrown `persist` means _nothing_ was
  written, so DLQ-then-retry is safe and never double-writes.
- **Fail-closed, retry-safe.** A hard DB-down fails the DLQ write too; we still
  **rethrow** (never silently succeed). The client retries under the **same
  derived key**, so the eventual success is idempotent. This is the
  [[0026-graceful-degradation-philosophy]] posture: degrade loudly, never lie.
- **Side-effecting inputs are injected** (`now()`, `newId()`), so the rest of
  the core stays pure and the basis fingerprint is reproducible.

### Idempotency — a derived key, no 409 path

The key is `applicationId + ":" + stableJsonSha256(request)`
([[0015-idempotency-keys]] composition). Because the key is **derived from the
exact request body**, the ADR-0015 _body-mismatch → 409_ case is
**unreachable by construction**: a different body yields a different key (a new
decision), an identical body yields the same key (a replay). Re-deciding the
same application on **changed** inputs is therefore a _new_ record, not a
conflict — which is the correct credit-decisioning behaviour.

### Dual retention — 14 days vs 25 months are different clocks

```
offersValidUntil  = decidedAt + 14 days     // operational freshness
basisRetainUntil  = decidedAt + 25 months   // FCRA / Reg B record floor
```

- **`offersValidUntil` (14d)** mirrors the **Highsale soft-pull's** 14-day
  validity ([[0030-credit-data-ingestion]]): offers computed off a stale pull
  must not be re-presented, so after this stamp the portal must **re-decide**.
  It is a _freshness_ flag, **not** a purge deadline.
- **`basisRetainUntil` (25mo)** is the FCRA §615 / Reg B `1002.12(b)`
  adverse-action **record-retention floor**. The `DecisionRecord`,
  `DecisionBasis`, and any `DecisionDlq` for the decision **co-retain** to this
  stamp (the basis is the legally load-bearing copy; the spine and DLQ expire
  with it). Purge is a P7 retention sweep keyed on `basisRetainUntil`.

### Tamper-evidence reuses the ADR-0011 chain — no second chain

The decision's integrity anchor is `basisFingerprint = SHA-256(canonicalJson(
basis))`, stored on `DecisionRecord` **and** inside the `AuditOutbox.after`.
Because the existing audit **sink** already hash-chains every drained row
([[0011-immutable-audit-via-outbox]]), the immutable chain **transitively
commits to the basis fingerprint** — altering the encrypted basis later would
break the fingerprint match against an already-chained audit row. We therefore
do **not** add a second hash-chain column to the outbox (see _Alternatives_).

### Purity + the audit PII guard

The pure core imports only `@eazepay/shared-utils` and engine-internal modules —
**no `@prisma/client`, no `services/user`, no `services/audit`**. The
`AuditOutbox.after` is assembled from a fixed, known-safe key set (ids, reason
codes, version pins, counts, fingerprints) and passed through an
**engine-local banned-key guard** mirroring SEC-040's regex. The independent
`services/audit` `validateAuditPayload` remains the **drain-side** check —
defense in depth (the same two-tier posture as P5's reason cap vs
compliance-doc's `normalizeDeclineCodes`), not a single point of trust.

## Alternatives considered

- **Do the Prisma adapter + migration in P6.** Rejected: the worktree has no
  Prisma client/CLI and everything is HELD; regenerating the workspace-shared
  client mid-build dirties the repo and can't be verified here. The port +
  in-memory adapter prove the design without a DB; the adapter lands with its
  P7 consumer where a full install is appropriate.
- **A second hash chain stored on the outbox row.** Rejected: ADR-0011 puts the
  chain in the **sink**, not the Postgres row; a row-level chain would duplicate
  it and create two sources of truth. The fingerprint-in-`after` lets the
  existing chain do the work.
- **Store the basis in plaintext JSON (like `RiskAssessment.signals`).**
  Rejected: the basis echoes the consumer's financial profile (FICO band, DTI,
  income, tradelines) — that is PII and `1002.12(b)` keeps it for 25 months.
  Plaintext at rest for 25 months is the exact exposure ADR-0016 forbids.
- **Put raw reasons/PII in the audit `after`.** Rejected by SEC-040: the outbox
  feeds the immutable sink, which cannot be redacted. Codes + ids only.
- **A client-supplied `Idempotency-Key` header.** Rejected: the portal sends
  none for decide, and a derived key is _stronger_ — it binds the dedup to the
  exact decided inputs, so a changed profile can never silently replay a stale
  decision.
- **One retention stamp.** Rejected: conflating offer-freshness (14d, tied to
  the pull) with the FCRA basis floor (25mo) would either purge the legal record
  early or keep stale offers presentable. They are different clocks.
- **Crash on a persist failure with no DLQ.** Rejected: a partial/soft failure
  would lose a computed decision. The encrypted DLQ + rethrow preserves the
  decision for reconcile _and_ fails the request closed so the idempotent retry
  is safe.

## Consequences

- **Positive:** every decision has a queryable, PII-free spine and an encrypted,
  replayable §615(a) basis; the audit row is same-txn and PII-free; the immutable
  chain anchors the basis fingerprint with no second chain; idempotency composes
  ADR-0015 with no 409 surface; retention separates offer-freshness from the FCRA
  floor; the engine stays standalone-ready and fully testable without a DB.
- **Negative / accepted:** the Prisma adapter, migration SQL, and dual-write →
  reconcile rollout are **deferred to P7** — until then no decision is _actually_
  written in a deployed env (acceptable: deploy is HELD and P7 owns the handler).
  The engine carries a small duplicate of SEC-040's banned-key regex
  (deliberate, to stay standalone); the two must be kept in sync, which the ADR
  records.
- The disposition enum is stored **uppercase** to match the engine union
  byte-for-byte — intentionally diverging from the schema's lowercase enum
  convention so replay/shadow comparison needs no case translation.

## Compliance / risk notes

- **FCRA §615(a) / Reg B `1002.12(b)`:** the durable basis captures the specific
  principal reasons **and** the scorer's key-factor breakdown, encrypted, retained
  25 months; the record can reproduce an adverse-action notice without decrypting
  PII (codes live on the spine).
- **ADR-0011 / SEC-040:** same-txn outbox write; `after` is id + code + version +
  fingerprint only, guarded at construction and again at the drain.
- **ADR-0016:** the only PII at rest is the `DecisionBasis`/`DecisionDlq`
  ciphertext, AAD-bound to `{entity, applicationId, idempotencyKey}` via the
  opaque envelope; keys + counts are clear.
- **ADR-0028 / SR 11-7:** version pins + config digest + catalog fingerprint are
  recorded per decision; `persistDecision` is pure given injected clock/id, so the
  basis fingerprint reproduces.
- **ADR-0015:** derived-key idempotency; retries are safe and never double-write.
- **UDAAP:** a `persist` failure fails the request closed (rethrow) rather than
  returning offers that were never durably recorded.

## Revisit when

- The Prisma adapter + migration land (P7) — confirm the migration is additive,
  the dual-write → reconcile (not hard-cutover) is wired, and the retention sweep
  is keyed on `basisRetainUntil`, OR
- the `affordabilityBufferCents` debt-service model lands ([[0032-reason-aggregation-disposition]])
  — the basis grows additional captured inputs and `schemaVersion` bumps, OR
- a key-rotation / re-wrap of the basis envelope is needed — reuse the
  `dek_rewrap` resumable-cursor pattern already in the schema, OR
- decisions need cross-product sharing (a federated basis) — re-open the
  single-table-per-product assumption.
