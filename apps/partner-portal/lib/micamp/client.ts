/**
 * MiCamp client — payment-processor integration scaffold.
 *
 * MiCamp is the third leg of MedPay's financial infrastructure
 * (alongside HighSale pre-qual and the Lender Marketplace).
 * Relationship: 50/50 rev share on every transaction the merchant
 * runs through MiCamp, owned by Steven on our side, with Frank @
 * Dappit handling the global payfac expansion.
 *
 * What this client owns:
 *   • MID auto-provisioning — pre-underwriting → post-underwriting
 *   • Payment processing dispatch (charge / refund / capture)
 *   • Settlement reporting
 *   • Webhook signature verification
 *
 * Wire to real MiCamp by setting MICAMP_API_KEY + MICAMP_API_URL.
 * Without those env vars every method returns a synthetic happy-path
 * response so the rest of the platform can be developed against a
 * stable contract before the real integration lands.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { safeLog } from '../safe-log';
import { fetchWithTimeout } from '../integrations/fetch-with-timeout';

/** Per-call timeouts. provision = known-slow (real MiCamp underwriting
 *  takes 5–20s); charge = money path, must fail fast so a hung partner
 *  doesn't pin a Next.js worker holding the consumer's session;
 *  settlement = bulk-ish data, 10s ceiling. */
const TIMEOUT_PROVISION_MS = 30_000;
const TIMEOUT_CHARGE_MS = 5_000;
const TIMEOUT_SETTLEMENT_MS = 10_000;
const PARTNER = 'micamp' as const;

/* ---------- types ---------- */

export type MidProvisioningStatus =
  | 'requested'
  | 'underwriting_pre'
  | 'underwriting_post'
  | 'active'
  | 'rejected'
  | 'paused';

export interface RateCard {
  /** Interchange + assessment pass-through in basis points. */
  interchangeBps: number;
  /** Processor markup in basis points. */
  processorBps: number;
  /** Per-transaction fee in cents. */
  perTransactionCents: number;
  /** Monthly service fee in cents. NULL if waived. */
  monthlyFeeCents: number | null;
  /** Settlement cadence in business days. */
  settlementDays: number;
}

export interface ProvisionMidRequest {
  partnerId: string;
  legalName: string;
  dba: string | null;
  ein: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  /** Annual processing volume estimate, in cents. */
  estimatedVolumeCents: number;
  /** Average ticket size, in cents. */
  estimatedTicketCents: number;
  mccCode: string;
  funnelUrls: string[];
}

export interface ProvisionMidResponse {
  ok: boolean;
  midId: string;
  micampMid: string | null;
  status: MidProvisioningStatus;
  rateCard: RateCard;
  /** Steps in the provisioning workflow + their current status. */
  steps: Array<{
    name: string;
    status: 'pending' | 'in_progress' | 'done' | 'failed' | 'skipped';
    note: string | null;
  }>;
  /** Estimated time-to-active, in hours. NULL once active. */
  etaHours: number | null;
}

export interface ChargeRequest {
  midId: string;
  amountCents: number;
  currency: 'USD';
  consumerToken: string;
  applicationId: string;
  metadata?: Record<string, string>;
}

export interface ChargeResponse {
  ok: boolean;
  transactionId: string;
  status: 'authorized' | 'captured' | 'declined' | 'pending';
  declineReason: string | null;
  feeBreakdown: {
    interchangeCents: number;
    processorCents: number;
    perTransactionCents: number;
    netCents: number;
  };
}

export interface SettlementReport {
  midId: string;
  periodStart: string;
  periodEnd: string;
  grossCents: number;
  feesCents: number;
  refundsCents: number;
  netCents: number;
  payoutDate: string;
  payoutStatus: 'pending' | 'in_transit' | 'paid' | 'failed';
  transactionCount: number;
}

/* ---------- env wiring ---------- */

const MICAMP_API_URL = process.env.MICAMP_API_URL ?? '';
const MICAMP_API_KEY = process.env.MICAMP_API_KEY ?? '';
const MICAMP_WEBHOOK_SECRET = process.env.MICAMP_WEBHOOK_SECRET ?? '';

/**
 * SEC-002 — webhook signature freshness window. Anything older than 5
 * minutes is rejected to defeat replay of a captured-and-stored
 * signature. Mirrors the Stripe `tolerance` default.
 */
const WEBHOOK_FRESHNESS_SECONDS = 300;

/**
 * SEC-002 — module-load assertion. In production a missing
 * MICAMP_WEBHOOK_SECRET means `verifyWebhookSignature()` would have
 * historically returned `true` for ANY payload. We refuse to even load
 * this module so the Next.js worker boot fails and Railway's rotation
 * stays on the previous (signed) revision.
 *
 * `lib/env.ts:assertProdEnv()` also asserts this at boot — this is a
 * belt-and-braces second line in case anything imports this module
 * before middleware evaluates.
 */
