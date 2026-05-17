import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { resolveBrandAccess } from '../../../lib/brand-access';

/**
 * SEC-101 — server-side brand ownership fence for `/v/<brand>/*`.
 *
 * Why this layout exists at all:
 *   The wall-up PR (#34) hides cross-brand links from the sidebar nav,
 *   but a user who types `/v/tradepay/applications` into the URL bar
 *   bypasses the nav entirely. Every page under `/v/[brand]` is a
 *   client component reading `useParams().brand` — there was no server-
 *   side gate. This layout IS that gate.
 *
 * How it works:
 *   - Reads cookies via `next/headers` (server-only; client JS cannot
 *     forge what we see here).
 *   - Delegates the policy decision to `resolveBrandAccess` (testable
 *     pure fn in lib/brand-access.ts).
 *   - On deny → `notFound()`. We use 404 not 403 so the URL doesn't
 *     confirm the route exists for a probing attacker.
 *
 * What this DOES NOT do:
 *   - It does not gate backend API calls. The BFF endpoints under
 *     `/api/v/[brand]/...` MUST independently verify ownership (see
 *     SEC-102 fix for /api/v/[brand]/consumer-invites). This layout
 *     stops a malicious render of someone else's data inside the
 *     React tree, but a direct `fetch('/api/v/tradepay/...')` from
 *     a console would still need API-side enforcement.
 */
export default async function BrandLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ brand: string }> | { brand: string };
}) {
  // Next 14 may deliver `params` as a sync object or a thenable depending
  // on rendering mode. Awaiting an already-resolved value is a no-op.
  const resolved = await Promise.resolve(params);
  const jar = cookies();
  const access = resolveBrandAccess(resolved.brand, {
    eazepay_at: jar.get('eazepay_at')?.value,
    eazepay_demo: jar.get('eazepay_demo')?.value,
  });

  if (!access.allowed) {
    // Structured deny breadcrumb so an ops team can spot unexpected
    // mismatch traffic (esp. demo_brand_mismatch — that's a probing
    // signal). Reason codes match the discriminated union in
    // lib/brand-access.ts.
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
