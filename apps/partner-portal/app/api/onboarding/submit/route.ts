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
/* GLBA Safeguards Rule + SOC2 CC6.1 — until the PII vault (ADR-0016)
 * is wired we MUST NOT accept SSN-4, bank-account numbers, or
 * beneficial-owner identifiers on this route. Previously the schema
 * validated those fields and then silently dropped them on the floor:
 * validated PII still transited the HTTPS body, landed in access logs,
 * and was visible in OTel request spans for the lifetime of the trace.
 *
 * The Zod refinement below REJECTS any presence of those fields, and
 * the route additionally returns 501 `pii_vault_not_wired` before Zod
 * runs (see detectUnwiredPii below) so the client gets an unambiguous
 * routable code rather than a generic validation error. Clients are
 * expected to omit the fields entirely. Once the vault lands, swap
 * the refine for a real string shape + envelope-encrypt + insert. */
const piiRejected = z
  .any()
  .optional()
  .refine((v) => v === undefined || v === null || v === '', {
    message: 'PII vault not yet wired; do not submit',
  });

const beneficialOwnerSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  title: z.string().min(1),
  ownershipPercentage: z.string(),
  email: z.string().email(),
  phone: z.string().min(1),
  isControlPerson: z.boolean(),
  // GLBA — beneficial-owner SSN-4 cannot transit this route until the
  // vault is wired. Reject if present.
  ssn4: piiRejected,
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
  // GLBA Safeguards — bank routing + account numbers + applicant
  // SSN-4 cannot be accepted on this route until the PII vault
  // (ADR-0016) is wired. detectUnwiredPii() returns 501 before Zod
  // runs; these refinements are belt-and-braces if a future caller
  // bypasses the pre-check.
  routingNumber: piiRejected,
  accountNumber: piiRejected,
  ssn4: piiRejected,
  accountType: z.enum(['checking', 'savings']).optional(),
  avgMonthlyVolume: z.string().min(1),
  avgTicket: z.string().min(1),
  hasProcessingHistory: z.boolean(),
  acceptedTerms: z.literal(true),
  acceptedPrivacy: z.literal(true),
  signedAgreement: z.literal(true),
});

/**
 * Pre-Zod presence check for unwired-PII fields. Returns a list of
 * offending key paths (e.g. ['routingNumber', 'owners[0].ssn4']). An
 * empty list means the body is safe to forward into Zod.
 *
 * We log only the key paths, never the values, so PII never reaches
 * the log stream even on the rejection path. safeLog also recursively
 * redacts by key name as a second defence.
 */
function detectUnwiredPii(body: unknown): string[] {
  if (!body || typeof body !== 'object') return [];
  const b = body as Record<string, unknown>;
  const offenders: string[] = [];
  if (b.routingNumber) offenders.push('routingNumber');
  if (b.accountNumber) offenders.push('accountNumber');
  if (b.ssn4) offenders.push('ssn4');
  if (Array.isArray(b.owners)) {
    for (let i = 0; i < b.owners.length; i++) {
      const o = b.owners[i] as Record<string, unknown> | null | undefined;
      if (o && o.ssn4) offenders.push(`owners[${i}].ssn4`);
    }
  }
  return offenders;
}

// Module-load banner. Fires once per Node worker so SOC2 reviewers
// and on-call see the posture without reading route code.
safeLog.warn({
  event: 'onboarding.pii_vault_pending',
  message: 'Onboarding rejects bank/SSN/BO PII until vault wired',
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

  // GLBA Safeguards / SOC2 CC6.1 — fail fast (501) on any unwired-PII
  // field. Done BEFORE Zod so the client gets a routable
  // `pii_vault_not_wired` code instead of a generic validation error,
  // and BEFORE any downstream persistence so PII never reaches storage.
  const piiOffenders = detectUnwiredPii(raw);
  if (piiOffenders.length > 0) {
    safeLog.warn({
      event: 'onboarding.submit.pii_rejected',
      offenders: piiOffenders,
    });
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Not Implemented',
        status: 501,
        code: 'pii_vault_not_wired',
        detail:
          'Bank account + beneficial owner PII fields cannot be accepted until the PII vault (ADR-0016) is wired. Submit without those fields.',
        offenders: piiOffenders,
      },
      { status: 501 },
    );
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
    res.cookies.set({
      name: ACCOUNT_COOKIE.name,
      value: cookieValue,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: ACCOUNT_COOKIE.ttlSeconds,
    });
  }

  return res;
}
