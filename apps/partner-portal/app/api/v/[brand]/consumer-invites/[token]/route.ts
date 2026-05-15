/**
 * Consumer invite — token lookup + state transitions.
 *
 *   GET    /api/v/<brand>/consumer-invites/<token>
 *     Returns the invite (brand, prefill, status, applicationId).
 *     Used by the partner detail UI + by the apply page to read the
 *     prefill bag.
 *
 *   PATCH  /api/v/<brand>/consumer-invites/<token>
 *     Body: { event: 'started' | 'step_completed' | 'redeemed',
 *             applicationId?: string }
 *     Marks the invite in progress / step bumped / redeemed. Called by
 *     the consumer apply flow so the partner's live tracker can pulse
 *     when the consumer first opens the link.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  getConsumerInvite,
  markStarted,
  markStepCompleted,
  redeemConsumerInvite,
  attachApplicationId,
} from '../../../../../../lib/consumer-invites-store';

const PatchSchema = z.object({
  event: z.enum(['started', 'step_completed', 'redeemed']),
  applicationId: z.string().min(1).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ brand: string; token: string }> },
) {
  const { token } = await params;
  const invite = await getConsumerInvite(token);
  if (!invite) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        code: 'consumer_invite_not_found',
      },
      { status: 404 },
    );
  }
  return NextResponse.json({ invite });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ brand: string; token: string }> },
) {
  const { token } = await params;
  const raw = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        code: 'invalid_event',
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  /* Optionally attach the resulting application id first — the order
   * matters because redeem leaves the record in a terminal state. */
  if (parsed.data.applicationId) {
    await attachApplicationId(token, parsed.data.applicationId);
  }

  let invite;
  if (parsed.data.event === 'started') invite = await markStarted(token);
  else if (parsed.data.event === 'step_completed')
    invite = await markStepCompleted(token);
  else invite = await redeemConsumerInvite(token);

  if (!invite) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        code: 'consumer_invite_not_found',
      },
      { status: 404 },
    );
  }
  return NextResponse.json({ invite });
}
