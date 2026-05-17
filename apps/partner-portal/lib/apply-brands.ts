/**
 * Per-brand content + visual theme for the consumer apply flow at
 * `/apply/<brand>`. Three industry-specific surfaces:
 *
 *   medpay   → patient financing (dental, med spa, fertility, vet, cosmetic)
 *   tradepay → home-improvement financing (HVAC, roofing, solar, electrical)
 *   coachpay → growth financing (coaching, certifications, bootcamps, courses)
 *
 * We deliberately don't reuse the "EAZE" wordmark on these landing pages —
 * each one wears the industry it serves. The MedPay landing speaks like a
 * dental-office partner, TradePay like a contractor finance brand,
 * CoachPay like a learning-marketplace funding partner.
 *
 * The lender pool shown at the end of the flow is still computed by the
 * shared `filterLenders()` rule (brand allowlist + tier match + per-partner
 * override + amount envelope) so the master can still toggle which lenders
 * appear from `/lender-marketplace`.
 */

import type { BrandCode } from '@eazepay/shared-types';

export interface ApplyTheme {
  /** Inline RGB used directly in style props for hero gradients + accents. */
  navy: string; // primary dark (header + buttons)
  accent: string; // hero gradient stop + chip backgrounds
  soft: string; // very pale surface tint for sections
  highlight: string; // wash colour for "AI Recommended" pill
}

export interface ApplyContent {
  /** Public wordmark + tagline (replaces "EAZE PAY"). */
  brandName: string;
  brandTagline: string;
  /** Browser title. */
  pageTitle: string;
  /** Hero. */
  heroHeadline: string;
  heroHighlight: string; // bold gradient phrase
  heroSubtitle: string;
  ctaPrimary: string;
  ctaSecondary: string;
  /** Sticky trust strip stats. */
  stats: Array<{ value: string; label: string }>;
  /** "Why choose us" — 6 benefit cards. */
  benefits: Array<{ title: string; description: string; pill?: 'Popular' }>;
  /** 3-step process. */
  steps: Array<{ title: string; description: string; bullets: string[] }>;
  /** Customer stories. */
  testimonials: Array<{ quote: string; name: string; role: string }>;
  /** Footer FAQ items. */
  faq: Array<{ q: string; a: string }>;
  /** Disclosure copy on /disclaimer step. */
  disclaimerCompliance: string;
  /** Intake form section heading + helper. */
  intakeHeading: string;
  intakeSub: string;
  intakeAmountHelper: string;
  /** Placeholder for the "Purpose" free-text field. */
  purposePlaceholder?: string;
  /** Offer screen. */
  offerHeadline: string;
  offerProduct: string;
  /** Bottom-page footer brand voice. */
  footerTagline: string;
  /** Industry-specific call-out icon themes (emoji-style fallback). */
  industryChips: string[];
}

const THEMES: Record<Exclude<BrandCode, 'direct'>, ApplyTheme> = {
  // Palettes match the corresponding MedPay/TradePay/CoachPay landing pages
  // in /landing/<brand>. Source-of-truth hex values:
  //   medpay   primary #0E7C66 deep teal · accent #22B8A0 · surface #ECFFFE → #FFFFFF · deep #062C29
  //   tradepay primary #0F172A slate     · accent #F97316 safety-orange   · surface #FAFAF9 → #FFFFFF
  //   coachpay primary #6366F1 indigo    · violet #8B5CF6                 · surface #F5F3FF → #FFFFFF · deep #1E1B4B
  medpay: {
    navy: '6 44 41', // #062C29 deep clinical teal contrast band
    accent: '14 124 102', // #0E7C66 brand teal (matches landing primary)
    soft: '236 255 254', // #ECFFFE surface tint
    highlight: '215 243 235', // pale mint wash for "recommended" pills
  },
  tradepay: {
    navy: '15 23 42', // #0F172A premium slate (matches landing primary)
    accent: '249 115 22', // #F97316 safety-orange (sparing accent, matches landing)
    soft: '250 250 249', // #FAFAF9 warm off-white surface
    highlight: '255 237 213', // #FFEDD5 orange wash for "recommended" pills
  },
  coachpay: {
    navy: '30 27 75', // #1E1B4B cosmic deep indigo (matches landing problem band)
    accent: '99 102 241', // #6366F1 electric indigo (matches landing primary)
    soft: '245 243 255', // #F5F3FF cosmic-light surface
    highlight: '237 233 254', // #EDE9FE violet wash for "recommended" pills
  },
};

