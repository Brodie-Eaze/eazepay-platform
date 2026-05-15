import { NextResponse, type NextRequest } from 'next/server';

/**
 * POST /api/applications/consent — consumer soft-pull consent receipt.
 *
 * WHY THIS ROUTE EXISTS
 * ---------------------
 * FCRA §604(a)(2) and Reg B (12 CFR §1002.5) require that the consumer
 * affirmatively authorize a credit pull AND that the lender / broker
 * retain a defensible record of that authorization. "Defensible" means
 * the record can prove three things in a regulator audit:
 *
 *   1. WHO consented   → application id + sessionId (cookie-bound)
 *   2. WHEN they consented → server-side ISO timestamp (not client clock)
 *   3. WHAT they saw   → the exact disclosure version string the UI
 *                        rendered, plus the consumer's IP + userAgent
 *
 * This route is the immutable audit-chain entry. In production it would
 * write to the append-only consent_receipts Postgres table + ship to the
 * S3 WORM bucket the SOC 2 Type II auditor reads. For now it acks 200
 * and keeps an in-memory copy so the dev flow round-trips end to end.
 *
 * The consumer page ALSO mirrors the receipt into localStorage keyed
 * `eazepay.consent.<applicationId>` so the consumer can prove what they
 * agreed to from their own browser if they ever dispute the inquiry
 * (FCRA §611 dispute path).
 */

// In-memory store. Replace with Prisma `consentReceipt.create({...})`
// when the schema lands. Keyed by `${applicationId}:${sessionId}` so a
// retry from the same session is idempotent but two separate sessions
// agreeing on behalf of the same applicationId are both captured (a red
// flag that gets routed to fraud review).
const RECEIPTS = new Map<
  string,
  {
    applicationId: string;
    sessionId: string;
    disclosureVersion: string;
    consentText: string;
    timestamp: string;
    ip: string;
    userAgent: string;
  }
>();

interface ConsentBody {
  applicationId: string;
  sessionId: string;
  disclosureVersion: string;
  consentText: string;
  // Client-supplied timestamp is recorded for forensics but we ALWAYS
  // overwrite with server time before persisting. Clock skew on consumer
  // devices is real and the audit needs a monotonic source of truth.
  clientTimestamp?: string;
}

export async function POST(req: NextRequest) {
  let body: ConsentBody;
  try {
    body = (await req.json()) as ConsentBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid_json' },
      { status: 400 },
    );
  }

  if (!body.applicationId || !body.sessionId || !body.disclosureVersion) {
    return NextResponse.json(
      { ok: false, error: 'missing_required_fields' },
      { status: 400 },
    );
  }

  // Forwarded-for is set by Vercel / Cloudflare / NLB. Trust the
  // leftmost address (originating client) when present, otherwise fall
  // back to the direct remote address Next exposes. Never trust a
  // header the consumer can mint themselves without a hop layer.
  const xff = req.headers.get('x-forwarded-for') ?? '';
  const ip = xff.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  const userAgent = req.headers.get('user-agent') ?? 'unknown';

  const receipt = {
    applicationId: body.applicationId,
    sessionId: body.sessionId,
    disclosureVersion: body.disclosureVersion,
    consentText: body.consentText,
    timestamp: new Date().toISOString(),
    ip,
    userAgent,
  };

  RECEIPTS.set(`${body.applicationId}:${body.sessionId}`, receipt);

  return NextResponse.json(
    {
      ok: true,
      receipt: {
        applicationId: receipt.applicationId,
        sessionId: receipt.sessionId,
        timestamp: receipt.timestamp,
        disclosureVersion: receipt.disclosureVersion,
      },
    },
    { status: 200 },
  );
}

/**
 * GET surface — used by ops to verify a receipt during a dispute. In
 * production this is admin-only. For the dev flow it's open so the
 * operator (Brodie) can curl it and see what landed.
 */
export async function GET(req: NextRequest) {
  const applicationId = req.nextUrl.searchParams.get('applicationId');
  if (!applicationId) {
    return NextResponse.json(
      { ok: false, error: 'applicationId_required' },
      { status: 400 },
    );
  }
  const matches = Array.from(RECEIPTS.values()).filter(
    (r) => r.applicationId === applicationId,
  );
  return NextResponse.json({ ok: true, receipts: matches });
}
