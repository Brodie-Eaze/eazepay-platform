/* eslint-disable */
// k6 v0.50+. Run with: k6 run tests/load/k6/decision-engine.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

/**
 * ─────────────────────────────────────────────────────────────────────
 * Decision engine — 500 RPS isolation profile
 * ─────────────────────────────────────────────────────────────────────
 *
 * Iteration 3 target. Pounds /api/v1/decision-engine in isolation at
 * 500 RPS sustained for 3 minutes. The engine is in-process (no upstream
 * HTTP); this profile exists to gate any regression in the scorer, the
 * Reg B reason-code lookup, or the lender filter that would push p95
 * past 200 ms under load.
 *
 * Why constant-arrival-rate
 * -------------------------
 * Open-model (`constant-arrival-rate`) over closed-model (`stages`) — at
 * 500 RPS, we want to measure how the server handles a fixed arrival
 * rate regardless of in-flight congestion, not how many requests N VUs
 * can squeeze through. If the server gets slower, the open model
 * surfaces that as queue depth + threshold burns; the closed model would
 * silently throttle by VU back-pressure and hide the regression.
 *
 * VU budget is pre-allocated up-front so the runtime doesn't pay the
 * autoscaler cost during the slice.
 *
 * SESSION
 * -------
 * The engine route is partner-session gated (SEC-001). Pass an
 * authenticated cookie via --env SESSION_COOKIE='ez_session=...' when
 * running against staging; locally the demo cookie works as well. A
 * 401 storm will not breach `http_req_failed` (we only require 2xx) but
 * the run will not be a meaningful latency measurement.
 *
 * RUN:
 *   k6 run tests/load/k6/decision-engine.js \
 *       --env BASE_URL=https://staging.eazepay.com \
 *       --env SESSION_COOKIE='eazepay_demo=<signed-master-cookie>'
 *
 * GATES:
 *   • p95 latency < 200 ms
 *   • p99 latency < 400 ms
 *   • error rate  < 0.1% (10× tighter than the apply-flow gate)
 *   • dropped iterations = 0 (would mean we can't keep up at 500 RPS)
 */

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const SESSION_COOKIE = __ENV.SESSION_COOKIE || '';

const STATES = ['CA', 'NY', 'TX', 'FL', 'IL', 'PA', 'OH', 'WA', 'GA', 'AZ'];
const BRANDS = ['medpay', 'tradepay', 'coachpay', 'direct'];

/**
 * One fixture per tier. Round-robined per iteration so over a 3-minute
 * run we hit each tier ~25% of the time. Each tier exercises a
 * different filter slice — keeps the load shaped like real traffic.
 *
 * Tier semantics (lib/decision-engine.ts):
 *   A → prime_plus  — high FICO / low DTI / premium-only lenders
 *   B → prime       — broadest lender set
 *   C → near_prime  — sub-prime + near-prime lenders only
 *   D → sub_prime   — sub-prime workhorses
 */
const PREQUAL_FIXTURES = [
  {
    tier: 'A',
    ficoBand: 780,
    dti: 0.18,
    openTradelines: 6,
    annualIncomeCents: 18_000_000,
    amountCents: 1_500_000,
  },
  {
    tier: 'B',
    ficoBand: 720,
    dti: 0.28,
    openTradelines: 5,
    annualIncomeCents: 9_000_000,
    amountCents: 800_000,
  },
  {
    tier: 'C',
    ficoBand: 660,
    dti: 0.38,
    openTradelines: 3,
    annualIncomeCents: 5_400_000,
    amountCents: 400_000,
  },
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
  scenarios: {
    sustained_500_rps: {
      executor: 'constant-arrival-rate',
      // 500 req/sec, time unit 1s, sustained for 3 minutes.
      rate: 500,
      timeUnit: '1s',
      duration: '3m',
      // Pre-allocate enough VUs that arrival rate is not throttled by
      // back-pressure even if the server momentarily slows. At ~50 ms
      // p50, 500 RPS needs ~25 VUs in steady state; pre-allocate 4× for
      // headroom and let k6 burst up to maxVUs if needed.
      preAllocatedVUs: 100,
      maxVUs: 400,
      tags: { profile: 'sustained-500rps' },
    },
  },

  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<400'],
    http_req_failed: ['rate<0.001'],
    // If k6 cannot keep up with the arrival rate it will increment
    // `dropped_iterations` — that's the unambiguous "server can't
    // handle 500 RPS" signal.
    dropped_iterations: ['count==0'],
  },

  gracefulStop: '20s',
  userAgent: 'eazepay-k6-decision-engine-500rps/1.0',
  tags: {
    test: 'decision-engine-500rps',
    iteration: '3',
  },
};

/** Generate a well-formed UUIDv4 for the engine's applicationId input. */
function syntheticApplicationId() {
  const hex = randomString(32, '0123456789abcdef');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export default function () {
  // Combine VU + iteration counters so each fixture appears ~25% of
  // the time without every VU running the same tier in lockstep.
  const fixture = PREQUAL_FIXTURES[(__ITER + __VU) % PREQUAL_FIXTURES.length];

  const headers = {
    'Content-Type': 'application/json',
  };
  if (SESSION_COOKIE) {
    headers['Cookie'] = SESSION_COOKIE;
  }

  const res = http.post(
    `${BASE_URL}/api/v1/decision-engine`,
    JSON.stringify({
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
    }),
    {
      headers,
      tags: { tier: fixture.tier },
    },
  );

  check(res, {
    'decision-engine: 2xx': (r) => r.status >= 200 && r.status < 300,
  });
  // No sleep — open-model arrival rate is enforced by k6, not VU pacing.
}
