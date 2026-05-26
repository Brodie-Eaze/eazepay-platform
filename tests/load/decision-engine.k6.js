/* eslint-disable */
// Comments target k6 v0.50+. Run with `k6 run tests/load/decision-engine.k6.js`.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

/**
 * ─────────────────────────────────────────────────────────────────────
 * Decision engine — isolation load profile
 * ─────────────────────────────────────────────────────────────────────
 *
 * Pounds /api/v1/decision-engine in isolation. The engine is
 * in-process (no upstream HTTP), so the latency budget here is the
 * tightest of the three scripts — p99 < 200 ms.
 *
 * Target shape: 100 req/s sustained for 2 minutes.
 *
 * Each VU iteration posts a pre-canned prequal payload spanning all
 * four tiers (A/B/C/D); the rotation is round-robin keyed on the
 * iteration counter so over a 2-minute run we hit every tier roughly
 * equally. This exercises the propensity model + lender filter on the
 * full state space, not just the prime-tier hot path.
 *
 * NB the engine endpoint is partner-session-gated (SEC-001 per the
 * route comment) — when running against a deployed env you need to
 * pass a session cookie via `--env SESSION_COOKIE=<value>` or the run
 * will be 401 storm. The default `BASE_URL=http://localhost:3004`
 * assumes a dev session is already established in cookies; locally
 * you'd typically run with `--env SESSION_COOKIE=` set.
 *
 * RUN:
 *   k6 run tests/load/decision-engine.k6.js \
 *       --env BASE_URL=https://staging.eazepay.com \
 *       --env SESSION_COOKIE='ez_session=abc123'
 *
 * Thresholds:
 *   • p99 latency < 200 ms (in-process — anything higher = code regression)
 *   • error rate  < 0.1 % (10× tighter than the apply-flow gate)
 */

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3004';
const SESSION_COOKIE = __ENV.SESSION_COOKIE || '';

const STATES = ['CA', 'NY', 'TX', 'FL', 'IL', 'PA', 'OH', 'WA', 'GA', 'AZ'];
const BRANDS = ['medpay', 'tradepay', 'coachpay', 'direct'];

/**
 * Pre-canned prequal payloads — one per tier × brand to exercise the
 * full filter + propensity surface. The decision engine fans out across
 * the 52-lender envelope per the orchestration ADR; each tier hits a
 * different filter slice.
 *
 * Tier semantics (lib/decision-engine.ts):
 *   A → prime_plus  → high FICO, low DTI, premium lenders only
 *   B → prime       → standard FICO, mid DTI, broadest lender set
 *   C → near_prime  → mid FICO, mid-high DTI, sub-prime + near-prime
 *   D → sub_prime   → low FICO, high DTI, sub-prime workhorses only
 */
const PREQUAL_FIXTURES = [
  // Tier A — prime plus
  {
    tier: 'A',
    ficoBand: 780,
    dti: 0.18,
    openTradelines: 6,
    annualIncomeCents: 18_000_000,
    amountCents: 1_500_000,
  },
  // Tier B — prime
  {
    tier: 'B',
    ficoBand: 720,
    dti: 0.28,
    openTradelines: 5,
    annualIncomeCents: 9_000_000,
    amountCents: 800_000,
  },
  // Tier C — near prime
  {
    tier: 'C',
    ficoBand: 660,
    dti: 0.38,
    openTradelines: 3,
    annualIncomeCents: 5_400_000,
    amountCents: 400_000,
  },
  // Tier D — sub prime
  {
    tier: 'D',
    ficoBand: 600,
    dti: 0.48,
    openTradelines: 2,
    annualIncomeCents: 3_600_000,
    amountCents: 200_000,
  },
];

export const options = {
  // 100 req/s for 2 minutes. Each VU iteration is ~100 ms of payload
  // build + the request — ~10 VUs per RPS → ~100 VUs for the target.
  stages: [
    { duration: '20s', target: 50 }, // ramp
    { duration: '20s', target: 100 }, // ramp
    { duration: '2m', target: 100 }, // hold (the slice)
    { duration: '20s', target: 0 }, // ramp down
  ],

  thresholds: {
    http_req_duration: ['p(99)<200'],
    http_req_failed: ['rate<0.001'],
  },

  gracefulStop: '20s',
  userAgent: 'eazepay-k6-decision-engine/1.0',

  tags: {
    test: 'decision-engine-isolation',
  },
};

/**
 * Build a deterministic UUIDv4 for the iteration so the engine's
 * application-id input is well-formed even though it points at a
 * non-existent application row. The engine validates the shape; it
 * does not require the row to exist in the load-test environment.
 */
function syntheticApplicationId() {
  const hex = randomString(32, '0123456789abcdef');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export default function () {
  // Round-robin the tier fixture so a 2-minute run hits each tier ~25%
  // of the time. __ITER is the per-VU iteration counter; combine with
  // __VU to avoid every VU running the same tier in lockstep.
  const fixture = PREQUAL_FIXTURES[(__ITER + __VU) % PREQUAL_FIXTURES.length];

  const body = JSON.stringify({
    applicationId: syntheticApplicationId(),
    prequal: {
      tier: fixture.tier,
      ficoBand: fixture.ficoBand,
      dti: fixture.dti,
      openTradelines: fixture.openTradelines,
      amountCents: fixture.amountCents,
      annualIncomeCents: fixture.annualIncomeCents,
      state: STATES[randomIntBetween(0, STATES.length - 1)],
      brand: BRANDS[randomIntBetween(0, BRANDS.length - 1)],
    },
  });

  const headers = {
    'Content-Type': 'application/json',
  };
  if (SESSION_COOKIE) {
    headers['Cookie'] = SESSION_COOKIE;
  }

  const res = http.post(`${BASE_URL}/api/v1/decision-engine`, body, {
    headers,
    tags: { tier: fixture.tier },
  });

  check(res, {
    // Accept 2xx (engine returned) OR 401 (no session — environment
    // misconfiguration; counted in error rate but not threshold-bursting).
    'decision-engine: 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  // Minimal pacing — keep VUs near saturation so we hit the 100 RPS.
  sleep(0.05 + Math.random() * 0.05);
}
