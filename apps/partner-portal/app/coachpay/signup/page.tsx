/**
 * /coachpay/signup — branded sign-up wizard for the CoachPay funnel.
 *
 * Renders the shared <OnboardingWizard> with `brand="coachpay"`, which:
 *   · pre-fills industry as `coaching` and skips the Industry step
 *   · swaps the chrome to CoachPay purple (#7C3AED / #A78BFA) and the
 *     Coach/Pay wordmark in the header
 *   · changes the submit copy to "Submit CoachPay application"
 *   · tints the surface background a faint purple so the form reads
 *     as a continuation of /landing/coachpay + /coachpay/checkout
 *
 * Backend: POSTs to /api/onboarding/submit with `industry: "coaching"`,
 * the route maps that to `brand: "coachpay"` and inserts the partner row.
 *
 * Reached from the Module 01 "Continue setup" CTA on /coachpay/onboarding.
 */
import OnboardingWizard from '../../welcome/wizard';

export const metadata = {
  title: 'CoachPay · Sign up',
  description: 'Activate your branded CoachPay partner portal.',
};

export default function CoachPaySignupPage(): JSX.Element {
  return <OnboardingWizard brand="coachpay" />;
}
