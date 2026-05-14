'use client';
import { CrownIcon } from '@eazepay/ui/web';
import { BrandOnboardingWizard } from '../../../components/brand-onboarding/BrandOnboardingWizard';

/**
 * CoachPay — Apply. Direct port of the Lovable `/onboarding/coach-pay`
 * flow. 5 documents (coaching cert, business license, insurance,
 * bank statements, W-9). Submits to the EAZE orchestration backend
 * via the brand-onboarding BFF proxy.
 */
export default function CoachPayOnboardingPage() {
  return (
    <BrandOnboardingWizard
      config={{
        slug: 'coach-pay',
        title: 'CoachPay — Apply',
        subtitle: 'Business onboarding for coaching & consulting financing',
        icon: <CrownIcon size={18} />,
        backHref: '/coach-pay',
        submitEndpoint: '/api/integrations/brand/apply?brand=coach-pay',
        documents: [
          {
            id: 'business-license',
            title: 'Business License / Registration',
            description: 'State or local business registration',
          },
          {
            id: 'coaching-cert',
            title: 'Coaching Certification',
            description: 'ICF, CCE, or equivalent coaching certification',
          },
          {
            id: 'insurance',
            title: 'Proof of Insurance',
            description: 'General liability or professional liability policy',
          },
          {
            id: 'bank-statements',
            title: 'Bank Statements (3 months)',
            description: 'Most recent 3 months of business bank statements',
          },
          {
            id: 'w9',
            title: 'W-9 Form',
            description: 'Completed and signed W-9',
          },
        ],
      }}
    />
  );
}
