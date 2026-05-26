/* eslint-disable */
// k6 v0.50+. Run with: k6 run tests/load/k6/webhook-inbox.js

import http from 'k6/http';
import crypto from 'k6/crypto';
import encoding from 'k6/encoding';
import { check } from 'k6';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

/**
 * ─────────────────────────────────────────────────────────────────────
 * Webhook ingestion — 100 events/sec sustained
 * ─────────────────────────────────────────────────────────────────────
 *
 * Iteration 3 target. Drives the lender webhook ingress at 100 events/
 * sec for 3 minutes. Two things the gate proves:
 *
 *   (1) Throughput — the inbox INSERT (idempotency_key UNIQUE) holds up
 *       under sustained ingress without lock contention pushing p95 past
 *       budget.
 *   (2) Idempotency — every event_id is unique, so we expect 0
 *       duplicate counter increments. If the route silently coalesces
 *       events on a hash collision we'd see it in webhook.duplicate.
 *
 * Each iteration POSTs a deterministically-signed `application.quoted`
 * event for a UUIDv4 application that does not exist in the DB. The
 * route doesn't require the application row to exist — it parses,
 * signature-checks, and inserts the inbox row. That's exactly the path
 * we want to profile.
 *
 * SIGNING
 * -------
 * The route uses `verifySignature` (lib/api-v1/shared.ts):
 *   HMAC-SHA256(secret, `${timestamp}.${nonce}.${body}`) → hex
 * Default shared secret for demo / non-prod is the literal string
 * `demo_shared_secret_replace_in_prod` (matches lib/api-v1/shared.ts
 * MOCK_SECRET). Override via --env WEBHOOK_SECRET=... when running
 * against an environment with REQUIRE_HMAC=true.
 *
 * RUN:
 *   k6 run tests/load/k6/webhook-inbox.js \
 *       --env BASE_URL=https://staging.eazepay.com
 *
 *   # Strict-HMAC environment:
 *   k6 run tests/load/k6/webhook-inbox.js \
 *       --env BASE_URL=https://staging.eazepay.com \
 *       --env WEBHOOK_SECRET=$WEBHOOK_HMAC_SECRET
 *
 * GATES:
 *   • 100% of requests return 200 OK
 *   • error rate = 0% (any 4xx/5xx is a failure — idempotency collision
 *     would show as a 409 here)
 *   • p95 latency < 500 ms
 *   • p99 latency < 1000 ms
 *   • dropped iterations = 0 (would mean we can't keep up at 100/sec)
 */

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const WEBHOOK_SECRET = __ENV.WEBHOOK_SECRET || 'demo_shared_secret_replace_in_prod';
// Default to BuzzPay — it's in SAMPLE_LENDERS and serves the widest
// brand set, so it routes through every inbox-inserter branch.
const LENDER_ID = __ENV.WEBHOOK_LENDER || 'buzzpay';

/**
 * Build an HMAC-SHA256 signature exactly the way verifySignature() does:
 *   sig = hex( hmac_sha256(secret, `${timestamp}.${nonce}.${body}`) )
 *
 * k6/crypto exposes a streaming HMAC helper; the hex digest matches the
 * server's `[...].map(b => b.toString(16).padStart(2,'0')).join('')`.
 */
function signPayload(body, timestamp, nonce) {
  const message = `${timestamp}.${nonce}.${body}`;
  return crypto.hmac('sha256', WEBHOOK_SECRET, message, 'hex');
}

/** Well-formed UUIDv4 — the schema validates this even though the DB row
 *  does not need to exist. The route inserts an inbox row keyed on the
 *  webhook event_id (the idempotency surface), not application_id. */
function uuidv4() {
  const hex = randomString(32, '0123456789abcdef');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export const options = {
  scenarios: {
    sustained_100_rps: {
      executor: 'constant-arrival-rate',
      rate: 100,
      timeUnit: '1s',
      duration: '3m',
      // 100 RPS × ~200 ms p99 → ~20 VUs steady state. 4× for headroom.
      preAllocatedVUs: 50,
      maxVUs: 200,
      tags: { profile: 'sustained-100rps' },
    },
  },

  thresholds: {
    // Every webhook must return 200 — anything else is a failure.
    http_req_failed: ['rate==0'],
    // Inbox INSERT under sustained ingress.
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    // The `signed` tag bucket exists so a future "drop the signature on
    // 5% of iterations" mutation can be split out from this threshold
    // without recomputing the overall gate.
    'http_req_failed{kind:signed}': ['rate==0'],
    // Arrival-rate keep-up check.
    dropped_iterations: ['count==0'],
  },

  gracefulStop: '20s',
  userAgent: 'eazepay-k6-webhook-inbox/1.0',
  tags: {
    test: 'webhook-inbox-100rps',
    iteration: '3',
  },
};

export default function () {
  // Build a unique, well-formed application.quoted event. Each iteration
  // gets a unique application_id + offer_id → unique event_id derived
  // server-side → zero idempotency collisions expected.
  const applicationId = uuidv4();
  const offerId = `offer_${randomString(12, '0123456789abcdef')}`;
  const eventId = `evt_${randomString(16, '0123456789abcdef')}`;

  const payload = {
    event_id: eventId,
    event_type: 'application.quoted',
    application_id: applicationId,
    offer_id: offerId,
    decision: 'approved',
    offer: {
      amount_cents: randomIntBetween(50_000, 5_000_000),
      apr_bps: randomIntBetween(700, 3500),
      term_months: randomIntBetween(12, 60),
      monthly_payment_cents: randomIntBetween(2_000, 50_000),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
  };
  const body = JSON.stringify(payload);

  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = `n_${randomString(12, '0123456789abcdef')}`;
  const signature = signPayload(body, timestamp, nonce);

  const res = http.post(`${BASE_URL}/api/v1/webhooks/lenders/${LENDER_ID}`, body, {
    headers: {
      'Content-Type': 'application/json',
      'X-EazePay-Timestamp': timestamp,
      'X-EazePay-Nonce': nonce,
      'X-EazePay-Signature': signature,
    },
    tags: { kind: 'signed' },
  });

  check(res, {
    'webhook: 200 OK': (r) => r.status === 200,
    'webhook: no idempotency_keys collision (no 409)': (r) => r.status !== 409,
  });
}
