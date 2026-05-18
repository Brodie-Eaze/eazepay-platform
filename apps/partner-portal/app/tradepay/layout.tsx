import type { ReactNode } from 'react';

/**
 * Shared layout for the TradePay flow pages: /tradepay/checkout
 * (Agreement), /tradepay/onboarding (KYB wizard).
 *
 * Visual posture: Aurean's section structure + dense data-forward
 * layout, in TradePay's orange palette (kept consistent with the
 * /landing/tradepay long page so a prospect bouncing between routes
 * doesn't see two different brands).
 *
 * Each child page renders its own <style dangerouslySetInnerHTML> with
 * page-specific rules — the design tokens live there too, in a single
 * .mpf-root namespace. No CSS module / no external file because the
 * existing pattern in the partner-portal is inline-CSS-per-page.
 */
export default function TradePayFlowLayout({ children }: { children: ReactNode }): JSX.Element {
  return <>{children}</>;
}

export const metadata = {
  title: 'TradePay · Doorstep Financing for Trade Businesses',
  description:
    'Soft-pull at the doorstep. Six trades lenders in parallel. Merchant-direct funding in 48 to 72 hours. Built for roofing, HVAC, solar, remodel, and exterior contractors.',
};
