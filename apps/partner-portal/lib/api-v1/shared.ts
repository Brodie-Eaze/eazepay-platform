import { NextResponse } from 'next/server';

/**
 * Shared helpers for the public lender-facing `/api/v1/*` endpoints.
 *
 * Production routes signed traffic through HMAC-SHA256 with a
 * per-lender shared secret. In demo / preview mode we still validate
 * signature headers when present so a lender can run their integration
 * tests end to end, but we don't reject unsigned requests — we annotate
 * the response with `_meta.signature_status` so the lender sees how
 * their key is being interpreted.
 *
 * SECURITY (SEC-003 hardening): In production, unsigned requests are
 * REJECTED. The `verifySignature()` helper returns `status: 'skipped'`
 * when no signature headers are present; callers MUST consult
 * `signatureRequired()` and refuse 'skipped' alongside 'invalid' /
 * 'missing' when running in prod. Attack scenario being closed: a
 * lender (or anyone who can reach /api/v1/lenders/{id}/quote) drops the
 * HMAC headers entirely and receives a 200 with real offer data,
 * bypassing the per-lender shared-secret check that's the only thing
 * gating these endpoints. The `requireSignatureCheck()` helper below
 * is the single source of truth for the env-gated reject decision.
 */

const MOCK_SECRET = 'demo_shared_secret_replace_in_prod';

/**
 * In production, HMAC signatures are MANDATORY — unsigned ('skipped')
 * requests must be rejected the same way 'invalid' / 'missing' are.
 * Outside prod (dev, preview, test) we keep the lenient default so
 * local demo flows and integration-partner sandboxes keep working
 * without secret-management overhead.
 *
 * Override with `REQUIRE_HMAC=true` if you need to force-enable the
 * strict policy in a non-prod environment (e.g. a security-review
 * staging box).
 */
export function signatureRequired(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.REQUIRE_HMAC === 'true';
}

/**
 * Single source of truth for "should this request be rejected on the
 * basis of its signature check?". Returns a non-null `problem`-style
 * payload to throw straight into a 401 response when the answer is
 * yes, or null when the request may proceed.
 *
 * Centralising this here means we cannot accidentally diverge across
 * the lender / webhook / future route handlers — every caller funnels
 * through the same gate and the same env override.
 */
export function requireSignatureCheck(
  sigCheck: { status: 'valid' | 'missing' | 'invalid' | 'skipped'; reason?: string },
  instance: string,
): null | { title: string; status: number; code: string; detail: string; instance: string } {
  if (sigCheck.status === 'invalid' || sigCheck.status === 'missing') {
    return {
      title: 'Unauthorized',
      status: 401,
      code: `signature_${sigCheck.status}`,
      detail: sigCheck.reason ?? 'HMAC signature failed.',
      instance,
    };
  }
  if (sigCheck.status === 'skipped' && signatureRequired()) {
    return {
      title: 'Unauthorized',
      status: 401,
      code: 'signature_required',
      detail:
        'HMAC signature headers (X-EazePay-Timestamp · X-EazePay-Nonce · X-EazePay-Signature) are mandatory in this environment.',
      instance,
    };
  }
  return null;
}

export interface ProblemDetails {
  type?: string;
  title: string;
  status: number;
  code: string;
  detail?: string;
  instance?: string;
}

export const problem = (p: Omit<ProblemDetails, 'type'> & { type?: string }) =>
  NextResponse.json(
    {
      type: p.type ?? 'about:blank',
      title: p.title,
      status: p.status,
      code: p.code,
      detail: p.detail,
      instance: p.instance,
    },
    { status: p.status },
  );

/** Deterministic id helper so the same input produces the same output across calls. */
export const idFor = (prefix: string, seed: string) => {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  const hex = Math.abs(h).toString(36).padStart(8, '0').slice(0, 12);
  return `${prefix}_${hex}`;
};

