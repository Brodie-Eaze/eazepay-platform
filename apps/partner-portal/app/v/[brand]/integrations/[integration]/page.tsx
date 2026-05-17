import { notFound } from 'next/navigation';
import {
  ShieldIcon,
  SearchIcon,
  ChartIcon,
  GaugeIcon,
  RouteIcon,
  PhoneIcon,
  CardIcon,
  BoltIcon,
  UsersIcon,
  PackageIcon,
} from '@eazepay/ui/web';
import { BRANDS, BRAND_ORDER, type BrandCode } from '@eazepay/shared-types';
import {
  IntegrationPage,
  type IntegrationPageProps,
} from '../../../../../components/IntegrationPage';

/**
 * Per-brand integration intro page — renders the same Lovable-spec
 * layout as the master operator's `/eaze-processing`, `/dialerpay`,
 * and `/ez-check` pages (shared `IntegrationPage` component), with
 * the brand baked into the name + CTA so it stays scoped to the
 * partner's portal.
 *
 * URL: `/v/<brand>/integrations/<integration>`
 *
 * Brand-locked URLs only — no link inside this page resolves to the
 * master operator's `/eaze-processing`, `/dialerpay`, or `/ez-check`
 * routes. The "Connect" CTA lands at `/v/<brand>/onboarding/...` so
 * partners stay inside their portal end-to-end.
 */

type IntegrationSlug = 'ez-check' | 'processing' | 'dialerpay';

function buildSpec(slug: IntegrationSlug, brand: BrandCode): IntegrationPageProps {
  const brandName = BRANDS[brand].name;
  const brandSlug = BRANDS[brand].slug;

  switch (slug) {
    case 'ez-check':
      return {
        name: `EZ Check ${brandName}`,
        icon: <ShieldIcon size={22} />,
        heading: `Pre-Qualify ${brandName} Applicants Instantly`,
        body: `EZ Check is a pre-qualification engine that evaluates ${brandName} applicants before they're submitted to lenders. Using soft credit pulls, income analysis, and proprietary fundability scoring, EZ Check determines each applicant's financing tier and automatically routes them to the correct ${brandName} product — saving time, protecting credit scores, and dramatically improving approval rates. Install the EZ Check widget directly into your CRM, landing page, or sales funnel to start qualifying leads in real-time.`,
        stats: [
          { label: 'Qualification Time', value: '<10 sec' },
          { label: 'Approval Lift', value: '+42%' },
          { label: 'Integration', value: '1-Click' },
        ],
        features: [
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
            description: `Intelligent routing automatically directs applicants to the best-fit ${brandName} lender based on their profile, maximizing approval rates and minimizing declines.`,
          },
        ],
        howItWorks: [
          'Applicant fills out a short pre-qualification form on your website or funnel',
          'EZ Check runs a soft credit pull and income capacity analysis in seconds',
          'Applicant receives a fundability tier score with estimated approval likelihood',
          `Qualified applicants are automatically routed to the best-matched ${brandName} lender`,
          'You receive real-time notifications on qualification results and next steps',
        ],
        cta: {
          label: `Connect EZ Check ${brandName}`,
          href: `/v/${brandSlug}/onboarding/ez-check`,
        },
      };

    case 'processing':
      // Rebrand 2026-05: MyCamp → MiCamp, no BNPL, added Dual Payment,
      // rate-card starts at 2.3% (risk-tiered). Mirrors the master
      // /eaze-processing page.
      return {
        name: `${brandName} Processing`,
        icon: <CardIcon size={22} />,
        heading: 'MiCamp — Payment Processing',
        body: `Powered by MiCamp, ${brandName} Processing provides full merchant payment processing — cards, ACH, and digital wallets. No BNPL component; this is an acquiring rail scoped to your ${brandName} portal. Rates start at 2.3% and tier up based on risk profile. Optional Dual Payment passes processing fees to the customer at checkout.`,
        stats: [
          { label: 'Rates from', value: '2.3%' },
          { label: 'Approval', value: 'Instant' },
          { label: 'Settlement', value: 'Next-day' },
        ],
        features: [
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
        ],
        requirements: [
          'Active merchant account',
          'Minimum $5K monthly transaction volume',
          'US-based business',
          'Compatible POS or e-commerce platform',
        ],
        cta: {
          label: `Connect ${brandName} Processing`,
          href: `/v/${brandSlug}/onboarding/processing`,
        },
      };

    case 'dialerpay':
      return {
        name: 'DialerPay',
        icon: <PhoneIcon size={22} />,
        heading: 'Connect DialerPay',
        body: `DialerPay is a secure, PCI-compliant payment capture system built for ${brandName}'s phone-based sales teams. It allows your agents to collect payments in real-time during live calls — no need to redirect customers to external links or follow up with invoices. Whether you're closing deals over the phone, collecting deposits, or processing recurring payments, DialerPay integrates directly into your call workflow to maximize conversions and reduce friction.`,
        stats: [
          { label: 'Avg Close Rate', value: '+34%' },
          { label: 'Processing Time', value: '<3 sec' },
          { label: 'Payment Methods', value: '5+' },
        ],
        features: [
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
        ],
        howItWorks: [
          'Agent initiates a payment request during a live call',
          'Customer provides payment details over a secure, encrypted channel',
          'Payment is processed instantly with real-time confirmation',
          'Receipt is automatically sent to the customer via email or SMS',
          'Transaction is logged and visible in your DialerPay dashboard',
        ],
        cta: {
          label: 'Connect DialerPay',
          href: `/v/${brandSlug}/onboarding/dialerpay`,
        },
      };
  }
}

export function generateStaticParams() {
  const brands = BRAND_ORDER.filter((b) => b !== 'direct') as BrandCode[];
  const slugs: IntegrationSlug[] = ['ez-check', 'processing', 'dialerpay'];
  return brands.flatMap((b) =>
    slugs.map((integration) => ({ brand: BRANDS[b].slug, integration })),
  );
}

export default function BrandIntegrationPage({
  params,
}: {
  params: { brand: string; integration: string };
}) {
  const brand = BRAND_ORDER.find((b) => BRANDS[b].slug === params.brand);
  if (!brand) notFound();
  const slug = params.integration as IntegrationSlug;
  if (!['ez-check', 'processing', 'dialerpay'].includes(slug)) notFound();
  const spec = buildSpec(slug, brand);
  return <IntegrationPage {...spec} />;
}