// SEC-002 hard floor — see lib/highsale/client.ts for rationale on
// the NEXT_PHASE exemption. Fail-closed at runtime, allow build time
// to complete in CI without secrets (the throw still fires on the
// first real import via a request).
const MICAMP_IS_BUILD_TIME = process.env.NEXT_PHASE === 'phase-production-build';
if (process.env.NODE_ENV === 'production' && !MICAMP_IS_BUILD_TIME && !MICAMP_WEBHOOK_SECRET) {
  throw new Error(
    '[micamp/client] MICAMP_WEBHOOK_SECRET is unset in production — refusing to load. ' +
      'Without it, verifyWebhookSignature() cannot fail-closed and forged webhooks would be accepted (SEC-002).',
  );
}

/** Real-wiring detection. When false every call returns a synthetic
 * response — used during demo + while Steven + Frank's team finishes
 * the auto-provisioning MID work. */
export function isMicampLive(): boolean {
  return Boolean(MICAMP_API_URL) && Boolean(MICAMP_API_KEY);
}

/* ---------- provisioning ---------- */

const DEFAULT_RATE_CARD: RateCard = {
  // "Well below industry standard" per the strategy doc. Industry
  // average for medical is ~250-300 bps interchange + ~100 bps markup;
  // we target this as our wedge.
  interchangeBps: 195,
  processorBps: 35,
  perTransactionCents: 12,
  monthlyFeeCents: null,
  settlementDays: 2,
};

const PROVISIONING_STEPS = [
  'application_received',
  'risk_sniff_test',
  'pre_underwriting',
  'mid_issued',
  'gateway_configured',
  'webhook_subscribed',
  'live',
] as const;

export async function provisionMid(req: ProvisionMidRequest): Promise<ProvisionMidResponse> {
  if (isMicampLive()) {
    const res = await fetchWithTimeout(
      `${MICAMP_API_URL}/v1/merchants`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${MICAMP_API_KEY}`,
        },
        body: JSON.stringify(req),
      },
      { timeoutMs: TIMEOUT_PROVISION_MS, partner: PARTNER, endpoint: 'provisionMid' },
    );
    if (!res.ok) {
      throw new Error(`MiCamp provisioning failed: ${res.status}`);
    }
    return (await res.json()) as ProvisionMidResponse;
  }

  // Synthetic happy-path. Pre-underwriting completes immediately so
  // the rest of the platform can demo end-to-end. Post-underwriting
  // gates on accumulated volume — handled by the volume tracker in
  // the orchestrator, not here.
  const midId = `mid_${Date.now().toString(36)}`;
  return {
    ok: true,
    midId,
    micampMid: null, // unset until real underwriting returns it
    status: 'underwriting_pre',
    rateCard: { ...DEFAULT_RATE_CARD },
    steps: PROVISIONING_STEPS.map((name, i) => ({
      name,
      status: i < 3 ? 'done' : i === 3 ? 'in_progress' : 'pending',
      note: i === 3 ? 'Awaiting risk team sign-off (typically 1–2 business days).' : null,
    })),
    etaHours: 24,
  };
}

/* ---------- charges ---------- */

export async function charge(req: ChargeRequest): Promise<ChargeResponse> {
  if (isMicampLive()) {
    const res = await fetchWithTimeout(
      `${MICAMP_API_URL}/v1/charges`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${MICAMP_API_KEY}`,
        },
        body: JSON.stringify(req),
      },
      { timeoutMs: TIMEOUT_CHARGE_MS, partner: PARTNER, endpoint: 'charge' },
    );
    if (!res.ok) {
      throw new Error(`MiCamp charge failed: ${res.status}`);
    }
    return (await res.json()) as ChargeResponse;
  }

  // Synthetic: deterministic fee math against the default rate card.
  const interchangeCents = Math.round((req.amountCents * DEFAULT_RATE_CARD.interchangeBps) / 10000);
  const processorCents = Math.round((req.amountCents * DEFAULT_RATE_CARD.processorBps) / 10000);
  const perTransactionCents = DEFAULT_RATE_CARD.perTransactionCents;
  const totalFee = interchangeCents + processorCents + perTransactionCents;

  return {
    ok: true,
    transactionId: `tx_${Date.now().toString(36)}`,
    status: 'captured',
    declineReason: null,
    feeBreakdown: {
      interchangeCents,
      processorCents,
      perTransactionCents,
      netCents: req.amountCents - totalFee,
    },
  };
}

/* ---------- settlement ---------- */

