import { BankIcon, HomeIcon, ChartIcon, ShieldIcon } from '@eazepay/ui/web';
import { IntegrationPage } from '../../components/IntegrationPage';

/**
 * TradePay — renamed from "EAZE Trade Pay" per the latest brand
 * decision. Customer financing for contractors and trade
 * professionals. Mirrors the Lovable `/trade-pay` page.
 */
export default function TradePayIntegrationPage() {
  return (
    <IntegrationPage
      name="TradePay"
      icon={<BankIcon size={22} />}
      heading="TradePay Financing"
      body="Customer financing for contractors and trade professionals. Enable your clients to finance home improvement and trade projects with flexible terms."
      stats={[
        { label: 'Loan Range', value: '$2K – $100K' },
        { label: 'Profile', value: '550+ FICO' },
        { label: 'Terms', value: '12 – 84 mo' },
      ]}
      features={[
        {
          icon: <HomeIcon size={18} />,
          title: 'Home Improvement',
          description: 'HVAC, roofing, plumbing, electrical, remodeling, and general contracting',
        },
        {
          icon: <ChartIcon size={18} />,
          title: 'Project Financing',
          description: 'Help homeowners finance large projects with affordable monthly payments',
        },
        {
          icon: <ShieldIcon size={18} />,
          title: 'Contractor Verified',
          description: 'Licensed and bonded contractors get priority access and better terms',
        },
      ]}
      requirements={[
        'Valid state contractor license',
        'Surety bond and general liability insurance',
        'Minimum 1 year in business',
        'US-based licensed contractor or trade business',
      ]}
      cta={{ label: 'Apply with TradePay', href: '/onboarding/trade-pay' }}
    />
  );
}
