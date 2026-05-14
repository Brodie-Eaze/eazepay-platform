import {
  PhoneIcon,
  ShieldIcon,
  BoltIcon,
  CardIcon,
  ChartIcon,
  UsersIcon,
} from '@eazepay/ui/web';
import { IntegrationPage } from '../../components/IntegrationPage';

/**
 * DialerPay — in-call PCI-compliant payment capture. Direct port of
 * Lovable's `/dialerpay` page. Six features in a 3x2 grid, "HOW IT
 * WORKS" 5-step list, AVG CLOSE RATE / PROCESSING TIME / PAYMENT
 * METHODS stats.
 */
export default function DialerPayPage() {
  return (
    <IntegrationPage
      name="DialerPay"
      icon={<PhoneIcon size={22} />}
      heading="Connect DialerPay"
      body="DialerPay is a secure, PCI-compliant payment capture system built for phone-based sales teams. It allows your agents to collect payments in real-time during live calls — no need to redirect customers to external links or follow up with invoices. Whether you're closing deals over the phone, collecting deposits, or processing recurring payments, DialerPay integrates directly into your call workflow to maximize conversions and reduce friction."
      stats={[
        { label: 'Avg Close Rate', value: '+34%' },
        { label: 'Processing Time', value: '<3 sec' },
        { label: 'Payment Methods', value: '5+' },
      ]}
      features={[
        {
          icon: <ShieldIcon size={18} />,
          title: 'PCI Compliant',
          description:
            'End-to-end encrypted payment capture ensures sensitive cardholder data is never exposed during calls',
        },
        {
          icon: <PhoneIcon size={18} />,
          title: 'In-Call Payments',
          description:
            'Seamlessly collect payments without transferring callers or interrupting the conversation flow',
        },
        {
          icon: <CardIcon size={18} />,
          title: 'Multi-Method',
          description:
            'Accept credit cards, debit cards, ACH bank transfers, and digital wallets all in one system',
        },
        {
          icon: <BoltIcon size={18} />,
          title: 'Instant Processing',
          description:
            'Payments are authorized and processed in real-time during the call, reducing drop-off and improving close rates.',
        },
        {
          icon: <UsersIcon size={18} />,
          title: 'Team Management',
          description:
            'Assign agents, track individual performance, and manage permissions across your entire sales team from one dashboard.',
        },
        {
          icon: <ChartIcon size={18} />,
          title: 'Reporting & Analytics',
          description:
            'Full visibility into transaction volumes, success rates, agent performance, and revenue metrics with exportable reports.',
        },
      ]}
      howItWorks={[
        'Agent initiates a payment request during a live call',
        'Customer provides payment details over a secure, encrypted channel',
        'Payment is processed instantly with real-time confirmation',
        'Receipt is automatically sent to the customer via email or SMS',
        'Transaction is logged and visible in your DialerPay dashboard',
      ]}
      cta={{ label: 'Connect DialerPay', href: '/onboarding/dialerpay' }}
    />
  );
}
