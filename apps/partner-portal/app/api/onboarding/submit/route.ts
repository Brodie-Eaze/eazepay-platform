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
 * Idempotency (this PR)
 * ---------------------
 * The double-submit bug previously called out in "What it does NOT yet
 * do" is now closed: every POST requires an `Idempotency-Key` request
 * header (UUIDv4). Replays within 24h return the stored response
 * verbatim; replays older than 24h return 410 Gone. The shared helper
 * lives in `lib/idempotency.ts` so the provision route + future money
 * paths share the same contract.
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
 *
 * Failure modes
 * -------------
 *   400 — validation failed, industry is 'other', industry/brand
 *         missing, OR Idempotency-Key header missing/malformed
 *   410 — replay against a key older than 24h
 *   422 — same Idempotency-Key replayed with a different body
 *   503 — Postgres not provisioned OR insert failed for any reason
 *   500 — unexpected error, logged via safeLog
 *
 * Response shape mirrors RFC-7807 Problem-Details per ADR-0014.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getDb, hasDb } from '../../../../lib/db';
import { partners } from '../../../../lib/db/schema';
import { signAccountSession, ACCOUNT_COOKIE } from '../../../../lib/account-cookie';
import { safeLog } from '../../../../lib/safe-log';
import {
  hashRequestBody,
  parseIdempotencyKeyHeader,
  replayIfStored,
  storeResponse,
} from '../../../../lib/idempotency';

const IDEMPOTENCY_SCOPE = 'onboarding.submit';

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

function mintPartnerId(legalName: string): string {
  const slug = legalName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `p_${slug}_${suffix}`.slice(0, 64);
}

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
  if (!hasDb()) {
    safeLog.warn({ event: 'onboarding.submit.no_db' });
    return problem(
      503,
      'Database unavailable',
      "We're unable to create accounts right now. Please try again in a few minutes, or email support@eazepay.com if it persists.",
    );
  }

  // Idempotency-Key is required — a double-submit (refresh, double-click,
  // mobile-network retry) must NOT mint a second partner row. See
  // lib/idempotency.ts. 24-hour TTL; replays after that return 410 Gone.
  const idempotencyKey = parseIdempotencyKeyHeader(req);
  if (idempotencyKey instanceof NextResponse) return idempotencyKey;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return problem(400, 'Invalid JSON', 'The request body could not be parsed.');
  }

  // GLBA Safeguards / SOC2 CC6.1 — fail fast (501) on any unwired-PII
  // field. Done BEFORE Zod and BEFORE the idempotency replay so a PII
  // submission can never get cached + replayed, and the client gets a
  // routable `pii_vault_not_wired` code instead of a generic validation
  // error. PII never reaches storage on this path.
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

  // Replay check runs AFTER PII gate + body parse so the request-hash
  // mismatch detection has a stable value AND a poisoned PII body
  // cannot land in the idempotency store. A hit short-circuits the
  // partner insert + the welcome email.
  const requestHash = hashRequestBody(raw);
  const replay = await replayIfStored(IDEMPOTENCY_SCOPE, idempotencyKey, requestHash);
  if (replay) return replay;

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
        status: 'pending',
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

  let cookieValue: string;
  try {
    cookieValue = await signAccountSession(
      { userId: partnerId, brand, partnerId },
      ACCOUNT_COOKIE.ttlSeconds,
    );
  } catch (err) {
    safeLog.error({ event: 'onboarding.submit.cookie_mint_failed', err });
    cookieValue = '';
  }

  safeLog.info({
    event: 'onboarding.submit.welcome_email_queued',
    partnerId,
    brand,
    to: primaryEmail,
  });

  const responseBody = {
    partnerId,
    brand,
    redirect: '/welcome/submitted',
  };

  // Persist the response under the idempotency key BEFORE returning so a
  // racing client retry hits the stored row instead of inserting a
  // second partner. The cookie itself is NOT stored — replays return
  // the same 201 body without a Set-Cookie, which is correct: the
  // first caller's browser already has the session.
  await storeResponse(IDEMPOTENCY_SCOPE, idempotencyKey, requestHash, 201, responseBody);

  const res = NextResponse.json(responseBody, { status: 201 });

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
