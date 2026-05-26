import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { settlementReport } from '@/lib/micamp/client';

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

  const end = parsed.data.end ?? new Date().toISOString().slice(0, 10);
  const startFallback = new Date();
  startFallback.setUTCDate(startFallback.getUTCDate() - 30);
  const start = parsed.data.start ?? startFallback.toISOString().slice(0, 10);

  try {
    const report = await settlementReport(parsed.data.midId, { start, end });
    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Bad Gateway',
        status: 502,
        code: 'micamp_settlement_failed',
        detail: err instanceof Error ? err.message : 'MiCamp settlement fetch failed',
      },
      { status: 502 },
    );
  }
}