/** Verify HMAC-SHA256 of timestamp.nonce.body using Web Crypto (Edge-safe). */
export async function verifySignature(args: {
  timestamp: string | null;
  nonce: string | null;
  signature: string | null;
  body: string;
  secret?: string;
}): Promise<{ status: 'valid' | 'missing' | 'invalid' | 'skipped'; reason?: string }> {
  const { timestamp, nonce, signature, body } = args;
  const secret = args.secret ?? MOCK_SECRET;
  if (!timestamp && !nonce && !signature) {
    return { status: 'skipped', reason: 'No signature headers — demo allows unsigned calls.' };
  }
  if (!timestamp || !nonce || !signature) {
    return {
      status: 'missing',
      reason: 'Required headers: X-EazePay-Timestamp · X-EazePay-Nonce · X-EazePay-Signature.',
    };
  }
  // 5-minute replay window
  const now = Math.floor(Date.now() / 1000);
  const ts = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > 300) {
    return { status: 'invalid', reason: 'Timestamp outside the 5-minute replay window.' };
  }
  try {
    const enc = new TextEncoder();
    const keyData = enc.encode(secret);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const payload = enc.encode(`${timestamp}.${nonce}.${body}`);
    const sigBuf = await crypto.subtle.sign('HMAC', key, payload);
    const hex = [...new Uint8Array(sigBuf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    // SEC-028 — constant-time comparison.
    //
    // Threat closed: the previous hex===signature check short-circuits
    // on the first differing byte. A network-adjacent attacker can
    // repeatedly call the endpoint with varying signatures and measure
    // response time to recover the correct signature one byte at a
    // time (microsecond-scale timing oracle; well-established attack
    // class — see "Lucky 13", HMAC-style timing attacks). The Edge
    // runtime has no node:crypto.timingSafeEqual, so we hand-roll the
    // constant-time check: encode both strings, XOR every byte, OR
    // the differences into one accumulator. Length difference returns
    // early because the lengths are public (and hex strings are a
    // fixed 64 chars anyway).
    const aBuf = new TextEncoder().encode(hex);
    const bBuf = new TextEncoder().encode(signature);
    if (aBuf.length !== bBuf.length) {
      return {
        status: 'invalid',
        reason: 'Signature did not match the computed HMAC-SHA256 over timestamp.nonce.body.',
      };
    }
    let diff = 0;
    for (let i = 0; i < aBuf.length; i++) {
      diff |= aBuf[i]! ^ bBuf[i]!;
    }
    if (diff !== 0) {
      return {
        status: 'invalid',
        reason: 'Signature did not match the computed HMAC-SHA256 over timestamp.nonce.body.',
      };
    }
    return { status: 'valid' };
  } catch (e) {
    return { status: 'invalid', reason: 'Signature verification crashed.' };
  }
}

/** Decorate the response with `_meta` so a lender sees how their headers were interpreted. */
export const withMeta = <T extends Record<string, unknown>>(
  body: T,
  meta: Record<string, unknown>,
) => ({ ...body, _meta: { ...meta, generated_at: new Date().toISOString() } });

// ─── Seed data — kept here so the API and the docs render the same payloads ─────

export const SAMPLE_APPLICATION = {
  application_id: 'app_4nqLkR2vTjW',
  policy_version: 'orch_v_2026_05_a',
  brand: 'tradepay',
  snapshot_hash: 'sha256:f4e9c1a2…',
  permissible_purpose: '604(a)(3)(A)',
  applicant: {
    state: 'TX',
    fico_band: '740-779',
    income_monthly_cents: 684_000,
    stability: { residence_years: 4.2, employer_years: 5.1 },
    cashflow_score: 0.84,
    dti_pct: 28.4,
    mla_covered: false,
    scra_active: false,
  },
  request: {
    amount_cents: 18_500_00,
    term_months: 60,
    category: 'home_improvement',
    purpose_detail: 'Solar PV + battery (Pacific Solar Co.)',
  },
  channel: {
    type: 'merchant',
    merchant_ref: 'mer_pacificsolar_001',
    partner_ref: 'evergreen',
  },
} as const;

export const SAMPLE_OFFER = {
  offer_id: 'off_8gQpZc7Tw9N',
  application_id: 'app_4nqLkR2vTjW',
  lender_product_id: 'lp_buzzpay_prime_tier1',
  amount_cents: 18_500_00,
  term_months: 60,
  apr_bps: 1099,
  fee_cents: 0,
  monthly_payment_cents: 40_142,
  lender_of_record: 'Cross River Bank',
  servicer: 'EazePay',
  valid_until: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  disclosures: {
    tila_reg_z: '/disclosures/tila/v2026.05.pdf',
    ecoa_reg_b: '/disclosures/ecoa/v2026.05.pdf',
  },
} as const;

/**
 * Brand + tier enums used by the public API surface. Defined here so the
 * `SAMPLE_LENDERS` array can declare its `brands` / `serves_tiers` fields
 * with a widened (but still typed) signature — otherwise `as const`
 * collapses every per-lender tuple into a different literal type and
 * `(typeof lender.brands)[number]` resolves to `never` at the call site,
 * which would make `l.brands.includes(brand)` un-typecheck.
 */
export type Brand = 'tradepay' | 'medpay' | 'coachpay' | 'direct';
export type LenderTier = 'prime_plus' | 'prime' | 'near_prime' | 'sub_prime';

interface SampleLenderDef {
  readonly id: string;
  readonly display_name: string;
  readonly legal_name: string;
  readonly integration_type: string;
  readonly brands: readonly Brand[];
  readonly serves_tiers: readonly LenderTier[];
  readonly min_amount_cents: number;
  readonly max_amount_cents: number;
  readonly apr_band_bps: { readonly min: number; readonly max: number };
  readonly sla_p95_ms: number;
  readonly webhook_url: string;
  readonly status: string;
}

export const SAMPLE_LENDERS: readonly SampleLenderDef[] = [
  {
    id: 'lp_buzzpay_prime',
    display_name: 'BuzzPay',
    legal_name: 'BuzzPay Finance, LLC (issued via Cross River Bank)',
    integration_type: 'API',
    brands: ['tradepay', 'medpay', 'coachpay', 'direct'],
    serves_tiers: ['prime_plus', 'prime', 'near_prime'],
    min_amount_cents: 500_00,
    max_amount_cents: 80_000_00,
    apr_band_bps: { min: 599, max: 1799 },
    sla_p95_ms: 612,
    webhook_url: 'https://buzzpay.example.com/webhooks/eazepay',
    status: 'active',
  },
  {
    id: 'lp_helia_medical',
    display_name: 'Helia Medical',
    legal_name: 'Helia Health Financing, Inc.',
    integration_type: 'API',
    brands: ['medpay'],
    serves_tiers: ['prime_plus', 'prime', 'near_prime'],
    min_amount_cents: 1_000_00,
    max_amount_cents: 50_000_00,
    apr_band_bps: { min: 690, max: 1499 },
    sla_p95_ms: 489,
    webhook_url: 'https://helia.example.com/webhooks/eazepay',
    status: 'active',
  },
  {
    id: 'lp_summit_premier',
    display_name: 'Summit Premier',
    legal_name: 'Summit Premier Capital, LLC',
    integration_type: 'API',
    brands: ['tradepay', 'medpay', 'coachpay'],
    serves_tiers: ['prime_plus'],
    min_amount_cents: 2_000_00,
    max_amount_cents: 150_000_00,
    apr_band_bps: { min: 549, max: 999 },
    sla_p95_ms: 743,
    webhook_url: 'https://summit.example.com/webhooks/eazepay',
    status: 'active',
  },
  {
    id: 'lp_kestrel',
    display_name: 'Kestrel',
    legal_name: 'Kestrel Lending Co.',
    integration_type: 'API',
    brands: ['tradepay'],
    serves_tiers: ['prime', 'near_prime', 'sub_prime'],
    min_amount_cents: 500_00,
    max_amount_cents: 35_000_00,
    apr_band_bps: { min: 999, max: 2499 },
    sla_p95_ms: 824,
    webhook_url: 'https://kestrel.example.com/webhooks/eazepay',
    status: 'active',
  },
  {
    id: 'lp_atlas_career_cap',
    display_name: 'Atlas Career Cap',
    legal_name: 'Atlas Career Capital, LLC',
    integration_type: 'API',
    brands: ['coachpay'],
    serves_tiers: ['prime_plus', 'prime'],
    min_amount_cents: 1_000_00,
    max_amount_cents: 25_000_00,
    apr_band_bps: { min: 749, max: 1199 },
    sla_p95_ms: 567,
    webhook_url: 'https://atlas.example.com/webhooks/eazepay',
    status: 'active',
  },
] as const;

export type SampleLender = (typeof SAMPLE_LENDERS)[number];

/** Build an offer for a given lender + amount — used by the offers + route endpoints. */
export function offerFor(lender: SampleLender, amountCents: number, termMonths = 48) {
  const aprMid = Math.round((lender.apr_band_bps.min + lender.apr_band_bps.max) / 2);
  const aprMonthly = aprMid / 100 / 12 / 100;
  const monthly =
    aprMonthly === 0
      ? Math.round(amountCents / termMonths)
      : Math.round((amountCents * aprMonthly) / (1 - Math.pow(1 + aprMonthly, -termMonths)));
  return {
    offer_id: idFor('off', lender.id + amountCents + termMonths),
    application_id: idFor('app', lender.id + amountCents),
    lender_product_id: lender.id,
    lender: lender.display_name,
    lender_of_record: lender.id === 'lp_buzzpay_prime' ? 'Cross River Bank' : lender.legal_name,
    amount_cents: amountCents,
    term_months: termMonths,
    apr_bps: aprMid,
    fee_cents: 0,
    monthly_payment_cents: monthly,
    approval_likelihood: lender.id === 'lp_buzzpay_prime' ? 0.92 : 0.78,
    valid_until: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  };
}
