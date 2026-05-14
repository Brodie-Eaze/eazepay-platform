import {
  CardIcon,
  ShieldIcon,
  PhoneIcon,
  PackageIcon,
  BoltIcon,
  ChartIcon,
} from '@eazepay/ui/web';
import { IntegrationPage } from '../../components/IntegrationPage';

/**
 * EAZE Processing — direct port of Lovable's `/eaze-processing` page,
 * with Lumino → MyCamp swap per the latest brand decision.
 *
 * Three stat columns, three pillar features (PCI / In-Call / Multi),
 * three BNPL provider cards (Klarna / Splitit / Payva), three deeper
 * features (Payment Processing / Built-in BNPL / Split Payments),
 * REQUIREMENTS checklist, and a Connect button.
 *
 * Note: Lovable's reference page mentions "Lumino" as the underlying
 * processor. We're routing on MyCamp instead — the copy is updated
 * accordingly here. The BNPL partner roster (Klarna / Splitit /
 * Payva) is kept verbatim.
 */
export default function EazeProcessingPage() {
  return (
    <IntegrationPage
      name="EAZE Processing"
      icon={<CardIcon size={22} />}
      heading="MyCamp — Payment Processing & BNPL"
      body="Powered by MyCamp, EAZE Processing provides full merchant payment processing with built-in access to consumer BNPL solutions. Accept payments, manage transactions, and offer flexible pay-later options — all through a single integration."
      stats={[
        { label: 'Order Range', value: '$2K – $15K' },
        { label: 'Approval', value: 'Instant' },
        { label: 'Installments', value: '4 – 24 pay' },
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
          title: 'Payment Processing',
          description: 'Full merchant processing — accept cards, ACH, and digital wallets through MyCamp',
        },
        {
          icon: <BoltIcon size={18} />,
          title: 'Built-in BNPL',
          description: 'Offer customers flexible pay-later options via Klarna, Splitit, and Payva',
        },
        {
          icon: <ChartIcon size={18} />,
          title: 'Split Payments',
          description: 'Automatic recurring payments — 4-pay, 6-pay, or custom installment schedules',
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
