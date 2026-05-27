# DEK Rewrap — LocalKeyManager → AWS KMS Cutover

> **TL;DR (60s):** Re-wrap every encrypted PII row's per-record DEK from the dev-grade `LocalKeyManager` KEK onto the production AWS KMS KEK. The PII payload does NOT change — only the per-row `data_key_ciphertext` + `kek_id` columns (and the embedded `dk`/`k` fields on opaque envelopes). Run **after** `pg_restore` to RDS and **before** flipping the PR #170 boot guard. Dry-run first, review the count, then `--commit`. Re-runnable: already-rewrapped rows are skipped on the `kek_id` check.

## When this fires

Day 6 of the AWS cutover, immediately after `pg_restore` lands the production DB into RDS and immediately before the API services switch their `KEY_MANAGER` env from `local` to `kms`. This is the **only** safe window — earlier and you re-wrap rows that production is still writing to under the local KEK; later and the boot guard refuses to start the API because every row has the wrong `kek_id`.

Sequence:

1. Pause writes to encrypted columns: stop the API + worker fleets (10 min planned downtime per cutover plan).
2. `pg_dump` from current Postgres → `pg_restore` into RDS.
3. **Run this script.** (see Execution below)
4. Verify count = 0 on the post-run check (see Verification).
5. Flip `KEY_MANAGER=kms` + boot guard env on the API + worker tasks.
6. ECS rolling deploy back to full capacity.

## Pre-flight

You need:

- **`LOCAL_KEK_HEX`** — the same 32-byte hex value the production API is currently booting with. Get it from 1Password → Vault: Production → `EAZEPAY_LOCAL_KEK_HEX`. **Do not regenerate.** Re-wrapping under a fresh source KEK destroys every existing envelope.
- **AWS KMS key ARN + IAM auth** — the destination CMK. Until the AWS adapter ships, the script defaults to `MockKmsKeyManager` with `kek_id='mock-kms'`; pass `MOCK_KMS_KEK_HEX` to pin its value across runs (deterministic for re-run testing).
- **`DATABASE_URL`** — points at the post-`pg_restore` RDS endpoint.
- **Approval** — solo-founder context: write the dry-run output + the cutover decision to the Council audit log per `agent-audit-log` discipline. This is a 4-eyes-equivalent paper trail for a SOC2 change to PII at rest.

## Execution

### 1. Dry-run

```bash
cd /path/to/eaze-billing
export LOCAL_KEK_HEX=...        # the CURRENT prod KEK
export DATABASE_URL=...          # the RDS endpoint
pnpm tsx scripts/migrate-deks-to-kms.ts --dry-run --batch-size=500 --concurrency=10
```

Expected output (one JSON line per batch + a final summary):

```json
{"level":"info","msg":"run.start","runId":"...","mode":"dry-run","sourceKekId":"local-dev","destinationKekId":"mock-kms",...}
{"level":"info","msg":"batch.done","table":"consumer_profiles","batchNum":0,"cursor":"...","fetched":500,"written":500,"stats":{...},"ms":4123}
...
{"level":"info","msg":"summary","summary":{"totals":{"total":X,"succeeded":X,"skipped":0,"failed":0},...}}
```

Review the `totals` block. Confirm:

- `total` matches `SELECT count(*) FROM consumer_profiles + beneficial_owners + ...` (the seven tables this script knows about).
- `failed` is `0`. Any non-zero failure count blocks `--commit` — investigate the JSONL failure file.
- The dry-run wrote NOTHING to the DB (`db.writes` count is 0, `dek_rewrap_progress` is empty).

### 2. Commit

```bash
pnpm tsx scripts/migrate-deks-to-kms.ts --commit --batch-size=500 --concurrency=10 --throttle-ms=100
```

Per-batch progress lands in `dek_rewrap_progress`. Audit rows land in `audit_outbox` with `action='pii_dek.rewrapped.<table_singular>'`, one per rewrapped row.

### 3. Estimated time

Formula: `rows × ~10ms_KMS_call ÷ concurrency = total_seconds`

| Row count | Concurrency | Expected wall-clock |
| --------- | ----------- | ------------------- |
| 10k       | 10          | ~10 s               |
| 100k      | 10          | ~100 s              |
| 1M        | 10          | ~17 min             |
| 1M        | 20          | ~8 min              |
| 10M       | 20          | ~83 min             |

Add per-batch throttle (`--throttle-ms × batch_count`) for the wall-clock floor. KMS's per-account quota is ~5500 ops/sec (soft), so 20 concurrent calls is well under cap; bump to 40 only if you see KMS-side rate-limit errors AND you've confirmed AWS isn't throttling other services on the same account.

### 4. Resume after interruption

If the script halts (KMS throttle, network blip, SIGKILL), restart with:

```bash
pnpm tsx scripts/migrate-deks-to-kms.ts --commit --resume-from=auto --batch-size=500
```

`--resume-from=auto` reads the most recent unfinished `dek_rewrap_progress` row per table and continues from `last_processed_id`. Rows BEFORE the cursor are not re-fetched; rows already-rewrapped that happen to be re-fetched are skipped on the `kek_id` check.

To resume one table manually (e.g., to skip a known-bad row range):

