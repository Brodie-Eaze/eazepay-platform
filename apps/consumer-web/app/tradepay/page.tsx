import { BrandLanding } from '../../lib/BrandLanding';
import { BRANDS } from '@eazepay/shared-types';

export const metadata = {
  title: 'TradePay by EazePay — Financing for home improvement, solar, and trades',
  description:
    'TradePay gives homeowners and small businesses real loan offers in 90 seconds for solar, roofing, HVAC, windows, pools, and renovations — with no impact to credit.',
};

export default function TradePayLanding() {
  return (
    <BrandLanding
      brand={BRANDS.tradepay}
      hero={{
        eyebrow: 'Financing for the work people live with for 20 years',
        title: 'Real terms for solar, roof, HVAC and the rest of the job.',
        titleAccent: 'No credit-score hit to look.',
        subhead:
          'TradePay routes your application across our network of bank-backed lenders so you compare real, side-by-side terms in seconds. Pay over 2 to 12 years — pick the option that fits your job and your budget.',
      }}
      useCases={[
        { label: 'Solar PV + battery', desc: 'Whole-home systems and battery upgrades, residential and small commercial.', sample: '$10k – $100k' },
        { label: 'Roof replacement', desc: 'Full tear-off, repair, and storm-damage reroofs across asphalt, metal, and tile.', sample: '$8k – $60k' },
        { label: 'HVAC + ductwork', desc: 'High-efficiency systems with rebate-aware quoting.', sample: '$4k – $35k' },
        { label: 'Windows + siding', desc: 'Full-house re-glazing, fiber-cement siding, exterior renovations.', sample: '$6k – $80k' },
        { label: 'Pools + outdoor living', desc: 'In-ground pools, hardscape, and outdoor kitchens.', sample: '$15k – $150k' },
        { label: 'Kitchen + bath remodel', desc: 'Full remodels with permits, design, and finishes.', sample: '$10k – $120k' },
      ]}
      trust={[
        ['Bank-of-record clarity', 'Loans are made by chartered partner banks. We surface the lender of record on every offer.'],
        ['Encrypted vault', 'AES-256 envelope encryption on every piece of PII. Bank-grade.'],
        ['Fair-routing default', 'Lowest total cost sorts first. We never hide a cheaper offer for our economics.'],
        ['Honest disclosure', 'Federal TILA box on every offer with APR, finance charge, and total of payments.'],
      ]}
      faq={[
        { q: 'Will checking offers hurt my credit?', a: 'No. TradePay uses a soft credit inquiry for offer matching, which never affects your score. A hard inquiry only happens if you accept an offer and choose to move forward.' },
        { q: 'How fast does the contractor get paid?', a: 'Most TradePay-approved jobs disburse via RTP within minutes of e-signing. ACH same-day is the fallback when RTP is unavailable.' },
        { q: 'What credit profile do you serve?', a: 'TradePay routes across prime, near-prime, and specialist contractor lenders. Most approved customers have FICO ≥ 640. We always tell you what tiers we evaluated.' },
        { q: 'Can my spouse co-sign?', a: 'Yes. Joint applications are supported and improve approval odds for thinner credit files. Both signers complete identity verification.' },
        { q: 'Are there prepayment penalties?', a: 'No. Every TradePay-routed loan is open to prepayment at any time without penalty. The TILA box on each offer states this in writing.' },
      ]}
    />
  );
}
