import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { redeemInvite, getInvite, BRAND_FROM_CONFIG_SLUG } from '../../../../../lib/invites-store';
import { sendWelcomeEmail } from '../../../../../lib/server-email';
import { createInvitedAccount, type AccountBrand } from '../../../../../lib/accounts-store';

/** Map BrandCode → the first demo partnerId for the brand. New
 *  businesses are bound to the brand's demo partner for now; when
 *  apps/api lands, we mint a real Merchant row per business and
 *  attach the user to it. */
const DEMO_PARTNER_BY_BRAND: Record<AccountBrand, string> = {
  medpay: 'p_helio',
  tradepay: 'p_orion',
  coachpay: 'p_atlas',
};
import { enforceCsrf } from '../../../../../lib/csrf.js';
import { enforce as enforceEdgeRateLimit } from '../../../../../lib/edge-rate-limit.js';

/**
 * Brand onboarding — BFF proxy.
 *
 * Forwards a brand-onboarding submission to the right provider on
 * the API side. Surface vs provider mapping:
 *
 *   surface           backend provider
 *   ─────────────     ────────────────
 *   coach-pay         eaze-orchestration (internal)
 *   trade-pay         eaze-orchestration (internal)
 *   med-pay           eaze-orchestration (internal)
 *   dialerpay         dialerpay
 *   processing        mycamp
 *
 * Partners never see the provider name — the brand stays the only
 * label everywhere on the UI surface. The provider only appears in
 * server-side audit rows + downstream system integrations.
 */

const PROVIDER_BY_BRAND: Record<string, string> = {
  'coach-pay': 'eaze-orchestration',
  'trade-pay': 'eaze-orchestration',
  'med-pay': 'eaze-orchestration',
  dialerpay: 'dialerpay',
  processing: 'mycamp',
};

// SEC-203: client IP comes from `resolveClientIp` which uses the
// rightmost-trusted-hop walk of X-Forwarded-For + X-Real-IP fallback.
// The leftmost-XFF approach we used before was trivially spoofable —
// see lib/client-ip.ts for the threat model.
import { resolveClientIp } from '../../../../../lib/client-ip.js';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3300';

const BodySchema = z.object({
  brand: z.string().min(1),
  legalName: z.string().min(1),
  dba: z.string().optional().default(''),
  ein: z.string().regex(/^\d{2}-?\d{7}$/, 'EIN format XX-XXXXXXX'),
  address: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(2).max(2),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP'),
  yearsInBusiness: z.string().min(1),
  avgMonthlyRevenue: z.string().min(1),
  ownerName: z.string().min(1),
  ownerTitle: z.string().min(1),
  ownerPhone: z.string().min(7),
  ownerEmail: z.string().email(),
  ownerSsnLast4: z.string().regex(/^\d{4}$/),
  ownerDob: z.string().min(1),
  ownerOwnershipPct: z.string().min(1),
  uploads: z.record(z.string()).default({}),
  inviteToken: z.string().min(1).optional(),
});

// SEC-115: never `console.log(body)` or `console.log(parsed.data)` in
// this file. Owner SSN-last-4 + DOB + owner phone/email all live on
// the parsed payload. If you add diagnostic logging, route it through
// `lib/safe-log.ts` (`safeLog.info(...)`), which deep-redacts every
// field whose key includes ssn/dob/email/phone/etc. before emit.

/**
 * SEC — CSRF wrapping scope.
 *
 * Wrapped (this file): /api/integrations/brand/apply because the
 * consumer apply form is the highest-value state-changing surface in
 * the partner-portal — a cross-site forged submission could enroll a
 * merchant on the operator's behalf, or pre-populate fraudulent KYB
 * data into a real session.
 *
 * Also wrapped: /api/auth/login (mint a session) and /api/auth/demo
 * (mint a demo session). Both can produce a privileged-feeling
 * session that an attacker could exploit downstream.
 *
 * NOT wrapped (deferred — defended by SameSite=Lax + auth-token
 * binding):
 *   - /api/auth/logout              (idempotent, low-risk)
 *   - /api/onboarding/invite        (operator-only, JSON-only)
 *   - /api/v/[brand]/consumer-invites
 *   - /api/applications/consent     (idempotent receipt write)
 * Track in SEC-### follow-up to wrap the deferred set when the
 * client fetch helper is centralised (today only this route uses a
 * non-portable cookie-bound form post).
 */
