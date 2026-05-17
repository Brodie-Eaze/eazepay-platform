import { NextResponse, type NextRequest } from 'next/server';
import { readSignedDemoPreset } from '../../../../lib/demo-cookie';

/**
 * Whoami. Server components and the avatar dropdown call this to get
 * the current actor. Returns null if no session cookie is present.
 *
 *  - Real session (eazepay_at cookie): proxies to backend GET /v1/me
 *  - Demo session (eazepay_demo cookie): returns a synthesised actor
 *    flagged `mode: 'demo'` so the UI can render the demo banner.
 *    Cookie value is HMAC-verified (SEC-103) before its preset is
 *    trusted — a forged or expired cookie resolves to 401.
 *  - No session: 401, the middleware will have already redirected
 *
 * SEC-109: only the master preset grants isAdmin:true, and the mint
 * route (`/api/auth/demo`) gates that preset behind DEMO_MASTER_ENABLED.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3300';

const DEMO_ACTORS: Record<string, { displayName: string; email: string; role: string }> = {
  master: { displayName: 'EAZE Admin', email: 'admin@eaze.test', role: 'master_admin' },
  all: { displayName: 'Demo Workspace', email: 'demo@eaze.test', role: 'partner_admin' },
  tradepay: { displayName: 'TradePay Demo', email: 'tradepay@eaze.test', role: 'partner_admin' },
  medpay: { displayName: 'MedPay Demo', email: 'medpay@eaze.test', role: 'partner_admin' },
  coachpay: { displayName: 'CoachPay Demo', email: 'coachpay@eaze.test', role: 'partner_admin' },
};

export async function GET(req: NextRequest) {
  const accessToken = req.cookies.get('eazepay_at')?.value;
  const signedDemo = req.cookies.get('eazepay_demo')?.value;
  const verifiedDemo = await readSignedDemoPreset(signedDemo);
  const demoPreset = verifiedDemo?.preset;

  if (accessToken) {
    try {
      const res = await fetch(`${API_URL}/v1/me`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const me = await res.json();
        return NextResponse.json({ mode: 'live', actor: me });
      }
      // Token rejected — fall through to 401.
    } catch {
      // Backend unreachable — degrade to 503.
      return NextResponse.json(
        {
          type: 'about:blank',
          title: 'Backend unreachable',
          status: 503,
          code: 'backend_unreachable',
        },
        { status: 503 },
      );
    }
  }

  if (demoPreset && DEMO_ACTORS[demoPreset]) {
    return NextResponse.json({
      mode: 'demo',
      preset: demoPreset,
      actor: {
        ...DEMO_ACTORS[demoPreset],
        id: `demo_${demoPreset}`,
        isAdmin: demoPreset === 'master',
      },
    });
  }

  return NextResponse.json(
    {
      type: 'about:blank',
      title: 'Unauthorized',
      status: 401,
      code: 'not_signed_in',
    },
    { status: 401 },
  );
}
