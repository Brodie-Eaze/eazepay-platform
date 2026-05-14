'use client';
import { PhoneIcon } from '@eazepay/ui/web';
import { BrandOnboardingWizard } from '../../../components/brand-onboarding/BrandOnboardingWizard';

/**
 * DialerPay — Apply. Lovable's `/onboarding/dialerpay` falls back to
 * the generic EAZE Pay shell; we ship our own DialerPay-specific
 * document list:
 *
 *   • Call-centre registration / 10DLC brand attestation
 *   • PCI attestation (SAQ)
 *   • Agent roster + payment-handling policy
 *   • Bank statements + W-9 + voided check (same shape as TradePay)
 */
export default function DialerPayOnboardingPage() {
  return (
    <BrandOnboardingWizard
      config={{
        slug: 'dialerpay',
        title: 'DialerPay — Connect',
        subtitle: 'Business onboarding for in-call payment capture',
        icon: <PhoneIcon size={18} />,
        backHref: '/dialerpay',
        submitEndpoint: '/api/integrations/brand/apply?brand=dialerpay',
        documents: [
          {
            id: '10dlc',
            title: '10DLC Brand Attestation',
            description: 'Carrier-registered business identity for SMS receipts',
          },
          {
            id: 'pci-saq',
            title: 'PCI Self-Assessment Questionnaire',
            description: 'Most recent signed SAQ (Type A or D as applicable)',
          },
          {
            id: 'agent-roster',
            title: 'Agent Roster + Permissions',
            description: 'List of agents authorised to collect payments + permission tiers',
          },
          {
            id: 'payment-policy',
            title: 'Payment Handling Policy',
            description: 'How your team takes, captures, and refunds payments today',
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
