/**
 * TradePay · Onboarding (/tradepay/onboarding)
 *
 * Streamlined 4-step Aurean-style apply flow. Wraps the shared
 * `BrandOnboardingPage` used by every vertical brand portal so the
 * checkout funnel hands off into the same wizard the partner portal
 * already uses at /onboarding/trade-pay. One source of truth for the
 * KYB UX, configured here with TradePay-specific copy + the 6 docs
 * a trade contractor needs to upload (license, bond + insurance,
 * trade cert, bank statements, W-9, voided check).
 *
 *   Step 1 · Business Info     — legal entity facts
 *   Step 2 · Owner Details     — principal / control person
 *   Step 3 · Documents         — 6-doc trades stack
 *   Step 4 · Review & Submit   — read-only summary + Submit Application
 *
 * Submits to /api/integrations/brand/apply?brand=trade-pay; on
 * success lands at /onboarding/submitted?brand=trade-pay.
 */
'use client';

import { BankIcon } from '@eazepay/ui/web';
import { BrandOnboardingPage } from '../../../components/brand-onboarding/BrandOnboardingWizard';

export default function TradePayCheckoutOnboarding() {
  return (
    <BrandOnboardingPage
      config={{
        slug: 'trade-pay',
        title: 'TradePay — Apply',
        subtitle: 'Business onboarding for trade & contractor financing',
        icon: <BankIcon size={18} />,
        backHref: '/tradepay/checkout',
        submitEndpoint: '/api/integrations/brand/apply?brand=trade-pay',
        documents: [
          {
            id: 'contractor-license',
            title: 'Contractor License',
            description: 'State-issued contractor or trade license (where required)',
          },
          {
            id: 'bond-insurance',
            title: 'Bond & Insurance Certificate',
            description: 'Surety bond + general liability + workers comp COI',
          },
          {
            id: 'trade-cert',
            title: 'Trade Certification',
            description: 'HVAC, plumbing, electrical, solar, or relevant trade cert',
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
          {
            id: 'voided-check',
            title: 'Voided Check',
            description: 'For ACH disbursement setup — merchant-direct funding',
          },
        ],
      }}
    />
  );
}
