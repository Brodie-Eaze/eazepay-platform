# Load scenarios → SLO coverage map

This doc is the narrative behind `tests/load/k6/*.js`. For each scenario
it explains:

- What the script simulates (real-world traffic pattern)
- Which SLOs in `apps/partner-portal/lib/slo/definitions.ts` it covers
- What a green run is evidence of
- What signal you get from a red run

If you change a target in an SLO definition, update the matching
threshold in the script (and vice versa) — the load test is what
proves the SLO is honest.

---

## Scenario 1 — Consumer apply at 3× peak

**Script:** `tests/load/k6/applications.js`

**Simulation:** 1500 concurrent virtual users walking the full consumer
apply funnel for 10 minutes, after a 4-minute ramp. Each VU iteration:
consent receipt → soft-pull prequal → decision-engine fan-out → render
offers. Synthetic identities only (RFC 2606 `.test` domain emails).

**Traffic shape rationale:** Pilot underwriting estimates ~500
concurrent applicants at peak. 3× that is the brief gate for "we won't
fall over on a viral marketing moment." 10 minutes sustained is long
enough that any GC stall / connection-pool drift / db-disk-buffer-fill
issue will surface within the run window.

**SLOs covered:**

| SLO                                           | Threshold proven                                    |
| --------------------------------------------- | --------------------------------------------------- |
| `consumer-apply-availability` (99.9% / 30d)   | `http_req_failed` < 1% under sustained 3× peak load |
| `consumer-apply-latency-p95` (< 1500 ms / 7d) | `http_req_duration` p(95) < 1500 ms                 |

**Green run is evidence of:** consumer-apply path can absorb a 3× spike
without breaching either SLO. The 10-minute sustained slice rules out
warm-cache-only / cold-cache regressions.

**Red run signals:**

- `p(95)<1500` breach with `prequal` tag in the worst bucket → HighSale
  client connection-pool exhaustion or upstream slowness; check
  `lib/highsale/*` HTTP keep-alive settings.
- `p(95)<1500` breach with `decision` tag in the worst bucket → engine
  regression (check `lib/decision-engine.ts` for recent changes; pair
  with `tests/load/k6/decision-engine.js` for isolation).
- `http_req_failed` > 1% → either consent receipt store evicting under
  pressure (look at `lib/consumer-consent.ts` cap) or DB connection
  pool saturated.

---

## Scenario 2 — Decision engine at 500 RPS

**Script:** `tests/load/k6/decision-engine.js`

**Simulation:** 500 requests per second sustained for 3 minutes against
`/api/v1/decision-engine` in isolation. Open-model arrival rate
(`constant-arrival-rate` executor) — the server has to keep up
regardless of in-flight congestion.

**Traffic shape rationale:** Engine is in-process (no upstream HTTP),
so the cost ceiling is "the scorer + the lender filter + the Reg B
reason-code lookup". 500 RPS is ~10× the expected sustained rate but
isolates the engine from any apply-flow noise, so we get a clean signal
on engine-specific regressions.

**SLOs covered:**

| SLO                                           | Threshold proven                    |
| --------------------------------------------- | ----------------------------------- |
| `decision-engine-availability` (99.95% / 30d) | `http_req_failed` < 0.1% at 500 RPS |
| `decision-engine-latency-p95` (< 250 ms / 7d) | `http_req_duration` p(95) < 200 ms  |

(Threshold is tighter than the SLO target — 200 ms vs. 250 ms — so the
load test acts as an early warning before we burn the production
budget.)

**Green run is evidence of:** the engine + the lender filter + the
Reg B lookup hold at 10× expected RPS without queueing. `dropped_iterations
== 0` is the unambiguous "we can keep up" signal.

**Red run signals:**

- `dropped_iterations > 0` → server cannot accept 500 RPS at all;
  arrival rate is being throttled by VU back-pressure.
