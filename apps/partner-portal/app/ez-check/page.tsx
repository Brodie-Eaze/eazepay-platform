import {
  ShieldIcon,
  SearchIcon,
  ChartIcon,
  GaugeIcon,
  RouteIcon,
} from '@eazepay/ui/web';
import { IntegrationPage } from '../../components/IntegrationPage';

/**
 * EZ Check — pre-qualification engine. Direct port of the live
 * Lovable `/ez-check` page; user-facing name stays "EZ Check" while
 * the BFF wires through to HighSale on the backend.
 */
export default function EzCheckPage() {
  return (
    <IntegrationPage
      name="EZ Check"
      icon={<ShieldIcon size={22} />}
      heading="Pre-Qualify Applicants Instantly"
      body="EZ Check is a pre-qualification engine that evaluates applicants before they're submitted to lenders. Using soft credit pulls, income analysis, and proprietary fundability scoring, EZ Check determines each applicant's financing tier and automatically routes them to the correct product — saving time, protecting credit scores, and dramatically improving approval rates. Install the EZ Check widget directly into your CRM, landing page, or sales funnel to start qualifying leads in real-time."
      stats={[
        { label: 'Qualification Time', value: '<10 sec' },
        { label: 'Approval Lift', value: '+42%' },
        { label: 'Integration', value: '1-Click' },
      ]}
      features={[
        {
          icon: <SearchIcon size={18} />,
          title: 'Soft Credit Qualification',
          description:
            "Pre-qualify applicants with a soft credit pull that won't impact their score — get instant insights into creditworthiness before submitting to lenders.",
        },
        {
          icon: <ChartIcon size={18} />,
          title: 'Income Capacity Analysis',
          description:
            'Analyze applicant income data to determine affordability and repayment capacity, ensuring better match rates with lender requirements.',
        },
        {
          icon: <GaugeIcon size={18} />,
          title: 'Fundability Tier Scoring',
          description:
            'Proprietary scoring system that categorizes applicants into fundability tiers, helping you understand approval likelihood before submission.',
        },
        {
          icon: <RouteIcon size={18} />,
          title: 'Lender Routing Logic',
          description:
            'Intelligent routing automatically directs applicants to the best-fit lender based on their profile, maximizing approval rates and minimizing declines.',
        },
      ]}
      howItWorks={[
        'Applicant fills out a short pre-qualification form on your website or funnel',
        'EZ Check runs a soft credit pull and income capacity analysis in seconds',
        'Applicant receives a fundability tier score with estimated approval likelihood',
        'Qualified applicants are automatically routed to the best-matched lender',
        'You receive real-time notifications on qualification results and next steps',
      ]}
      cta={{ label: 'Connect EZ Check', href: '/onboarding/ez-check' }}
    />
  );
}
