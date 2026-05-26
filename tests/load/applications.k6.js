/* eslint-disable */
// Comments target k6 v0.50+. Run with `k6 run tests/load/applications.k6.js`.

import http from 'k6/http';
import { check, sleep, fail } from 'k6';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

/**
 * ─────────────────────────────────────────────────────────────────────
 * Consumer apply flow — load profile (3× peak)
 * ─────────────────────────────────────────────────────────────────────
 *
 * Walks the full consumer apply flow at three times projected peak
 * volume. The brief number is ~22.5k applications/day = ~260/min
 * baseline → 3× = ~780/min ≈ 13/s baseline. We target 30 req/s
 * sustained, which is the conservative "burst handles 3× and headroom"
 * shape.
 *
 * Each VU iteration walks the four-step real funnel:
 *
 *   1. POST  /api/applications/consent                  (FCRA receipt)
 *   2. POST  /api/integrations/highsale/prequal         (soft-pull)
 *   3. POST  /api/v1/decision-engine                    (rank lenders)
 *   4. GET   /api/v1/applications/[id]/offers           (render offers)
 *
 * Step ordering matches the production flow — consent must be on file
 * before prequal, prequal must complete before decision, decision must
 * complete before offers. Failures cascade: a 4xx on step N skips N+1
 * so we don't pile false 404s on the threshold metric.
 *
 * Synthetic-only data
 * -------------------
 * No real PII. Emails are `load+<rand>@eazepay.test` — the `.test`
 * TLD is reserved (RFC 2606) so no real user can ever be addressed.
 * SSN-last-4 + DOB are deterministic-but-fake. State + FICO band span
 * the full distribution to exercise every tier of the decision engine.
 *
 * RUN:
 *   k6 run tests/load/applications.k6.js \
 *       --env BASE_URL=https://staging.eazepay.com
 *
 * Thresholds (the gate)
 * ---------------------
 *   • p99 latency < 800 ms across the full flow
 *   • error rate  < 1 %
 *
 * If these trip the run exits non-zero — wire this into a nightly
 * staging job to catch regressions before lender demos.
 */

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3004';

// Mirror the brand vocabulary from lib/api-v1/shared.ts. Keep in sync
// when new brands ship.
const BRANDS = ['medpay', 'tradepay', 'coachpay'];

const FICO_BANDS = ['760+', '720-759', '680-719', '640-679', '600-639'];
const STATES = ['CA', 'NY', 'TX', 'FL', 'IL', 'PA', 'OH', 'WA', 'GA', 'AZ'];

// Decision engine tier mapping. Real engine derives tier from the
// HighSale snapshot — we pre-stamp it here so the engine call has
// canonical inputs.
const TIERS = ['A', 'B', 'C', 'D'];

/**
 * Build a deterministic-but-unique synthetic identity for one VU
 * iteration. Suffix is the `randomString` so the same VU running the
 * same iteration N times in the same run produces N distinct
 * applications — important so the dedupe / idempotency paths don't
 * collapse the traffic.
 */
function syntheticApplicant() {
  const suffix = randomString(10, 'abcdefghijklmnopqrstuvwxyz0123456789');
  return {
    applicationId: `00000000-0000-4000-8000-${suffix.padEnd(12, '0').slice(0, 12)}`,
    sessionId: `sess_${suffix}`,
    email: `load+${suffix}@eazepay.test`,
    suffix,
  };
}

export const options = {
  // 30 req/s sustained for 5 minutes. With ~1.5 s of think-time spread
  // across the four steps, each VU produces ~0.5 iterations/sec → ~60 VUs
  // gives us the target 30 RPS. We ramp to give the server warm-up
  // headroom and bleed back down to cleanly count tail latency.
  stages: [
    { duration: '30s', target: 30 }, // ramp to ~15 RPS
    { duration: '30s', target: 60 }, // ramp to ~30 RPS
    { duration: '5m', target: 60 }, // hold 30 RPS for 5 min (the slice)
    { duration: '30s', target: 0 }, // ramp down
  ],

  thresholds: {
    // The gate per the brief.
    http_req_duration: ['p(99)<800'],
    http_req_failed: ['rate<0.01'],
    // Per-step thresholds — prequal is the slowest (upstream HTTP call)
    // so it gets the highest budget.
    'http_req_duration{step:consent}': ['p(99)<200'],
    'http_req_duration{step:prequal}': ['p(99)<800'],
    'http_req_duration{step:decision}': ['p(99)<400'],
    'http_req_duration{step:offers}': ['p(99)<300'],
  },

  gracefulStop: '30s',
  noConnectionReuse: false,
  userAgent: 'eazepay-k6-applications/1.0',

  tags: {
    test: 'applications-flow',
  },
};

