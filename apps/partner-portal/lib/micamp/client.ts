/**
 * MiCamp client — payment-processor integration scaffold.
 *
 * MiCamp is the third leg of MedPay's financial infrastructure
 * (alongside HighSale pre-qual and the Lender Marketplace).
 * Relationship: 50/50 rev share on every transaction the merchant
 * runs through MiCamp, owned by Steven on our side, with Frank @
 * Dappit handling the global payfac expansion.
 *
 * What this adapter owns:
 *   - MID auto-provisioning — pre-underwriting -> post-underwriting
 *   - Payment processing dispatch (charge / refund / capture)
 *   - Settlement reporting
 *   - Webhook signature verification (delegates the HMAC primitive to
 *     the shared verifier in @eazepay/integrations-core; we keep the
 *     secret + fail-loud-on-prod-load guard local).
 *
 * Wire to real MiCamp by setting MICAMP_API_KEY + MICAMP_API_URL.
 * Without those env vars every method returns a synthetic happy-path
 * response so the rest of the platform can be developed against a
 * stable contract before the real integration lands.
 *
 * REFACTOR NOTE (refactor/integration-adapter-interfaces):
 *   This module now implements the `MerchantProcessor` port from
 *   @eazepay/integrations-core via the `createMicampClient()` factory.
 *   The named top-level exports (`provisionMid`, `charge`, ...) are
 *   preserved as thin wrappers so existing tests + the orchestrator
 *   keep working. Route handlers consume the interface via
 *   `apps/partner-portal/lib/integrations/registry.ts` — they no
 *   longer import the concrete module. `WebhookVerificationResult` is
 *   re-exported (back-compat) but its canonical home is the core lib.
 */

import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  createHmacWebhookVerifier,
  IntegrationErrorException,
  type BalanceSnapshot,
  type MerchantProcessor,
  type WebhookVerificationResult,
} from '@eazepay/integrations-core';
import { safeLog } from '../safe-log';
import { fetchWithTimeout } from '../integrations/fetch-with-timeout';

// Re-exported for back-compat; the canonical declaration lives in
// @eazepay/shared-types/webhook-events alongside the Zod schema that
// the worker uses to fail-loud on malformed deliveries.
export type { MicampWebhookEvent } from '@eazepay/shared-types';

/** Per-call timeouts. provision = known-slow (real MiCamp underwriting
 *  takes 5–20s); charge = money path, must fail fast so a hung partner
 *  doesn't pin a Next.js worker holding the consumer's session;
 *  settlement = bulk-ish data, 10s ceiling. */
const TIMEOUT_PROVISION_MS = 30_000;
const TIMEOUT_CHARGE_MS = 5_000;
const TIMEOUT_SETTLEMENT_MS = 10_000;
const PARTNER = 'micamp' as const;

/* ---------- types ---------- */

/**
 * Response shapes are declared as Zod schemas; TypeScript types are
 * derived via `z.infer<>`. Single source of truth — a parse failure at
 * the boundary throws `IntegrationErrorException({ kind: 'MalformedResponse' })`
 * so an upstream contract drift surfaces in the inbox / metrics tile
 * rather than corrupting downstream state via an unchecked `as` cast.
 */

export type MidProvisioningStatus =
  | 'requested'
  | 'underwriting_pre'
  | 'underwriting_post'
  | 'active'
  | 'rejected'
  | 'paused';

export const RateCardSchema = z.object({
  /** Interchange + assessment pass-through in basis points. */
  interchangeBps: z.number().int().nonnegative(),
  /** Processor markup in basis points. */
  processorBps: z.number().int().nonnegative(),
  /** Per-transaction fee in cents. */
  perTransactionCents: z.number().int().nonnegative(),
  /** Monthly service fee in cents. NULL if waived. */
  monthlyFeeCents: z.number().int().nonnegative().nullable(),
  /** Settlement cadence in business days. */
  settlementDays: z.number().int().nonnegative(),
});

export type RateCard = z.infer<typeof RateCardSchema>;

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

export const ProvisionMidResponseSchema = z.object({
  ok: z.boolean(),
  midId: z.string().min(1),
  micampMid: z.string().min(1).nullable(),
  status: z.enum([
    'requested',
    'underwriting_pre',
    'underwriting_post',
    'active',
    'rejected',
    'paused',
  ]),
  rateCard: RateCardSchema,
  steps: z.array(
    z.object({
      name: z.string(),
      status: z.enum(['pending', 'in_progress', 'done', 'failed', 'skipped']),
      note: z.string().nullable(),
    }),
  ),
  etaHours: z.number().nullable(),
});

