# Load tests (k6)

Two generations of profiles live here:

- `*.k6.js` (at this directory root) — iteration 1/2 baseline profiles.
  Lower targets, used by the CI smoke pipeline.
- `k6/*.js` (this subdirectory) — iteration 3 production-readiness
  profiles. Higher targets, run before lender demos / pilot go-live.

## Iteration 3 profiles (`tests/load/k6/`)

| Script                  | Profile                                 | SLO covered                            |
| ----------------------- | --------------------------------------- | -------------------------------------- |
| `k6/applications.js`    | 1500 VUs × 10 min · 3× peak             | Consumer apply availability + latency  |
| `k6/decision-engine.js` | 500 RPS × 3 min                         | Decision engine latency p95            |
| `k6/webhook-inbox.js`   | 100 events/sec × 3 min                  | Webhook ingestion availability         |
| `k6/auth-guard.js`      | 200 RPS × 2 min, mostly-401 enumeration | Admin/partner guard latency under load |

Each script declares its own `thresholds`; the run exits non-zero on any
breach so CI can fail the build cleanly.

## Prerequisites

k6 is a single-binary CLI, not an npm package. Install once:

```bash
# macOS
brew install k6

# Debian / Ubuntu
sudo gpg -k && sudo gpg --no-default-keyring \
    --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
    --keyserver hkp://keyserver.ubuntu.com:80 \
    --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
    | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Verify
k6 version  # should report v0.50+
```

The k6 binary is intentionally not in `package.json` — that would couple
every dev install to a Go runtime download.

## Running

```bash
# Local dev server.
BASE_URL=http://localhost:3000 k6 run tests/load/k6/applications.js

# Staging.
k6 run tests/load/k6/applications.js \
    --env BASE_URL=https://staging.eazepay.com

# Decision-engine requires a session — pass a signed demo cookie:
k6 run tests/load/k6/decision-engine.js \
    --env BASE_URL=https://staging.eazepay.com \
    --env SESSION_COOKIE='eazepay_demo=<signed-master-cookie>'

# Webhook inbox — strict-HMAC staging:
k6 run tests/load/k6/webhook-inbox.js \
    --env BASE_URL=https://staging.eazepay.com \
    --env WEBHOOK_SECRET=$WEBHOOK_HMAC_SECRET
```

Syntax-check a script without running it:

```bash
k6 inspect tests/load/k6/applications.js
```

## What pass / fail looks like

A passing run ends with green tick boxes against every threshold:

```
running (10m02.5s), 0000/1500 VUs, 412 891 complete and 0 interrupted iterations
default ✓ [======================================] 1500 VUs  10m0s

     ✓ checks.........................: 99.87%  ✓ 412355  ✗ 536
     ✓ http_req_duration..............: avg=287ms p(95)=1.18s  p(99)=2.41s
     ✓ http_req_failed................: 0.13%   ✓ 536     ✓ 412355
```

A failing run prints `✗` on the threshold that breached and exits 1:

```
     ✗ http_req_duration..............: p(95)=2.41s   <  expected p(95)<1500ms
                                        p(99)=4.92s   <  expected p(99)<3000ms

ERRO[0602] thresholds on metrics 'http_req_duration' have been crossed
```

When a run fails:

1. Open the `thresholds` block in the script — those are the gates.
2. Tag-segmented thresholds (e.g. `http_req_duration{step:prequal}`)
   tell you which step regressed.
3. Cross-reference with `/admin/observability` and the metrics emitted
   during the run window. If `webhook.rejected` ticked up during a
   webhook-inbox run, the signature check is the regression.

## Test environment notes

Real load runs need a dedicated environment that won't trip rate
limits on shared dev infra and an out-of-band metrics sink (k6 Cloud,
Grafana Cloud, InfluxDB) so the trend over releases is visible. The
default `BASE_URL=http://localhost:3000` is for local syntax + sanity
checks; the gates are calibrated for staging.

## Wiring into CI

The iteration-3 profiles are NOT in the default test pipeline. They're
intended for:

- Pre-lender-demo smoke runs (manual trigger before each demo)
- Nightly staging runs once we wire a Grafana sink
- The pilot go-live launch checklist (see `docs/launch-checklist.md`)

When that lands, add a workflow that runs:

```bash
k6 run --out cloud tests/load/k6/applications.js \
    --env BASE_URL=$STAGING_URL
```

with `K6_CLOUD_TOKEN` and `K6_CLOUD_PROJECT_ID` from environment.
