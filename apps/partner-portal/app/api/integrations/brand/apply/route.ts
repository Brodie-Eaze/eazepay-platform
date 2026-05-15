import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  redeemInvite,
  getInvite,
  BRAND_FROM_CONFIG_SLUG,
} from '../../../../../lib/invites-store';

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

export async function POST(req: NextRequest) {
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
    if (
      invite &&
      invite.status === 'active' &&
      expectedBrand &&
      invite.brand === expectedBrand
    ) {
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
        await redeemInvite(parsed.data.inviteToken, json.applicationId ?? `app_${Date.now().toString(36)}`);
      }
      return NextResponse.json(json);
    } catch {
      // Fall through to the synthetic 202.
    }
  }

  const applicationId = `app_${parsed.data.brand}_${Date.now().toString(36)}`;
  if (inviteIsValid && parsed.data.inviteToken) {
    await redeemInvite(parsed.data.inviteToken, applicationId);
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
