import {
  BoltIcon,
  ChartIcon,
  PackageIcon,
  SparkIcon,
} from '@eazepay/ui/web';
import { AgencyPickerPage } from '../../components/AgencyPickerPage';

/** Marketing Consult — direct port of the Lovable `/marketing-consult`
 *  page. Vertical-specific agency picker (Medical: Lead Juice,
 *  Coaches: AMALA Agency). */
export default function MarketingConsultPage() {
  return (
    <AgencyPickerPage
      name="Marketing Consult"
      icon={<BoltIcon size={22} />}
      heading="Marketing Consulting Services"
      body="Accelerate your business growth with expert marketing strategy, lead generation, and brand positioning. Choose the agency that fits your industry below."
      stats={[
        { label: 'Avg ROI', value: '4.2×' },
        { label: 'Campaigns', value: '500+' },
        { label: 'Onboarding', value: '7 days' },
      ]}
      features={[
        {
          icon: <SparkIcon size={18} />,
          title: 'Lead Generation',
          description: 'Proven funnels and ad strategies to drive qualified leads to your business',
        },
        {
          icon: <ChartIcon size={18} />,
          title: 'Performance Analytics',
          description: 'Detailed reporting on campaign ROI, conversion rates, and growth metrics',
        },
        {
          icon: <PackageIcon size={18} />,
          title: 'Brand Positioning',
          description: 'Strategic messaging and creative assets tailored to your target market',
        },
      ]}
      whatsIncluded={[
        'Custom marketing strategy & audit',
        'Paid ad management (Google, Meta, TikTok)',
        'Landing page design & optimization',
        'Monthly performance reporting',
        'Dedicated marketing strategist',
      ]}
      verticals={[
        {
          label: 'Medical',
          agencies: [
            {
              name: 'Lead Juice',
              blurb:
                'Specialized marketing for medical practices, med spas, dental offices, and healthcare providers. Lead Juice delivers patient acquisition strategies that drive real appointments.',
              bullets: ['Patient lead generation', 'HIPAA-compliant campaigns', 'Med spa & dental marketing'],
              cta: 'Book a Call with Lead Juice',
            },
          ],
        },
        {
          label: 'Coaches',
          agencies: [
            {
              name: 'AMALA Agency',
              blurb:
                'Growth marketing built for coaches, consultants, and course creators. AMALA Agency helps you build authority, fill programs, and scale your coaching business.',
              bullets: ['Coaching funnel builds', 'Social media strategy', 'Program launch campaigns'],
              cta: 'Book a Call with AMALA Agency',
            },
          ],
        },
      ]}
    />
  );
}
