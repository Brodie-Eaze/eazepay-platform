import { NextResponse, type NextRequest } from 'next/server';
import { enforce as enforceEdgeRateLimit } from '../../../../lib/edge-rate-limit.js';
import { getSessionContext } from '../../../../lib/session';

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
//
// SEC-105: two caps prevent unbounded memory growth.
//   * MAX_RECEIPTS_TOTAL — global FIFO cap; oldest evicted on insert
//   * MAX_RECEIPTS_PER_APPLICATION — defends against single-applicationId
//     amplification (an attacker forging session IDs in a loop). Five
//     receipts per app is enough for legit retry/refresh; anything
//     beyond is fraud-signal anyway.
const MAX_RECEIPTS_TOTAL = 5_000;
const MAX_RECEIPTS_PER_APPLICATION = 5;

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

function pruneReceiptsForApplication(applicationId: string): void {
  // Map iteration order = insertion order. Oldest matching entry is
  // the first one encountered when iterating.
  const matching: string[] = [];
  for (const [key, rec] of RECEIPTS) {
    if (rec.applicationId === applicationId) matching.push(key);
  }
  while (matching.length >= MAX_RECEIPTS_PER_APPLICATION) {
    const oldest = matching.shift();
    if (oldest) RECEIPTS.delete(oldest);
  }
}

function pruneReceiptsGlobal(): void {
  while (RECEIPTS.size >= MAX_RECEIPTS_TOTAL) {
    const oldest = RECEIPTS.keys().next().value;
    if (!oldest) return;
    RECEIPTS.delete(oldest);
  }
}

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
  // SEC — Per-IP edge rate limit. The consent map is an in-memory
  // store that grows by one entry per request; without a cap an
  // attacker can OOM the BFF replica by posting synthetic receipts.
  // 20 req/min/IP per the brief — see lib/edge-rate-limit.ts for the
  // sliding-window mechanics and the multi-replica caveat.
  const xff = req.headers.get('x-forwarded-for') ?? '';
  const clientIp = xff.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  const rl = enforceEdgeRateLimit(clientIp);
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({
        type: 'about:blank',
        title: 'Too Many Requests',
        status: 429,
        code: 'rate_limited',
        detail: 'Too many consent receipts from this network. Retry shortly.',
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil(rl.retryAfterMs / 1000).toString(),
        },
      },
    );
  }

  let body: ConsentBody;
  try {
    body = (await req.json()) as ConsentBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  if (!body.applicationId || !body.sessionId || !body.disclosureVersion) {
    return NextResponse.json({ ok: false, error: 'missing_required_fields' }, { status: 400 });
  }

  // Forwarded-for is set by Vercel / Cloudflare / NLB. Trust the
  // leftmost address (originating client) when present, otherwise fall
  // back to the direct remote address Next exposes. Never trust a
  // header the consumer can mint themselves without a hop layer.
  // Re-use the `clientIp` value computed above for the rate limiter
  // so the receipt records the same IP that bucketed the call.
  const ip = clientIp;
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

  // SEC-105: enforce caps before insert. Retries with the same
  // composite key overwrite in place and don't grow the map, so the
  // per-application prune only fires for genuinely new sessions.
  const key = `${body.applicationId}:${body.sessionId}`;
  if (!RECEIPTS.has(key)) {
    pruneReceiptsForApplication(body.applicationId);
    pruneReceiptsGlobal();
  }
  RECEIPTS.set(key, receipt);

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
 * GET surface — used by ops to verify a receipt during a dispute.
 *
 * SEC-104 hardening: pre-fix, this GET returned every receipt for a
 * given applicationId (IP, UA, disclosure version, consentText, full
 * sessionId) to ANY caller — applicationId values are guessable
 * (`app_<brand>_<base36-ts>` per SEC-112) so the leak path was
 * iterate-and-harvest.
 *
 * Policy:
 *   - Require an operator-level session (master/all/admin/operator/
 *     viewer/investor demo presets, or a real session in master_admin
 *     role once the backend wires it). Brand-scoped demo presets get
 *     403 — partner merchants don't read FCRA audit chains.
 *   - 404 when no session at all so the existence of the route isn't
 *     a probing signal for unauthenticated attackers.
 */
export async function GET(req: NextRequest) {
  const session = await getSessionContext(req);
  if (session.mode === 'none') {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        code: 'not_found',
      },
      { status: 404 },
    );
  }

  const isAdmin = (session.mode === 'demo' && session.isOperator) || session.mode === 'real';
  if (!isAdmin) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Forbidden',
        status: 403,
        code: 'admin_required',
        detail: 'Consent receipt access is limited to operator-tier sessions.',
      },
      { status: 403 },
    );
  }

  const applicationId = req.nextUrl.searchParams.get('applicationId');
  if (!applicationId) {
    return NextResponse.json({ ok: false, error: 'applicationId_required' }, { status: 400 });
  }
  const matches = Array.from(RECEIPTS.values()).filter((r) => r.applicationId === applicationId);
  return NextResponse.json({ ok: true, receipts: matches });
}