const CONTENT: Record<Exclude<BrandCode, 'direct'>, ApplyContent> = {
  medpay: {
    brandName: 'MedPay',
    brandTagline: 'Patient Financing',
    pageTitle: 'MedPay | Patient Financing for Care You Deserve',
    heroHeadline: 'Patient Financing for',
    heroHighlight: 'Care You Deserve',
    heroSubtitle:
      'From dental implants to med-spa treatments — same-day approvals, soft credit check, terms up to 60 months. No impact to your credit score.',
    ctaPrimary: 'Check My Rate',
    ctaSecondary: 'How It Works',
    stats: [
      { value: '$240M+', label: 'Funded to date' },
      { value: '12,400+', label: 'Patients funded' },
      { value: '0% APR', label: 'Promo plans available' },
      { value: '60 sec', label: 'Pre-qualification' },
    ],
    benefits: [
      {
        title: 'Rates as low as 5.99% APR',
        description: 'Competitive rates set by your credit profile — never inflated.',
        pill: 'Popular',
      },
      {
        title: 'Terms 6 – 60 months',
        description: 'Pick a payment that fits your monthly budget.',
      },
      {
        title: '0% APR promotional plans',
        description: 'Same-as-cash plans on qualifying procedures.',
        pill: 'Popular',
      },
      {
        title: 'Soft credit check',
        description: 'See your options without dinging your credit.',
        pill: 'Popular',
      },
      {
        title: 'Same-day decision',
        description: 'Pre-qualified at the office, in under 60 seconds.',
      },
      {
        title: 'Provider paid up front',
        description: 'Your dentist or clinic is paid in full so care can start now.',
      },
    ],
    steps: [
      {
        title: 'Apply at the office',
        description: 'Complete a 60-second pre-qualification on your phone or the clinic tablet.',
        bullets: ['No paperwork required', 'Soft credit pull', 'HIPAA-aware'],
      },
      {
        title: 'Compare your plans',
        description: 'See real APR + monthly payments across our medical lending partners.',
        bullets: ['Multiple offers to compare', '0% intro APR options', 'No obligation'],
      },
      {
        title: 'Start your care',
        description: 'Your provider is paid in full. Schedule the procedure and pay over time.',
        bullets: ['Direct provider disbursement', 'Auto-pay supported', 'Pay early at no penalty'],
      },
    ],
    testimonials: [
      {
        quote:
          'I needed Invisalign + two crowns and didn’t have the cash. MedPay pre-qualified me in seconds and I started treatment that same afternoon.',
        name: 'Olivia Hernandez',
        role: 'Dental patient · Phoenix, AZ',
      },
      {
        quote:
          'Our IVF cycle was completely out of pocket. MedPay’s 60-month plan made it possible. Zero impact on our credit to check rates.',
        name: 'Maya & Daniel Kim',
        role: 'Fertility patients · Austin, TX',
      },
      {
        quote:
          'My med spa lets me book the treatment plan I actually want instead of breaking it into 4 visits. The promo APR plan was the deciding factor.',
        name: 'Sasha Whitfield',
        role: 'Aesthetic patient · Miami, FL',
      },
    ],
    faq: [
      {
        q: 'Does applying affect my credit score?',
        a: 'No — pre-qualification uses a soft credit inquiry, visible only to you. Your score is untouched until you formally accept an offer.',
      },
      {
        q: 'Which procedures are covered?',
        a: 'Dental, orthodontics, cosmetic, dermatology, fertility, vision, hearing, veterinary, and most elective medical procedures performed by a licensed US provider.',
      },
      {
        q: 'How fast does my clinic get paid?',
        a: 'Typically within 1 business day of the consumer accepting the offer. Disbursement goes directly to the provider — never to the patient.',
      },
      {
        q: 'What happens if I get declined?',
        a: 'You’ll always see the principal reasons in writing (Adverse Action Notice, FCRA + ECOA aligned). You can re-apply after 30 days or appeal with additional documentation.',
      },
    ],
    disclaimerCompliance:
      'MedPay is a financing marketplace — not a lender, and not a medical provider. Lenders make final credit decisions. Treatments are at the discretion of your licensed provider. No PHI (protected health information) is collected on this page.',
    intakeHeading: 'Let’s match you with the right plan',
    intakeSub: 'Your details stay private. Soft credit inquiry only — no impact on your score.',
    intakeAmountHelper: 'Most patients borrow between $1,500 and $25,000 for procedures.',
    purposePlaceholder: 'Dental implants, IVF, LASIK, etc.',
    offerHeadline: 'You’re pre-qualified for care',
    offerProduct: 'MedPay Financing',
    footerTagline: 'Helping patients access the care they need, without the cash crunch.',
    industryChips: [
      'Dental',
      'Med spa',
      'Fertility',
      'Cosmetic',
      'Veterinary',
      'Vision',
      'Hearing',
    ],
  },
  tradepay: {
    brandName: 'TradePay',
    brandTagline: 'Home Improvement Financing',
    pageTitle: 'TradePay | Project Financing for Home Improvement',
    heroHeadline: 'Project Financing for',
    heroHighlight: 'Home Improvement Pros',
    heroSubtitle:
      'HVAC replacements, roof repairs, solar installs, and major remodels — financed in 60 seconds. Loans up to $100,000 with terms to 84 months.',
    ctaPrimary: 'Pre-Qualify Now',
    ctaSecondary: 'Talk to a Funding Specialist',
    stats: [
      { value: '$415M+', label: 'Projects funded' },
      { value: '8,200+', label: 'Homeowners financed' },
      { value: 'Up to $100K', label: 'Loan size' },
      { value: '60 sec', label: 'Pre-qualification' },
    ],
    benefits: [
      {
        title: 'Loans up to $100,000',
        description: 'Cover the full project — labour, materials, equipment, and permits.',
        pill: 'Popular',
      },
      {
        title: '12-month deferred interest',
        description: 'Same-as-cash plans on qualifying installs.',
        pill: 'Popular',
      },
      {
        title: 'No home equity required',
        description: 'Unsecured. Your house is never collateral on a TradePay loan.',
      },
      {
        title: 'Soft credit check',
        description: 'Check your rate without affecting your credit score.',
        pill: 'Popular',
      },
      {
        title: 'Contractor paid direct',
        description: 'Your crew gets paid the day the job starts — no waiting on you.',
      },
      {
        title: 'Terms 24 – 84 months',
        description: 'Stretch large projects into payments your household can absorb.',
      },
    ],
    steps: [
      {
        title: 'Pre-qualify online',
        description:
          'Tell us about the project + a few details about yourself. Takes under 2 minutes.',
        bullets: ['Mobile-friendly', 'Soft credit pull', 'No SSN required at this step'],
      },
      {
        title: 'Pick your plan',
        description: 'Compare offers across multiple home-improvement lenders side by side.',
        bullets: ['Multiple APRs to compare', 'Deferred interest options', 'No obligation'],
      },
      {
        title: 'Start the project',
        description: 'Your contractor is paid up front. Work begins on the agreed start date.',
        bullets: [
          'Direct contractor pay',
          'Progress payments available',
          'Pay off early — no penalty',
        ],
      },
    ],
    testimonials: [
      {
        quote:
          'Our 18-year-old AC failed in July. TradePay had us approved in two minutes and the new system was installed by Friday. No fuss.',
        name: 'Carla & Ben Whitlock',
        role: 'Homeowners · Dallas, TX',
      },
      {
        quote:
          'I install solar for a living. Half my customers used to walk because of cash flow. TradePay closed three deals for me last month alone.',
        name: 'Marcus Bell',
        role: 'Solar contractor · Phoenix, AZ',
      },
      {
        quote:
          'Storm took half my roof. State Farm covered the shingles, TradePay funded the rest — full re-deck, gutters, new vents. Done in 9 days.',
        name: 'Linda Foster',
        role: 'Homeowner · Tampa, FL',
      },
    ],
    faq: [
      {
        q: 'What types of projects can I finance?',
        a: 'HVAC, roofing, solar, plumbing, electrical, windows, doors, full kitchen + bath remodels, decks, garage doors, fences — anything from a licensed home-improvement contractor in our network.',
      },
      {
        q: 'Does my contractor have to be in your network?',
        a: 'No, but our in-network contractors get same-day direct deposit. Out-of-network projects fund a check to the homeowner with a contractor invoice on file.',
      },
      {
        q: 'How big can the loan be?',
        a: 'Up to $100,000 for qualified borrowers. Most projects fall between $8,000 and $45,000.',
      },
      {
        q: 'Is this secured by my house?',
        a: 'No — TradePay loans are unsecured. Your home is never collateral, and there’s no lien on your title.',
      },
    ],
    disclaimerCompliance:
      'TradePay is a financing marketplace — not a lender, and not a contractor. Lender partners make all final credit decisions. Work is performed at the discretion of your selected contractor.',
    intakeHeading: 'Tell us about your project',
    intakeSub: 'Your details stay private. Soft credit inquiry only — no impact on your score.',
    intakeAmountHelper: 'Most homeowners borrow between $5,000 and $60,000.',
    purposePlaceholder: 'Roof, HVAC, kitchen reno, solar, etc.',
    offerHeadline: 'Your project is pre-approved',
    offerProduct: 'TradePay Project Loan',
    footerTagline: 'Helping homeowners say yes to the project — without raiding their savings.',
    industryChips: ['HVAC', 'Roofing', 'Solar', 'Plumbing', 'Electrical', 'Windows', 'Remodels'],
  },
  coachpay: {
    brandName: 'CoachPay',
    brandTagline: 'Growth Financing',
    pageTitle: 'CoachPay | Invest in Your Growth',
    heroHeadline: 'Invest in',
    heroHighlight: 'Your Growth',
    heroSubtitle:
      'Pay for coaching, bootcamps, certifications, and high-ticket courses over 12 – 60 months. Soft credit check only — see your options in 60 seconds.',
    ctaPrimary: 'Check My Options',
    ctaSecondary: 'Talk to a Specialist',
    stats: [
      { value: '15,000+', label: 'Learners funded' },
      { value: '$185M+', label: 'Tuition financed' },
      { value: '90 days', label: 'Deferred first payment' },
      { value: '60 sec', label: 'Pre-qualification' },
    ],
    benefits: [
      {
        title: 'Up to $50,000',
        description: 'Enough to cover high-ticket mastermind programs and full bootcamps.',
        pill: 'Popular',
      },
      {
        title: 'Defer 90 days',
        description: 'Start the program now, start paying after onboarding.',
        pill: 'Popular',
      },
      {
        title: 'Coach paid up front',
        description: 'Your coach or program gets paid in full so you can dive straight in.',
      },
      {
        title: 'Soft credit check',
        description: 'Check rates with zero impact to your credit score.',
        pill: 'Popular',
      },
      {
        title: 'Terms 12 – 60 months',
        description: 'Match payments to expected return-on-investment from the program.',
      },
      {
        title: 'Approved for self-employed',
        description: 'Income-based underwriting — W-2 not required.',
      },
    ],
    steps: [
      {
        title: 'Pick your program',
        description:
          'Find your bootcamp, certification, or coach — partner programs are pre-vetted.',
        bullets: ['Coaching programs', 'Bootcamps + certifications', 'Mastermind tuition'],
      },
      {
        title: 'Pre-qualify in 60 seconds',
        description: 'Soft credit pull. See multiple offers from learning-financing lenders.',
        bullets: ['Multiple offers to compare', 'Defer 90 days', 'No obligation'],
      },
      {
        title: 'Enrol + start growing',
        description: 'Your program partner is paid up front. Cohort kickoff happens on schedule.',
        bullets: ['Direct program payout', 'Auto-pay supported', 'Pay off early — no penalty'],
      },
    ],
    testimonials: [
      {
        quote:
          'I wanted to enrol in an executive coaching certification but the $9,800 up front wasn’t happening. CoachPay let me start the cohort the next week.',
        name: 'Avery Cho',
        role: 'Career coach · Seattle, WA',
      },
      {
        quote:
          'My data-science bootcamp paid off in 4 months. CoachPay covered the tuition so I could focus on the curriculum instead of side gigs.',
        name: 'Tobias Renner',
        role: 'Bootcamp grad · Brooklyn, NY',
      },
      {
        quote:
          'I run a high-ticket mastermind. Before CoachPay, 30% of qualified students walked at payment. Now they pre-qualify on the call and enrol on the spot.',
        name: 'Atlas Reeve',
        role: 'Founder, Atlas Executive Coaching',
      },
    ],
    faq: [
      {
        q: 'What kinds of programs qualify?',
        a: 'Coaching programs, bootcamps, certifications, mastermind tuition, and high-ticket courses delivered by a registered US program partner — typically $2,000 – $50,000 in cost.',
      },
      {
        q: 'How fast does my coach or school get paid?',
        a: 'Usually within 1 business day of accepted offer. Funds go directly to the program — never to the student.',
      },
      {
        q: 'Do I need a W-2 to qualify?',
        a: 'No. CoachPay supports self-employed, 1099, and freelancer income. We look at recurring deposits + total monthly cash flow.',
      },
      {
        q: 'Can I defer my first payment?',
        a: 'Yes — most programs include a 90-day deferral so you’re past onboarding before your first payment hits.',
      },
    ],
    disclaimerCompliance:
      'CoachPay is a financing marketplace — not a lender, and not an education institution. Lender partners make all final credit decisions. Programs are delivered at the discretion of your selected program partner.',
    intakeHeading: 'Tell us about your program',
    intakeSub: 'Your details stay private. Soft credit inquiry only — no impact on your score.',
    intakeAmountHelper: 'Most learners borrow between $2,500 and $25,000.',
    purposePlaceholder: 'Coaching program, bootcamp, certification, etc.',
    offerHeadline: 'You’re pre-qualified to enrol',
    offerProduct: 'CoachPay Growth Loan',
    footerTagline:
      'Helping learners + coaches close the gap between “I want to grow” and “I’m in.”',
    industryChips: [
      'Coaching',
      'Bootcamps',
      'Certifications',
      'Mastermind',
      'Online courses',
      'Career programs',
    ],
  },
};

export function brandTheme(brand: Exclude<BrandCode, 'direct'>): ApplyTheme {
  return THEMES[brand];
}

export function brandContent(brand: Exclude<BrandCode, 'direct'>): ApplyContent {
  return CONTENT[brand];
}