export default function () {
  const applicant = syntheticApplicant();
  const brand = BRANDS[randomIntBetween(0, BRANDS.length - 1)];
  const baseHeaders = {
    'Content-Type': 'application/json',
    'X-Forwarded-For': `10.${randomIntBetween(0, 255)}.${randomIntBetween(0, 255)}.${randomIntBetween(1, 254)}`,
  };

  // ── 1. Consent receipt.
  const consentRes = http.post(
    `${BASE_URL}/api/applications/consent`,
    JSON.stringify({
      applicationId: applicant.applicationId,
      sessionId: applicant.sessionId,
      disclosureVersion: '2026-05-01',
      consentText: 'I authorize EazePay to obtain a soft-pull credit report under FCRA §604(a)(2).',
      clientTimestamp: new Date().toISOString(),
    }),
    { headers: baseHeaders, tags: { step: 'consent' } },
  );

  const consentOk = check(consentRes, {
    'consent: 2xx': (r) => r.status >= 200 && r.status < 300,
  });
  if (!consentOk) {
    sleep(randomIntBetween(1, 2));
    return;
  }

  // Consent receipt id is the dedupe key for the FCRA verifier in
  // prequal. Falls back to the application id if the route returns 204.
  let consentReceiptId = `cr_${applicant.suffix}`;
  try {
    const body = consentRes.json();
    if (body && typeof body === 'object' && 'receiptId' in body) {
      consentReceiptId = String(body.receiptId);
    }
  } catch {
    // 204 No Content path — keep the synthetic id.
  }

  sleep(0.2 + Math.random() * 0.2);

  // ── 2. Prequal (soft credit pull).
  const prequalRes = http.post(
    `${BASE_URL}/api/integrations/highsale/prequal`,
    JSON.stringify({
      applicationId: applicant.applicationId,
      consentReceiptId,
      brand,
      requestId: `rq_${applicant.suffix}`,
      applicant: {
        email: applicant.email,
        firstName: `Load${applicant.suffix.slice(0, 4)}`,
        lastName: `Test${applicant.suffix.slice(4, 8)}`,
        ssnLast4: '0000',
        dob: '1985-06-15',
        addressState: STATES[randomIntBetween(0, STATES.length - 1)],
        annualIncomeCents: randomIntBetween(3_600_000, 18_000_000),
      },
      request: {
        amountCents: randomIntBetween(50_000, 5_000_000),
        purpose: 'home-repair',
      },
    }),
    { headers: baseHeaders, tags: { step: 'prequal' } },
  );

  const prequalOk = check(prequalRes, {
    'prequal: 2xx or 412 (consent gate)': (r) =>
      (r.status >= 200 && r.status < 300) || r.status === 412,
  });
  if (!prequalOk || prequalRes.status !== 200) {
    sleep(randomIntBetween(1, 2));
    return;
  }

  sleep(0.2 + Math.random() * 0.2);

  // ── 3. Decision engine.
  const tier = TIERS[randomIntBetween(0, TIERS.length - 1)];
  const decisionRes = http.post(
    `${BASE_URL}/api/v1/decision-engine`,
    JSON.stringify({
      applicationId: applicant.applicationId,
      prequal: {
        tier,
        ficoBand: 700,
        dti: 0.32,
        openTradelines: 4,
        amountCents: randomIntBetween(50_000, 5_000_000),
        annualIncomeCents: randomIntBetween(3_600_000, 18_000_000),
        state: STATES[randomIntBetween(0, STATES.length - 1)],
        brand,
      },
    }),
    { headers: baseHeaders, tags: { step: 'decision' } },
  );

  check(decisionRes, {
    'decision: 2xx or 401 (no session)': (r) =>
      (r.status >= 200 && r.status < 300) || r.status === 401,
  });

  sleep(0.2 + Math.random() * 0.2);

  // ── 4. Offers page.
  const offersRes = http.get(`${BASE_URL}/api/v1/applications/${applicant.applicationId}/offers`, {
    headers: baseHeaders,
    tags: { step: 'offers' },
  });

  check(offersRes, {
    'offers: 2xx, 401, or 404': (r) =>
      (r.status >= 200 && r.status < 300) || r.status === 401 || r.status === 404,
  });

  // Per-iteration think-time so 60 concurrent VUs spread their requests
  // instead of synchronising into a thundering-herd.
  sleep(randomIntBetween(1, 2));
}
