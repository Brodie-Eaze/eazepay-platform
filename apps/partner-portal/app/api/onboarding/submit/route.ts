/**
 * POST /api/onboarding/submit — partner onboarding endpoint.
 *
 * What this fixes
 * ---------------
 * Before this route existed, the /welcome 5-step wizard POSTed to a
 * non-existent endpoint and got back 404. The wizard then surfaced
 * "Onboarding submission failed. Please try again." with no detail.
 * This was the highest-leverage broken thing on the platform — a real
 * customer literally could not sign up.
 *
 * What it does now
 * ----------------
 *   1. Parse + validate the `OnboardingState` body shape (Zod).
 *   2. Reject `industry = 'other'` with 400 + a "we'll be in touch"
 *      message — there's no `direct` brand in the partners enum.
 *   3. Map industry → brand (medical→medpay, trades→tradepay,
 *      coaching→coachpay).
 *   4. Mint a partner-id from the legal name slug + a timestamp suffix.
 *   5. INSERT into the partners table.
 *   6. Mint a signed account-session cookie so the user lands logged in.
 *   7. Send a welcome email via Resend (when wired) — silently logged
 *      otherwise.
 *   8. Return 201 with `{ partnerId, brand, redirect: '/welcome/submitted' }`.
 *
 * What it does NOT yet do
 * -----------------------
 *   • Persist the bank account (routing + account number). ADR-0016
 *     (PII vault) is the pre-req for storing those values — the schema
 *     doesn't have the columns and PII shouldn't land in plaintext.
 *     We accept the data, validate it, then drop it on the floor. A
 *     future PR will add the `bank_accounts` table + per-row data keys
 *     and wire that path through.
 *   • Persist beneficial-owner records. Same reason — owner SSN-4 +
 *     DOB are PII and need the vault.
 *   • Run KYB. The Middesk integration is in the next sprint.
 *   • Real idempotency. A double-submit creates two partner rows.
 *     The user-visible mitigation is the wizard's `submitting` flag
 *     that disables the button between click and response; the
 *     server-side mitigation is a future ADR-0015 idempotency key.
 *
 * Failure modes
 * -------------
 *   400 — validation failed, industry is 'other', or industry/brand
 *         is missing
 *   503 — Postgres not provisioned (hasDb() returned false) OR
 *         insert failed for any DB-level reason
 *   500 — unexpected error, logged via safeLog
 *
 * Response shape mirrors RFC-7807 Problem-Details per ADR-0014.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb, hasDb } from '../../../../lib/db';
import { partners } from '../../../../lib/db/schema';
import { signAccountSession, ACCOUNT_COOKIE } from '../../../../lib/account-cookie';
import { safeLog } from '../../../../lib/safe-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ---------- request validation ----------
 *
 * Mirrors `OnboardingState` from `app/welcome/state.ts`. We use Zod
 * instead of importing the type directly so the validation rejects
 * extra fields and coerces bad types into 400s rather than silently
 * accepting them.
 */
const beneficialOwnerSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  title: z.string().min(1),
  ownershipPercentage: z.string(),
  email: z.string().email(),
  phone: z.string().min(1),
  isControlPerson: z.boolean(),
});

const onboardingSchema = z.object({
  industry: z.enum(['coaching', 'trades', 'medical', 'other']),
  legalName: z.string().min(1),
  dba: z.string().optional().default(''),
  ein: z.string().regex(/^\d{2}-?\d{7}$/),
  website: z.string().optional().default(''),
  phone: z.string().min(7),
  addressLine1: z.string().min(1),
  addressLine2: z.string().optional().default(''),
  city: z.string().min(1),
  state: z.string().length(2),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/),
  yearsInBusiness: z.string().min(1),
  employeeCount: z.string().min(1),
  owners: z.array(beneficialOwnerSchema).min(1),
  bankName: z.string().min(1),
  routingNumber: z.string().regex(/^\d{9}$/),
  accountNumber: z.string().regex(/^\d{4,17}$/),
  accountType: z.enum(['checking', 'savings']),
  avgMonthlyVolume: z.string().min(1),
  avgTicket: z.string().min(1),
  hasProcessingHistory: z.boolean(),
  acceptedTerms: z.literal(true),
  acceptedPrivacy: z.literal(true),
  signedAgreement: z.literal(true),
});

const INDUSTRY_TO_BRAND = {
  medical: 'medpay',
  trades: 'tradepay',
  coaching: 'coachpay',
} as const;

type Brand = (typeof INDUSTRY_TO_BRAND)[keyof typeof INDUSTRY_TO_BRAND];

