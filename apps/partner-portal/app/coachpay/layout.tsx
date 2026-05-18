import type { ReactNode } from 'react';

/**
 * Shared layout for the CoachPay flow pages: /coachpay/checkout
 * (Agreement), /coachpay/onboarding (KYB wizard).
 *
 * Visual posture: Aurean's section structure + dense data-forward
 * layout, in CoachPay's dark theme + purple palette (kept consistent
 * with the /landing/coachpay long page so a prospect bouncing between
 * routes doesn't see two different brands).
 *
 * Each child page renders its own <style dangerouslySetInnerHTML> with
 * page-specific rules — the design tokens live there too, in a single
 * .mpf-root namespace. No CSS module / no external file because the
 * existing pattern in the partner-portal is inline-CSS-per-page.
 */
export default function CoachPayFlowLayout({ children }: { children: ReactNode }): JSX.Element {
  return <>{children}</>;
}

export const metadata = {
  title: 'CoachPay · Same-Call Financing for High-Ticket Coaches',
  description:
    'Soft-pull pre-qualification on the discovery call. Marketplace + card-stacking across 800+ lenders. Merchant-direct funding in 48 to 72 hours. Built for executive coaching, masterminds, and high-ticket programs.',
};
