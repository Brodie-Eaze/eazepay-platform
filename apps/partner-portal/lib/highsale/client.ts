/**
 * HighSale client — pre-qualification + agency sub-account integration.
 *
 * HighSale is the pre-qualification layer underneath BOTH AI Funding
 * Solutions (today) and MedPay (July 1). We operate as an AGENCY
 * account — every client signed onto AI Funding / MedPay becomes a
 * sub-account underneath us, which gives us:
 *   - Collective usage view across all clients
 *   - Subscription + throttle controls
 *   - Wholesale -> retail margin on every pre-qual pull
 *     (retail $3/pool · wholesale slides 1k:$260 -> 25k:$1.10)
 *   - Auto-billing via Milly (bi-weekly / monthly / weekly probation)
 *
 * Pixie (smart form + smart routing) sits inside HighSale as a
 * feature clients configure within their own file — it is NOT a
 * platform component we own.
 *
 * Wire to real HighSale by setting HIGHSALE_AGENCY_KEY +
 * HIGHSALE_API_URL. Without those env vars every method returns a
 * synthetic happy-path response.
 *
 * REFACTOR NOTE (refactor/integration-adapter-interfaces):
 *   This module now implements the `SoftPullProvider` port from
 *   @eazepay/integrations-core via the `createHighsaleClient()`
 *   factory. The `WebhookVerificationResult` type previously came in
 *   via a cross-import from `../micamp/client` (app->app sideways
 *   coupling); it now lives in `@eazepay/integrations-core` and is
 *   imported from there by every adapter. The named top-level exports
 *   (`createSubAccount`, `runPrequal`, `verifyHighsaleSignature`) are
 *   preserved for back-compat with existing tests + the orchestrator.
 */

import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  createHmacWebhookVerifier,
  IntegrationErrorException,
  type SoftPullProvider,
  type SoftPullSnapshot,
  type WebhookVerificationResult,
} from '@eazepay/integrations-core';
import { safeLog } from '../safe-log';
import { fetchWithTimeout } from '../integrations/fetch-with-timeout';

// Re-exported for back-compat; the canonical declaration lives in
// @eazepay/shared-types/webhook-events alongside the Zod schema that
// the worker uses to fail-loud on malformed deliveries.
export type { HighsaleWebhookEvent } from '@eazepay/shared-types';

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

/**
 * Response schemas are declared as Zod first; TypeScript types are
 * derived via `z.infer<>`. Single source of truth — a parse failure at
 * the JSON boundary throws `IntegrationErrorException({ kind: 'MalformedResponse' })`
 * so an upstream contract drift surfaces in the inbox / metrics tile
 * rather than corrupting downstream state via an unchecked `as` cast.
 */
export const BureauTypeSchema = z.enum(['fico8', 'vantage']);
export const BillingCadenceSchema = z.enum(['weekly', 'biweekly', 'monthly']);

export const CreateSubAccountResponseSchema = z.object({
  ok: z.boolean(),
  subAccountId: z.string().min(1),
  pixieEmbedUrl: z.string().min(1),
  /** Per-sub-account API key for direct pulls. */
  apiKey: z.string().min(1),
  configuredBureau: BureauTypeSchema,
  billingCadence: BillingCadenceSchema,
  probationUntil: z.string().min(1),
});

export type CreateSubAccountResponse = z.infer<typeof CreateSubAccountResponseSchema>;

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

export const PrequalResponseSchema = z.object({
  ok: z.boolean(),
  pullId: z.string().min(1),
  bureau: BureauTypeSchema,
  /** 'soft' for pre-qual, 'hard' for funding. Pre-qual is ALWAYS soft. */
  pullKind: z.literal('soft'),
  /** Credit tier our routing layer ranks against — A through D. */
  tier: z.enum(['A', 'B', 'C', 'D']),
  /** Approximate FICO band, 5-point granularity. NULL on thin file. */
  ficoBand: z.number().nullable(),
  /** Estimated max approved amount in cents, based on pre-qual data. */
  estimatedMaxCents: z.number().int().nonnegative(),
  /** Debt-to-income, as a fraction. NULL on insufficient data. */
  dti: z.number().nullable(),
  /** Open trade lines, derived from the bureau pull. */
  openTradelines: z.number().int().nullable(),
  /** Per-pull cost charged by HighSale at wholesale, in cents.
   * We retail at 300 (= $3 USD). */
  wholesaleCostCents: z.number().int().nonnegative(),
  /** Frozen bureau snapshot for audit / regulator replay. */
  snapshotJson: z.string(),
});

