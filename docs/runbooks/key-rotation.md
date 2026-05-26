# Key Rotation — Scheduled, Offboard, and Compromise

> **TL;DR (60s):** Rotate a secret. Three trigger types: scheduled (every 90 days), offboard (someone with access left), or compromise (leak suspected/confirmed). First action: classify the trigger to pick a procedure — compromise is fast-path (cut immediately, accept downtime); scheduled/offboard uses the **dual-key window** (accept old+new for 5 min, then cut). **Always** write the rotation event to `audit_log`. Roll forward — never re-issue the old secret.

## When this fires

- Calendar: every 90 days per secret (track in `docs/security/secret-rotation-schedule.md`)
- Personnel: someone with secret access left the org — rotate within 24 hr
- Leak: secret found in git history, logs, screenshot, third-party breach notification — rotate within 1 hr
- Provider-driven: MiCamp / HighSale / Stripe initiated a rotation on their side

## Severity

- **Sev1** — confirmed compromise (secret in public git, partner reports unauthorized API calls)
- **Sev2** — suspected compromise (secret in private repo logs, ex-employee with access never revoked)
- **Sev3** — scheduled rotation (no known compromise)

## Secrets in scope

Track each in 1Password → Vault: Production. Bracketed value is the env var key.

| Secret                                   | Env var                         | Service                     | Rotation owner |
| ---------------------------------------- | ------------------------------- | --------------------------- | -------------- |
| MiCamp webhook secret                    | `MICAMP_WEBHOOK_SECRET`         | partner-portal, workers     | Brodie         |
| MiCamp API key                           | `MICAMP_API_KEY`                | eazepay-api                 | Brodie         |
| HighSale webhook secret                  | `HIGHSALE_WEBHOOK_SECRET`       | partner-portal, workers     | Brodie         |
| HighSale agency key                      | `HIGHSALE_AGENCY_KEY`           | partner-portal, eazepay-api | Brodie         |
| Trutopia engine key                      | `TRUTOPIA_ENGINE_KEY`           | eazepay-api                 | Brodie         |
| Database URL (rotate password component) | `DATABASE_URL`                  | all services                | Brodie         |
| Stripe webhook secret                    | `STRIPE_WEBHOOK_SECRET`         | partner-portal              | Brodie         |
| Per-lender HMAC secrets                  | `lenders.webhook_secret` column | partner-portal              | Brodie         |

The per-lender HMAC is stored _in the DB_ (`lenders.webhook_secret`), not in env — rotate by `UPDATE lenders SET webhook_secret=...` with the dual-key window handled at the verifier (see step 3 below).

## Diagnosis (5 min)

### 1. Classify the trigger

```
Was the secret published publicly (GitHub, paste site, screenshot)?
├─ YES → Sev1 compromise — go to Mitigation step 1A (FAST CUT).
└─ NO ──→ Is the secret known to a person who no longer has access?
          ├─ YES → Sev2 offboard — go to Mitigation step 1B (DUAL-KEY).
          └─ NO ──→ Sev3 scheduled — go to Mitigation step 1B (DUAL-KEY).
```

### 2. Confirm the secret's current usage

```bash
# Where is this secret used?
grep -rn "MICAMP_WEBHOOK_SECRET" apps services libs --include='*.ts' --include='*.tsx'

# Is it currently being read?
railway logs --service partner-portal --tail 500 | grep -i 'micamp.webhook'
```

Healthy: handful of references, all in expected modules.
Sick: references outside expected modules (rotate + investigate why).

### 3. Audit recent use of the credential

```sql
-- If the secret is used to sign inbound webhooks, check the inbox for
-- recent activity from the provider.
SELECT processing_status, count(*)
FROM webhook_inbox
WHERE provider = '<provider>'
  AND received_at > now() - interval '24 hours'
GROUP BY processing_status;
```

Healthy: normal volume, low `failed` count.
Sick: spike of `failed` with `failure_reason LIKE '%signature%'` → an attacker may already be probing.

## Mitigation (do in order)

### 1A. FAST CUT (compromise — Sev1)

Accept downtime to stop the bleed. Skip the dual-key window.