export async function settlementReport(
  midId: string,
  period: { start: string; end: string },
): Promise<SettlementReport> {
  if (isMicampLive()) {
    const res = await fetchWithTimeout(
      `${MICAMP_API_URL}/v1/merchants/${midId}/settlements?start=${period.start}&end=${period.end}`,
      {
        headers: { Authorization: `Bearer ${MICAMP_API_KEY}` },
      },
      { timeoutMs: TIMEOUT_SETTLEMENT_MS, partner: PARTNER, endpoint: 'settlementReport' },
    );
    if (!res.ok) {
      throw new Error(`MiCamp settlement fetch failed: ${res.status}`);
    }
    return (await res.json()) as SettlementReport;
  }

  // Synthetic placeholder — empty period.
  return {
    midId,
    periodStart: period.start,
    periodEnd: period.end,
    grossCents: 0,
    feesCents: 0,
    refundsCents: 0,
    netCents: 0,
    payoutDate: period.end,
    payoutStatus: 'pending',
    transactionCount: 0,
  };
}

/* ---------- webhooks ---------- */

/**
 * SEC-002 — structured verification result. Callers log the `reason`
 * to safe-log so we have an audit trail of WHY a signature was
 * rejected (replayed timestamp vs. tampered body vs. unsigned).
 */
export type WebhookVerificationReason =
  | 'missing_secret'
  | 'missing_signature'
  | 'bad_signature'
  | 'stale_timestamp'
  | 'malformed';

export type WebhookVerificationResult =
  | { valid: true }
  | { valid: false; reason: WebhookVerificationReason };

/**
 * Constant-time HMAC verification on inbound MiCamp webhooks.
 *
 * MiCamp signs with sha256 over `${unix_ts}.${raw_body}`; the signature
 * header format is `t=<unix>,v1=<hex>` (matching Stripe's convention,
 * which the real provider also uses).
 *
 * SEC-002 — fail-closed behaviour:
 *   • Production with no MICAMP_WEBHOOK_SECRET → impossible (module
 *     load threw above). This branch only fires in non-production.
 *   • Non-prod with no secret → `valid: false` (was: `true`) UNLESS the
 *     operator explicitly opts in via MICAMP_WEBHOOK_INSECURE_ALLOW=true,
 *     in which case we STILL return invalid but log a warning every
 *     time so it's visible in the dev console.
 *   • Stale timestamp (> 5 min) → reject. Defeats replay of a captured
 *     signature.
 *   • Bad / missing fields → reject with a specific reason so the
 *     route handler can audit-log it.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
): WebhookVerificationResult {
  if (!MICAMP_WEBHOOK_SECRET) {
    // In production we already threw at module load. This branch is
    // reachable only in non-production. Default-deny; opt-in is via
    // MICAMP_WEBHOOK_INSECURE_ALLOW=true.
    const insecureAllow = process.env.MICAMP_WEBHOOK_INSECURE_ALLOW === 'true';
    if (insecureAllow) {
      safeLog.warn({
        event: 'micamp.webhook.insecure_allow',
        message:
          'MICAMP_WEBHOOK_SECRET unset and MICAMP_WEBHOOK_INSECURE_ALLOW=true — accepting unsigned webhook is NEVER safe in prod',
      });
    }
    return { valid: false, reason: 'missing_secret' };
  }

  if (!signatureHeader) {
    return { valid: false, reason: 'missing_signature' };
  }

  const parts = Object.fromEntries(
    signatureHeader.split(',').map((kv) => {
      const [k, v] = kv.split('=');
      return [k?.trim() ?? '', v?.trim() ?? ''];
    }),
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) {
    return { valid: false, reason: 'malformed' };
  }

  const tsNum = Number(timestamp);
  if (!Number.isFinite(tsNum)) {
    return { valid: false, reason: 'malformed' };
  }
  // Freshness window — 5 minutes either direction (clock skew tolerant).
  if (Math.abs(Date.now() / 1000 - tsNum) > WEBHOOK_FRESHNESS_SECONDS) {
    return { valid: false, reason: 'stale_timestamp' };
  }

  const payload = `${timestamp}.${rawBody}`;
  const expected = createHmac('sha256', MICAMP_WEBHOOK_SECRET).update(payload).digest('hex');
  if (expected.length !== signature.length) {
    return { valid: false, reason: 'bad_signature' };
  }
  let expectedBuf: Buffer;
  let sigBuf: Buffer;
  try {
    expectedBuf = Buffer.from(expected, 'hex');
    sigBuf = Buffer.from(signature, 'hex');
  } catch {
    return { valid: false, reason: 'malformed' };
  }
  if (expectedBuf.length !== sigBuf.length) {
    return { valid: false, reason: 'bad_signature' };
  }
  return timingSafeEqual(expectedBuf, sigBuf)
    ? { valid: true }
    : { valid: false, reason: 'bad_signature' };
}

export type MicampWebhookEvent =
  | { type: 'mid.underwriting.approved'; midId: string; micampMid: string; rateCard: RateCard }
  | { type: 'mid.underwriting.rejected'; midId: string; reason: string }
  | { type: 'mid.post_underwriting'; midId: string; thresholdCents: number }
  | { type: 'payment.captured'; transactionId: string; midId: string; amountCents: number }
  | { type: 'payment.refunded'; transactionId: string; midId: string; amountCents: number }
  | { type: 'settlement.paid'; midId: string; payoutDate: string; netCents: number };
