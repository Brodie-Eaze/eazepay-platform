import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { settlementReport } from '@/lib/micamp/client';
import { assertResourceOwnership, requirePartnerSession } from '@/lib/server-guards';
import { safeErrorResponse } from '@/lib/safe-error';

/**
 * GET /api/integrations/micamp/settlement?midId=...&start=...&end=...
 *
 * Pull a settlement report for a partner's MID over a date window.
 * Drives:
 *   • The partner portal payouts page (per-MID payout schedule)
 *   • The admin observability dashboard (aggregate processing volume)
 *   • The accounting team's monthly close (rev-share calculation
 *     against MiCamp's 50/50 split)
 *
 * Date params are ISO YYYY-MM-DD. Missing window defaults to the
 * trailing 30 days.
 */

const QuerySchema = z.object({
  midId: z.string().min(1),
  start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  end: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export async function GET(req: NextRequest) {
  // SEC-001: partner session required. Settlement reports include
  // cents-level revenue + per-MID payout history — pre-fix anyone
  // could pull another partner's report by guessing their midId.
  const guard = await requirePartnerSession(req);
  if (guard instanceof NextResponse) return guard;

  const search = req.nextUrl.searchParams;
  const parsed = QuerySchema.safeParse({
    midId: search.get('midId'),
    start: search.get('start') ?? undefined,
    end: search.get('end') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        code: 'invalid_settlement_query',
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  // SEC-001 follow-up: midId → partner ownership check (mids.partner_id
  // is the source of truth). 404 on mismatch / not-found avoids
  // leaking the existence of another partner's MID uuid.
  const ownership = await assertResourceOwnership(guard, parsed.data.midId, 'mid');
  if (ownership) return ownership;

  const end = parsed.data.end ?? new Date().toISOString().slice(0, 10);
  const startFallback = new Date();
  startFallback.setUTCDate(startFallback.getUTCDate() - 30);
  const start = parsed.data.start ?? startFallback.toISOString().slice(0, 10);

  try {
    const report = await settlementReport(parsed.data.midId, { start, end });
    return NextResponse.json(report);
  } catch (err) {
    // SEC-007: never echo upstream error text. GETs leak fewer cycles
    // but the body still gets logged + cached downstream.
    return safeErrorResponse(
      err,
      'micamp_settlement_failed',
      502,
      '/api/integrations/micamp/settlement',
    );
  }
}
