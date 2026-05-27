/**
 * HighSale client — pre-qualification + agency sub-account integration.
 *
 * HighSale is the pre-qualification layer underneath BOTH AI Funding
 * Solutions (today) and MedPay (July 1). We operate as an AGENCY
 * account — every client signed onto AI Funding / MedPay becomes a
 * sub-account underneath us, which gives us:
 *   • Collective usage view across all clients
 *   • Subscription + throttle controls
 *   • Wholesale → retail margin on every pre-qual pull
 *     (retail $3/pool · wholesale slides 1k:$260 → 25k:$1.10)
 *   • Auto-billing via Milly (bi-weekly / monthly / weekly probation)
 *
 * Pixie (smart form + smart routing) sits inside HighSale as a
 * feature clients configure within their own file — it is NOT a
 * platform component we own.
 *
 * Wire to real HighSale by setting HIGHSALE_AGENCY_KEY +
 * HIGHSALE_API_URL. Without those env vars every method returns a
 * synthetic happy-path response.
 */

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { safeLog } from '../safe-log';
import type { WebhookVerificationResult } from '../micamp/client';
import { fetchWithTimeout } from '../integrations/fetch-with-timeout';

/** Per-call timeouts. Sub-account create is provisioning-grade (HighSale
 *  stands up a downstream agency child + Pixie embed — routinely 5–15s);
 *  prequal is a soft-pull credit query and must fail fast so the apply
 *  form doesn't hang the consumer. */
const TIMEOUT_SUBACCOUNT_MS = 30_000;
const TIMEOUT_PREQUAL_MS = 5_000;
const PARTNER = 'highsale' as const;

/* ---------- types ---------- */

export type BureauType = 'fico8' | 'vantage';

export interface CreateSubAccountRequest {
  partnerId: string;
  legalName: string;
  primaryContactEmail: string;
  /** Which bureau the sub-account should be configured to pull from. */
  bureau: BureauType;
  /** Soft monthly pull cap — protects the wholesale tier we sit on. */
  monthlyPullCap: number | null;
  /** Milly billing config: weekly during 3-month probation, then
   * bi-weekly or monthly. */
  billingCadence: 'weekly' | 'biweekly' | 'monthly';
  brand: 'medpay' | 'tradepay' | 'coachpay' | 'ai_funding';
}

export interface CreateSubAccountResponse {
  ok: boolean;
  subAccountId: string;
  pixieEmbedUrl: string;
  /** Per-sub-account API key for direct pulls. */
  apiKey: string;
  configuredBureau: BureauType;
  billingCadence: 'weekly' | 'biweekly' | 'monthly';
  probationUntil: string;
}

export interface PrequalRequest {
  subAccountId: string;
  consumer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    /** Last 4 of SSN — full SSN never leaves the consumer device in pre-qual. */
    ssnLast4: string;
    dob: string;
    address: {
      street: string;
      city: string;
      state: string;
      zip: string;
    };
    annualIncomeCents: number;
    employmentType: 'w2' | 'self_employed' | '1099' | 'retired' | 'unemployed' | 'other';
  };
  requestedAmountCents: number;
  /** Idempotency key from the consumer apply form. */
  requestId: string;
  /** SEC-006 / Task #45: opaque FCRA consent receipt id verified by the
   * BFF before this request was assembled. Forwarded to HighSale so the
   * wholesale pull row carries our consent-chain pointer in their audit
   * tooling — useful during a downstream regulator subpoena. Optional
   * because HighSale's existing sub-account flow accepts the request
   * without it; the BFF route is the gate that enforces presence. */
  clientReference?: string;
}

export interface PrequalResponse {
  ok: boolean;
  pullId: string;
  bureau: BureauType;
  /** 'soft' for pre-qual, 'hard' for funding. Pre-qual is ALWAYS soft. */
  pullKind: 'soft';
  /** Credit tier our routing layer ranks against — A through D. */
  tier: 'A' | 'B' | 'C' | 'D';
  /** Approximate FICO band, 5-point granularity. NULL on thin file. */
  ficoBand: number | null;
  /** Estimated max approved amount in cents, based on pre-qual data. */
  estimatedMaxCents: number;
  /** Debt-to-income, as a fraction. NULL on insufficient data. */
  dti: number | null;
  /** Open trade lines, derived from the bureau pull. */
  openTradelines: number | null;
  /** Per-pull cost charged by HighSale at wholesale, in cents.
   * We retail at 300 (= $3 USD). */
  wholesaleCostCents: number;
  /** Frozen bureau snapshot for audit / regulator replay. */
  snapshotJson: string;
}

