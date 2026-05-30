# PRIV-014 — Right to erasure via crypto-shred

> CCPA-CPRA §1798.105 (Right to Delete) + GDPR Art.17 (RTBF) + SOC 2
> Privacy (P4 — Disposal). Reconciled against BSA/AML (31 CFR 1020.220,
> 1010.430) and FCRA/ECOA record-retention obligations.
> Owner: CCO + Engineering. Status: **shipped behind admin gate; PENDING
> LEGAL SIGN-OFF on the retention-vs-deletion boundary before any merge.**

## Finding

The platform had no right-to-be-forgotten / right-to-delete capability —
no `deleteAccount`, no crypto-shred. CCPA/CPRA grants a verified consumer
the right to erasure of their personal data, with a statutory carve-out
for data the business is legally required to retain.

## Control implemented

A crypto-shred erasure operation that destroys a consumer's per-subject
data-encryption key (DEK), rendering their AES-256-GCM-encrypted PII
permanently unrecoverable, **without** mutating the append-only audit
trail and **without** row-deleting records under a legal hold.

### Why crypto-shred (not row delete)

PII for a consumer lives as a single envelope: a unique DEK per
`ConsumerProfile`, wrapped by the KMS/local KEK (`data_key_ciphertext`),
alongside the AES-256-GCM `pii_ciphertext`. Destroying the wrapped DEK
makes the ciphertext mathematically undecryptable while leaving every
other row, the immutable `audit_outbox`, and any retained financial
record physically intact. This is the recommended NIST SP 800-88 media-
sanitisation technique for encrypted-at-rest data and is the only erasure
method that does not require rewriting an append-only audit log.

### What gets shred vs retained

| Data class             | Source columns                                                     | No credit relationship          | Loan-backed subject                        |
| ---------------------- | ------------------------------------------------------------------ | ------------------------------- | ------------------------------------------ |
| `consumer_profile_pii` | `consumer_profiles.{data_key_ciphertext,pii_ciphertext,pii_nonce}` | **SHRED** (DEK destroyed)       | **RETAIN** — BSA CIP 5yr (31 CFR 1020.220) |
| `user_contact_pii`     | `users.{email,phone_e164,display_name,totp_secret_ciphertext}`     | **SHRED** (tombstoned in place) | **RETAIN** (flagged for legal review)      |

The `users` row itself is never deleted — loans, applications and audit
rows FK to its id. Only the contact columns are nulled; the row survives
as a tombstoned shell carrying `contact_erased_at` + `erasure_receipt_id`.

### The retention-hold boundary (the compliance-critical seam)

The deletion-vs-retention decision is an **injectable port**
(`RetentionPolicy`, default `LoanBackedRetentionPolicy`), not a hardcoded
rule. Auditors get a named, documented class with explicit predicates;
the lawful boundary can be swapped (state laws, product mix) without
touching the shred mechanics.

The single load-bearing predicate: _"Has this consumer EVER had a credit
relationship (any `Loan` row)?"_ If yes, the KYC blob is a CIP identity
record under a live 5-year-post-closure hold and is retained. The 5-year
clock runs **from account closure**, so a paid-off or charged-off loan is
still inside the retention tail.

**Default-retain safety rule:** when the policy cannot positively prove a
datum is free of any retention obligation, it returns `retain` with
`uncertain: true`, surfacing the item on the receipt for human/legal
review. Over-retention is a recoverable privacy gap; over-deletion of a
BSA record is an unrecoverable regulatory breach. The default policy
deliberately over-retains loan-backed contact PII and flags it — it is
**conservative, not maximally privacy-forward**, by design.

A `manualLegalHold` flag forces retain-everything for litigation /
regulatory inquiry holds, overriding the loan check.

## Where it is exposed / how it is gated

- Service: `ErasureService.eraseConsumer` (`services/admin/src/erasure.service.ts`).
- Route: `POST /v1/admin/consumers/:id/erase` on `AdminController`.
- Gating: class-level `@AdminOnly()` + `@UseGuards(AdminGuard)` (bearer
  JWT + admin). `@Idempotent()` guards double-submit. A `reason` of ≥10
  chars is mandatory so the audit narrative is never empty.
- **No** UI, **no** self-serve, **no** unauthenticated path.

## Evidence / audit trail

Every erasure (in the same DB transaction as the shred):

1. Writes an append-only `audit_outbox` row, `action = admin.consumer.erased`,
   actor = the executing admin, `after` = the full `ErasureReceipt`.
2. Opens a `ComplianceReview` (`kind = data_erasure`) whose `evidence`
   holds the receipt. Left `open` (not auto-closed) when any retained
   item is flagged for legal review.
3. Stamps `pii_erased_at` / `contact_erased_at` + `erasure_receipt_id` on
   the affected rows — queryable for quarterly SOC 2 / privacy evidence
   pulls without decrypting anything.

The `ErasureReceipt` records, per data class, shred-vs-retain, the hold
id for retains, the rationale, and a snapshot of the retention facts the
policy reasoned over (so the decision is reproducible at audit time).

## Backfill

**None required.** This is a net-new capability; no historical rows are
in a bad state. The migration adds schema surface only and shreds nothing
on apply. The operation is idempotent on an already-erased subject.

## Open items requiring legal / human confirmation

1. **The retention carve-out itself.** Is "any `Loan` row ⇒ retain the
   full CIP blob for 5 years" the correct line, or should retention end
   5 years after the LAST loan closed (freeing prospects-who-once-borrowed
   sooner)? The clock-start interpretation needs counsel.
2. **Contact PII for loan-backed subjects.** Currently retained wholesale
   and flagged. Legal may approve shredding marketing-only contact fields
   while retaining identifying ones — that is a policy swap, not a
   mechanics change.
3. **Dual-control on erasure.** Today a single admin can execute (with a
   mandatory reason + full audit). Given its destructiveness, consider
   requiring a second approver (the codebase already has the
   `ComplianceReview` dual-control pattern). Flagged for the security
   review board.
4. **Identity-verification document images** (`DocumentKind.identity_verification_image`)
   and any KYC artifacts stored outside `consumer_profiles` are NOT yet
   in scope of this erasure. They must be inventoried and added before
   this satisfies a full erasure request end-to-end.
