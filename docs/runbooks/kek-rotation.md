# KEK Rotation Runbook

Status: **PLACEHOLDER** — structural scaffold only. Fill in each
section before the first production cutover.

Related runbook: `docs/runbooks/key-rotation.md` covers application-
level signing keys (JWT, webhook HMAC, esign HMAC). This runbook
covers the Key Encryption Key (KEK) — the root of the PII envelope
encryption hierarchy.

---

## Scope

The KEK wraps every per-tenant Data Encryption Key (DEK) in the
PII envelope (`services/user/src/internal/pii-vault.service.ts`).
A compromised KEK exposes every PII row in the database.

Two adapter implementations exist:

- `LocalKeyManager` — dev only. KEK is a 32-byte value loaded from
  `LOCAL_KEK_HEX`. Stored at rest on whatever filesystem holds the
  env. **Forbidden in production** by `apps/api/src/config/env.ts`
  (PE-KEK-01).
- `KmsKeyManager` — production. Wraps AWS KMS. **Currently a stub**
  (`services/user/src/adapters/kms-key-manager.adapter.ts`) — the
  dispatch path is wired but the AWS SDK calls return random bytes
  and refuse to decrypt. Replace before any tenant onboarding.

## Triggers for rotation

Rotate the KEK when any of:

- [ ] Scheduled — annually at minimum (PCI DSS 3.6.4 cryptoperiod).
- [ ] Compromise suspected — any unexplained KMS access in CloudTrail.
- [ ] Personnel change — anyone with prior KMS admin access leaves.
- [ ] Adapter upgrade — moving from LocalKeyManager to KmsKeyManager
      counts as a rotation, not a fresh install. Existing DEKs must
      be re-wrapped.

## Pre-flight checklist

- [ ] AWS KMS key created in the production region with multi-region
      key set if cross-region DR is in scope.
- [ ] Key policy reviews complete — only the production IAM role for
      the API task can `kms:GenerateDataKey` and `kms:Decrypt`.
- [ ] CloudTrail logging on the key is enabled and going to the
      compliance log bucket.
- [ ] Alarms configured for unexpected `kms:Decrypt` volume.
- [ ] Backup KEK ARN documented in the password manager.
- [ ] On-call paged and aware of the rotation window.

## Rotation procedure

### A. Standard rotation (re-wrap DEKs under new KEK)

1. [ ] Schedule a maintenance window — DEK re-wrap is online but the
       database load is non-trivial; aim for low-traffic hours.
2. [ ] Create the new KEK in KMS. Set `Description` to include the
       rotation date. Do NOT delete the previous KEK.
3. [ ] Deploy the API with both ARNs configured:
   - `KMS_KEY_ARN` — the new KEK (writer)
   - `KMS_KEY_ARN_LEGACY` — the previous KEK (reader)
     The `KmsKeyManager` will use the new KEK for `generateDataKey`
     but still accept the legacy KEK when `decryptDataKey` is
     called with the legacy `kekId`.
4. [ ] Run the DEK re-wrap backfill job (`tools/rewrap-deks.ts` —
       to be authored alongside the real KmsKeyManager). The job:
   - selects rows in batches of N
   - decrypts the wrapped DEK under the legacy KEK
   - re-wraps under the new KEK
   - writes back atomically with the new `kekId`
   - emits an `AuditLog` row per batch
   - is idempotent + restartable
5. [ ] Verify no rows remain with the legacy `kekId`.
6. [ ] Remove `KMS_KEY_ARN_LEGACY` from the deploy.
7. [ ] Schedule the legacy KEK for deletion in KMS (minimum 7-day
       window — DO NOT shorten; this is your last revert path).
8. [ ] Run the audit chain verifier
       (`services/audit/src/internal/chain-verify.cron.ts`) to
       confirm the rotation's audit-log entries chained cleanly.

### B. Emergency rotation (suspected compromise)

1. [ ] Immediately disable the suspected KEK in KMS (`Disable Key`).
       This breaks live traffic — accept the outage; better than
       exfiltration continuing.
2. [ ] Notify Compliance + on-call.
3. [ ] Investigate CloudTrail for the suspected access window.
4. [ ] Once the breach window is bounded, follow steps A.2–A.8
       above with the disabled KEK as the legacy reader.
5. [ ] File an incident report. If the suspected access window
       included successful `Decrypt` calls from an unexpected
       principal, the breach is in-scope for state breach
       notification statutes — engage Legal.

## Adapter swap procedure (LocalKeyManager → KmsKeyManager)

This is the cutover from development-grade to production-grade key
management. It is technically a rotation (every DEK is re-wrapped
under a different KEK in a different boundary).

1. [ ] Stand up the AWS KMS key per the pre-flight checklist.
2. [ ] Replace the stub `KmsKeyManager` implementation with the
       real `@aws-sdk/client-kms` calls (see the docstring in
       `services/user/src/adapters/kms-key-manager.adapter.ts`).
3. [ ] Deploy to staging with `KEY_MANAGER=kms`. Verify a fresh PII
       seal/open round-trips end-to-end.
4. [ ] Author the DEK re-wrap backfill job referenced above.
5. [ ] Run the backfill in staging against a copy of production
       data. Time it.
6. [ ] Schedule the production cutover window.
7. [ ] In production:
   - Deploy with both `KEY_MANAGER=kms` AND
     `LOCAL_KEK_HEX` still set (the LocalKeyManager remains
     constructable as the legacy reader during cutover).
   - Run the backfill.
   - Remove `LOCAL_KEK_HEX` from env.
   - Confirm `apps/api/src/config/env.ts` PE-KEK-01 boot guard
     is now the only thing keeping LocalKeyManager out.

## Verification

After any rotation, run:

- [ ] `pnpm nx test service-user` — encryption round-trips.
- [ ] `pnpm nx test service-audit` — chain integrity verifier still
      consistent across the rotation's audit entries.
- [ ] Manual spot-check: open a known PII row from the consumer
      portal and confirm fields decrypt correctly.
- [ ] CloudTrail review: confirm the only principal calling
      `kms:Decrypt` is the production API role.

## Rollback

| Scenario                                              | Rollback                                                                                  |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Rotation deployed, app boot fails                     | Revert deploy. Old KEK still accepted because not yet scheduled for deletion.             |
| Rotation deployed, partial re-wrap, errors surface    | Stop the backfill. Re-deploy with `KMS_KEY_ARN_LEGACY` retained. Investigate.             |
| Legacy KEK scheduled for deletion, then problem found | Cancel the scheduled deletion in KMS immediately (it's reversible for the window length). |
| Legacy KEK actually deleted                           | UNRECOVERABLE for any row not yet re-wrapped. This is why step A.7 minimum is 7 days.     |

## Owner

Platform Engineering — primary on-call. Compliance is a stakeholder
on every rotation and MUST be notified at the start + end of the
window.

## References

- SOC2 CC6.1, CC6.7 — logical access + transmission protection
- PCI DSS 3.5, 3.6 — key management lifecycle, cryptoperiods
- NIST SP 800-57 — key management recommendations
- `services/user/src/ports/key-manager.port.ts` — adapter contract
- `services/user/src/adapters/kms-key-manager.adapter.ts` — stub
  awaiting real KMS wiring
- `apps/api/src/config/env.ts` — PE-KEK-01 boot guard