/* ---------- env wiring ---------- */

const HIGHSALE_API_URL = process.env.HIGHSALE_API_URL ?? '';
const HIGHSALE_AGENCY_KEY = process.env.HIGHSALE_AGENCY_KEY ?? '';
const HIGHSALE_WEBHOOK_SECRET = process.env.HIGHSALE_WEBHOOK_SECRET ?? '';

/** SEC-002 — see micamp/client.ts for rationale. */
const WEBHOOK_FRESHNESS_SECONDS = 300;

// SEC-002 hard floor: fail-closed at RUNTIME if the secret is unset in
// production. We do NOT throw during `next build` (NEXT_PHASE is set by
// Next.js itself) — build-time imports happen in CI without secrets,
// and refusing to load there would only break the build, not protect a
// real request. The throw still fires on the first runtime import path.
const IS_BUILD_TIME = process.env.NEXT_PHASE === 'phase-production-build';
if (process.env.NODE_ENV === 'production' && !IS_BUILD_TIME && !HIGHSALE_WEBHOOK_SECRET) {
  throw new Error(
    '[highsale/client] HIGHSALE_WEBHOOK_SECRET is unset in production — refusing to load. ' +
      'Without it, verifyHighsaleSignature() cannot fail-closed and forged webhooks would be accepted (SEC-002).',
  );
}

export function isHighsaleLive(): boolean {
  return Boolean(HIGHSALE_API_URL) && Boolean(HIGHSALE_AGENCY_KEY);
}

/* ---------- sub-accounts ---------- */

export async function createSubAccount(
  req: CreateSubAccountRequest,
): Promise<CreateSubAccountResponse> {
  if (isHighsaleLive()) {
    const res = await fetchWithTimeout(
      `${HIGHSALE_API_URL}/agency/v1/sub-accounts`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agency-Key': HIGHSALE_AGENCY_KEY,
        },
        body: JSON.stringify(req),
      },
      { timeoutMs: TIMEOUT_SUBACCOUNT_MS, partner: PARTNER, endpoint: 'createSubAccount' },
    );
    if (!res.ok) {
      throw new Error(`HighSale sub-account create failed: ${res.status}`);
    }
    return (await res.json()) as CreateSubAccountResponse;
  }

  // Synthetic happy-path. Probation window = 90 days.
  const probationUntil = new Date();
  probationUntil.setUTCDate(probationUntil.getUTCDate() + 90);
  const subAccountId = `hs_${Date.now().toString(36)}`;

  return {
    ok: true,
    subAccountId,
    pixieEmbedUrl: `https://app.highsale.com/embed/pixie/${subAccountId}`,
    apiKey: `hk_dev_${subAccountId}_${Math.random().toString(36).slice(2, 10)}`,
    configuredBureau: req.bureau,
    billingCadence: req.billingCadence,
    probationUntil: probationUntil.toISOString(),
  };
}

/* ---------- pre-qualification pulls ---------- */

/** Deterministic stub: same inputs always produce the same tier so
 * the consumer apply demo behaves consistently across reloads. */
function syntheticTier(email: string): { tier: 'A' | 'B' | 'C' | 'D'; ficoBand: number } {
  const h = createHash('sha256').update(email.toLowerCase()).digest();
  const bucket = (h[0] ?? 0) % 4;
  if (bucket === 0) return { tier: 'A', ficoBand: 760 };
  if (bucket === 1) return { tier: 'B', ficoBand: 700 };
  if (bucket === 2) return { tier: 'C', ficoBand: 660 };
  return { tier: 'D', ficoBand: 600 };
}

