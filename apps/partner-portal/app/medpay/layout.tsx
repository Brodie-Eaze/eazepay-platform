import type { ReactNode } from 'react';

/**
 * Shared layout for the MedPay flow pages: /medpay (Website),
 * /medpay/start (Landing), /medpay/checkout (Agreement),
 * /medpay/success (Confirmation), /medpay/onboarding (KYB wizard).
 *
 * Visual posture: Aurean's section structure + dense data-forward
 * layout, but in MedPay's teal palette (kept consistent with the
 * /landing/medpay long page so a prospect bouncing between routes
 * doesn't see two different brands).
 *
 * Each child page renders its own <style dangerouslySetInnerHTML> with
 * page-specific rules — the design tokens live there too, in a single
 * .mpf-root namespace. No CSS module / no external file because the
 * existing pattern in the partner-portal is inline-CSS-per-page.
 */
export default function MedPayFlowLayout({ children }: { children: ReactNode }): JSX.Element {
  return <>{children}</>;
}

export const metadata = {
  title: 'MedPay · Outcomes When It Matters Most',
  description:
    'A lender you can depend on. A platform you can depend on. Soft-pull pre-qualification, multi-lender marketplace, merchant-direct funding in 48 to 72 hours.',
};
