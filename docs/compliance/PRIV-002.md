# PRIV-002 — Encrypt edge consumer PII at rest (partner-portal `applications`)

> Frameworks: SOC 2 CC6.1 (logical access — protection of data at rest) ·
> GLBA Safeguards Rule, 16 CFR §314.4(c)(3) (encryption of customer
> information at rest).
> Status: REMEDIATED (code) — pending HOLD-PR review + DB snapshot before
> the plaintext-drop follow-up (migration 0021).
> Owner: Engineering + CCO. Remediation date: 2026-05-31.

## Finding

The partner-portal "edge" Postgres (`apps/partner-portal`, Drizzle ORM)
stored consumer PII on the `applications` table — `consumer_first`,
`consumer_last`, `consumer_email`, `consumer_phone` — as **plaintext
`text` columns**. The backend `services/user` PII vault already encrypts
the same class of data with per-row AES-256-GCM envelope encryption (DEK
wrapped by a KEK, AAD binding, DEK zeroization). The edge table was the
gap: a leaked `DATABASE_URL`, a backup snapshot, or a compromised replica
exposed every consumer's identity + contact tuple in the clear, while the
strong vault protected the same data one service over.

## Fix (what the code now does)

Edge consumer PII is encrypted at rest with the **same envelope scheme
the backend vault uses** — no new crypto was invented:

- **AES-256-GCM** via `aesGcmEncrypt` / `aesGcmDecrypt`
  (`@eazepay/shared-utils`) — the exact functions the backend
  `PiiVaultService` calls.
- **Envelope encryption** via the `KeyManager` port
  (`@eazepay/integrations-core`): a fresh per-row DEK is generated, used
  once, then zeroized; the KEK-wrapped DEK ciphertext is persisted next to
  the payload. The row alone cannot recover plaintext — a KEK held by KMS
  (or `LOCAL_KEK_HEX` in dev) is also required.
- **AAD binding**: every ciphertext's GCM Additional Authenticated Data is
  bound to `(application id, field name)`. A ciphertext lifted from
  application A's `consumer_email_enc` and written onto application B's
  row fails the auth-tag check and throws on read — it cannot silently
  decrypt to wrong-row plaintext. This is the same anti-transplant
  guarantee SEC-019 added for backend BeneficialOwner rows.

### Encrypt on write, decrypt on read — at the data-access boundary

| Boundary                      | File                                                                      | What changed                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Write (only writer)           | `apps/partner-portal/app/api/v/[brand]/applications/route.ts` (POST)      | Mints the application id up front, `sealApplicationPii(id, …)`, inserts `*_enc` + `consumer_email_bidx` instead of plaintext. |
| Read (partner dashboard list) | same file (GET)                                                           | `decryptApplicationRowsZipped` — identical output shape ("First L." + full email).                                            |
| Read (master/admin list)      | `apps/partner-portal/app/api/admin/applications/route.ts`                 | same.                                                                                                                         |
| Read (live status snapshot)   | `apps/partner-portal/app/api/v/[brand]/applications/[id]/status/route.ts` | decrypts only when the invite record does not supply the name (preserves original fallback semantics).                        |
| Read (outcome notification)   | `apps/partner-portal/lib/notify-application-outcome.ts`                   | selects `*_enc`, decrypts for the masked "First L." label.                                                                    |

### New modules

- `apps/partner-portal/lib/db/pii-crypto.ts` — the edge envelope
  primitive (`sealEdgePiiField` / `openEdgePiiField`), KeyManager
  resolution from env (`LocalEdgeKeyManager` byte-compatible with the
  backend `LocalKeyManager`; `MockKmsKeyManager` for cutover parity), and
  the email blind index (`emailBlindIndex`).
- `apps/partner-portal/lib/db/applications-pii.ts` — the per-row
  seal/open mapping (`sealApplicationPii`, `decryptApplicationRow`,
  `decryptApplicationRowsZipped`, `newApplicationId`).

## Migration strategy — expand/contract (plaintext NOT dropped yet)

Two migrations, deliberately split so a backfill defect can never destroy
the only copy of the data:

1. **`drizzle/0020_encrypt_consumer_pii.sql`** (in this PR): ADD the
   `consumer_*_enc` columns (nullable) + `consumer_email_bidx` + its
   index; DROP the NOT NULL on the four plaintext columns so the write
   path can stop populating them immediately; **leave the plaintext
   columns in place**.
