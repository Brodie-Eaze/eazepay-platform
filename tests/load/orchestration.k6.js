/* eslint-disable */
// Comments target k6 v0.50+. Run with `k6 run tests/load/orchestration.k6.js`.

import http from 'k6/http';
import { check, sleep, fail } from 'k6';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

/**
 * ─────────────────────────────────────────────────────────────────────
 * Orchestration submit — load profile
 * ─────────────────────────────────────────────────────────────────────
 *
 * Models the smoke-to-burst ramp for the application-submission +
 * orchestration path of the EazePay partner-portal BFF.
 *
 * Each virtual user (VU) executes one full submission cycle per
 * iteration:
 *
 *   1. POST /api/v1/applications        — create draft
 *   2. POST /api/v1/applications/{id}/submit
 *
 * Both calls are scored against the thresholds at the bottom of this
 * file. The thresholds are the gate: if any threshold trips the run
 * exits non-zero so CI can fail the build.
 *
 * Payload generator uses the brand + tier names from
 * `apps/partner-portal/lib/api-v1/shared.ts::SAMPLE_LENDERS` so the
 * fan-out fixture lines up with the per-lender envelope the real
 * orchestrator evaluates.
 *
 * RUN:
 *   k6 run tests/load/orchestration.k6.js \
 *       --env BASE_URL=https://eazepay-platform-production.up.railway.app
 *
 * k6 must be installed separately (`brew install k6` on macOS,
 * `apt install k6` on Debian-family Linux). Do NOT bundle into the
 * monorepo's package.json — it's a CLI binary, not an npm package.
 *
 * WATCH IN OUTPUT (terminal summary tail):
 *   • http_req_duration {p(95), p(99)}
 *   • http_req_failed (should track <1%)
 *   • iterations + iteration_duration (RPS sustained = iterations /
 *     duration_seconds; gut-check vs. expected 100 VU × ~ 2 req/s)
 *   • thresholds — green ticks at the very bottom
 *
 * If you need a custom dashboard, export to Grafana Cloud:
 *   K6_CLOUD_TOKEN=... k6 run --out cloud orchestration.k6.js
 */

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

// Sample brand/tier shapes lifted from SAMPLE_LENDERS to keep the
// orchestration fixture honest. Tweak in sync with the source file if
// new lenders / brands land.
const BRAND_TIER_FIXTURE = [
  // BuzzPay — generalist; serves the widest brand set.
  { brand: 'tradepay', tier: 'prime' },
  { brand: 'tradepay', tier: 'near_prime' },
  // Helia Medical — medpay only.
  { brand: 'medpay', tier: 'prime_plus' },
  { brand: 'medpay', tier: 'prime' },
  // Summit Premier — prime_plus across tradepay+medpay+coachpay.
  { brand: 'medpay', tier: 'prime_plus' },
  { brand: 'coachpay', tier: 'prime_plus' },
  { brand: 'tradepay', tier: 'prime_plus' },
  // Kestrel — tradepay-only sub-prime/near-prime workhorse.
  { brand: 'tradepay', tier: 'sub_prime' },
  { brand: 'tradepay', tier: 'near_prime' },
  // Atlas Career Cap — coachpay-only.
  { brand: 'coachpay', tier: 'prime' },
];

const CHANNELS = ['merchant', 'direct', 'partner_link'];
const PURPOSES = [
  'kitchen-renovation',
  'medical-elective',
  'professional-coaching',
  'debt-consolidation',
  'home-repair',
];

const FICO_BANDS = ['760+', '720-759', '680-719', '640-679', '600-639'];
const STATES = ['CA', 'NY', 'TX', 'FL', 'IL', 'PA', 'OH', 'WA'];

/**
 * Build a synthetic but schema-valid application payload. The BFF's
 * BodySchema (apps/partner-portal/app/api/v1/applications/route.ts)
 * validates everything; if the shape drifts and this generator falls
 * out of sync the run will fail-loud with a 422 streak rather than
 * silently passing.
 */
