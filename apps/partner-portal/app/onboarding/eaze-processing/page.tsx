'use client';
import { CardIcon } from '@eazepay/ui/web';
import { BrandOnboardingWizard } from '../../../components/brand-onboarding/BrandOnboardingWizard';

/**
 * Processing — Connect. Card-processing onboarding. Surface stays
 * brand-neutral "Processing"; the BFF proxy maps brand=processing to
 * MiCamp on the backend (MID provisioning + boarding files).
 */
export default function ProcessingOnboardingPage() {
  return (
    <BrandOnboardingWizard
      config={{
        slug: 'processing',
        title: 'Processing — Connect',
        subtitle: 'MID provisioning, card boarding, and ACH setup',
        icon: <CardIcon size={18} />,
        backHref: '/processing',
        submitEndpoint: '/api/integrations/brand/apply?brand=processing',
        documents: [
          {
            id: 'merchant-app',
            title: 'Merchant Processing Application',
            description: 'MiCamp boarding application (we send this for e-sign)',
          },
          {
            id: 'voided-check',
            title: 'Voided Check',
            description: 'For settlement bank verification',
          },
          {
            id: 'bank-statements',
            title: 'Bank Statements (3 months)',
            description: 'Most recent 3 months of business bank statements',
          },
          {
            id: 'processing-statements',
            title: 'Prior Processing Statements (3 months, if any)',
            description: 'Card-processing statements from your current provider',
          },
          {
            id: 'business-license',
            title: 'Business License / Registration',
            description: 'State or local business registration',
          },
          {
            id: 'w9',
            title: 'W-9 Form',
            description: 'Completed and signed W-9',
          },
          {
            id: 'photo-id',
            title: 'Owner Photo ID',
            description: "Driver's licence or passport for the principal",
          },
        ],
      }}
    />
  );
}