2. **`scripts/backfill-priv002.ts`** (run after 0020, before 0021):
   encrypt every existing row whose `_enc` columns are NULL. Idempotent,
   restartable (keyset pagination over rows still needing encryption),
   AAD-correct (binds to each row's real id), and audit-logged
   (`audit_log` row, actor `system:backfill-priv002`). A `--verify` mode
   confirms every `_enc` value decrypts back to the plaintext and reports
   `remaining_plaintext_unencrypted`.
3. **`drizzle/0021_drop_plaintext_consumer_pii.sql.TODO`** (HOLD — not
   applied; the `.TODO` suffix keeps the `*.sql`-globbing runner from
   picking it up): promotes `_enc` to NOT NULL and DROPs the plaintext
   columns (crypto-shred — only the KEK-wrapped ciphertext remains).
   Promote to `.sql` in a separate PR only after the backfill `--verify`
   reports 0 mismatches / 0 remaining AND a DB snapshot is taken.

**Why deferred:** dropping plaintext in the same migration would leave the
data only in the new columns the instant the drop commits; any backfill
bug would be unrecoverable. The split keeps a rollback path until the
encrypted copy is proven.

## Blind index (added; no lookup wired yet)

A deterministic **HMAC-SHA-256 blind index** of the normalized
(lowercased) email is written to `consumer_email_bidx` on write +
backfill, keyed by `EDGE_PII_BLIND_INDEX_KEY` (distinct from the
encryption KEK — never reuse a confidentiality key as a MAC key).

Verified across the whole partner-portal: **there is no existing equality
lookup on `consumer_email` or `consumer_phone`** to preserve (the columns
are only written and read-for-display). The blind index is therefore not
required to keep any current feature working — it exists so a future
dedupe / support-lookup / RTBF-by-email query can be added **without
another PII-touching migration**. No phone blind index was added (no
plausible near-term lookup; unused columns carry cost) — `emailBlindIndex`
documents the extension point.

## Key material / env

| Var                        | Purpose                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| `KEY_MANAGER`              | `local` (default) or `mock-kms`; AWS KMS adapter drops in once the CMK ARN is provisioned. |
| `LOCAL_KEK_HEX`            | 32-byte hex KEK — the **same value** as `apps/api`'s `LOCAL_KEK_HEX` (one KEK to rotate).  |
| `EDGE_PII_BLIND_INDEX_KEY` | Separate 32-byte HMAC key for the email blind index.                                       |

All three are documented in `apps/partner-portal/.env.example`. The crypto
module fails closed (throws) if `KEY_MANAGER=local` and `LOCAL_KEK_HEX`
is missing — a half-wired config never silently downgrades to plaintext.

## Tests (auditor-relevant assertions)

`apps/partner-portal/lib/db/pii-crypto.spec.ts` (13 tests, all passing):

- Round-trip seal → open for each field.
- **AAD rejection**: a ciphertext sealed for application A throws when
  opened under application B's id (cross-row transplant) — and when
  opened under the wrong field name.
- Non-deterministic ciphertext (fresh DEK + nonce per call).
- Blind index: deterministic, case/space-insensitive, keyed (changes with
  the HMAC key), throws when the key is missing.
- Write+read boundary round-trip incl. email lowercasing; fail-closed on a
  NULL ciphertext column.
- Backfill seal/decrypt parity (mirrors `scripts/backfill-priv002.ts`),
  including the `mock-kms` cutover path.

## Verification commands (run in the worktree)

- `pnpm --filter @eazepay/api exec prisma generate` → success.
- `pnpm --filter @eazepay/partner-portal run typecheck` → exit 0.
- `pnpm --filter @eazepay/partner-portal exec vitest run lib/db/pii-crypto.spec.ts` → 13 passed.

## Residual risk / left for human review

- **Plaintext still on disk** until the HOLD 0021 migration + backfill run
  in production. The finding is fully closed only after that — this PR
  closes it for **new** rows and stages the historical fix.
- **KEK provenance**: dev uses `LOCAL_KEK_HEX`. Production must point
  `KEY_MANAGER` at the AWS KMS adapter (CMK ARN) when provisioned; until
  then the edge shares the api `LOCAL_KEK_HEX`, which must live only in
  the secret manager, never in the repo.
- **No automatic bulk-decryption alerting** on the edge yet (the backend
  vault logs bulk decrypts). Edge reads are display-bounded + tenant-RLS
  scoped, so volume is low, but a follow-up could add a decrypt counter.
