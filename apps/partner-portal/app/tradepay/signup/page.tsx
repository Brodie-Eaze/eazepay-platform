/**
 * /tradepay/signup — branded sign-up wizard for the TradePay funnel.
 *
 * Renders the shared <OnboardingWizard> with `brand="tradepay"`, which:
 *   · pre-fills industry as `trades` and skips the Industry step
 *   · swaps the chrome to TradePay orange (#D4581A / #F47B3F) and the
 *     Trade/Pay wordmark in the header
 *   · changes the submit copy to "Submit TradePay application"
 *   · tints the surface background a faint orange so the form reads
 *     as a continuation of /landing/tradepay + /tradepay/checkout
 *
 * Backend: POSTs to /api/onboarding/submit with `industry: "trades"`,
 * the route maps that to `brand: "tradepay"` and inserts the partner row.
 *
 * Reached from the Module 01 "Continue setup" CTA on /tradepay/onboarding.
 */
import OnboardingWizard from '../../welcome/wizard';

export const metadata = {
  title: 'TradePay · Sign up',
  description: 'Activate your branded TradePay partner portal.',
};

export default function TradePaySignupPage(): JSX.Element {
  return <OnboardingWizard brand="tradepay" />;
}
