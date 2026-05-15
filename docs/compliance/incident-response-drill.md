# Incident response drill — tabletop template + worked example

> SOC 2 CC7.4 / CC7.5 — Incident detection, response, and recovery.
> Cadence: tabletop drill every 90 days. Owner: CCO + IC pool.
> Last reviewed: 2026-05-15.

## Tabletop template

Every drill captures the following fields. The drill is run live in a
Slack `#incident-drill` thread by the IC; this template is the
post-drill writeup that the auditor reads.

| Field                         | Required answer                                                            |
| ----------------------------- | -------------------------------------------------------------------------- |
| Scenario                      | One-sentence description                                                   |
| Detection time                | Wall-clock from "event happens" to "first alarm"                           |
| Detection source              | Log alert / customer report / monitoring / external                        |
| IC                            | Named individual                                                           |
| Severity assigned             | SEV1 / SEV2 / SEV3 / SEV4 (matrix in `docs/runbooks/incident-response.md`) |
| Communication tree            | Internal Slack → CCO → partner banks → regulators in that order            |
| Mitigation steps              | Numbered, time-stamped                                                     |
| Customer notification cadence | FCRA 30-day rule for PII breach; statutory windows for state AGs           |
| Post-mortem owner             | Named individual, due within 5 business days                               |
| Action items                  | Captured in Linear with owners + due dates                                 |

## Worked example — Highsale signature key compromised, 2026-04-01T02:00Z

Treat the example as a SEV1. The 5-step response captured here is the
shape every real drill should produce.

### 1. Detection (T+0:00 → T+0:08)

- Anomaly: `webhook_deliveries.lastError` for `source='highsale'` shows
  HMAC mismatches climbing past baseline at 02:00:14 UTC.
- IC opens Slack `#incident`, declares SEV1, names themselves IC.
- Alert source: log alert on `webhook.verify.fail` count > 50/min.

### 2. Contain (T+0:08 → T+0:25)

- IC rotates the `HIGHSALE_WEBHOOK_SECRET` to a fresh 32-byte secret in
  Railway env vars.
- IC sets `WEBHOOK_REPLAY_WINDOW_ENFORCED=true` (confirms it was true).
- IC pauses Highsale's outbound posting via Highsale's partner console
  (out-of-band — Highsale has not yet acknowledged compromise).
- IC verifies no successful HMAC matches occurred after T-30min by
  querying `audit_outbox` for `event='webhook.application.received'`.

### 3. Eradicate (T+0:25 → T+1:00)

- Coordinate with Highsale on root cause (their side: key leaked via
  a contractor laptop). Document in the post-mortem.
- Confirm no malicious applications were accepted. Cross-check
  `application_created` audit rows against Highsale's outbound log.

### 4. Recover (T+1:00 → T+2:00)

- Re-enable Highsale with the new secret.
- Replay any genuine missed deliveries from Highsale's retry queue.
- Watch `webhook.verify.fail` count for 30 min, expect to return to 0.

### 5. Lessons (within 48 h)

- Post-mortem in `docs/runbooks/post-mortems/2026-04-01-highsale-key.md`.
- Action item: contractor offboarding doc to add "rotate every
  partner-side HMAC secret" — owned by Highsale's CCO.
- Action item: alert on `webhook.verify.fail` > 50/min — confirm wired.
- Customer notification: not required (no consumer PII exfiltrated;
  HMAC failures dropped traffic, did not accept it). FCRA 30-day clock
  did NOT start because no consumer record was viewed or modified by
  an unauthorised party.

## Drill scenarios on the rotation

1. Highsale HMAC key compromise (above).
2. Postgres credentials leaked via a build log.
3. Audit chain mismatch (treat as SEV1; runbook `incident-response.md` §4).
4. Single replica wedged; cron leader stuck.
5. PII exfil from a compromised operator account.
