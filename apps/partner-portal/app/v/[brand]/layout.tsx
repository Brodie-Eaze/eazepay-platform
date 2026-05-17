import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { resolveBrandAccess } from '../../../lib/brand-access';
import { readSignedDemoPreset } from '../../../lib/demo-cookie';

/**
 * SEC-101 — server-side brand ownership fence for `/v/<brand>/*`.
 *
 * Why this layout exists:
 *   The wall-up PR (#34) hides cross-brand links from the sidebar nav,
 *   but a user who types `/v/tradepay/applications` into the URL bar
 *   bypasses the nav entirely. Every page under `/v/[brand]` is a
 *   client component reading `useParams().brand` — there was no server-
 *   side gate. This layout IS that gate.
 *
 * Flow:
 *   1. Read cookies via `next/headers` (server-only; client JS cannot
 *      forge what we see here).
 *   2. Verify the `eazepay_demo` HMAC signature (SEC-103 / SEC-109).
 *      Forged cookies fail verification and resolve as no-session.
 *   3. Delegate policy decision to `resolveBrandAccess` (testable pure fn).
 *   4. On deny → `notFound()`. 404 not 403 so the URL doesn't confirm
 *      the route exists for a probing attacker.
 *
 * This layout does NOT gate backend API calls — the BFF endpoints
 * under `/api/v/[brand]/...` MUST independently verify ownership
 * (see SEC-102 for the consumer-invites pattern via lib/session.ts).
 */
export default async function BrandLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ brand: string }> | { brand: string };
}) {
  const resolved = await Promise.resolve(params);
  const jar = cookies();
  const realToken = jar.get('eazepay_at')?.value;
  const signedDemoCookie = jar.get('eazepay_demo')?.value;
  // SEC-103: verify the demo cookie's HMAC signature before trusting
  // its value. A forged or expired cookie resolves to null and the
  // resolver treats it as no session.
  const verified = await readSignedDemoPreset(signedDemoCookie);

  const access = resolveBrandAccess(resolved.brand, {
    hasRealSession: Boolean(realToken),
    verifiedDemoPreset: verified?.preset ?? null,
  });

  if (!access.allowed) {
    // eslint-disable-next-line no-console
    console.warn(
      JSON.stringify({
        level: 'warn',
        event: 'brand_access.denied',
        brand: resolved.brand,
        reason: access.reason,
      }),
    );
    notFound();
  }

  return <>{children}</>;
}
