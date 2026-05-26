# Partner Suspension — Stop a Live Partner Safely

> **TL;DR (60s):** A live partner needs to be stopped — performance fraud, AML hit, compliance request, regulator subpoena. First action: confirm admin auth, then walk the four-step suspension sequence (partners.status flip → pause provisioning → disable marketplace → pause MiCamp MID). **Never delete the MID** — funds may be in flight and must reconcile through the existing row. Write everything to `audit_log` with the reason; regulators replay this table.

## When this fires

- Internal: chargeback rate >2% over 7 days, refund rate >5%, sustained KYC failures
- Partner-side: partner requests offboarding (planned)
- External: AML/fraud signal from MiCamp or HighSale
- Regulatory: CFPB / state DFI / NYDFS subpoena, AG inquiry, court order
- Operator manual: any "stop them now" decision by Brodie

**Customer impact:** consumers on the partner's `/apply/<brand>?ref=...` funnel will get a 410 Gone response (handled by partner-status middleware). Existing in-flight loans continue to fund / service normally.

## Severity

- **Sev1** — regulator hold OR active consumer harm (suspected fraud actively running). Suspend immediately, no pre-notify.
- **Sev2** — performance suspension (chargebacks, refunds). Same-day suspend after Brodie confirms.
- **Sev3** — planned offboarding (partner requested, end of contract). Schedule and notify in advance.

## Diagnosis (5 min)

### 1. Verify admin auth

```bash
# Verify your session has the admin role.
curl -fsS https://partner-portal.up.railway.app/api/session \
  -H "Cookie: ${ADMIN_SESSION_COOKIE}" | jq '.mode, .isOperator'
```

Healthy: `"demo"` and `true` (admin gate per current `requireAdmin()`).
Sick: anything else — you cannot perform suspension actions. Stop.

### 2. Find the partner and confirm scope

```sql
SELECT id, brand, legal_name, status, primary_contact_email, created_at, updated_at
FROM partners
WHERE id = '<partner-id>' OR legal_name ILIKE '%<search>%';
```

Healthy: one row, `status='active'`.
Sick: multiple rows (id collision — investigate) or already `status='suspended'` (someone got there first; check `audit_log`).

### 3. Snapshot the partner's live footprint

```sql
-- In-flight applications
SELECT count(*) FILTER (WHERE status IN ('submitted', 'in_review', 'approved')) AS in_flight,
       count(*) FILTER (WHERE status = 'funded' AND updated_at > now() - interval '30 days') AS recent_funded
FROM applications
WHERE partner_id = '<partner-id>';

-- Active MIDs
SELECT id, micamp_mid, provisioning_status, volume_cents_to_date, last_settled_at
FROM mids
WHERE partner_id = '<partner-id>';

-- Marketplace entries
SELECT lender_id, state, reason
FROM partner_marketplaces
WHERE partner_id = '<partner-id>';
```

Healthy snapshot: write to `/tmp/partner-suspension-<id>-snapshot.csv` and upload to the incident channel before any state change.

## Mitigation (do in order)

**Pre-flight: log the intent.** Before flipping any state, drop the kickoff audit row so the audit trail starts cleanly.

```sql
INSERT INTO audit_log (actor, action, target_type, target_id, payload_json, ip_address, user_agent)
VALUES ('brodie', 'partner.suspension.initiated', 'partner', '<partner-id>',
        json_build_object(
          'reason', '<one-line reason — performance / aml / regulatory / planned>',
          'severity', 'SEV-<N>',
          'sev1_no_prenotify', <true | false>
        )::text,
        '<your-ip>', '<your-user-agent>');
```

1. **Flip `partners.status='suspended'`.** Why: middleware on `/apply/<brand>` reads this column; suspended partners serve 410 to new consumers immediately.

   ```sql
   UPDATE partners
   SET status = 'suspended', updated_at = now()
   WHERE id = '<partner-id>' AND status = 'active';
   ```

   Verify: `SELECT status FROM partners WHERE id='<partner-id>'` → `'suspended'`. Test `curl /apply/<brand>?ref=<partner-id>` returns 410.

