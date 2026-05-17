import { CardIcon, ShieldIcon, PhoneIcon, PackageIcon, BoltIcon, ChartIcon } from '@eazepay/ui/web';
import { IntegrationPage } from '../../components/IntegrationPage';

/**
 * EAZE Processing — MiCamp-powered acquiring.
 *
 * Rebrand notes (2026-05):
 *   - MyCamp → MiCamp (typography fix)
 *   - Dropped BNPL line entirely. Klarna / Splitit / Payva are not
 *     part of the offering anymore. EAZE Processing is acquiring only.
 *   - Added "Dual Payment" — customer covers processing fees at
 *     checkout (surcharging where allowed; cash-discount otherwise).
 *   - Rate card starts at 2.3% (risk-tiered).
 */
export default function EazeProcessingPage() {
  return (
    <IntegrationPage
      name="EAZE Processing"
      icon={<CardIcon size={22} />}
      heading="MiCamp — Payment Processing"
      body="Powered by MiCamp, EAZE Processing provides full merchant payment processing — cards, ACH, and digital wallets. No BNPL component; this is an acquiring rail. Rates start at 2.3% and tier up based on risk profile. Optional Dual Payment passes processing fees to the customer at checkout."
      stats={[
        { label: 'Rates from', value: '2.3%' },
        { label: 'Approval', value: 'Instant' },
        { label: 'Settlement', value: 'Next-day' },
      ]}
      features={[
        {
          icon: <ShieldIcon size={18} />,
          title: 'PCI Compliant',
          description: 'End-to-end encrypted payment capture',
        },
        {
          icon: <PhoneIcon size={18} />,
          title: 'In-Call Payments',
          description: 'Take payments without leaving the call',
        },
        {
          icon: <CardIcon size={18} />,
          title: 'Multi-Method',
          description: 'Accept cards, ACH, and digital wallets',
        },
        {
          icon: <PackageIcon size={18} />,
          title: 'Dual Payment',
          description:
            'Customer covers processing fees at checkout — surcharging (where allowed) or cash-discount programs',
        },
        {
          icon: <BoltIcon size={18} />,
          title: 'Risk-Tiered Rates',
          description:
            'Rates start at 2.3% and scale with risk profile, MCC, average ticket, and chargeback history',
        },
        {
          icon: <ChartIcon size={18} />,
          title: 'Split Payments',
          description:
            'Automatic recurring payments — 4-pay, 6-pay, or custom installment schedules',
        },
      ]}
      requirements={[
        'Active merchant account',
        'Minimum $5K monthly transaction volume',
        'US-based business',
        'Compatible POS or e-commerce platform',
      ]}
      cta={{ label: 'Connect EAZE Processing', href: '/onboarding/eaze-processing' }}
    />
  );
}
