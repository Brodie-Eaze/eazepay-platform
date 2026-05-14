import { BrandLanding } from '../../lib/BrandLanding';
import { BRANDS } from '@eazepay/shared-types';

export const metadata = {
  title: 'MedPay by EazePay — Patient financing for dental, medical, and vet care',
  description:
    'MedPay gives patients real loan offers in 90 seconds for dental, medical, vision, vet, and fertility care — with terms designed for procedures, not credit cards.',
};

export default function MedPayLanding() {
  return (
    <BrandLanding
      brand={BRANDS.medpay}
      hero={{
        eyebrow: 'Patient financing without the surprise',
        title: 'Pay for your treatment over time.',
        titleAccent: 'Approval in 90 seconds, no score hit.',
        subhead:
          'MedPay matches you with bank-backed lenders so you can compare real, side-by-side terms before your appointment. Built for the way care is actually paid for — not as a credit card workaround.',
      }}
      useCases={[
        { label: 'Dental + orthodontics', desc: 'Implants, aligners, full-arch restorations, cosmetic dentistry.', sample: '$1k – $40k' },
        { label: 'Medical procedures', desc: 'Elective surgery, weight management, dermatology, cosmetic.', sample: '$2k – $50k' },
        { label: 'Vision + LASIK', desc: 'Refractive surgery, premium intraocular lenses.', sample: '$2k – $10k' },
        { label: 'Fertility care', desc: 'IVF cycles, embryo banking, donor and surrogate programs.', sample: '$5k – $50k' },
        { label: 'Veterinary care', desc: 'Major procedures, oncology, specialty referrals.', sample: '$1k – $20k' },
        { label: 'Hearing + specialty', desc: 'Hearing aids and other specialty health categories.', sample: '$1k – $12k' },
      ]}
      trust={[
        ['Bank-backed loans', 'Every offer is a real loan from a chartered partner bank, with the lender of record clearly disclosed.'],
        ['HIPAA-aware integration', 'Practices never share PHI with us. We finance the patient, not the chart.'],
        ['No retroactive rate hikes', 'TILA-disclosed APR holds for the full term. No deferred-interest gotchas.'],
        ['Fair compare-and-choose', 'Lowest total cost is the default sort. Hidden fees are not.'],
      ]}
      faq={[
        { q: 'How is MedPay different from a CareCredit-style card?', a: 'MedPay is a real installment loan with a fixed APR and term, disclosed in a TILA box up front. There is no deferred-interest mechanic, so the rate you see is the rate you pay through the life of the loan.' },
        { q: 'Will applying affect my credit?', a: 'No. MedPay uses a soft credit check to match you with offers, which does not impact your score. A hard inquiry only happens if you accept an offer.' },
        { q: 'Can I use MedPay for care that already happened?', a: 'Yes — many lenders in our network finance post-care balances, including outstanding balances from your provider, within product limits.' },
        { q: 'How does my provider get paid?', a: 'On e-sign, your provider receives funds via RTP same-day (ACH fallback). You make monthly payments to the lender of record per your agreement.' },
        { q: 'Is there a cosigner option?', a: 'Yes. Adding a cosigner often improves offer pricing and approval odds for thinner credit files.' },
      ]}
    />
  );
}