export async function runPrequal(req: PrequalRequest): Promise<PrequalResponse> {
  if (isHighsaleLive()) {
    const res = await fetchWithTimeout(
      `${HIGHSALE_API_URL}/sub/v1/prequal`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${HIGHSALE_AGENCY_KEY}`,
          'X-Sub-Account': req.subAccountId,
          'X-Idempotency-Key': req.requestId,
        },
        body: JSON.stringify(req),
      },
      { timeoutMs: TIMEOUT_PREQUAL_MS, partner: PARTNER, endpoint: 'runPrequal' },
    );
    if (!res.ok) {
      throw new Error(`HighSale pre-qual failed: ${res.status}`);
    }
    return (await res.json()) as PrequalResponse;
  }

  // Synthetic pre-qual — deterministic per (email, requested amount).
  const { tier, ficoBand } = syntheticTier(req.consumer.email);
  const tierMultiplier = { A: 1.0, B: 0.85, C: 0.6, D: 0.35 }[tier];
  const estimatedMaxCents = Math.round(req.requestedAmountCents * tierMultiplier);

  // DTI heuristic: requested amount × 0.0008 over (annualIncome / 12).
  const monthlyIncome = req.consumer.annualIncomeCents / 12;
  const estMonthlyPayment = req.requestedAmountCents * 0.0008;
  const dti = monthlyIncome > 0 ? estMonthlyPayment / monthlyIncome : null;

  return {
    ok: true,
    pullId: `pull_${Date.now().toString(36)}`,
    bureau: 'fico8',
    pullKind: 'soft',
    tier,
    ficoBand,
    estimatedMaxCents,
    dti,
    openTradelines: tier === 'A' ? 8 : tier === 'B' ? 6 : tier === 'C' ? 4 : 2,
    // Synthetic wholesale tier — middle of the sliding scale.
    wholesaleCostCents: 180,
    snapshotJson: JSON.stringify({
      synthetic: true,
      generatedAt: new Date().toISOString(),
      tier,
      ficoBand,
      consumerHash: createHash('sha256').update(req.consumer.email).digest('hex').slice(0, 12),
    }),
  };
}

/* ---------- webhook verification ---------- */

/**
 * SEC-002 — fail-closed signature verification for inbound HighSale +
 * Milly webhooks. Mirrors `verifyWebhookSignature` in lib/micamp/client.ts;
 * see that module for the full contract. Returns a structured result so
 * the route handler can audit-log the failure reason.
 */
export function verifyHighsaleSignature(
  rawBody: string,
  signatureHeader: string,
): WebhookVerificationResult {
  if (!HIGHSALE_WEBHOOK_SECRET) {
    // Production: unreachable (module load threw above). Non-prod only.
    const insecureAllow = process.env.HIGHSALE_WEBHOOK_INSECURE_ALLOW === 'true';
    if (insecureAllow) {
      safeLog.warn({
        event: 'highsale.webhook.insecure_allow',
        message:
          'HIGHSALE_WEBHOOK_SECRET unset and HIGHSALE_WEBHOOK_INSECURE_ALLOW=true — accepting unsigned webhook is NEVER safe in prod',
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
  if (Math.abs(Date.now() / 1000 - tsNum) > WEBHOOK_FRESHNESS_SECONDS) {
    return { valid: false, reason: 'stale_timestamp' };
  }

  const payload = `${timestamp}.${rawBody}`;
  const expected = createHmac('sha256', HIGHSALE_WEBHOOK_SECRET).update(payload).digest('hex');
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

export type HighsaleWebhookEvent =
  | { type: 'pull.completed'; pullId: string; subAccountId: string; tier: 'A' | 'B' | 'C' | 'D' }
  | { type: 'pull.failed'; pullId: string; subAccountId: string; reason: string }
  | { type: 'subaccount.suspended'; subAccountId: string; reason: string }
  | { type: 'milly.invoice.issued'; subAccountId: string; amountCents: number; periodEnd: string }
  | { type: 'milly.invoice.paid'; subAccountId: string; amountCents: number }
  | { type: 'milly.invoice.failed'; subAccountId: string; amountCents: number; reason: string };