1. **Mint the new secret upstream** (MiCamp portal, HighSale portal, Stripe dashboard, `openssl rand -hex 32` for our own HMACs).
2. **Revoke the old secret upstream immediately.** Provider must confirm revocation.
3. **Update Railway env vars** for every service in the table above that uses this secret. Railway redeploys on env change.
   ```bash
   railway variables set MICAMP_WEBHOOK_SECRET=<new> --service partner-portal
   railway variables set MICAMP_WEBHOOK_SECRET=<new> --service workers
   railway redeploy --service partner-portal
   railway redeploy --service workers
   ```
4. **Expect inbound webhook failures during the cut window** — they will land in `webhook_inbox` with `failure_reason LIKE '%signature%'` and the upstream will retry per their policy. After cut completes (≤5 min), MiCamp/HighSale resend automatically.
5. **Audit-log the rotation.**
   ```sql
   INSERT INTO audit_log (actor, action, target_type, target_id, payload_json)
   VALUES ('brodie', 'secret.rotated.fast_cut', 'secret', 'MICAMP_WEBHOOK_SECRET',
           json_build_object(
             'trigger', 'compromise',
             'cut_at', now(),
             'downtime_expected_sec', 30,
             'evidence', '<gdoc / ticket url>'
           )::text);
   ```
6. Verify per Verification below.

### 1B. DUAL-KEY WINDOW (scheduled or offboard — Sev2/Sev3)

Zero-downtime rotation. The verifier accepts old+new for a 5-minute window.

1. **Mint the new secret upstream** (or `openssl rand -hex 32` for our HMACs).
2. **Deploy verifier accepting both keys.** Set `MICAMP_WEBHOOK_SECRET_NEXT` alongside `MICAMP_WEBHOOK_SECRET`; the verifier tries primary first, then `_NEXT`.
   ```bash
   railway variables set MICAMP_WEBHOOK_SECRET_NEXT=<new> --service partner-portal
   railway variables set MICAMP_WEBHOOK_SECRET_NEXT=<new> --service workers
   railway redeploy --service partner-portal
   railway redeploy --service workers
   # Wait for healthchecks to pass.
   ```
3. **Flip the provider to the new secret.** In the MiCamp / HighSale / Stripe portal, switch signing key to the new value. Provider signs new events with `_NEXT`.
4. **Wait 5 minutes.** Watch `webhook_inbox` — `failed` rows should be zero while `processing_status='done'` keeps incrementing. If you see failures, halt — your `_NEXT` value does not match what the provider is signing with.
5. **Promote NEXT to primary, drop NEXT.**
   ```bash
   railway variables set MICAMP_WEBHOOK_SECRET=<new> --service partner-portal
   railway variables unset MICAMP_WEBHOOK_SECRET_NEXT --service partner-portal
   railway variables set MICAMP_WEBHOOK_SECRET=<new> --service workers
   railway variables unset MICAMP_WEBHOOK_SECRET_NEXT --service workers
   railway redeploy --service partner-portal
   railway redeploy --service workers
   ```
6. **Audit-log the rotation.**
   ```sql
   INSERT INTO audit_log (actor, action, target_type, target_id, payload_json)
   VALUES ('brodie', 'secret.rotated.dual_key', 'secret', 'MICAMP_WEBHOOK_SECRET',
           json_build_object(
             'trigger', '<scheduled | offboard>',
             'window_started_at', '<ISO>',
             'window_closed_at', '<ISO>',
             'failures_during_window', 0
           )::text);
   ```

### Per-lender HMAC variant (`lenders.webhook_secret`)

The verifier in `apps/partner-portal/lib/lenders/verify-signature.ts` accepts either `webhook_secret` or `webhook_secret_next` (column to be added if missing — see Gaps).

```sql
-- Stage NEW secret
UPDATE lenders SET webhook_secret_next = '<new>', updated_at = now() WHERE id = '<lender-id>';

-- (Provider switches to new on their side; wait 5 min watching webhook_inbox.)

-- Promote
UPDATE lenders
SET webhook_secret = '<new>',
    webhook_secret_next = NULL,
    updated_at = now()
WHERE id = '<lender-id>';

INSERT INTO audit_log (actor, action, target_type, target_id, payload_json)
VALUES ('brodie', 'secret.rotated.dual_key', 'lender', '<lender-id>',
        json_build_object('field', 'webhook_secret', 'trigger', '<scheduled|offboard>')::text);
```