export async function POST(req: NextRequest) {
  // CSRF first, then per-IP edge rate limit, then the body parse +
  // backend dispatch. Order matters: CSRF rejection is constant-cost,
  // rate-limit rejection is constant-cost, only after both do we burn
  // any cycles parsing the body.
  const csrfFail = enforceCsrf(req);
  if (csrfFail) return csrfFail;

  const ip = resolveClientIp(req);
  const rl = enforceEdgeRateLimit(ip);
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({
        type: 'about:blank',
        title: 'Too Many Requests',
        status: 429,
        code: 'rate_limited',
        detail: 'Too many submissions from this network. Retry shortly.',
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil((rl.retryAfterMs ?? 60_000) / 1000).toString(),
        },
      },
    );
  }

  const url = new URL(req.url);
  const brandParam = url.searchParams.get('brand') ?? '';

  const raw = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse({ ...raw, brand: raw?.brand ?? brandParam });
  if (!parsed.success) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        code: 'invalid_application_payload',
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const provider = PROVIDER_BY_BRAND[parsed.data.brand];
  if (!provider) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        code: 'unknown_brand',
        detail: `No provider mapping for brand "${parsed.data.brand}".`,
      },
      { status: 400 },
    );
  }

  /* Resolve any invite first — if present, we'll stamp the resulting
   * application with `meta.invitedById` so the master pipeline can
   * filter "Your invites". We don't fail the application if the invite
   * is stale; we just skip the meta tag + don't redeem. */
  let invitedById: string | undefined;
  let inviteIsValid = false;
  if (parsed.data.inviteToken) {
    const invite = await getInvite(parsed.data.inviteToken);
    const expectedBrand = BRAND_FROM_CONFIG_SLUG[parsed.data.brand];
    if (invite && invite.status === 'active' && expectedBrand && invite.brand === expectedBrand) {
      invitedById = invite.invitedById;
      inviteIsValid = true;
    }
  }

  const token = req.cookies.get('eazepay_at')?.value;
  if (token) {
    try {
      const res = await fetch(`${API_URL}/v1/integrations/${provider}/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          provider,
          surface: parsed.data.brand,
          ...parsed.data,
          meta: invitedById ? { invitedById, inviteToken: parsed.data.inviteToken } : undefined,
        }),
      });
      if (!res.ok) {
        return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
      }
      const json = (await res.json()) as { applicationId?: string };
      if (inviteIsValid && parsed.data.inviteToken) {
        // SEC-112: collision-free fallback when the backend doesn't return an id.
        await redeemInvite(parsed.data.inviteToken, json.applicationId ?? `app_${randomUUID()}`);
      }
      return NextResponse.json(json);
    } catch {
      // Fall through to the synthetic 202.
    }
  }

  // SEC-112: collision-free + unguessable. The previous form
  // `app_<brand>_<base36-ts>` had two problems:
  //   1. simultaneous applies in the same millisecond could collide
  //   2. iterating timestamps let an attacker harvest consent receipts
  //      via SEC-104 (now fixed, but the underlying id format was the
  //      load-bearing predictability).
  const applicationId = `app_${parsed.data.brand}_${randomUUID()}`;
  if (inviteIsValid && parsed.data.inviteToken) {
    await redeemInvite(parsed.data.inviteToken, applicationId);
  }

  // Fire the branded welcome email. The mapping config-slug → BrandCode
  // is what BRAND_FROM_CONFIG_SLUG provides — handles both 'med-pay'
  // (the wizard's URL slug) and 'medpay' (the BrandCode).
  const brandCode =
    BRAND_FROM_CONFIG_SLUG[parsed.data.brand] ??
    (['medpay', 'tradepay', 'coachpay'].includes(parsed.data.brand)
      ? (parsed.data.brand as 'medpay' | 'tradepay' | 'coachpay')
      : null);
  if (brandCode) {
    // Mint an invited Owner account for this business. The welcome
    // email's portal link carries the userId so the recipient can
    // set a password + sign in. Lookup is idempotent at email-per-brand
    // so a retry of the same onboarding doesn't clobber an existing
    // account.
    const partnerId = DEMO_PARTNER_BY_BRAND[brandCode];
    const { userId } = await createInvitedAccount({
      email: parsed.data.ownerEmail,
      displayName: parsed.data.ownerName,
      brand: brandCode,
      partnerId,
      role: 'Owner',
    });

    const origin = req.headers.get('origin') ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    // Welcome link carries the userId (NOT the email — userId is the
    // stable identifier; email could change). The /welcome/<brand>
    // page is a public route (outside the /v/<brand>/ auth fence) so
    // a recipient who has no cookie can land here and set a password.
    // POSTs { userId, newPassword } to /api/account/set-password.
    const portalUrl = `${origin}/welcome/${brandCode}?u=${userId}`;
    try {
      await sendWelcomeEmail({
        brand: brandCode,
        to: parsed.data.ownerEmail,
        idempotencyKey: `welcome-${userId}`,
        vars: {
          recipientName: parsed.data.ownerName.split(' ')[0] ?? parsed.data.ownerName,
          merchantBusinessName: parsed.data.legalName,
          portalUrl,
        },
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'onboarding.welcome_email_failed',
          applicationId,
          userId,
          msg: (err as Error).message,
        }),
      );
    }
  }

  return NextResponse.json(
    {
      ok: true,
      applicationId,
      brand: parsed.data.brand,
      provider,
      meta: invitedById ? { invitedById, inviteToken: parsed.data.inviteToken } : undefined,
    },
    { status: 202 },
  );
}