```bash
pnpm tsx scripts/migrate-deks-to-kms.ts --commit \
  --table=consumer_profiles \
  --resume-from=<uuid-after-which-to-continue>
```

## Verification

After the run completes (or before flipping the boot guard), run these against the production DB:

```sql
-- Should return 0 for every table.
SELECT 'consumer_profiles' AS tbl, count(*) FROM consumer_profiles WHERE kek_id != 'mock-kms'
UNION ALL
SELECT 'beneficial_owners', count(*) FROM beneficial_owners WHERE kek_id != 'mock-kms';
```

(Substitute the real KMS key ARN for `'mock-kms'` once the AWS adapter ships.)

For opaque-envelope tables (no `kek_id` column — KEK lives inside the base64 payload), use:

```sql
-- Non-null rows whose envelope's `"k":` field is NOT the destination KEK.
-- This is a brittle string match — only use as a coarse smoke check;
-- the script's own summary (`totals.failed=0`) is the authoritative signal.
SELECT 'users_totp' AS tbl, count(*) FROM users
  WHERE totp_secret_ciphertext IS NOT NULL
    AND totp_secret_ciphertext NOT LIKE '%"k":"mock-kms"%';
```

(Decode the base64 + parse the inner JSON if you need a definitive answer; the simple LIKE works because `mock-kms` is a stable literal in the envelope.)

A spot-check that the rewrap preserved PII semantics: pick one consumer_profile row, boot a one-off API instance with the destination KEK wired, fetch the profile via the `/v1/users/me` endpoint, confirm the decrypted PII matches expectation. The end-to-end open() call is the load-bearing acceptance test — if AES-GCM auth fails, you'll get an exception immediately rather than a silent bad-read.

## Rollback

Three failure modes, three rollback paths:

### A. Script halts partway, KMS is healthy

Re-run with `--resume-from=auto`. The partial state is safe:

- Rows BEFORE the last progress cursor are on `mock-kms` — readable by the destination KEK.
- Rows AFTER the cursor are still on `local-dev` — readable by the source KEK (LocalKeyManager).
- The boot guard is NOT yet flipped, so the API still reads both.

No data loss. No special remediation. Re-run picks up where it stopped.

### B. KMS outage mid-migration

Same as A. The script's per-batch transaction means writes are atomic per batch; an in-flight batch either commits fully or rolls back fully. KMS comes back → re-run with `--resume-from=auto`. Wall-clock impact: the dead time plus the remaining-row processing time.

### C. The rewrap produced wrong ciphertext (silent corruption)

This is the worst case and the reason we test in staging first. Detection:

1. Post-run API smoke test fails to open a known-good row's PII.
2. Audit-log query shows the row was rewrapped: `SELECT * FROM audit_outbox WHERE action LIKE 'pii_dek.rewrapped%' AND target_id = '<row-id>'`.

Recovery: restore the affected rows from the pre-cutover Postgres backup. The `pg_dump → pg_restore` from Step 1 of the cutover sequence is the snapshot you fall back to; restore the encrypted columns row-by-row using the row id from the audit log.

**Do not** attempt to re-wrap the corrupted row in place. The plaintext DEK has been destroyed at this point (the script `.fill(0)`s it after wrap); the only recovery is the pre-cutover backup.

## Out of scope

The script does **not** rewrap these envelopes:

- **`LenderConnection.apiKeyCiphertext` / `apiSecretCiphertext` / `webhookSecretCiphertext`** — uses `CredentialVaultService` (services/lender/src/internal/credential-vault.service.ts), which encrypts both DEK + payload into a single base64 envelope keyed by the same `LOCAL_KEK_HEX` but with a different layout (no `kek_id` column, no per-row identifier). The cutover plan handles these separately by manually rotating each lender connection's credentials via the partner-portal admin UI; the dual-key window in `docs/runbooks/key-rotation.md` is the canonical procedure.
- **`audit_outbox.before` / `.after`** — not encrypted; this is the audit channel itself.

If a future PR adds new encrypted PII columns, register them in the `TABLES` map at the top of `scripts/migrate-deks-to-kms.ts` and add a `make<Type>Row()` fixture in the spec — the rest of the script is table-agnostic.

## Related

- [`scripts/migrate-deks-to-kms.ts`](../../scripts/migrate-deks-to-kms.ts) — the script itself.
- [`scripts/migrate-deks-to-kms.spec.ts`](../../scripts/migrate-deks-to-kms.spec.ts) — covers idempotency, resume, failure handling, progress tracking, dry-run semantics.
- [`libs/integrations-core/src/key-manager.ts`](../../libs/integrations-core/src/key-manager.ts) — `KeyManager` port.
- [`libs/integrations-core/src/mock-kms-key-manager.ts`](../../libs/integrations-core/src/mock-kms-key-manager.ts) — destination mock used until the AWS adapter ships.
- [`apps/api/prisma/migrations/20260527_dek_rewrap_progress`](../../apps/api/prisma/migrations/20260527_dek_rewrap_progress) — `dek_rewrap_progress` table for resumable cursor.
- [`docs/runbooks/key-rotation.md`](./key-rotation.md) — out-of-band rotation procedure for lender credentials.