export type ProvisionMidResponse = z.infer<typeof ProvisionMidResponseSchema>;

export interface ChargeRequest {
  midId: string;
  amountCents: number;
  currency: 'USD';
  consumerToken: string;
  applicationId: string;
  /**
   * REQUIRED. Sent to MiCamp as the `Idempotency-Key` header so a
   * partner-side retry (network blip, double-click, our own queue
   * retry) collapses to a single consumer charge. Without this,
   * retrying a 5xx = double-charging the consumer.
   *
   * Use `deriveChargeIdempotencyKey({ applicationId, amountCents })`
   * for the common "charge this application this amount exactly once"
   * case. Pass an explicit per-attempt UUID when business semantics
   * require multiple distinct charges against the same application.
   */
  idempotencyKey: string;
  metadata?: Record<string, string>;
}

export const ChargeResponseSchema = z.object({
  ok: z.boolean(),
  transactionId: z.string().min(1),
  status: z.enum(['authorized', 'captured', 'declined', 'pending']),
  declineReason: z.string().nullable(),
  feeBreakdown: z.object({
    interchangeCents: z.number().int(),
    processorCents: z.number().int(),
    perTransactionCents: z.number().int(),
    netCents: z.number().int(),
  }),
});

export type ChargeResponse = z.infer<typeof ChargeResponseSchema>;

export const SettlementReportSchema = z.object({
  midId: z.string().min(1),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  grossCents: z.number().int().nonnegative(),
  feesCents: z.number().int().nonnegative(),
  refundsCents: z.number().int().nonnegative(),
  netCents: z.number().int(),
  payoutDate: z.string().min(1),
  payoutStatus: z.enum(['pending', 'in_transit', 'paid', 'failed']),
  transactionCount: z.number().int().nonnegative(),
});

export type SettlementReport = z.infer<typeof SettlementReportSchema>;

/**
 * Parse a JSON response body against a Zod schema, converting parse
 * failures into the canonical `IntegrationErrorException({ kind:
 * 'MalformedResponse' })` so route handlers + workers see a uniform
 * failure shape regardless of which adapter raised it. We pass through
 * the raw `ZodError.message` as `detail` — it carries the path of the
 * offending field, which is what an operator needs to triage a
 * contract drift without re-fetching the request body.
 */
function parseMicampResponse<T>(schema: z.ZodType<T>, body: unknown, endpoint: string): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new IntegrationErrorException({
      provider: PARTNER,
      endpoint,
      kind: 'MalformedResponse',
      message: `MiCamp ${endpoint} response did not match schema`,
      detail: result.error.message,
    });
  }
  return result.data;
}

/* ---------- env wiring ---------- */

const MICAMP_API_URL = process.env.MICAMP_API_URL ?? '';
const MICAMP_API_KEY = process.env.MICAMP_API_KEY ?? '';
const MICAMP_WEBHOOK_SECRET = process.env.MICAMP_WEBHOOK_SECRET ?? '';

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

/**
 * Deterministic idempotency key for the common "charge this application
 * this amount exactly once" path. Truncated to 32 chars to fit MiCamp's
 * Idempotency-Key length cap (mirrors Stripe's 255 ceiling — we stay
 * well under).
 */
export function deriveChargeIdempotencyKey(parts: {
  applicationId: string;
  amountCents: number;
}): string {
  return createHash('sha256')
    .update(`${parts.applicationId}|${parts.amountCents}`)
    .digest('hex')
    .slice(0, 32);
}

/* ---------- provisioning ---------- */

