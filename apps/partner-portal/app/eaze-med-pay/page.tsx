import {
  HeartPulseIcon,
  ShieldIcon,
  ClockIcon,
} from '@eazepay/ui/web';
import { IntegrationPage } from '../../components/IntegrationPage';

/**
 * EAZE Med Pay — direct port of Lovable's `/eaze-med-pay` page.
 * Patient financing for medical, dental, and veterinary practices.
 */
export default function EazeMedPayPage() {
  return (
    <IntegrationPage
      name="EAZE Med Pay"
      icon={<HeartPulseIcon size={22} />}
      heading="EAZE Med Pay Financing"
      body="Patient financing for medical, dental, and veterinary practices. Offer your clients flexible payment plans with same-day approvals and competitive rates."
      stats={[
        { label: 'Loan Range', value: '$1K – $100K' },
        { label: 'Profile', value: '550+ FICO' },
        { label: 'Terms', value: '6 – 84 mo' },
      ]}
      features={[
        {
          icon: <HeartPulseIcon size={18} />,
          title: 'Medical & Dental',
          description: 'Elective surgery, dental implants, orthodontics, cosmetic procedures',
        },
        {
          icon: <ShieldIcon size={18} />,
          title: 'Patient-Friendly',
          description: 'No prepayment penalties, transparent terms, compliant disclosures',
        },
        {
          icon: <ClockIcon size={18} />,
          title: 'Same-Day Decisions',
          description: 'Real-time approvals so patients can schedule immediately',
        },
      ]}
      requirements={[
        'Active medical/dental/veterinary practice',
        'Valid provider license or certification',
        'Minimum 6 months in practice',
        'US-based patients only',
      ]}
      cta={{ label: 'Apply with EAZE Med Pay', href: '/onboarding/eaze-med-pay' }}
    />
  );
}