- `p(99)` breach across all tiers → engine code regression; bisect
  recent commits to `lib/decision-engine.ts`.
- `p(99)` breach concentrated in one `tier:X` tag → that tier's
  filter slice is slow (e.g. tier-D filter is over-scanning).

---

## Scenario 3 — Webhook ingestion at 100 events/sec

**Script:** `tests/load/k6/webhook-inbox.js`

**Simulation:** 100 signed lender webhook POSTs per second for 3
minutes against `/api/v1/webhooks/lenders/{lender}`. Each event has a
unique `event_id` so we expect zero `idempotency_keys` collisions.
Signatures are HMAC-SHA256 over `${timestamp}.${nonce}.${body}` per
the production verifier in `lib/api-v1/shared.ts`.

**Traffic shape rationale:** A lender that approves applications in a
single batch could fan out hundreds of `application.quoted` events in
quick succession. The webhook inbox is the closest thing we have to a
"we never silently drop" surface — every accepted event must land in
the inbox row, and every duplicate must be deduped to the same row.

**SLOs covered:**

| SLO                                             | Threshold proven                                      |
| ----------------------------------------------- | ----------------------------------------------------- |
| `webhook-ingestion-availability` (99.99% / 30d) | `http_req_failed == 0` at 100 events/sec — zero drops |

**Green run is evidence of:** the inbox INSERT under the UNIQUE
constraint on `idempotency_keys` holds up at sustained ingress without
lock contention or hash collisions. 100% 200 OK rate confirms the
"silently drop" failure mode is closed.

**Red run signals:**

- Any 4xx/5xx → break the cardinal rule; the entire load run fails.
- 409 in the sample → idempotency collision (would mean the synthetic
  event-id generator collided, which is statistically near-zero, OR
  the server is hash-folding event IDs).
- `p(95) > 500ms` → inbox INSERT contention; check `pg_stat_activity`
  during a run and look for lock waits on the inbox table.

---

## Scenario 4 — Auth-guard under enumeration

**Script:** `tests/load/k6/auth-guard.js`

**Simulation:** 200 requests per second for 2 minutes hitting four
admin/partner-gated routes without (95%) or with a malformed bearer
token (5%). All requests should 401. Models an attacker enumerating
the admin surface looking for a route that leaks or 500s under load.

**Traffic shape rationale:** Guards are the security hot-path. If
`requireAdmin` / `requirePartnerSession` ever quietly grow a DB query
(e.g. a future "look up the session in `sessions` table" change), the
401 latency budget will be the first thing to catch it. Guards must
stay cheap.

**SLOs covered:**

| SLO                                                                 | Threshold proven                         |
| ------------------------------------------------------------------- | ---------------------------------------- |
| `admin-portal-guard-latency` (implicit p95<100ms — see definitions) | Guard latency under enumeration pressure |

This script also acts as a regression test for SEC-001 (admin surface
must not be accessible to anonymous traffic) — every single request
returning anything but 401/403 is a check failure.

**Green run is evidence of:**

- Guards stay fast under bulk rejection traffic
- Every gated route correctly returns 401/403 to anonymous traffic
- No 5xx — guards never crash under load

**Red run signals:**

- `p(95) > 100ms` → someone added a DB hit (or worse, a remote call)
  to the guard hot-path.
- Any 5xx → guard code path crashes on a particular header / cookie
  shape; check the matching route handler.
- Any 200 → critical SEC-001 regression. Stop and investigate
  immediately before opening a lender demo.

---

## Lender-API integration health

**Not covered by a single k6 script.** Lender-API integration health is
measured via real first-attempt webhook success rates over a 7-day
window (see SLO `lender-api-integration-health`). The k6 webhook-inbox
script proves the **receiver** side; the integration SLO measures the
**sender** side, which we can only observe in production.

The pen-test prep checklist (`docs/pen-test-prep.md`) notes this gap;
synthetic lender-side monitoring is a follow-up task.
