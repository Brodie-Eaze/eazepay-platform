import { UsersIcon, ChartIcon, PackageIcon, SparkIcon } from '@eazepay/ui/web';
import { AgencyPickerPage } from '../../components/AgencyPickerPage';

/** Sales Recruitment — direct port of Lovable's `/sales-recruitment`.
 *  Two verticals (Medical / Coaches) × multiple agencies. */
export default function SalesRecruitmentPage() {
  return (
    <AgencyPickerPage
      name="Sales Recruitment"
      icon={<UsersIcon size={22} />}
      heading="Sales Recruitment Services"
      body="Build a high-performing sales team with our specialized recruitment partners. Choose the vertical that fits your business below."
      stats={[
        { label: 'Avg Time to Hire', value: '14 days' },
        { label: 'Retention Rate', value: '92%' },
        { label: 'Placements', value: '1,200+' },
      ]}
      features={[
        {
          icon: <UsersIcon size={18} />,
          title: 'Talent Sourcing',
          description:
            'Access a vetted pipeline of experienced sales professionals in financial services',
        },
        {
          icon: <ChartIcon size={18} />,
          title: 'Performance Matching',
          description:
            'Data-driven matching to find reps who fit your product, market, and culture',
        },
        {
          icon: <SparkIcon size={18} />,
          title: 'Onboarding Support',
          description: 'Structured training programs to get new hires producing revenue fast',
        },
      ]}
      whatsIncluded={[
        'Dedicated recruitment specialist',
        'Pre-screened candidate pipeline',
        'Sales aptitude & culture fit assessments',
        '90-day placement guarantee',
        'Ongoing performance coaching support',
      ]}
      verticals={[
        {
          label: 'Medical',
          agencies: [
            {
              name: 'She Sells',
              blurb:
                'Women-led sales recruitment specializing in medical and healthcare sales teams. Build a powerhouse team that understands patient financing.',
              bullets: [
                'Medical sales specialists',
                'Healthcare industry focus',
                'High-performance closers',
              ],
              cta: 'Book a Call with She Sells',
            },
            {
              name: 'Freedom Academy',
              blurb:
                'Full-service recruitment for medical sales professionals with deep expertise in patient financing and med spa sales.',
              bullets: ['Patient financing experts', 'Med spa sales reps', 'Proven track record'],
              cta: 'Book a Call with Freedom Academy',
            },
          ],
        },
        {
          label: 'Coaches',
          agencies: [
            {
              name: 'Impact',
              blurb:
                'Recruitment agency focused on high-ticket coaching and consulting sales teams. Find closers who understand transformation-based selling.',
              bullets: [
                'High-ticket sales closers',
                'Coaching industry expertise',
                'Setter & closer teams',
              ],
              cta: 'Book a Call with Impact',
            },
            {
              name: 'Freedom Academy',
              blurb:
                'Specialized recruitment for coaching and course creator businesses. Sales talent that converts leads into enrolled clients.',
              bullets: ['Course & program sales', 'Enrollment specialists', 'Scalable sales teams'],
              cta: 'Book a Call with Freedom Academy',
            },
          ],
        },
      ]}
    />
  );
}
