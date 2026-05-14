import { BrandLanding } from '../../lib/BrandLanding';
import { BRANDS } from '@eazepay/shared-types';

export const metadata = {
  title: 'CoachPay by EazePay — Pay over time for coaching, certifications, and courses',
  description:
    'CoachPay matches learners with bank-backed financing for executive coaching, certifications, bootcamps, and professional development — with terms built around how careers actually pay back.',
};

export default function CoachPayLanding() {
  return (
    <BrandLanding
      brand={BRANDS.coachpay}
      hero={{
        eyebrow: 'Career investment, financed the right way',
        title: 'Invest in yourself.',
        titleAccent: 'Pay it back at the speed your career grows.',
        subhead:
          'CoachPay routes your application across our network of bank-backed lenders for executive coaching, certifications, bootcamps, and career programs. Terms from 6 to 60 months, fixed APR, no deferred-interest tricks.',
      }}
      useCases={[
        { label: 'Executive coaching', desc: '1:1 coaching engagements, leadership programs, group cohorts.', sample: '$2k – $30k' },
        { label: 'Bootcamps + intensives', desc: 'Engineering, data, design, product, and AI programs.', sample: '$3k – $25k' },
        { label: 'Professional certifications', desc: 'PMP, CFA, AWS, security, and other industry certifications.', sample: '$500 – $10k' },
        { label: 'Career programs', desc: 'Career transition cohorts, MBA prep, executive education.', sample: '$2k – $20k' },
        { label: 'Therapy + wellness', desc: 'Long-format therapy, intensives, and structured wellness programs.', sample: '$1k – $15k' },
        { label: 'Specialty courses', desc: 'Niche professional skill programs with verified outcomes.', sample: '$500 – $10k' },
      ]}
      trust={[
        ['Bank-backed loans', 'Every offer is a real loan from a chartered partner bank, with the lender of record clearly disclosed.'],
        ['No deferred-interest gotchas', 'Fixed APR for the full term. The TILA box on every offer shows the exact finance charge.'],
        ['Pause-friendly servicing', 'Hardship pathway is one tap. We surface forbearance and payment-assistance options up front.'],
        ['Honest outcome disclosure', 'Program partners share outcome data in the application flow so you can decide with eyes open.'],
      ]}
      faq={[
        { q: 'How is CoachPay different from a tuition payment plan?', a: 'CoachPay is a real installment loan from a chartered bank. Your program partner is paid in full upfront, and you make monthly payments to the lender of record over the term you chose. No surprises if you drop out or move on.' },
        { q: 'Will applying hurt my credit?', a: 'No. CoachPay uses a soft credit check to match you with offers, which does not impact your score. A hard inquiry only happens if you accept an offer.' },
        { q: 'Can I cosign with my employer?', a: 'Not yet — but employer-funded paths are coming. For now, individual and joint applications are supported.' },
        { q: 'What if I drop out of the program?', a: 'Your loan is independent of the program. If your program partner offers a refund, that refund is applied directly to your loan balance. The hardship pathway is also available throughout the term.' },
        { q: 'Are there limits to what you finance?', a: 'CoachPay focuses on programs with a verified outcome record — coaching, certifications, bootcamps, structured wellness, and similar categories. Not every program qualifies.' },
      ]}
    />
  );
}