const DEFAULT_RATE_CARD: RateCard = {
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
    return parseMicampResponse(ProvisionMidResponseSchema, await res.json(), 'provisionMid');
  }

  const midId = `mid_${Date.now().toString(36)}`;
  return {
    ok: true,
    midId,
    micampMid: null,
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
    // Idempotency-Key header is REQUIRED — retrying a 5xx without it
    // would double-charge the consumer. The type system enforces the
    // field's presence on ChargeRequest; fetchWithTimeout bounds the
    // outbound call so a hung partner cannot pin a Next.js worker.
    const res = await fetchWithTimeout(
      `${MICAMP_API_URL}/v1/charges`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${MICAMP_API_KEY}`,
          'Idempotency-Key': req.idempotencyKey,
        },
        body: JSON.stringify(req),
      },
      { timeoutMs: TIMEOUT_CHARGE_MS, partner: PARTNER, endpoint: 'charge' },
    );
    if (!res.ok) {
      throw new Error(`MiCamp charge failed: ${res.status}`);
    }
    return parseMicampResponse(ChargeResponseSchema, await res.json(), 'charge');
  }

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
    return parseMicampResponse(SettlementReportSchema, await res.json(), 'settlementReport');
  }

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
 * SEC-002 — structured verification result.
 *
 * Re-exported here for back-compat with any consumer that previously
 * imported the type from this module. The canonical definition now
 * lives in `@eazepay/integrations-core`; HighSale + Trutopia import it
 * directly from the core lib (not via cross-import from this file).
 */
export type {
  WebhookVerificationReason,
  WebhookVerificationResult,
} from '@eazepay/integrations-core';

/**
 * Module-scoped HMAC verifier. The shared helper handles every
 * fail-closed branch (missing_signature / malformed / stale_timestamp
 * / bad_signature). The `missing_secret` branch is handled below so we
 * can preserve the legacy INSECURE_ALLOW warning log + the
 * refuse-to-load production guard above.
 */
const micampVerifier = createHmacWebhookVerifier({
  secret: MICAMP_WEBHOOK_SECRET,
});

/**
 * Constant-time HMAC verification on inbound MiCamp webhooks.
 *
 * MiCamp signs with sha256 over `${unix_ts}.${raw_body}`; the signature
 * header format is `t=<unix>,v1=<hex>` (matching Stripe's convention,
 * which the real provider also uses).
 *
 * SEC-002 — fail-closed behaviour:
 *   - Production with no MICAMP_WEBHOOK_SECRET -> impossible (module
 *     load threw above). This branch only fires in non-production.
 *   - Non-prod with no secret -> `valid: false` UNLESS the operator
 *     explicitly opts in via MICAMP_WEBHOOK_INSECURE_ALLOW=true, in
 *     which case we STILL return invalid but log a warning every time
 *     so it's visible in the dev console.
 *   - Stale timestamp (> 5 min) -> reject. Defeats replay of a
 *     captured signature.
 *   - Bad / missing fields -> reject with a specific reason so the
 *     route handler can audit-log it.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
): WebhookVerificationResult {
  if (!MICAMP_WEBHOOK_SECRET) {
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

  return micampVerifier.verifySignature(rawBody, signatureHeader);
}

/* MicampWebhookEvent is exported at the top of this file via re-export
 * from @eazepay/shared-types — the canonical schema lives there next to
 * the Zod discriminated union used by the worker. */

/* ---------- MerchantProcessor adapter ---------- */

/**
 * Concrete shape of the MiCamp `MerchantProcessor` — re-exposes the
 * adapter-owned request/response types into the generic interface.
 * Consumers should prefer this alias over re-spelling the generics.
 */
export type MicampMerchantProcessor = MerchantProcessor<
  ProvisionMidRequest,
  ProvisionMidResponse,
  ChargeRequest,
  ChargeResponse,
  SettlementReport
>;

export interface CreateMicampClientOptions {
  /**
   * Hooks for tests / canary harnesses. Defaults to the module-level
   * functions (which themselves switch between synthetic + live based
   * on env vars). Override individual methods to swap in a stub for
   * one merchant while leaving the others on the real client.
   */
  provisionMid?: (req: ProvisionMidRequest) => Promise<ProvisionMidResponse>;
  charge?: (req: ChargeRequest) => Promise<ChargeResponse>;
  settlementReport?: (
    midId: string,
    period: { start: string; end: string },
  ) => Promise<SettlementReport>;
  /**
   * Optional getBalance implementation. The current MiCamp wiring does
   * NOT expose a balance endpoint — until Steven + Frank ship one, this
   * defaults to throwing IntegrationError(kind: 'NotImplemented') so the
   * canary harness surfaces the gap rather than fabricating data.
   */
  getBalance?: (midId: string) => Promise<BalanceSnapshot>;
}

/**
 * Build a `MerchantProcessor` backed by MiCamp. The factory exists so
 * the registry can hand back a per-merchant adapter (e.g. a stub for
 * one merchant during canary while every other merchant stays on the
 * real client) without route handlers needing to know which.
 */
export function createMicampClient(
  opts: CreateMicampClientOptions = {},
): MicampMerchantProcessor {
  return {
    provider: PARTNER,
    provisionMid: opts.provisionMid ?? provisionMid,
    charge: opts.charge ?? charge,
    settlementReport: opts.settlementReport ?? settlementReport,
    getBalance:
      opts.getBalance ??
      (async (midId: string): Promise<BalanceSnapshot> => {
        throw new IntegrationErrorException({
          provider: PARTNER,
          endpoint: 'getBalance',
          kind: 'NotImplemented',
          message: `getBalance(${midId}) is not yet wired on the MiCamp adapter — pending Steven + Frank's payfac endpoint.`,
        });
      }),
  };
}