function freshApplicationPayload() {
  const fixture = BRAND_TIER_FIXTURE[randomIntBetween(0, BRAND_TIER_FIXTURE.length - 1)];
  const suffix = randomString(8, 'abcdefghijklmnopqrstuvwxyz');
  return {
    brand: fixture.brand,
    channel: {
      type: CHANNELS[randomIntBetween(0, CHANNELS.length - 1)],
      // merchant_ref + partner_ref are optional; include for realism.
      merchant_ref: `m_${suffix}`,
    },
    applicant: {
      first_name: `Load${suffix.slice(0, 4)}`,
      last_name: `Test${suffix.slice(4, 8)}`,
      email: `load+${suffix}@eazepay.test`,
      phone: `+1555${randomIntBetween(2000000, 9999999)}`,
      state: STATES[randomIntBetween(0, STATES.length - 1)],
      fico_band: FICO_BANDS[randomIntBetween(0, FICO_BANDS.length - 1)],
      income_monthly_cents: randomIntBetween(300_000, 1_500_000),
      mla_covered: false,
      scra_active: false,
    },
    request: {
      // Stay inside the BodySchema bounds: min 50k cents, max 15M cents.
      amount_cents: randomIntBetween(50_000, 5_000_000),
      term_months: randomIntBetween(12, 60),
      purpose: PURPOSES[randomIntBetween(0, PURPOSES.length - 1)],
    },
  };
}

export const options = {
  // Three-stage profile — 1 to 100 VUs over 1 minute, hold at 100 for
  // 2 minutes (sustained-load slice), ramp back to 0 over 1 minute
  // to capture the cool-down tail. Total 4 minutes per run.
  stages: [
    { duration: '1m', target: 100 },
    { duration: '2m', target: 100 },
    { duration: '1m', target: 0 },
  ],

  // Thresholds — these are the gate. A run is GREEN iff every line
  // here resolves OK; otherwise the process exits non-zero so CI can
  // pick it up. Numbers come from the brief.
  thresholds: {
    // p95 < 500ms for the BFF as a whole.
    http_req_duration: ['p(95)<500', 'p(99)<1500'],
    // Less than 1% failures (4xx + 5xx + transport).
    http_req_failed: ['rate<0.01'],
    // Specific assertions per-step — the create vs submit calls have
    // different latency budgets. Tag-scoped thresholds.
    'http_req_duration{step:create}': ['p(95)<500'],
    'http_req_duration{step:submit}': ['p(95)<500'],
  },

  // Per-VU runtime tuning. `gracefulStop` gives in-flight requests up
  // to 30 s to drain after the ramp-down — otherwise the trailing
  // edge spikes failure counts.
  gracefulStop: '30s',

  // Disable connection reuse so we measure cold-path-ish numbers.
  // Comment out if you want to benchmark the warm path instead.
  noConnectionReuse: false,
  userAgent: 'eazepay-k6-load/1.0',

  // Tag every metric with the test name so the cloud / Grafana view
  // distinguishes runs at a glance.
  tags: {
    test: 'orchestration-submit',
  },
};

export default function () {
  // ── 1. Create application.
  const payload = freshApplicationPayload();
  const idempotencyKey = `k6-${__VU}-${__ITER}-${randomString(8)}`;

  const createRes = http.post(`${BASE_URL}/api/v1/applications`, JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    tags: { step: 'create' },
  });

  const created = check(createRes, {
    'create: 2xx': (r) => r.status >= 200 && r.status < 300,
    'create: returned application_id': (r) => {
      try {
        return typeof r.json('application_id') === 'string';
      } catch {
        return false;
      }
    },
  });
  if (!created) {
    // No application_id → no submit step. Skip rather than firing a
    // 404 we know will fail; the threshold counts the create failure.
    sleep(randomIntBetween(1, 2));
    return;
  }
  const applicationId = createRes.json('application_id');

  // Tiny think-time between create and submit. Real consumer flows
  // pause for consent screens; we model 250-500 ms.
  sleep(0.25 + Math.random() * 0.25);

  // ── 2. Submit application.
  const submitRes = http.post(
    `${BASE_URL}/api/v1/applications/${applicationId}/submit`,
    JSON.stringify({
      consent: { tila: true, fcra_soft: true, esign: true },
    }),
    {
      headers: {
        'Content-Type': 'application/json',
      },
      tags: { step: 'submit' },
    },
  );

  check(submitRes, {
    'submit: 2xx': (r) => r.status >= 200 && r.status < 300,
    'submit: status=orchestrating': (r) => {
      try {
        return r.json('status') === 'orchestrating';
      } catch {
        return false;
      }
    },
  });

  // Per-VU pacing. Spread iterations so 100 concurrent VUs don't all
  // hammer the API in lockstep; 1-2 s think-time is realistic for the
  // partner-portal funnel.
  sleep(randomIntBetween(1, 2));
}

/**
 * Optional summary handler — k6 calls this at the end of the run and
 * we can produce a JSON artefact alongside the default terminal
 * output. Uncomment if you want machine-readable output for a CI
 * dashboard:
 *
 * export function handleSummary(data) {
 *   return {
 *     'tests/load/last-summary.json': JSON.stringify(data, null, 2),
 *   };
 * }
 */
