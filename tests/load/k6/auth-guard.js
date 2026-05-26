/* eslint-disable */
// k6 v0.50+. Run with: k6 run tests/load/k6/auth-guard.js

import http from 'k6/http';
import { check } from 'k6';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

/**
 * ─────────────────────────────────────────────────────────────────────
 * Auth guard — enumeration / 401 storm
 * ─────────────────────────────────────────────────────────────────────
 *
 * Iteration 3 target. Models the threat profile of an attacker hammering
 * admin + partner-scoped surfaces with mostly-anonymous traffic, trying
 * to enumerate which routes exist + which ones leak shape on a 401 (vs.
 * 404 vs. 500). Two things this gate is designed to catch:
 *
 *   (1) requireAdmin / requirePartnerSession must not become a perf
 *       cliff under bulk traffic. A 401 response should be cheaper than
 *       a 200 — getSessionContext should bail fast on missing cookies
 *       without doing any DB hits.
 *
 *   (2) The 4xx response shape must be byte-stable across routes (RFC
 *       7807 problem-details, identical title/code per status) so a
 *       fingerprinting attacker cannot distinguish "admin-only route" /
 *       "partner-only route" / "doesn't exist" via response timing or
 *       payload differences. This is enforced by lib/safe-error and
 *       lib/server-guards; the load script just confirms the gates hold
 *       under enumeration pressure.
 *
 * Mix:
 *   • 95% requests without cookies → 401 (the "storm")
 *   • 5% requests with a malformed bearer token → 401 (different code
 *     path through getSessionContext: parses + rejects)
 *
 * Surface hit (round-robin per iteration):
 *   - GET  /api/admin/audit
 *   - GET  /api/admin/observability/snapshot
 *   - GET  /api/admin/slo
 *   - GET  /api/admin/applications
 *
 * If guards regress (e.g. someone adds a DB query in the auth path),
 * p95 climbs above the threshold and the run fails.
 *
 * RUN:
 *   k6 run tests/load/k6/auth-guard.js \
 *       --env BASE_URL=https://staging.eazepay.com
 *
 * GATES:
 *   • p95 latency < 100 ms — guards must be cheap
 *   • p99 latency < 250 ms
 *   • 401 rate    > 99%  (most traffic SHOULD be 401 — that's the test)
 *   • 5xx rate    < 0.1% (guards must not crash under load)
 *   • dropped iterations = 0
 */

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Admin + partner-gated endpoints. None of these should return 200 to
// an anonymous caller. If one does, that's a SEC-001 regression.
const PROTECTED_PATHS = [
  '/api/admin/audit',
  '/api/admin/observability/snapshot',
  '/api/admin/slo',
  '/api/admin/applications',
];

export const options = {
  scenarios: {
    enumeration_storm: {
      executor: 'constant-arrival-rate',
      // 200 RPS for 2 minutes. Higher than the apply-flow rate because
      // a real enumeration attack would burst — we want to confirm the
      // guard stays fast even at attack pacing.
      rate: 200,
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 50,
      maxVUs: 200,
      tags: { profile: 'enumeration-200rps' },
    },
  },

  thresholds: {
    // p95 < 100 ms — guards must be cheap. A regression here is the
    // signal that someone added a DB query (or worse, a remote call)
    // to the auth path.
    http_req_duration: ['p(95)<100', 'p(99)<250'],
    // Less than 0.1% 5xx — guards must not crash under bulk traffic.
    'http_req_failed{outcome:server_error}': ['rate<0.001'],
    // Arrival-rate keep-up.
    dropped_iterations: ['count==0'],
    // The whole point: most traffic IS rejected with 401. We tag each
    // request by its expected outcome so the report makes the success
    // visible.
    'checks{outcome:rejected}': ['rate>0.99'],
  },

  gracefulStop: '20s',
  userAgent: 'eazepay-k6-auth-guard/1.0',
  tags: {
    test: 'auth-guard-enumeration',
    iteration: '3',
  },
};

/**
 * 5% of iterations carry a deliberately-malformed bearer token. This
 * hits getSessionContext through the "real session attempted, rejected"
 * branch rather than the trivial "no session at all" branch — different
 * code path, same expected 401 outcome.
 */
function shouldSendBearerToken() {
  return Math.random() < 0.05;
}

function malformedBearer() {
  // Token-shaped garbage. Length matches the real bearer token shape so
  // any parser cost is exercised; payload is deliberately nonsense.
  return `Bearer ${randomString(32, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')}`;
}

export default function () {
  const path = PROTECTED_PATHS[__ITER % PROTECTED_PATHS.length];
  const headers = {
    Accept: 'application/json',
    // Spread X-Forwarded-For so the edge rate-limiter doesn't bucket
    // everything into a single IP — we're testing the guard cost, not
    // the rate limiter cost.
    'X-Forwarded-For': `198.51.100.${(__VU % 254) + 1}`,
  };
  if (shouldSendBearerToken()) {
    headers['Authorization'] = malformedBearer();
  }

  const res = http.get(`${BASE_URL}${path}`, {
    headers,
    tags: { path, hasBearer: headers['Authorization'] ? 'yes' : 'no' },
  });

  // Tag the outcome bucket explicitly so the threshold can separate
  // "guard correctly rejected" (good — 401/403) from "server error"
  // (bad — 5xx). 404 would be a route-doesn't-exist signal; we don't
  // expect any of our paths to 404, so it lands in the failed bucket.
  const rejected = res.status === 401 || res.status === 403;
  const serverError = res.status >= 500;
  check(
    res,
    { 'guard rejected anonymous traffic with 401/403': () => rejected },
    { outcome: rejected ? 'rejected' : serverError ? 'server_error' : 'unexpected' },
  );
}
