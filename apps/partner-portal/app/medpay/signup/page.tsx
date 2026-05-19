/**
 * /medpay/signup — branded sign-up wizard for the MedPay funnel.
 *
 * Renders the shared <OnboardingWizard> with `brand="medpay"`, which:
 *   · pre-fills industry as `medical` and skips the Industry step
 *     (the funnel already determined the vertical)
 *   · swaps the chrome to MedPay teal (#0E7C66 / #22B8A0) and the
 *     Med/Pay wordmark in the header
 *   · changes the submit copy to "Submit MedPay application"
 *   · tints the surface background a faint teal so the form reads as
 *     a continuation of /landing/medpay + /medpay/checkout
 *
 * Backend: POSTs to /api/onboarding/submit with `industry: "medical"`,
 * the route maps that to `brand: "medpay"` and inserts the partner row
 * with status='pending'.
 *
 * This page is reached from the Module 01 "Continue setup" CTA on
 * /medpay/onboarding. /welcome is the unbranded manual-onboarding
 * fallback.
 */
import OnboardingWizard from '../../welcome/wizard';

export const metadata = {
  title: 'MedPay · Sign up',
  description: 'Activate your branded MedPay partner portal.',
};

export default function MedPaySignupPage(): JSX.Element {
  return <OnboardingWizard brand="medpay" />;
}
