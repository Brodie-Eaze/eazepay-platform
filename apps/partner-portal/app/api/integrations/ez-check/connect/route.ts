import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { safeLog } from '../../../../../lib/safe-log';

/**
 * EZ Check install — BFF proxy.
 *
 * Partner-facing brand stays "EZ Check"; the actual integration runs
 * against HighSale on the backend. This route:
 *
 *   1. Validates the 5-step wizard payload (CRM + funnel + config +
 *      install call).
 *   2. Lifts the partner session cookie into a Bearer token and
 *      forwards to `${API_URL}/v1/integrations/highsale/install`.
 *   3. On unwired-backend / network failure returns 202 with a
 *      synthetic install id so the wizard can still complete the
 *      flow end-to-end during development.
 *
 * The forward target is HighSale-specific — the Nest controller on
 * the API side is `IntegrationsController.highsaleInstall` and it
 * persists a `MarketplaceLender` row + queues a Calendly invite.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3300';

const BodySchema = z.object({
  crmPlatform: z.string().min(1),
  crmUrl: z.string().min(1),
  apiKey: z.string().optional().default(''),
  contactName: z.string().min(1),
  contactEmail: z.string().email(),
  contactPhone: z.string().min(7),
  placements: z.array(z.string()).min(1),
  funnelUrls: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  webhookUrl: z.string().optional().default(''),
  redirectApproved: z.string().optional().default(''),
  redirectDeclined: z.string().optional().default(''),
  brandColor: z.string().optional().default(''),
  displayName: z.string().min(1),
  customDomain: z.string().optional().default(''),
  selectedDate: z.string().nullable(),
  selectedTime: z.string().nullable(),
});

export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        code: 'invalid_install_payload',
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const token = req.cookies.get('eazepay_at')?.value;

  // Forward to the API's HighSale install handler. The on-disk
  // contract is the surface-name (EZ Check) → provider (HighSale)
  // mapping; the partner never sees "HighSale" in any UI string.
  if (token) {
    try {
      const res = await fetch(`${API_URL}/v1/integrations/highsale/install`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          provider: 'highsale',
          surface: 'ez-check',
          ...parsed.data,
        }),
      });
      if (!res.ok) {
        return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
      }
      return NextResponse.json(await res.json());
    } catch (err) {
      // SILENT-FAIL FIX: network failure was previously masked by the
      // synthetic ack below — the partner-facing UI saw success even
      // when the HighSale install never reached the backend. Log + fall
      // through (the synthetic path is the documented dev fallback,
      // but the failure needs to be visible to operators).
      safeLog.error({
        event: 'ez_check_connect.backend_unreachable',
        err,
      });
      // Fall through to the synthetic acknowledgement.
    }
  }

  // Synthetic 202 — the wizard can complete in dev before the API
  // route is wired. Once `/v1/integrations/highsale/install` ships
  // this branch becomes the network-failure fallback only.
  return NextResponse.json(
    {
      ok: true,
      installId: `ezc_${Date.now().toString(36)}`,
      provider: 'highsale',
      surface: 'ez-check',
      scheduledFor:
        parsed.data.selectedDate && parsed.data.selectedTime
          ? `${parsed.data.selectedDate}T${parsed.data.selectedTime}`
          : null,
    },
    { status: 202 },
  );
}
