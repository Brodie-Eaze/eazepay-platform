'use client';
import { HeartPulseIcon } from '@eazepay/ui/web';
import { BrandOnboardingWizard } from '../../../components/brand-onboarding/BrandOnboardingWizard';

/**
 * MedPay — Apply. Direct port of the Lovable `/onboarding/med-pay`
 * flow. 6 documents (provider license, DEA, malpractice, NPI, bank
 * statements, W-9). Note: we don't ingest PHI here — only the
 * provider's licensing + financial documents.
 */
export default function MedPayOnboardingPage() {
  return (
    <BrandOnboardingWizard
      config={{
        slug: 'med-pay',
        title: 'MedPay — Apply',
        subtitle: 'Business onboarding for medical & dental patient financing',
        icon: <HeartPulseIcon size={18} />,
        backHref: '/med-pay',
        submitEndpoint: '/api/integrations/brand/apply?brand=med-pay',
        documents: [
          {
            id: 'provider-license',
            title: 'Provider License',
            description: 'Medical, dental, or veterinary license',
          },
          {
            id: 'dea-registration',
            title: 'DEA Registration (if applicable)',
            description: 'Drug Enforcement Administration registration',
          },
          {
            id: 'malpractice',
            title: 'Malpractice Insurance',
            description: 'Current malpractice or professional liability policy',
          },
          {
            id: 'npi',
            title: 'NPI Number Verification',
            description: 'National Provider Identifier documentation',
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
