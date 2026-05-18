/**
 * CoachPay · Onboarding (/coachpay/onboarding)
 *
 * Streamlined 4-step Aurean-style apply flow. Wraps the shared
 * `BrandOnboardingPage` used by every vertical brand portal so the
 * checkout funnel hands off into the same wizard the partner portal
 * already uses at /onboarding/coach-pay. One source of truth for the
 * KYB UX, configured here with CoachPay-specific copy + the 5 docs a
 * high-ticket coaching business needs to upload (business reg,
 * coaching cert, E&O insurance, bank statements, W-9).
 *
 *   Step 1 · Business Info     — legal entity facts
 *   Step 2 · Owner Details     — principal / control person
 *   Step 3 · Documents         — 5-doc coaching stack
 *   Step 4 · Review & Submit   — read-only summary + Submit Application
 *
 * Submits to /api/integrations/brand/apply?brand=coach-pay; on
 * success lands at /onboarding/submitted?brand=coach-pay.
 */
'use client';

import { CrownIcon } from '@eazepay/ui/web';
import { BrandOnboardingPage } from '../../../components/brand-onboarding/BrandOnboardingWizard';

export default function CoachPayCheckoutOnboarding() {
  return (
    <BrandOnboardingPage
      config={{
        slug: 'coach-pay',
        title: 'CoachPay — Apply',
        subtitle: 'Business onboarding for high-ticket coaching financing',
        icon: <CrownIcon size={18} />,
        backHref: '/coachpay/checkout',
        submitEndpoint: '/api/integrations/brand/apply?brand=coach-pay',
        documents: [
          {
            id: 'business-license',
            title: 'Business License / Registration',
            description: 'State or local business registration · articles of incorporation · DBA',
          },
          {
            id: 'coaching-cert',
            title: 'Coaching Certification (where applicable)',
            description: 'ICF, CCE, or equivalent coaching / consulting credential',
          },
          {
            id: 'insurance',
            title: 'Errors & Omissions (E&O) Insurance',
            description:
              'Professional liability policy · $1M+ recommended for high-ticket programs',
          },
          {
            id: 'bank-statements',
            title: 'Bank Statements (3 months)',
            description: 'Most recent 3 months of business bank statements',
          },
          {
            id: 'w9',
            title: 'W-9 Form',
            description: 'Completed and signed W-9 matching the business EIN',
          },
        ],
      }}
    />
  );
}
