import {
  CrownIcon,
  UsersIcon,
  ChartIcon,
  ShieldIcon,
} from '@eazepay/ui/web';
import { IntegrationPage } from '../../components/IntegrationPage';

/**
 * CoachPay — renamed from "EAZE Pay" per the latest brand decision.
 * Client financing for coaching + consulting. Mirrors the Lovable
 * `/coach-pay` page but uses the new brand name everywhere on the
 * surface; the underlying brand code stays `coachpay` in the data
 * model.
 */
export default function CoachPayIntegrationPage() {
  return (
    <IntegrationPage
      name="CoachPay"
      icon={<CrownIcon size={22} />}
      heading="CoachPay Financing"
      body="Client financing for coaching and consulting businesses. Offer your clients flexible payment plans so they can invest in their personal and professional growth."
      stats={[
        { label: 'Loan Range', value: '$1K – $50K' },
        { label: 'Profile', value: '580+ FICO' },
        { label: 'Terms', value: '6 – 60 mo' },
      ]}
      features={[
        {
          icon: <UsersIcon size={18} />,
          title: 'Coaching & Consulting',
          description:
            'Life coaching, business coaching, executive consulting, and professional development',
        },
        {
          icon: <ChartIcon size={18} />,
          title: 'Flexible Client Financing',
          description:
            'Help clients invest in their growth with affordable monthly payments',
        },
        {
          icon: <ShieldIcon size={18} />,
          title: 'Simple Qualification',
          description:
            'Streamlined underwriting with minimal documentation for coaches',
        },
      ]}
      requirements={[
        'Valid coaching certification (ICF, CCE, or equivalent)',
        'Minimum 6 months in business',
        'Active business registration',
        'US-based business entity',
      ]}
      cta={{ label: 'Apply with CoachPay', href: '/onboarding/coach-pay' }}
    />
  );
}
