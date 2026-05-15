# Load tests (k6)

Baseline load profile for the EazePay orchestration submit path.
Currently a single scenario; add new files alongside as the surface
grows.

## Specs

- `orchestration.k6.js` — application create + submit cycle. Ramp 1 →
  100 VUs over 1 minute, hold 100 VUs for 2 minutes, ramp down for 1
  minute. ~4 minutes wall-clock per run.

## Prerequisites

k6 is a single-binary CLI, not an npm package. Install once:

```bash
# macOS
brew install k6

# Debian/Ubuntu
sudo apt-get install k6

# Verify
k6 version  # should report v0.50+
```

The k6 binary is intentionally not pinned in `package.json` — that
would couple every dev install to a Go runtime download.

## Running

```bash
# Against the deployed production environment (read-only, hits the
# partner-portal BFF /api/v1 surface which is mock-backed).
k6 run tests/load/orchestration.k6.js \
    --env BASE_URL=https://eazepay-platform-production.up.railway.app

# Against local partner-portal dev server (port 3001 to match the
# Playwright config; the partner-portal package defaults to 3004 —
# override `next dev -p 3001` to align).
k6 run tests/load/orchestration.k6.js \
    --env BASE_URL=http://localhost:3001
```

## What to watch in the output

k6 prints a single-screen summary when the run completes. The
following lines are the gate:

| Metric                                 | Pass target          | Notes                                              |
| -------------------------------------- | -------------------- | -------------------------------------------------- |
| `http_req_duration` ............ p95   | < 500 ms             | Across all steps.                                  |
| `http_req_duration` ............ p99   | < 1 500 ms           | Tail; spikes here surface GC + warmup issues.      |
| `http_req_failed` .............. rate  | < 1 %                | Counts 4xx + 5xx + transport.                      |
| `http_req_duration{step:create}` p95   | < 500 ms             | Application create.                                |
| `http_req_duration{step:submit}` p95   | < 500 ms             | Orchestration submit.                              |
| `iterations` ................... total | ≥ ~12 000 over 4 min | Sanity vs. 100 VU × ~1.5 req/s × ~150 s sustained. |

Thresholds are encoded in `options.thresholds` inside the script;
breaching any of them causes k6 to exit non-zero so CI can fail the
build cleanly.

## Local sanity check

For a quick smoke test before committing changes to the script,
truncate the profile to 30 seconds total:

```bash
k6 run tests/load/orchestration.k6.js \
    --env BASE_URL=http://localhost:3001 \
    --vus 10 \
    --duration 30s
```

`--vus`/`--duration` flags override the stage profile, so this skips
the ramp shape but still exercises the request shapes and thresholds.

## Wiring into CI

This suite is intentionally NOT in the default test pipeline. Real
load runs need:

- A dedicated environment that won't trip rate limits on shared dev
  infra.
- An out-of-band metrics sink (k6 cloud, InfluxDB + Grafana, etc.)
  so the trend over releases is visible.
- A scheduled trigger — load isn't a per-PR signal; nightly /
  pre-release is the sweet spot.

When that lands, add a workflow that runs:

```bash
k6 run --out cloud tests/load/orchestration.k6.js \
    --env BASE_URL=$STAGING_URL
```

with `K6_CLOUD_TOKEN` and `K6_CLOUD_PROJECT_ID` from environment.