2. **Pause future provisioning runs.** Why: a queued provisioning_runs row could undo step 1 by re-seeding the partner. Cancel any queued/running runs for this partner.

   ```sql
   UPDATE provisioning_runs
   SET status = 'failed',
       failure_reason = COALESCE(failure_reason, '') || ' [suspended:' || '<reason>' || ']',
       completed_at = now()
   WHERE partner_id = '<partner-id>'
     AND status IN ('queued', 'running');
   ```

   Verify: no rows return from `SELECT … WHERE partner_id=… AND status IN ('queued','running')`.

3. **Disable marketplace entries.** Why: even with `partners.status='suspended'` blocking the apply funnel, the lender marketplace UI could still surface the partner. Belt-and-braces.

   ```sql
   UPDATE partner_marketplaces
   SET state = 'disabled',
       reason = '<one-line reason>',
       changed_by = 'brodie',
       updated_at = now()
   WHERE partner_id = '<partner-id>'
     AND state = 'enabled';
   ```

   Verify: `SELECT count(*) FILTER (WHERE state='enabled') FROM partner_marketplaces WHERE partner_id='<partner-id>'` returns 0.

4. **Pause MiCamp MID — do NOT delete.** Why: there may be funds in flight (a settlement webhook arriving in the next 24h credits this MID; deleting orphans the settlement). MiCamp also retains the MID record per their service agreement.

   ```sql
   -- CAUTION: paused, NOT deleted. partners → mids has ON DELETE RESTRICT
   -- for exactly this reason. Do not try to work around it.
   UPDATE mids
   SET provisioning_status = 'paused', updated_at = now()
   WHERE partner_id = '<partner-id>'
     AND provisioning_status IN ('active', 'underwriting_post', 'underwriting_pre');
   ```

   Then **call MiCamp** (Steven) to confirm upstream pause. Settlement webhooks still arrive and credit the paused MID correctly; new authorisations are blocked at the processor.
   Verify: `mids.provisioning_status='paused'` locally + MiCamp confirms.

5. **Notify the partner** (Sev2/Sev3 only — see Sev1 variant below).

   ```
   Email to partners.primary_contact_email using the template below.
   ```

6. **Document the reason in `audit_log`.** Final row closes the suspension event.
   ```sql
   INSERT INTO audit_log (actor, action, target_type, target_id, payload_json)
   VALUES ('brodie', 'partner.suspended', 'partner', '<partner-id>',
           json_build_object(
             'reason', '<one-line reason>',
             'evidence_links', '<gdoc / ticket urls>',
             'reversible', <true | false>,
             'reversal_conditions', '<plain english>'
           )::text);
   ```

### Regulatory hold variant (CFPB / state DFI / NYDFS / court order)

**Do NOT pre-notify the partner.** Pre-notification of a regulator-driven hold can itself be a violation (tipping off). Execute steps 1–4 silently. Skip step 5. Add a special audit action:

```sql
INSERT INTO audit_log (actor, action, target_type, target_id, payload_json)
VALUES ('brodie', 'partner.suspended.regulatory_hold', 'partner', '<partner-id>',
        json_build_object(
          'agency', '<CFPB | state-DFI-XX | NYDFS | court>',
          'reference_number', '<their case / subpoena #>',
          'received_at', '<ISO>',
          'do_not_notify_partner', true,
          'counsel_engaged', true
        )::text);
```

Loop in legal counsel within the hour. Comms to the partner happen only with counsel sign-off.

## Reversal procedure

Suspension is reversible (except for regulatory holds, which require an explicit release from the agency).

