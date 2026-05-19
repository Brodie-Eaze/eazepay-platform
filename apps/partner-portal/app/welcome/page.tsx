/**
 * /welcome — generic / manual partner onboarding sign-up wizard.
 *
 * This is the unbranded fallback path. Five steps including the
 * Industry selector. Used when:
 *   • An operator manually onboards a partner whose vertical isn't
 *     yet served by a branded funnel.
 *   • A direct visitor lands here without going through any branded
 *     marketing surface (rare but possible — middleware allowlists
 *     `/welcome` so the URL is reachable).
 *
 * The per-vertical funnels (/medpay/signup, /tradepay/signup,
 * /coachpay/signup) render the same wizard with a `brand` prop, which
 * pre-fills industry + skips Step 1 + swaps the chrome palette.
 *
 * All paths POST to the same `/api/onboarding/submit` route.
 */
import OnboardingWizard from './wizard';

export const metadata = {
  title: 'EazePay · Partner sign-up',
  description: 'Activate your EazePay partner portal.',
};

export default function WelcomePage(): JSX.Element {
  return <OnboardingWizard />;
}