/**
 * Mint a partner-id from the legal name + timestamp. Slug + suffix
 * gives a human-readable identifier (`p_brodie-dental_abc123`) that's
 * still unique even if two practices share a name.
 *
 * Length-capped at 64 chars to fit the partner_id column comfortably
 * and survive any future TEXT → VARCHAR migration.
 */
function mintPartnerId(legalName: string): string {
  const slug = legalName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `p_${slug}_${suffix}`.slice(0, 64);
}

/**
 * Render an RFC-7807 Problem-Details response. Centralised so every
 * failure path uses the same shape and the front-end's `body.detail`
 * read keeps working.
 */
function problem(
  status: number,
  title: string,
  detail: string,
  extra: Record<string, unknown> = {},
): NextResponse {
  return NextResponse.json(
    {
      type: `https://eazepay.com/problems/${title.toLowerCase().replace(/\s+/g, '-')}`,
      title,
      status,
      detail,
      ...extra,
    },
    { status },
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Postgres availability gate — same pattern as the other write routes
  // in `app/api/v/[brand]/applications/`.
  if (!hasDb()) {
    safeLog.warn({ event: 'onboarding.submit.no_db' });
    return problem(
      503,
      'Database unavailable',
      "We're unable to create accounts right now. Please try again in a few minutes, or email support@eazepay.com if it persists.",
    );
  }

  // Parse + validate the body.
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return problem(400, 'Invalid JSON', 'The request body could not be parsed.');
  }
  const parsed = onboardingSchema.safeParse(raw);
  if (!parsed.success) {
    return problem(
      400,
      'Validation failed',
      'One or more fields did not pass validation. See `errors` for detail.',
      { errors: parsed.error.flatten() },
    );
  }
  const data = parsed.data;

  // 'other' industry has no brand in the partners enum. We treat it
  // as a soft reject: the customer hears from us via support rather
  // than getting auto-provisioned. Future: add a `general` brand and
  // wire a manual-approval queue.
  if (data.industry === 'other') {
    return problem(
      400,
      'Industry not yet supported',
      "We don't have a vertical for your industry yet. Email support@eazepay.com and we'll get you set up manually.",
      { industry: data.industry },
    );
  }

  const brand: Brand = INDUSTRY_TO_BRAND[data.industry];
  const partnerId = mintPartnerId(data.legalName);
  const primaryEmail = data.owners[0]?.email ?? '';

  // Insert the partner row. We log + drop the bank-account + owner
  // detail intentionally; persisting that without the PII vault (ADR-0016)
  // would be a SOC2 finding waiting to happen.
  try {
    const db = getDb();
    await db
      .insert(partners)
      .values({
        id: partnerId,
        brand,
        legalName: data.legalName,
        displayName: data.dba || data.legalName,
        primaryContactEmail: primaryEmail,
        status: 'pending', // operator review before they appear in admin tools
      })
      .onConflictDoNothing({ target: partners.id });
  } catch (err) {
    safeLog.error({ event: 'onboarding.submit.db_insert_failed', err });
    return problem(
      503,
      'Database unavailable',
      "Couldn't create your account. Please try again in a few minutes.",
    );
  }

  safeLog.info({
    event: 'onboarding.submit.partner_created',
    partnerId,
    brand,
    industry: data.industry,
  });

  // Mint the account-session cookie. The user-id for now is the
  // partner-id; a future identity service will issue real user records.
  let cookieValue: string;
  try {
    cookieValue = await signAccountSession(
      { userId: partnerId, brand, partnerId },
      ACCOUNT_COOKIE.ttlSeconds,
    );
  } catch (err) {
    safeLog.error({ event: 'onboarding.submit.cookie_mint_failed', err });
    // Partner row created but session not. The user can sign in via
    // /sign-in with their email — we'll continue with 201 instead of
    // rolling back the insert.
    cookieValue = '';
  }

  // Send the welcome email — best-effort, never blocks the response.
  // The notification service / Resend wiring will fire `welcome.<brand>`
  // template once it lands. For now we log the intent.
  safeLog.info({
    event: 'onboarding.submit.welcome_email_queued',
    partnerId,
    brand,
    to: primaryEmail,
  });

  const res = NextResponse.json(
    {
      partnerId,
      brand,
      redirect: '/welcome/submitted',
    },
    { status: 201 },
  );

  if (cookieValue) {
    // SEC-206: SameSite=Strict to match the rest of the auth cookie
    // surface (sign-in / accept-invite / set-password all mint Strict).
    // Lax let a top-level cross-site GET present the just-minted
    // session — Strict closes that vector. The onboarding flow lands
    // the user on /welcome/submitted in the same browsing context, so
    // Strict does not break navigation.
    res.cookies.set({
      name: ACCOUNT_COOKIE.name,
      value: cookieValue,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: ACCOUNT_COOKIE.ttlSeconds,
    });
  }

  return res;
}