export type PrequalResponse = z.infer<typeof PrequalResponseSchema>;

/**
 * Parse a JSON response body against a Zod schema, converting parse
 * failures into the canonical `IntegrationErrorException({ kind:
 * 'MalformedResponse' })` so route handlers + workers see a uniform
 * failure shape regardless of which adapter raised it.
 */
function parseHighsaleResponse<T>(schema: z.ZodType<T>, body: unknown, endpoint: string): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new IntegrationErrorException({
      provider: PARTNER,
      endpoint,
      kind: 'MalformedResponse',
      message: `HighSale ${endpoint} response did not match schema`,
      detail: result.error.message,
    });
  }
  return result.data;
}

/* ---------- env wiring ---------- */

const HIGHSALE_API_URL = process.env.HIGHSALE_API_URL ?? '';
const HIGHSALE_AGENCY_KEY = process.env.HIGHSALE_AGENCY_KEY ?? '';
const HIGHSALE_WEBHOOK_SECRET = process.env.HIGHSALE_WEBHOOK_SECRET ?? '';

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
    return parseHighsaleResponse(
      CreateSubAccountResponseSchema,
      await res.json(),
      'createSubAccount',
    );
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
    return parseHighsaleResponse(PrequalResponseSchema, await res.json(), 'runPrequal');
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
 * Module-scoped HMAC verifier. The shared helper in
 * @eazepay/integrations-core handles every fail-closed branch except
 * `missing_secret`, which stays here so we can preserve the legacy
 * INSECURE_ALLOW warning log + the refuse-to-load production guard.
 */
const highsaleVerifier = createHmacWebhookVerifier({
  secret: HIGHSALE_WEBHOOK_SECRET,
});

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

  return highsaleVerifier.verifySignature(rawBody, signatureHeader);
}

/* HighsaleWebhookEvent is exported at the top of this file via re-export
 * from @eazepay/shared-types — the canonical schema lives there next to
 * the Zod discriminated union used by the worker. */

/* ---------- SoftPullProvider adapter ---------- */

export type HighsaleSoftPullProvider = SoftPullProvider<
  CreateSubAccountRequest,
  CreateSubAccountResponse,
  PrequalRequest,
  PrequalResponse
>;

export interface CreateHighsaleClientOptions {
  /**
   * Hooks for tests / canary harnesses. Defaults to the module-level
   * functions (which themselves switch between synthetic + live based
   * on env vars). Override individual methods to swap in a stub for one
   * sub-account while leaving the others on the real client.
   */
  createSubAccount?: (req: CreateSubAccountRequest) => Promise<CreateSubAccountResponse>;
  runPrequal?: (req: PrequalRequest) => Promise<PrequalResponse>;
  /**
   * Optional getSnapshot implementation. The current HighSale wiring
   * does NOT expose a snapshot-by-pullId endpoint — until it does, this
   * defaults to throwing IntegrationError(kind: 'NotImplemented') so
   * the canary harness + regulator replay tooling surface the gap
   * rather than fabricating data.
   */
  getSnapshot?: (pullId: string) => Promise<SoftPullSnapshot>;
}

/**
 * Build a `SoftPullProvider` backed by HighSale. The factory exists so
 * the registry can hand back a per-partner adapter (e.g. a stub for one
 * partner during canary) without route handlers needing to know which.
 */
export function createHighsaleClient(
  opts: CreateHighsaleClientOptions = {},
): HighsaleSoftPullProvider {
  return {
    provider: PARTNER,
    createSubAccount: opts.createSubAccount ?? createSubAccount,
    runPrequal: opts.runPrequal ?? runPrequal,
    getSnapshot:
      opts.getSnapshot ??
      (async (pullId: string): Promise<SoftPullSnapshot> => {
        throw new IntegrationErrorException({
          provider: PARTNER,
          endpoint: 'getSnapshot',
          kind: 'NotImplemented',
          message: `getSnapshot(${pullId}) is not yet wired on the HighSale adapter — pending the snapshot-by-id endpoint.`,
        });
      }),
  };
}
