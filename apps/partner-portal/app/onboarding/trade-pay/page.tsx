'use client';
import { BankIcon } from '@eazepay/ui/web';
import { BrandOnboardingPage } from '../../../components/brand-onboarding/BrandOnboardingWizard';

/**
 * TradePay — Apply. Direct port of the Lovable `/onboarding/trade-pay`
 * flow. 6 documents (contractor license, bond + insurance, trade
 * cert, bank statements, W-9, voided check).
 *
 * Wrapped in `BrandOnboardingPage` so a `?invite=<token>` query param
 * is resolved against `/api/onboarding/invite/[token]` and used to
 * pre-fill / lock the brand wizard.
 */
export default function TradePayOnboardingPage() {
  return (
    <BrandOnboardingPage
      config={{
        slug: 'trade-pay',
        title: 'TradePay — Apply',
        subtitle: 'Business onboarding for trade & contractor financing',
        icon: <BankIcon size={18} />,
        backHref: '/trade-pay',
        submitEndpoint: '/api/integrations/brand/apply?brand=trade-pay',
        documents: [
          {
            id: 'contractor-license',
            title: 'Contractor License',
            description: 'State-issued contractor or trade license',
          },
          {
            id: 'bond-insurance',
            title: 'Bond & Insurance Certificate',
            description: 'Surety bond and general liability insurance',
          },
          {
            id: 'trade-cert',
            title: 'Trade Certification',
            description: 'HVAC, plumbing, electrical, or relevant trade cert',
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
          {
            id: 'voided-check',
            title: 'Voided Check',
            description: 'For ACH deposit setup',
          },
        ],
      }}
    />
  );
}