### Recovery if rotation fails mid-flight

You're in the dual-key window and seeing signature failures.

1. **Halt — do not promote NEXT to primary.** Keep the old primary live.
2. **Snapshot the failing events** for inspection.
   ```sql
   SELECT id, provider, event_type, failure_reason, raw_body, signature_header
   FROM webhook_inbox
   WHERE provider = '<provider>'
     AND processing_status = 'failed'
     AND received_at > now() - interval '30 minutes'
   ORDER BY received_at DESC LIMIT 20;
   ```
3. **Test the new secret manually** against one failing event's raw body + signature header. If signature does not verify, your `_NEXT` value does not match the provider's. Re-fetch from the provider.
4. **If you've already promoted NEXT to primary but it was wrong**, you cannot un-rotate — the provider has already cut over. Mint another new secret, fast-cut to it, and accept the downtime.

## Root cause categories (for compromise events)

| Category                     | Disambiguation test                        | Action                                                         |
| ---------------------------- | ------------------------------------------ | -------------------------------------------------------------- |
| Secret committed to git      | GitGuardian / GitHub secret-scanning alert | Rotate + force-push history rewrite + notify GitHub support    |
| Secret in logs               | grep production logs for the value         | Rotate + audit log scrubber + add secret to log-redaction list |
| Personnel offboard           | someone left with access                   | Rotate within 24h of offboard                                  |
| Provider breach              | provider notification (MiCamp/Stripe etc)  | Rotate per their guidance                                      |
| Phishing / device compromise | engineer's machine compromised             | Rotate ALL secrets that engineer had access to                 |

## Communication template

### Internal Slack (compromise)

```
SEV-{N} | Secret rotation — {secret name} | trigger={compromise|offboard|scheduled}
Cut method: {fast | dual-key}
Affected services: partner-portal, workers
Expected downtime: {0 sec (dual-key) | 30-60 sec (fast cut)}
Webhook inbox check: failed={N} done={N}
Next update: {HH:MM UTC}
```

### Provider communication (when we initiate rotation due to suspected leak)

```
Subject: Coordinated webhook-secret rotation — EazePay

Hi {provider contact},

We are initiating a coordinated rotation of our webhook-signing secret
for EazePay's inbound integration, starting {HH:MM UTC}. We will run a
dual-key acceptance window for ~5 minutes, then drop the old secret.

Please mint a new signing secret on your side and notify us when ready;
we will load it as the staged secret on ours, then ask you to flip.

— EazePay Engineering
```

## Post-incident

| Item                                                                                            | Owner  | Timing       |
| ----------------------------------------------------------------------------------------------- | ------ | ------------ |
| `audit_log` row written                                                                         | Brodie | At rotation  |
| Secret-rotation schedule updated (next-due date pushed +90d)                                    | Brodie | Same day     |
| 1Password vault updated with new secret + old secret marked retired                             | Brodie | At rotation  |
| For compromise: postmortem covering how the secret leaked                                       | Brodie | Within 72 hr |
| 48h action: check `webhook_inbox` for any failed rows still attributable to the rotation window | Brodie | Within 48 hr |
| 7d follow-up: confirm no upstream calls still using old secret (provider analytics)             | Brodie | Day 7        |

## Gaps flagged

- `lenders.webhook_secret_next` column does not exist yet — the dual-key window for per-lender HMACs requires adding it. Until then, per-lender rotations must use the fast-cut path.
- No automated secret-rotation reminder. File: cron job that posts to `#ops-alerts` 14 days before each 90-day rotation due date.

## Related runbooks

- [`incident-response.md`](incident-response.md) — master
- [`webhook-dlq.md`](webhook-dlq.md) — failures during/after rotation land here
- [`partner-suspension.md`](partner-suspension.md) — if a partner-specific HMAC leak is the cause

---

_Last reviewed: 2026-05-26 — Owner: Brodie_