1. Verify the reversal condition is met (chargeback rate dropped, AML cleared, planned-offboarding cancelled).
2. Reverse step 4: `UPDATE mids SET provisioning_status='active' WHERE partner_id=… AND provisioning_status='paused'`. Then **call MiCamp** to unpause upstream.
3. Reverse step 3: `UPDATE partner_marketplaces SET state='enabled' WHERE partner_id=… AND state='disabled'`.
4. Reverse step 1: `UPDATE partners SET status='active' WHERE id=… AND status='suspended'`.
5. Step 2 is not reversed — the cancelled provisioning_runs stay cancelled; if needed, re-run provisioning fresh.
6. Log the reversal:
   ```sql
   INSERT INTO audit_log (actor, action, target_type, target_id, payload_json)
   VALUES ('brodie', 'partner.unsuspended', 'partner', '<partner-id>',
           json_build_object('reason', '<why reversed>', 'previous_reason', '<original>')::text);
   ```

## Root cause categories

| Category                         | Disambiguation test                                  | Notes                                              |
| -------------------------------- | ---------------------------------------------------- | -------------------------------------------------- |
| Performance / chargebacks        | Internal dashboard shows >2% chargeback rate over 7d | Reversible after 30 days clean                     |
| AML / sanctions hit              | MiCamp or HighSale notified                          | Loop in counsel; reversal needs cleared screening  |
| Compliance — partner-side breach | Partner failed annual KYC/AML attestation            | Reversible on attestation                          |
| Regulatory hold                  | Subpoena, court order, formal regulator request      | Counsel-led; no pre-notify                         |
| Planned offboarding              | Partner requested, contract ending                   | Schedule, notify, no surprise                      |
| Operator manual                  | Brodie decision                                      | Document the reasoning in `audit_log.payload_json` |

## Communication template

### Internal Slack (Sev1)

```
SEV-1 | Partner suspended — {partner_id} | {legal_name}
Reason: {one line}
Steps complete: partner=done | provisioning=done | marketplace=done | mid=pending-MiCamp-call
Partner notified: {yes | no — regulatory hold}
Counsel engaged: {yes | no | n/a}
Next update: {HH:MM UTC}
```

### Partner email (standard suspension — Sev2/Sev3)

```
Subject: EazePay account suspension — action required — {brand}

Hi {first name},

We have temporarily suspended new application traffic on your EazePay
account effective {date UTC}. In-flight applications and settlements
continue as normal.

Reason: {one-line — "elevated chargeback rate" / "annual KYC attestation
overdue" / "you requested offboarding"}.

Next steps: {what they need to do, or "we will be in touch within N
business days with next steps"}.

If this is unexpected, reply to this email and we will arrange a call.

— EazePay Risk & Compliance
```

### Partner email (reversal)

```
Subject: EazePay account reactivated — {brand}

Hi {first name},

Your EazePay account is reactivated effective {date UTC}. New
application traffic on `/apply/{brand}` is flowing again, and your
processing MID is live.

If you see anything unexpected in the first 48 hours, reply to this email.

— EazePay Risk & Compliance
```

## Post-incident

| Item                                                                                                                                                 | Owner  | Timing        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------- |
| Final audit_log row written with reason + evidence links                                                                                             | Brodie | At suspension |
| MiCamp + HighSale upstream pause confirmed                                                                                                           | Brodie | Within 4 hr   |
| Legal counsel notified (regulatory holds only)                                                                                                       | Brodie | Within 1 hr   |
| 48h action: weekly check of `mids.last_settled_at` for paused MIDs (orphaned settlements)                                                            | Brodie | Recurring     |
| 7d follow-up: verify no consumer reached the funnel post-suspension (`applications WHERE partner_id=… AND created_at>suspension_at` should be empty) | Brodie | Day 7         |

## Related runbooks

- [`incident-response.md`](incident-response.md) — master
- [`provisioning-rollback.md`](provisioning-rollback.md) — if the partner is mid-provisioning, roll back rather than suspend
- [`key-rotation.md`](key-rotation.md) — if suspension is because partner-specific HMAC was leaked

---

_Last reviewed: 2026-05-26 — Owner: Brodie_
