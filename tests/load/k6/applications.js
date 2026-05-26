/* eslint-disable */
// k6 v0.50+. Run with: k6 run tests/load/k6/applications.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

/**
 * ─────────────────────────────────────────────────────────────────────
 * Consumer apply flow — 3× expected peak
 * ─────────────────────────────────────────────────────────────────────
 *
 * Iteration 3 target. Drives the consumer apply funnel at three times
 * projected launch peak. Pilot underwriting estimates ~500 concurrent
 * applicants at peak; we run at 1500 VUs sustained for 10 minutes
 * (with a 2-minute ramp on each side) to confirm there are no thread-
 * pool / connection-pool / DB-connection cliffs under sustained 3× load
 * before we open the front door to a lender demo.
 *
 * Per-iteration funnel (matches production ordering):
 *
 *   1. POST /api/applications/consent             (FCRA soft-pull receipt)
 *   2. POST /api/integrations/highsale/prequal    (soft credit pull)
 *   3. POST /api/v1/decision-engine               (rank lenders)
 *   4. GET  /api/v1/applications/{id}/offers      (render offers card)
 *
 * Failures cascade — a 4xx on step N skips N+1 so we don't pile
 * structural 404s onto the threshold metric.
 *
 * Synthetic only. Emails are `load+<rand>@eazepay.test` (RFC 2606
 * reserved TLD — never routable). SSN-last-4 + DOB are fixed-fake. State
 * + amount span the realistic distribution to exercise every decision
 * tier.
 *
 * RUN:
 *   k6 run tests/load/k6/applications.js \
 *       --env BASE_URL=https://staging.eazepay.com
 *
 * GATES (k6 thresholds — any breach → non-zero exit):
 *   • p95 latency < 1500 ms
 *   • p99 latency < 3000 ms
 *   • error rate  < 1%
 */

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Keep in sync with lib/api-v1/shared.ts brand vocab.
const BRANDS = ['medpay', 'tradepay', 'coachpay'];
const STATES = ['CA', 'NY', 'TX', 'FL', 'IL', 'PA', 'OH', 'WA', 'GA', 'AZ'];
const TIERS = ['A', 'B', 'C', 'D'];

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
  // 1500 VUs sustained for 10 minutes (the slice). Ramp on either side
  // so warm-up + cool-down tails don't contaminate the threshold window.
  // Total wall-clock: ~14 minutes.
  stages: [
    { duration: '2m', target: 500 }, // ramp 0 → 500
    { duration: '2m', target: 1500 }, // ramp 500 → 1500
    { duration: '10m', target: 1500 }, // hold (the slice)
    { duration: '2m', target: 0 }, // ramp down
  ],

  thresholds: {
    // The gate per the brief.
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
    http_req_failed: ['rate<0.01'],
    // Per-step thresholds — prequal is the slowest step (it makes a
    // synchronous upstream call to HighSale) so it gets the loosest
    // budget. Decision + offers are in-process and tighter.
    'http_req_duration{step:consent}': ['p(95)<400'],
    'http_req_duration{step:prequal}': ['p(95)<1500'],
    'http_req_duration{step:decision}': ['p(95)<500'],
    'http_req_duration{step:offers}': ['p(95)<400'],
  },

  gracefulStop: '30s',
  noConnectionReuse: false,
  userAgent: 'eazepay-k6-applications-3x/1.0',
  tags: {
    test: 'applications-3x-peak',
    iteration: '3',
  },
};

export default function () {
  const applicant = syntheticApplicant();
  const brand = BRANDS[randomIntBetween(0, BRANDS.length - 1)];
  const baseHeaders = {
    'Content-Type': 'application/json',
    // Spread synthetic source IPs so the BFF edge rate-limiter doesn't
    // mistake the load run for a single-source DoS. 10.0.0.0/8 is
    // RFC 1918 private — never collides with a real client IP.
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

  // The route returns a receipt id we forward as the FCRA dedupe key for
  // the prequal step. Fall back to a synthetic id on 204 responses.
  let consentReceiptId = `cr_${applicant.suffix}`;
  try {
    const body = consentRes.json();
    if (body && typeof body === 'object' && 'receiptId' in body) {
      consentReceiptId = String(body.receiptId);
    }
  } catch {
    // 204 No Content — synthetic id is fine.
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

  // Per-VU think time — 1500 concurrent VUs without pacing would
  // synchronise into a thundering herd at every step.
  sleep(randomIntBetween(1, 2));
}
