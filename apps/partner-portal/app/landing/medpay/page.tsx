'use client';

import { useEffect, useRef, useState } from 'react';

/* ============================================================================
   MedPay · Patient Financing landing page (finance-first).
   Single-file rebuild. Inline SVG icons. Tailwind for layout, custom CSS
   block for animations, glass, ambient grid, scroll-reveal, marquee, etc.
   Visual benchmark: AUREAN/AI marketing page. Palette: clinical teal.
   ========================================================================== */

/* ----------------------------- copy / config ---------------------------- */

const NAV_LINKS: Array<{ href: string; label: string }> = [
  { href: '#financing', label: 'Financing' },
  { href: '#how', label: 'How it works' },
  { href: '#pillars', label: 'Platform' },
  { href: '#agents', label: 'Agents' },
  { href: '#roi', label: 'ROI' },
  { href: '#stories', label: 'Stories' },
];

// Chips float clear of the offer-card body. Stage container is the parent;
// positions are above the card top (top: -X%) and below the card bottom
// (bottom: -X%) so they never overlap the card's visible text.
const HERO_CHIPS: Array<{ k: string; v: string; top?: string; bottom?: string; left?: string; right?: string; delay: string }> = [
  { k: 'FCRA',        v: 'soft pull · 0 impact',         top: '-12%',    left:  '2%',  delay: '0s'   },
  { k: 'Decision',    v: 'instant · multi-offer',        top: '-12%',    right: '2%',  delay: '0.6s' },
  { k: 'Payout',      v: 'merchant-direct · 48-72hr',    bottom: '-12%', left:  '2%',  delay: '1.2s' },
  { k: 'Promo',       v: '0% interest plans · T&Cs',     bottom: '-12%', right: '2%',  delay: '1.8s' },
];

const TICKER: Array<{ value: string; label: string; delta: string }> = [
  { value: '$240M+', label: 'Funded to date', delta: '+$18M this quarter' },
  { value: '12,400+', label: 'Patients funded', delta: '+1,420 in 30d' },
  { value: 'Real-time', label: 'Lender marketplace', delta: '52 lenders parallel' },
  { value: '60 sec', label: 'Pre-qualification', delta: 'Soft pull · zero impact' },
];

const STATUS_QUO: Array<{ stat: string; label: string }> = [
  { stat: '38%', label: 'Same-day close (industry avg.)' },
  { stat: '$1.4M', label: 'Case acceptance lost / yr (3-chair)' },
  { stat: '54%', label: 'Inbound never pre-qualified' },
  { stat: '2-4 wks', label: 'Consult → deposit' },
];

const WITH_MEDPAY: Array<{ stat: string; label: string }> = [
  { stat: 'Higher', label: 'Same-day close when financing is at-chair' },
  { stat: 'Same-day', label: 'Consult → approval → funded' },
  { stat: '52 lenders', label: 'Soft-pull marketplace · parallel quote' },
  { stat: 'Direct', label: 'Lender disburses merchant-direct · 48-72hr' },
];

const STAGES: Array<{ n: string; stage: string; title: string; body: string; metric: string }> = [
  {
    n: '01',
    stage: 'Pre-qual',
    title: 'Soft-pull EZ Check',
    body: 'Patient enters last 4 of SSN + DOB on your iPad. Soft pull returns a fundability tier in under 10 seconds. Zero credit impact.',
    metric: '< 10s',
  },
  {
    n: '02',
    stage: 'Agentic intake',
    title: 'PRISM reshapes the apply flow',
    body: 'Every form session is watched by PRISM. It reorders questions on partial answers, kills friction for high-intent patients, and adds verification steps when the signal looks junky.',
    metric: '−41% drop-off',
  },
  {
    n: '03',
    stage: 'Marketplace',
    title: 'Decision engine waterfalls',
    body: 'MedPay routes the application across every marketplace enabled. engine.tech, HSP Medical, EazePay Direct. Parallel quote, 5s SLA.',
    metric: '52 lenders',
  },
  {
    n: '04',
    stage: 'Offer',
    title: 'Best offer wins',
    body: 'Offers ranked consumer-best (lowest total cost). Patient sees one screen with the AI-recommended offer + 2 alternates. Tap → e-sign → done.',
    metric: 'Best offer wins',
  },
  {
    n: '05',
    stage: 'Funded',
    title: 'Lender disburses direct to your business account',
    body: 'Merchant-direct disbursement. No intermediary holds the funds. Payouts generally land within 48 to 72 hours of the loan settling. No clawback on routine defaults. Credit risk sits with the lender, not the practice.',
    metric: '48-72hr · merchant-direct',
  },
];

const OFFERS: Array<{ label: string; term: string; monthly: string; apr: string; total: string; recommended?: boolean; note?: string }> = [
  {
    label: 'Best · lowest total cost',
    term: '48 mo',
    monthly: '$250',
    apr: '6.9%',
    total: '$12,000',
    recommended: true,
    note: 'Soft pull only · lender confirmed at e-sign',
  },
  { label: 'Personal · 36 mo', term: '36 mo', monthly: '$338', apr: '8.9%', total: '$12,168', note: 'Soft pull only' },
  { label: '0% Promo · 12 mo', term: '12 mo', monthly: '$1,000', apr: '0% promo', total: '$12,000', note: 'Deferred interest · pay-in-full · T&Cs apply' },
];

type AgentStatus = 'ONLINE' | 'LEARNING';

type AgentIconKey = 'prism' | 'vega' | 'oracle' | 'helix' | 'nexus' | 'flux' | 'echo';

const AGENTS: Array<{
  n: string;
  code: string;
  role: string;
  span: 7 | 5 | 12;
  status: AgentStatus;
  description: string;
  stats: Array<{ k: string; v: string }>;
  lastAction: string;
  iconKey: AgentIconKey;
}> = [
  {
    n: '01',
    code: 'PRISM',
    role: 'Intake Agent',
    span: 7,
    status: 'ONLINE',
    description:
      'PRISM watches every apply-form session in real time. It reshapes question order based on partial answers, kills friction for high-intent patients, and adds verification steps when it detects junk. It learns which question sequences convert per traffic source.',
    stats: [
      { k: 'Sessions/hr', v: '4,820' },
      { k: 'Field skips', v: '38%' },
      { k: 'Form drop-off', v: '−41%' },
    ],
    lastAction:
      'reordered branch on traffic_source=meta_advantage to ask treatment_type before income_band · 14s ago',
    iconKey: 'prism',
  },
  {
    n: '02',
    code: 'VEGA',
    role: 'Enrichment Agent',
    span: 5,
    status: 'ONLINE',
    description:
      'VEGA orchestrates 12 enrichment providers in parallel. It picks the cheapest source likely to return a match, falls back automatically on failure, and dedupes identity collisions across vendors.',
    stats: [
      { k: 'Avg cost/lead', v: '$0.41' },
      { k: 'Identity match', v: '94%' },
    ],
    lastAction:
      'fell back to provider_03 after timeout on provider_01 · saved $0.18 · 2s ago',
    iconKey: 'vega',
  },
  {
    n: '03',
    code: 'ORACLE',
    role: 'Scoring Agent',
    span: 5,
    status: 'LEARNING',
    description:
      'ORACLE runs a calibrated propensity model trained on your closed-won outcomes, not a generic lookalike. It retrains nightly on every disposition your front desk logs and surfaces drift before it affects revenue.',
    stats: [
      { k: 'Model AUC', v: '0.89' },
      { k: 'Last retrain', v: '4h ago' },
    ],
    lastAction:
      'flagged feature drift on procedure_value. Recalibrated thresholds · 4h ago',
    iconKey: 'oracle',
  },
  {
    n: '04',
    code: 'HELIX',
    role: 'Routing Agent',
    span: 7,
    status: 'ONLINE',
    description:
      'HELIX matches every qualified patient to the right rep, not just the next available one. It learns which reps close which tiers, accounts for rep capacity in real time, and routes around vacations, lunch, and underperformance without anyone asking.',
    stats: [
      { k: 'Avg route time', v: '320ms' },
      { k: 'Rep match lift', v: '+31%' },
      { k: 'SLA breach', v: '0.4%' },
    ],
    lastAction:
      'rerouted T1 patient away from rep_M.Chen (capacity 98%) → rep_S.Patel · 1s ago',
    iconKey: 'helix',
  },
  {
    n: '05',
    code: 'NEXUS',
    role: 'Lender Marketplace Agent',
    span: 7,
    status: 'ONLINE',
    description:
      'NEXUS routes every qualified patient through a curated multi-lender marketplace, prime to subprime, $3k to $50k. Soft pull only. It learns which lenders approve which patient profiles, watches stip rates in real time, and reroutes around lenders that tighten overnight.',
    stats: [
      { k: 'Decision', v: '< 10s' },
      { k: 'Pull type', v: 'Soft only' },
      { k: 'Lenders', v: '52' },
    ],
    lastAction:
      'matched patient profile (V4=712, DTI=0.34, ask=$12k) to lender_07 + 2 backups · 12s ago',
    iconKey: 'nexus',
  },
  {
    n: '06',
    code: 'FLUX',
    role: 'Payment Agent',
    span: 5,
    status: 'ONLINE',
    description:
      'FLUX handles the actual money. It presents BNPL, POS finance, ACH, and card options based on the lender approval, retries failed payments intelligently, and reconciles every settled cent back to the originating ad campaign.',
    stats: [
      { k: 'Auth success', v: '96.3%' },
      { k: 'Recovery', v: '+18%' },
    ],
    lastAction:
      'retried failed ACH on case_8412 via card_on_file · captured $4,200 · 8s ago',
    iconKey: 'flux',
  },
  {
    n: '07',
    code: 'ECHO',
    role: 'Attribution Agent',
    span: 12,
    status: 'ONLINE',
    description:
      'ECHO closes the loop. It holds pixel events until a patient clears qualification, then fires weighted conversions back to Meta and Google via server-side CAPI. It uploads closed-won deals as offline conversions. The cleanest training signal your ad account will ever see.',
    stats: [],
    lastAction:
      'uploaded 47 closed-won cases to Meta CAPI, weighted by case_value · 6m ago',
    iconKey: 'echo',
  },
];

const ECHO_STREAM: Array<{ event: string; route: string; muted?: boolean }> = [
  { event: 'patient_qualified · T1', route: '→ Meta CAPI · weight 1.00' },
  { event: 'patient_qualified · T2', route: '→ Google Offline · weight 0.65' },
  { event: 'case_closed · $14,200', route: '→ Meta CAPI · weight 2.20' },
  { event: 'patient_disqualified · T4', route: '→ suppressed · audience exclude', muted: true },
  { event: 'case_closed · $8,900', route: '→ Google Offline · weight 1.40' },
];

const CASES: Array<{
  quote: string;
  name: string;
  role: string;
  outcomes: Array<{ value: string; label: string }>;
  primaryTag: string;
}> = [
  {
    quote:
      'We were losing 4 in 10 implant consults to "I need to think about it." After MedPay financing, our same-day close rate jumped dramatically. Same patient pool, same prices. 3-chair practice, +$840k in year-one case acceptance.',
    name: 'Dr. Lena Park',
    role: 'Owner · Atlas Dental Group · Austin, TX',
    outcomes: [
      { value: 'Lifted', label: 'Same-day close' },
      { value: '+$840k', label: 'Year-1 attached' },
    ],
    primaryTag: 'Financing outcome',
  },
  {
    quote:
      'The marketplace waterfall is the difference-maker. When one lender declines, the next quotes in seconds. We funded a meaningful share of patients that a single-lender setup would have turned away. Net new revenue we never would have seen.',
    name: 'Mara Velasco',
    role: 'Operations · Lumin Aesthetic · Miami, FL',
    outcomes: [
      { value: 'Marketplace', label: 'Waterfall coverage' },
      { value: '+$420k', label: 'Recovered' },
    ],
    primaryTag: 'Financing outcome',
  },
  {
    quote:
      'Instant approvals at the consult turned our close rate on $8k+ tickets from a coin-flip into a routine. Strong marketplace coverage, decisions under 10 seconds, and the agentic layer pre-qualifying every inbound application around the clock means our front desk only spends time with patients who can actually afford the work. We never see a deferred deal again.',
    name: 'James Park',
    role: 'CFO · MedFirst Solutions · New York, NY',
    outcomes: [
      { value: '< 10s', label: 'Decision time' },
      { value: '52 lenders', label: 'Marketplace' },
    ],
    primaryTag: 'Financing outcome',
  },
];

const INTEGRATIONS: string[] = [
  'CROSS RIVER BANK',
  'ENGINE.TECH',
  'HSP MEDICAL',
  'FINWISE',
  'EXPERIAN',
  'TRANSUNION',
  'PLAID',
  'PERSONA',
  'SIFT',
];

const OBJECTIONS: Array<{ q: string; a: string }> = [
  {
    q: 'Will offering finance turn my practice into a CareCredit-style operation?',
    a: 'No. MedPay is a high-touch, premium patient experience. The patient sees an instant decision, three best-fit offers ranked by total cost, and a clean accept-and-go flow. The lender name only appears at e-sign per FCRA disclosure rules. CareCredit feels like a credit-card pitch; MedPay feels like a feature of your practice.',
  },
  {
    q: 'What happens if the patient defaults? Do I get clawed back?',
    a: "You're paid in full when the lender disburses. The lender on the offer carries the credit risk, not you. No clawbacks for routine defaults. If a patient cancels treatment before disbursement, that's between you and them, same as a cash refund.",
  },
  {
    q: 'How do I know the AI-recommended offer is actually best for my patient?',
    a: 'Offers are ranked consumer-best by total cost of credit. APR, term, fees, deferred-interest risk are all priced into the ranking. The patient always sees the AI-recommended offer plus two alternates on one screen, so it is never a black box. Every recommendation is logged with the reason code and full marketplace pull, so you can audit any decision after the fact.',
  },
  {
    q: 'How fast is onboarding really?',
    a: '5-minute self-serve wizard for the business profile. KYB (IRS TIN, Secretary of State, OFAC, PEP, FinCEN BOI) clears in 60 seconds for clean records. Once a patient is approved and signed, payouts are merchant-direct and generally land within 48 to 72 hours of the loan settling.',
  },
  {
    q: 'How is this different from Sunbit / Cherry / Affirm?',
    a: 'Two reasons. (1) We are a marketplace. Sunbit/Cherry are single lenders. We waterfall across 52, so when their algorithm declines, ours keeps going. The marketplace coverage opens up real-lender approvals where a single lender would decline. (2) The agentic layer is bundled. Seven autonomous agents covering intake, enrichment, scoring, routing, lender selection, payment retry, and attribution. Sunbit will never answer your phone or recover a failed disbursement.',
  },
];

/* ----------------------------- inline SVG icons ---------------------------- */

const Icon = {
  Logo: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" stroke="#fff" strokeWidth="2.4" />
    </svg>
  ),
  Arrow: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Check: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Spark: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
  Phone: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M5 4h4l2 5-3 2a14 14 0 006 6l2-3 5 2v4a2 2 0 01-2 2A18 18 0 013 6a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  Card: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="6" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 11h18" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  Bolt: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ),
  Shield: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  Stack: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M12 3L2 8l10 5 10-5-10-5zM2 14l10 5 10-5M2 18l10 5 10-5" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ),
  Plus: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  Minus: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  Star: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l3 7 7.5.6-5.7 5L18.4 22 12 18l-6.4 4L7.2 14.6 1.5 9.6 9 9z" />
    </svg>
  ),
  Hub: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  // ============ AGENT ICONS (AUREAN 7) ============
  AgentPrism: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 3L3 18h18L12 3z" stroke="#0E7C66" strokeWidth="1.6" />
      <path d="M12 8v8M8 14h8" stroke="#0E7C66" strokeWidth="1.2" />
    </svg>
  ),
  AgentVega: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4" stroke="#0E7C66" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="9" stroke="#0E7C66" strokeWidth="1" strokeDasharray="2 3" />
    </svg>
  ),
  AgentOracle: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M4 17l5-9 4 6 3-4 4 7" stroke="#0E7C66" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  AgentHelix: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M6 4c4 4 4 12 0 16M18 4c-4 4-4 12 0 16M6 8h12M6 16h12" stroke="#0E7C66" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  AgentNexus: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="2.2" fill="#0E7C66" />
      <circle cx="4" cy="6" r="1.6" fill="#0E7C66" />
      <circle cx="20" cy="6" r="1.6" fill="#0E7C66" />
      <circle cx="4" cy="18" r="1.6" fill="#0E7C66" />
      <circle cx="20" cy="18" r="1.6" fill="#0E7C66" />
      <path d="M12 12L4 6M12 12L20 6M12 12L4 18M12 12L20 18" stroke="#0E7C66" strokeWidth="0.8" />
    </svg>
  ),
  AgentFlux: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 12c3-3 6-3 9 0s6 3 9 0" stroke="#0E7C66" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M3 7c3-3 6-3 9 0s6 3 9 0" stroke="#0E7C66" strokeWidth="1" strokeLinecap="round" strokeOpacity="0.5" />
      <path d="M3 17c3-3 6-3 9 0s6 3 9 0" stroke="#0E7C66" strokeWidth="1" strokeLinecap="round" strokeOpacity="0.5" />
    </svg>
  ),
  AgentEcho: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="2" fill="#0E7C66" />
      <circle cx="12" cy="12" r="6" stroke="#0E7C66" strokeWidth="1.2" />
      <circle cx="12" cy="12" r="10" stroke="#0E7C66" strokeWidth="0.8" strokeDasharray="2 3" />
    </svg>
  ),
};

const AGENT_ICON_MAP: Record<AgentIconKey, () => JSX.Element> = {
  prism: Icon.AgentPrism,
  vega: Icon.AgentVega,
  oracle: Icon.AgentOracle,
  helix: Icon.AgentHelix,
  nexus: Icon.AgentNexus,
  flux: Icon.AgentFlux,
  echo: Icon.AgentEcho,
};

/* ----------------------------- helpers ---------------------------- */

function useReveal(): void {
  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;
    const els = document.querySelectorAll<HTMLElement>('.reveal');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function useScrolled(): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = (): void => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return scrolled;
}

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

/* ----------------------------- main component ---------------------------- */

export default function MedPayLandingPage(): JSX.Element {
  useReveal();
  const scrolled = useScrolled();

  // ROI calculator state — 5-input funnel
  const [leads, setLeads] = useState<number>(180);          // inbound leads / month
  const [qualifiedRate, setQualifiedRate] = useState<number>(50); // % of inbound that qualify
  const [closeRate, setCloseRate] = useState<number>(45);   // % of qualifieds → yes-to-treatment
  const [fundedRate, setFundedRate] = useState<number>(70); // % of closes that fund via MedPay
  const [ticket, setTicket] = useState<number>(8000);       // avg ticket $

  // WITH MedPay: leads × qualified% × close% × funded%
  const withFundedPerMonth = Math.round(
    leads * (qualifiedRate / 100) * (closeRate / 100) * (fundedRate / 100)
  );
  const withFundedPerYear = withFundedPerMonth * 12;
  const withRevenueAnnual = withFundedPerYear * ticket;

  // WITHOUT MedPay: industry baseline ~18% close rate (no pre-qual + no instant decision).
  // No financing step — the close rate IS the funnel since there's no "fund" gate.
  const WITHOUT_CLOSE_RATE = 18; // %
  const withoutFundedPerMonth = Math.round(
    leads * (qualifiedRate / 100) * (WITHOUT_CLOSE_RATE / 100)
  );
  const withoutFundedPerYear = withoutFundedPerMonth * 12;
  const withoutRevenueAnnual = withoutFundedPerYear * ticket;

  const deltaRevenue = Math.max(0, withRevenueAnnual - withoutRevenueAnnual);
  const deltaPatients = Math.max(0, withFundedPerYear - withoutFundedPerYear);

  // Objections accordion state
  const [openIdx, setOpenIdx] = useState<number>(0);

  // Faux live decision-time counter for hero stat strip
  const [decisionMs, setDecisionMs] = useState<number>(11);
  useEffect(() => {
    const id = setInterval(() => {
      setDecisionMs((prev) => {
        const drift = Math.round((Math.random() - 0.5) * 4);
        const next = prev + drift;
        if (next < 7) return 7;
        if (next > 18) return 18;
        return next;
      });
    }, 1800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="medpay-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* ============================== NAV ============================== */}
      <header className={`mp-nav ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="mp-nav-inner">
          <a href="#" className="mp-brand" aria-label="MedPay home">
            <span className="mp-brand-mark">
              <Icon.Logo />
            </span>
            <span className="mp-brand-word">
              MedPay<span className="mp-brand-sub">/Patient Financing</span>
            </span>
          </a>
          <nav className="mp-nav-links" aria-label="Primary">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href}>
                {l.label}
              </a>
            ))}
          </nav>
          <div className="mp-nav-cta">
            <a href="/apply/medpay" className="btn-ghost-teal">
              See the patient flow
            </a>
            <a href="/welcome" className="btn-primary-teal">
              Start MedPay signup
            </a>
          </div>
        </div>
      </header>

      {/* ============================== HERO ============================== */}
      <section className="mp-hero noise">
        <div className="absolute inset-0 ambient-mesh" aria-hidden />
        <div className="absolute inset-0 ambient-grid-teal" aria-hidden />

        <div className="mp-container">
          <div className="mp-hero-grid">
            {/* LEFT: headline + ctas + live stat strip */}
            <div className="mp-hero-left">
              <div className="mp-eyebrow-pill">
                <span className="mp-pulse-dot" />
                FOR DENTAL · MED SPA · DERM · VET · VISION
              </div>

              <h1 className="mp-h1">
                <span className="grad-teal">Every patient gets</span>
                <br />
                <span className="grad-teal-deep">an instant</span>{' '}
                <span className="grad-teal">financing</span>
                <br />
                <span className="grad-teal-deep">decision.</span>
              </h1>

              <p className="mp-hero-sub">
                Pre-qualification agents and the lending waterfall run <strong>in synchrony</strong>.
                Software agents qualify every inbound application silently on the <strong>financial data</strong>
                {' '}— soft-pull credit, identity, propensity — so your team&apos;s calendar fills with patients
                who can <strong>actually afford treatment</strong>. The marketplace then returns an{' '}
                <strong>instant multi-offer decision</strong> at the chair, the close happens on the same visit,
                and funds settle <strong>merchant-direct, generally within 48 to 72 hours</strong> of the
                loan settling. All under one signup.
              </p>

              <div className="mp-hero-ctas">
                <a href="/welcome" className="btn-primary-teal lg">
                  Approve more patients
                  <Icon.Arrow />
                </a>
                <a href="#financing" className="btn-ghost-teal lg">
                  See the marketplace
                </a>
              </div>

              {/* live financing strip */}
              <div className="mp-hero-strip">
                <div>
                  <div className="strip-val">
                    $4.8<span className="strip-unit">M</span>
                  </div>
                  <div className="strip-label">Funded · last 30 days</div>
                </div>
                <div>
                  <div className="strip-val">
                    Soft<span className="strip-unit"> pull</span>
                  </div>
                  <div className="strip-label">Fundability tier · zero credit impact</div>
                </div>
                <div>
                  <div className="strip-val">
                    {decisionMs}
                    <span className="strip-unit">s</span>
                  </div>
                  <div className="strip-label">
                    Avg decision time
                    <span className="strip-live">
                      <span className="strip-live-dot" /> live
                    </span>
                  </div>
                </div>
                <div>
                  <div className="strip-val">
                    52<span className="strip-unit"> lenders</span>
                  </div>
                  <div className="strip-label">Parallel waterfall</div>
                </div>
              </div>
            </div>

            {/* RIGHT: floating offer card + chips + ambient particles */}
            <div className="mp-hero-right">
              <div className="mp-hero-stage">
                {/* halo */}
                <div className="mp-halo" aria-hidden />
                {/* pixel grid behind card */}
                <div className="mp-pixel-grid" aria-hidden>
                  {Array.from({ length: 192 }).map((_, i) => (
                    <span key={i} className={`px ${[7, 18, 33, 47, 62, 81, 102, 119, 138, 155, 171].includes(i) ? 'fired' : ''}`} />
                  ))}
                </div>

                {/* primary offer card */}
                <div className="mp-offer-card glass-teal-hi reveal">
                  <div className="mp-offer-head">
                    <div className="mp-offer-tag">
                      <span className="mp-pulse-dot" />
                      MEDPAY · APPROVED
                    </div>
                    <div className="mp-offer-id">OFFER #84221</div>
                  </div>
                  <div className="mp-offer-title">Implant consult · approved</div>
                  <div className="mp-offer-amount">
                    $12,000
                    <span className="mp-offer-amount-sub">approved</span>
                  </div>

                  <div className="mp-offer-row">
                    <div>
                      <div className="mp-offer-row-k">Est. monthly</div>
                      <div className="mp-offer-row-v">$250<span className="dim"> · 48 mo</span></div>
                    </div>
                    <div>
                      <div className="mp-offer-row-k">APR</div>
                      <div className="mp-offer-row-v">6.9%</div>
                    </div>
                    <div>
                      <div className="mp-offer-row-k">Lender</div>
                      <div className="mp-offer-row-v sm">Cross River Bank</div>
                    </div>
                  </div>

                  <div className="mp-offer-bar">
                    <div className="mp-offer-bar-track">
                      <div className="mp-offer-bar-fill" />
                    </div>
                    <div className="mp-offer-bar-stages">
                      <span className="on">Pre-qual</span>
                      <span className="on">Marketplace</span>
                      <span className="on">Offer</span>
                      <span className="on">E-sign</span>
                      <span className="cur">Disburse</span>
                    </div>
                  </div>

                  <button className="mp-offer-cta" type="button">
                    Accept offer · e-sign
                    <Icon.Arrow />
                  </button>

                  <div className="mp-offer-foot">
                    <span>
                      <Icon.Shield /> Soft pull · 0 credit impact
                    </span>
                    <span>
                      <Icon.Bolt /> Merchant-direct · 48-72hr payout
                    </span>
                  </div>
                </div>

                {/* live stat panel (sits beside card on wide) */}
                <div className="mp-hero-side-stat glass-teal reveal">
                  <div className="mp-side-eyebrow">LIVE · MARKETPLACE</div>
                  <div className="mp-side-grid">
                    <div>
                      <div className="mp-side-val">52</div>
                      <div className="mp-side-label">Lenders quoting</div>
                    </div>
                    <div>
                      <div className="mp-side-val">from 5.9%</div>
                      <div className="mp-side-label">APR (qualifying)</div>
                    </div>
                    <div>
                      <div className="mp-side-val">$3k to $50k</div>
                      <div className="mp-side-label">Loan range</div>
                    </div>
                    <div>
                      <div className="mp-side-val">up to 60 mo</div>
                      <div className="mp-side-label">Terms</div>
                    </div>
                  </div>
                  <div className="mp-side-divider" />
                  <div className="mp-side-footrow">
                    <span className="mp-side-rail">
                      <span className="mp-pulse-dot" />
                      Merchant-direct payout · 48-72hr after settlement
                    </span>
                  </div>
                </div>

                {/* floating data chips */}
                {HERO_CHIPS.map((c, i) => (
                  <div
                    key={i}
                    className="mp-chip"
                    style={{
                      top: c.top,
                      bottom: c.bottom,
                      left: c.left,
                      right: c.right,
                      animationDelay: c.delay,
                    }}
                  >
                    <span className="mp-chip-k">{c.k}</span>
                    <span className="mp-chip-v">{c.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ============================== TICKER ============================== */}
          <div className="mp-ticker reveal" id="ticker">
            {TICKER.map((t, i) => (
              <div key={i} className="mp-ticker-cell">
                <div className="mp-ticker-val">{t.value}</div>
                <div className="mp-ticker-lab">{t.label}</div>
                <div className="mp-ticker-delta">
                  <span className="delta-dot" /> {t.delta}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================== PROBLEM ============================== */}
      <section className="mp-problem" id="problem">
        <div className="mp-container">
          <div className="mp-section-head reveal" style={{ maxWidth: '780px' }}>
            <div className="mp-section-tag dark">01 · THE COST OF DOING NOTHING</div>
            <h2 className="mp-h2 light">
              Every patient who says <em>&ldquo;let me think about it&rdquo;</em> walks out with $4,200 in your treatment plan{' '}
              <span className="grad-text-warning">unfunded.</span>
            </h2>
            <p className="mp-section-body light">
              A 3-chair practice averages <strong>$1.4M/yr</strong> in case acceptance lost to financing friction. The
              objection isn&apos;t price. It&apos;s cash-flow. Patients don&apos;t carry $12k. Without a yes-able monthly number on
              the spot, the implant case becomes &ldquo;I&apos;ll call you back.&rdquo;
            </p>
          </div>

          <div className="mp-compare reveal">
            <div className="mp-compare-card mp-compare-quo">
              <div className="mp-compare-eyebrow muted">STATUS QUO · WITHOUT MEDPAY</div>
              <ul className="mp-compare-list">
                {STATUS_QUO.map((row, i) => (
                  <li key={i}>
                    <span className="mp-compare-stat muted">{row.stat}</span>
                    <span className="mp-compare-label">{row.label}</span>
                  </li>
                ))}
              </ul>
              <div className="mp-compare-foot muted">9 failure points · 4-week deal cycle</div>
            </div>

            <div className="mp-compare-divider" aria-hidden>
              <span>vs</span>
            </div>

            <div className="mp-compare-card mp-compare-medpay">
              <div className="mp-compare-eyebrow">WITH MEDPAY · FINANCING ON</div>
              <ul className="mp-compare-list">
                {WITH_MEDPAY.map((row, i) => (
                  <li key={i}>
                    <span className="mp-compare-stat">{row.stat}</span>
                    <span className="mp-compare-label light">{row.label}</span>
                  </li>
                ))}
              </ul>
              <div className="mp-compare-foot light">1 platform · same-day deal cycle</div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================== WATERFALL ============================== */}
      <section className="mp-waterfall" id="how">
        <div className="mp-container">
          <div className="mp-section-head reveal" style={{ maxWidth: '820px' }}>
            <div className="mp-section-tag">02 · HOW IT WORKS</div>
            <h2 className="mp-h2">
              <span className="grad-teal">One platform. Five stages.</span>
              <br />
              <span className="grad-teal-deep">From cold lead to settled deal.</span>
            </h2>
            <p className="mp-section-body">
              The financing waterfall runs end-to-end inside MedPay. Soft-pull pre-qual, the agentic layer
              pre-qualifying every application on the financial data, a marketplace decision engine that fires
              52 lenders in parallel, the best offer winning, and the lender disbursing direct to your business
              account on approval — generally within 48 to 72 hours of settlement.
            </p>
          </div>

          <div className="mp-waterfall-diagram reveal">
            {/* SVG flow with curved connectors */}
            <svg
              viewBox="0 0 1200 360"
              className="mp-waterfall-svg"
              preserveAspectRatio="xMidYMid meet"
              aria-hidden
            >
              <defs>
                <linearGradient id="flowline" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#22B8A0" stopOpacity="0.05" />
                  <stop offset="20%" stopColor="#22B8A0" stopOpacity="0.6" />
                  <stop offset="50%" stopColor="#0E7C66" stopOpacity="0.85" />
                  <stop offset="80%" stopColor="#22B8A0" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#22B8A0" stopOpacity="0.05" />
                </linearGradient>
                <linearGradient id="nodeFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FFFFFF" />
                  <stop offset="100%" stopColor="#ECFFFE" />
                </linearGradient>
                <filter id="nodeshadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="6" stdDeviation="10" floodColor="#0E7C66" floodOpacity="0.18" />
                </filter>
              </defs>

              {/* main flowline: curved */}
              <path
                d="M 80 200 C 220 60, 360 320, 500 180 S 780 60, 920 200 S 1100 320, 1180 200"
                fill="none"
                stroke="url(#flowline)"
                strokeWidth="3"
                strokeLinecap="round"
                className="mp-flowline"
              />
              <path
                d="M 80 200 C 220 60, 360 320, 500 180 S 780 60, 920 200 S 1100 320, 1180 200"
                fill="none"
                stroke="#22B8A0"
                strokeOpacity="0.0"
                strokeWidth="14"
                strokeLinecap="round"
                className="mp-flowline-glow"
              />
              {/* travelling pulse dot */}
              <circle r="6" fill="#0E7C66" className="mp-flowpulse">
                <animateMotion
                  dur="6s"
                  repeatCount="indefinite"
                  path="M 80 200 C 220 60, 360 320, 500 180 S 780 60, 920 200 S 1100 320, 1180 200"
                />
              </circle>
            </svg>

            {/* the five stage nodes positioned over the SVG */}
            <div className="mp-stages-row">
              {STAGES.map((s) => (
                <div key={s.n} className="mp-stage-node">
                  <div className="mp-stage-num">{s.n}</div>
                  <div className="mp-stage-card">
                    <div className="mp-stage-stage">{s.stage}</div>
                    <div className="mp-stage-title">{s.title}</div>
                    <div className="mp-stage-metric">{s.metric}</div>
                    <div className="mp-stage-body">{s.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================== AGENTIC LAYER ============================== */}
      <section className="mp-agents" id="agents">
        <div className="absolute inset-0 ambient-grid-teal" aria-hidden />
        <div className="mp-container">
          <div className="mp-section-head reveal" style={{ maxWidth: '880px' }}>
            <div className="mp-section-tag">03 · THE AGENTIC LAYER</div>
            <h2 className="mp-h2">
              <span className="grad-teal">Seven agents running every approval</span>
              <br />
              <span className="grad-teal-deep">patient intake to attribution · 24/7.</span>
            </h2>
            <p className="mp-section-body">
              Each agent has a defined role, a defined scope, and a measurable output. They work on the
              financial data &mdash; not on the phone. They don&apos;t replace your team; they replace the
              manual intake reviews, the enrichment vendor sprawl, the lender-routing back-and-forth, the
              failed-ACH chase, and the broken pixel feedback loop your ad account is starving on. Every
              action is logged, explainable, and FCRA-aware.
            </p>
          </div>

          <div className="mp-agents-grid reveal">
            {AGENTS.map((a) => {
              const AgentIco = AGENT_ICON_MAP[a.iconKey];
              const isEcho = a.iconKey === 'echo';
              const spanClass = `span-${a.span}`;
              return (
                <article
                  key={a.code}
                  className={`mp-agent-card glass-teal ${spanClass} ${isEcho ? 'is-wide is-echo' : ''}`}
                >
                  {isEcho ? (
                    <div className="mp-agent-echo-grid">
                      <div className="mp-agent-echo-left">
                        <div className="mp-agent-head">
                          <div className="mp-agent-head-left">
                            <div className="mp-agent-icon glass-teal-hi">
                              <span className="mp-agent-pulse" />
                              <AgentIco />
                            </div>
                            <div className="mp-agent-titlewrap">
                              <div className="mp-agent-eyebrow">Agent {a.n}</div>
                              <h3 className="mp-agent-titlerow">
                                <span className="mp-agent-code">{a.code}</span>
                                <span className="mp-agent-role"> · {a.role}</span>
                              </h3>
                            </div>
                          </div>
                          <div className={`mp-agent-status status-${a.status.toLowerCase()}`}>
                            <span className="mp-agent-status-dot" />
                            {a.status}
                          </div>
                        </div>
                        <p className="mp-agent-desc">{a.description}</p>
                        <div className="mp-agent-lastaction">
                          <span className="mp-agent-lastaction-k">last action:</span> {a.lastAction}
                        </div>
                      </div>
                      <div className="mp-agent-echo-right">
                        <div className="mp-agents-stream glass-teal-hi">
                          <div className="mp-agents-stream-head">
                            <span className="mp-agents-stream-eyebrow">ECHO · live event stream</span>
                            <span className="mp-agents-stream-meta">events/min · 142</span>
                          </div>
                          <div className="mp-agents-stream-list">
                            {ECHO_STREAM.map((e, i) => (
                              <div
                                key={i}
                                className={`mp-agents-stream-row ${e.muted ? 'is-muted' : ''} ${
                                  i === ECHO_STREAM.length - 1 ? 'is-last' : ''
                                }`}
                              >
                                <span className="mp-agents-stream-event">{e.event}</span>
                                <span className="mp-agents-stream-route">{e.route}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="mp-agent-head">
                        <div className="mp-agent-head-left">
                          <div className="mp-agent-icon glass-teal-hi">
                            <span className="mp-agent-pulse" />
                            <AgentIco />
                          </div>
                          <div className="mp-agent-titlewrap">
                            <div className="mp-agent-eyebrow">Agent {a.n}</div>
                            <h3 className="mp-agent-titlerow">
                              <span className="mp-agent-code">{a.code}</span>
                              <span className="mp-agent-role"> · {a.role}</span>
                            </h3>
                          </div>
                        </div>
                        <div className={`mp-agent-status status-${a.status.toLowerCase()}`}>
                          <span className="mp-agent-status-dot" />
                          {a.status}
                        </div>
                      </div>

                      <p className="mp-agent-desc">{a.description}</p>

                      {a.stats.length > 0 && (
                        <div
                          className="mp-agent-stats"
                          style={{ gridTemplateColumns: `repeat(${a.stats.length}, 1fr)` }}
                        >
                          {a.stats.map((s) => (
                            <div key={s.k} className="mp-agent-stat">
                              <div className="mp-agent-stat-label">{s.k}</div>
                              <div className="mp-agent-stat-value">{s.v}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="mp-agent-lastaction">
                        <span className="mp-agent-lastaction-k">last action:</span> {a.lastAction}
                      </div>
                    </>
                  )}
                </article>
              );
            })}
          </div>

          <div className="mp-agents-coord reveal">
            <div className="mp-agents-coord-left">
              <div className="mp-agents-coord-icon">
                <Icon.Hub />
              </div>
              <div>
                <div className="mp-agents-coord-eyebrow">Coordination layer</div>
                <div className="mp-agents-coord-title">
                  All seven agents share a common event bus, a shared memory store, and a unified observability plane.
                </div>
              </div>
            </div>
            <a href="#cta" className="btn-ghost-teal mp-agents-coord-cta">
              See agents in action
              <Icon.Arrow />
            </a>
          </div>

          <div className="mp-agent-foot reveal">
            <Icon.Shield />
            <span>
              Every agent action is FCRA permissible-purpose-aware and logged to an immutable audit trail.
            </span>
          </div>
        </div>
      </section>

      {/* ============================== PILLARS ============================== */}
      <section className="mp-pillars" id="pillars">
        <div className="mp-container">
          <div className="mp-section-head reveal" style={{ maxWidth: '820px' }}>
            <div className="mp-section-tag">04 · THE PLATFORM</div>
            <h2 className="mp-h2">
              <span className="grad-teal">Financing is the engine.</span>
              <br />
              <span className="grad-teal-deep">The agentic layer comes standard.</span>
            </h2>
            <p className="mp-section-body">
              MedPay is built around the financing marketplace. That&apos;s the revenue unlock. The agentic layer is
              bundled in the same signup, so you don&apos;t need to stitch a separate answering service, lead-qualifying
              tool, or attribution stack onto your finance funnel.
            </p>
          </div>

          {/* PILLAR 01: FINANCING: DOMINANT */}
          <div className="mp-pillar dominant reveal" id="financing">
            <div className="mp-pillar-grid dominant-grid">
              {/* LEFT: copy */}
              <div className="mp-pillar-copy">
                <div className="mp-pillar-badge primary">
                  <span className="mp-pillar-num">01</span>
                  <span>Pillar one · Financing</span>
                  <span className="mp-pillar-tag primary">THE ENGINE</span>
                </div>
                <h3 className="mp-pillar-title">
                  Instant decisions on <span className="num-tone">$3k to $50k</span> tickets. A real marketplace, not a
                  single lender.
                </h3>
                <p className="mp-pillar-body">
                  MedPay plugs into multiple lender marketplaces (engine.tech, HSP Medical, EazePay Direct) and runs a
                  parallel waterfall on every application. Patient gets an instant decision with multiple offers ranked
                  to their personal situation. You&apos;re paid in full when the lender disburses, merchant-direct, no
                  intermediary holding funds. No clawback for routine defaults.
                </p>
                <ul className="mp-pillar-bullets">
                  {[
                    'Loans $3,000 to $50,000 · soft pull at the chair · zero credit impact',
                    'APR from 5.9% for qualifying clients · terms up to 60 months',
                    '0% interest plans available for qualifying programs · T&Cs apply',
                    'Instant decision · three best-fit offers ranked by total cost',
                    'Merchant-direct payout · funds land generally within 48 to 72 hours',
                    'Lender carries the credit risk · no clawback on routine defaults',
                    'Premium patient experience · clean accept-and-go flow',
                    '52 lenders quoted in parallel · 5-second SLA per round-trip',
                  ].map((b, i) => (
                    <li key={i}>
                      <span className="mp-bullet-tick">
                        <Icon.Check />
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>
                <div className="mp-pillar-roi primary">
                  <Icon.Bolt />
                  <span>Higher same-day close on implant consults</span>
                </div>
              </div>

              {/* RIGHT: mockup, offer comparison card */}
              <div className="mp-pillar-mock dominant-mock">
                <div className="mock-frame">
                  <div className="mock-frame-head">
                    <div className="mock-dots">
                      <span /> <span /> <span />
                    </div>
                    <div className="mock-frame-title">patient.medpay.app · Atlas Dental</div>
                    <div className="mock-frame-lock">
                      <Icon.Shield />
                      <span>secured</span>
                    </div>
                  </div>

                  <div className="mock-body">
                    <div className="mock-greet">Welcome, M. Alvarez · approved for $12,000</div>
                    <div className="mock-sub">
                      52 lenders quoted in parallel. Your three best offers, ranked by total cost.
                    </div>

                    {/* waterfall mini-bar */}
                    <div className="mock-waterfall">
                      <div className="mock-waterfall-bar">
                        <span className="seg seg-quoted">48 quoted</span>
                        <span className="seg seg-approved">39 approved</span>
                        <span className="seg seg-best">3 surfaced</span>
                      </div>
                      <div className="mock-waterfall-meta">52 lenders · 4.8s round-trip · soft pull only</div>
                    </div>

                    {/* offer rows */}
                    <div className="mock-offers">
                      {OFFERS.map((o, i) => (
                        <div key={i} className={`mock-offer ${o.recommended ? 'is-best' : ''}`}>
                          <div className="mock-offer-left">
                            <div className="mock-offer-lender">
                              {o.recommended && (
                                <span className="mock-best">
                                  <Icon.Star /> Best
                                </span>
                              )}
                              <span className="mock-offer-label">{o.label}</span>
                            </div>
                            <div className="mock-offer-note">{o.note ?? `${o.term} · ${o.apr}`}</div>
                          </div>
                          <div className="mock-offer-right">
                            <div className="mock-offer-monthly">{o.monthly}<span className="dim">/mo</span></div>
                            <div className="mock-offer-meta">{o.term} · {o.apr}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mock-cta-row">
                      <button className="mock-cta-primary" type="button">
                        Accept · e-sign now
                      </button>
                      <button className="mock-cta-ghost" type="button">
                        See all 39 offers
                      </button>
                    </div>

                    <div className="mock-foot">
                      Soft credit pull only · 0 impact to score · final terms and lender confirmed at e-sign.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ============== SYNERGY CALLOUT ============== */}
          <div className="mp-synergy reveal">
            <div className="mp-synergy-grid">
              <div className="mp-synergy-side">
                <div className="mp-synergy-eyebrow">
                  <Icon.Hub />
                  THE SYNERGY
                </div>
                <h3 className="mp-synergy-h">
                  <span className="grad-teal">Your financial filter.</span>{' '}
                  <span className="grad-teal-deep">Your closer.</span>
                </h3>
                <div className="mp-synergy-pair">
                  <div className="mp-synergy-half">
                    <div className="mp-synergy-half-k">Agentic layer</div>
                    <div className="mp-synergy-half-v">The financial filter</div>
                  </div>
                  <div className="mp-synergy-x">&times;</div>
                  <div className="mp-synergy-half">
                    <div className="mp-synergy-half-k">Lending waterfall</div>
                    <div className="mp-synergy-half-v">The closer</div>
                  </div>
                </div>
              </div>
              <div className="mp-synergy-body">
                <p>
                  Software agents work silently on every inbound application &mdash; soft-pull credit, identity
                  enrichment, propensity scoring &mdash; and surface only the financially-qualified prospects
                  to your front desk. Your consult slots fill up with patients who can actually afford treatment.
                  The lending waterfall then returns an instant multi-offer decision at the chair. Your team
                  converts on the same visit instead of chasing payment plans over two weeks.
                </p>
              </div>
            </div>
          </div>

          {/* ============== CALENDAR QUALITY + PIXEL FEEDBACK LOOP ============== */}
          <div className="mp-calendar reveal" id="calendar-quality">
            <div className="mp-calendar-head">
              <div className="mp-section-tag" style={{ marginBottom: 14 }}>04A &middot; CALENDAR QUALITY</div>
              <h3 className="mp-calendar-h">
                <span className="grad-teal">Fill your calendar with buyers.</span>{' '}
                <span className="grad-teal-deep">Not fillers.</span>
              </h3>
              <p className="mp-calendar-sub">
                Your pixel learns what a funded patient looks like.
              </p>
            </div>

            <div className="mp-calendar-grid">
              {/* LEFT: Calendar quality */}
              <div className="mp-calendar-card">
                <div className="mp-calendar-card-eyebrow">
                  <Icon.Bolt />
                  CONSULT SLOT ECONOMICS
                </div>
                <h4 className="mp-calendar-card-h">Every 30-minute slot is finite and expensive.</h4>
                <p className="mp-calendar-card-body">
                  A consult with a prospect who can&apos;t afford the treatment is 30 minutes not spent with a
                  patient who can. Pre-qualifying on the financial data &mdash; before the slot is even
                  booked &mdash; means your team only sees prospects who can fund.
                </p>

                {/* mini calendar visualization */}
                <div className="mp-calendar-cal">
                  <div className="mp-calendar-cal-head">
                    <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span>
                  </div>
                  <div className="mp-calendar-cal-body">
                    {Array.from({ length: 25 }).map((_, i) => {
                      // ~30% disqualified in pre-MedPay world, near 0 post
                      const disq = [2, 5, 9, 12, 16, 19, 22].includes(i);
                      const buyer = !disq;
                      return (
                        <div
                          key={i}
                          className={`mp-calendar-cal-slot ${buyer ? 'buyer' : 'filler'}`}
                          title={buyer ? 'Funded buyer' : 'Filler · can’t afford treatment'}
                        >
                          <span className="mp-calendar-cal-dot" />
                        </div>
                      );
                    })}
                  </div>
                  <div className="mp-calendar-cal-legend">
                    <span className="lg-buyer"><span className="lg-dot" /> Funded buyer</span>
                    <span className="lg-filler"><span className="lg-dot" /> Filler &mdash; can&apos;t fund</span>
                  </div>
                </div>
              </div>

              {/* RIGHT: Pixel feedback loop */}
              <div className="mp-calendar-card pixel">
                <div className="mp-calendar-card-eyebrow">
                  <Icon.Spark />
                  PIXEL FEEDBACK LOOP &middot; ECHO
                </div>
                <h4 className="mp-calendar-card-h">Train your pixel on funded patients, not form fills.</h4>
                <p className="mp-calendar-card-body">
                  ECHO holds pixel events until a lead actually clears the financial qualification, then fires
                  weighted conversions back to Meta and Google via server-side CAPI. Over time, the ad
                  platforms learn what a <em>funded patient</em> looks like and the algorithms get smarter at
                  finding more of them. Your ad spend gets more efficient month over month &mdash; not because
                  you upped budgets, but because you trained your pixel on real buyers.
                </p>

                {/* loop visualization */}
                <div className="mp-pixel-loop">
                  <div className="mp-pixel-loop-row">
                    <span className="mp-pixel-step n1">01</span>
                    <span className="mp-pixel-step-label">Lead clicks ad</span>
                  </div>
                  <div className="mp-pixel-loop-row">
                    <span className="mp-pixel-step n2">02</span>
                    <span className="mp-pixel-step-label">Agents pre-qualify on financial data</span>
                  </div>
                  <div className="mp-pixel-loop-row">
                    <span className="mp-pixel-step n3">03</span>
                    <span className="mp-pixel-step-label">Funded? &rarr; weighted CAPI event fires</span>
                  </div>
                  <div className="mp-pixel-loop-row">
                    <span className="mp-pixel-step n4">04</span>
                    <span className="mp-pixel-step-label">Meta &amp; Google retrain on real buyers</span>
                  </div>
                  <div className="mp-pixel-loop-row last">
                    <span className="mp-pixel-step n5">05</span>
                    <span className="mp-pixel-step-label">CPA falls &mdash; same budget, more funded patients</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ============================== ROI CALCULATOR ============================== */}
      <section className="mp-roi" id="roi">
        <div className="mp-container">
          <div className="mp-section-head reveal" style={{ maxWidth: '720px' }}>
            <div className="mp-section-tag">05 · YOUR NUMBERS</div>
            <h2 className="mp-h2">
              <span className="grad-teal">What MedPay would do</span>{' '}
              <span className="grad-teal-deep">for your practice.</span>
            </h2>
            <p className="mp-section-body">
              Drop in your funnel. We model what you&apos;d recover with MedPay vs. without. Illustrative
              based on your inputs &mdash; not a guarantee of returns.
            </p>
          </div>

          <div className="mp-roi-card-wrap reveal">
            <div className="mp-roi-grid">
              {/* LEFT: 5 dense sliders */}
              <div className="mp-roi-inputs">
                <div className="mp-roi-inputs-head">
                  <span className="mp-roi-eyebrow-light">YOUR FUNNEL</span>
                  <span className="mp-roi-inputs-meta">5 inputs · live</span>
                </div>

                <div className="mp-roi-row">
                  <div className="mp-roi-label">
                    <span>Inbound leads / month</span>
                    <span className="mp-roi-val">{leads}</span>
                  </div>
                  <input
                    id="roi-leads"
                    type="range"
                    min={20}
                    max={1000}
                    step={5}
                    value={leads}
                    onChange={(e) => setLeads(Number(e.target.value))}
                    className="mp-slider"
                  />
                  <div className="mp-slider-scale">
                    <span>20</span>
                    <span>1,000</span>
                  </div>
                </div>

                <div className="mp-roi-row">
                  <div className="mp-roi-label">
                    <span>Qualified lead %</span>
                    <span className="mp-roi-val">{qualifiedRate}%</span>
                  </div>
                  <input
                    id="roi-qual"
                    type="range"
                    min={10}
                    max={90}
                    step={1}
                    value={qualifiedRate}
                    onChange={(e) => setQualifiedRate(Number(e.target.value))}
                    className="mp-slider"
                  />
                  <div className="mp-slider-scale">
                    <span>10%</span>
                    <span>90%</span>
                  </div>
                </div>

                <div className="mp-roi-row">
                  <div className="mp-roi-label">
                    <span>Close rate (qualifieds &rarr; yes)</span>
                    <span className="mp-roi-val">{closeRate}%</span>
                  </div>
                  <input
                    id="roi-close"
                    type="range"
                    min={5}
                    max={90}
                    step={1}
                    value={closeRate}
                    onChange={(e) => setCloseRate(Number(e.target.value))}
                    className="mp-slider"
                  />
                  <div className="mp-slider-scale">
                    <span>5%</span>
                    <span>90%</span>
                  </div>
                </div>

                <div className="mp-roi-row">
                  <div className="mp-roi-label">
                    <span>Funded rate (closes &rarr; accept finance)</span>
                    <span className="mp-roi-val">{fundedRate}%</span>
                  </div>
                  <input
                    id="roi-funded"
                    type="range"
                    min={10}
                    max={95}
                    step={1}
                    value={fundedRate}
                    onChange={(e) => setFundedRate(Number(e.target.value))}
                    className="mp-slider"
                  />
                  <div className="mp-slider-scale">
                    <span>10%</span>
                    <span>95%</span>
                  </div>
                </div>

                <div className="mp-roi-row">
                  <div className="mp-roi-label">
                    <span>Avg treatment ticket</span>
                    <span className="mp-roi-val">{fmtUsd(ticket)}</span>
                  </div>
                  <input
                    id="roi-ticket"
                    type="range"
                    min={3000}
                    max={50000}
                    step={500}
                    value={ticket}
                    onChange={(e) => setTicket(Number(e.target.value))}
                    className="mp-slider"
                  />
                  <div className="mp-slider-scale">
                    <span>$3,000</span>
                    <span>$50,000</span>
                  </div>
                </div>
              </div>

              {/* RIGHT: 2-up Without / With + delta */}
              <div className="mp-roi-outputs">
                <div className="mp-roi-outputs-head">
                  <span className="mp-roi-eyebrow-light">ANNUAL OUTPUT</span>
                  <span className="mp-roi-inputs-meta">illustrative</span>
                </div>

                <div className="mp-roi-compare">
                  <div className="mp-roi-compare-card without">
                    <div className="mp-roi-compare-eyebrow">WITHOUT MEDPAY</div>
                    <div className="mp-roi-compare-meta">{WITHOUT_CLOSE_RATE}% close baseline</div>
                    <div className="mp-roi-compare-block">
                      <div className="mp-roi-compare-num">{fmtUsd(withoutRevenueAnnual)}</div>
                      <div className="mp-roi-compare-lab">recovered revenue / yr</div>
                    </div>
                    <div className="mp-roi-compare-block">
                      <div className="mp-roi-compare-num sm">{withoutFundedPerYear.toLocaleString('en-US')}</div>
                      <div className="mp-roi-compare-lab">funded patients / yr</div>
                    </div>
                  </div>

                  <div className="mp-roi-compare-card with">
                    <div className="mp-roi-compare-eyebrow accent">WITH MEDPAY</div>
                    <div className="mp-roi-compare-meta">your input rates</div>
                    <div className="mp-roi-compare-block">
                      <div className="mp-roi-compare-num accent">{fmtUsd(withRevenueAnnual)}</div>
                      <div className="mp-roi-compare-lab">recovered revenue / yr</div>
                    </div>
                    <div className="mp-roi-compare-block">
                      <div className="mp-roi-compare-num sm accent">{withFundedPerYear.toLocaleString('en-US')}</div>
                      <div className="mp-roi-compare-lab">funded patients / yr</div>
                    </div>
                  </div>
                </div>

                <div className="mp-roi-delta">
                  <div className="mp-roi-delta-main">
                    <span className="mp-roi-delta-tag">DELTA</span>
                    <span className="mp-roi-delta-val">+ {fmtUsd(deltaRevenue)} / year</span>
                  </div>
                  <div className="mp-roi-delta-sub">+ {deltaPatients.toLocaleString('en-US')} funded patients / year</div>
                </div>

                <a href="/welcome" className="btn-primary-teal mp-roi-cta">
                  Lock in this number
                  <Icon.Arrow />
                </a>
              </div>
            </div>

            <div className="mp-roi-foot">
              Illustrative based on your inputs. Actual outcomes vary by practice, geography, and patient mix.
              Not a guarantee of returns. Loans $3,000&ndash;$50,000; APR from 5.9%; terms up to 60 months; 0%
              interest plans available (T&amp;Cs apply).
            </div>
          </div>
        </div>
      </section>

      {/* ============================== CASE STUDIES ============================== */}
      <section className="mp-stories" id="stories">
        <div className="mp-container">
          <div className="mp-section-head reveal" style={{ maxWidth: '820px' }}>
            <div className="mp-section-tag">06 · CASE STUDIES</div>
            <h2 className="mp-h2">
              <span className="grad-teal">Practices that turned</span>{' '}
              <span className="grad-teal-deep">&ldquo;let me think about it&rdquo;</span>{' '}
              <span className="grad-teal">into approved.</span>
            </h2>
          </div>

          <div className="mp-stories-grid reveal">
            {CASES.map((c, i) => (
              <article key={i} className="mp-story-card">
                <div className="mp-story-tag">{c.primaryTag}</div>
                <blockquote className="mp-story-quote">&ldquo;{c.quote}&rdquo;</blockquote>
                <div className="mp-story-outcomes">
                  {c.outcomes.map((o, j) => (
                    <div key={j} className="mp-story-outcome">
                      <div className="mp-story-out-val">{o.value}</div>
                      <div className="mp-story-out-lab">{o.label}</div>
                    </div>
                  ))}
                </div>
                <div className="mp-story-attrib">
                  <div className="mp-story-avatar">{c.name.split(' ').map((s) => s[0]).join('').slice(0, 2)}</div>
                  <div>
                    <div className="mp-story-name">{c.name}</div>
                    <div className="mp-story-role">{c.role}</div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ============================== INTEGRATIONS MARQUEE ============================== */}
      <section className="mp-integrations">
        <div className="mp-container">
          <div className="mp-integrations-head reveal">
            <span className="mp-section-tag muted-tag">07 · BUILT ON RAILS YOU TRUST</span>
            <span className="mp-integrations-sub">
              Bank-grade partners. Direct integrations. No reseller mark-up.
            </span>
          </div>
          <div className="mp-marquee">
            <div className="mp-marquee-track">
              {INTEGRATIONS.concat(INTEGRATIONS).map((logo, i) => (
                <span key={i} className="mp-marquee-cell">
                  {logo}
                  <span className="mp-marquee-dot" aria-hidden>
                    ·
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================== OBJECTIONS ============================== */}
      <section className="mp-faq" id="faq">
        <div className="mp-container">
          <div className="mp-faq-grid reveal">
            <div className="mp-faq-left">
              <div className="mp-section-tag">08 · OBJECTIONS</div>
              <h2 className="mp-h2 left">
                <span className="grad-teal">The five things</span>
                <br />
                <span className="grad-teal-deep">every practice asks first.</span>
              </h2>
              <p className="mp-section-body" style={{ marginTop: '20px' }}>
                Financing is the lead. Everything else is built so it works at the chair. Here are the questions clinic
                owners ask before they sign. Answered straight.
              </p>
              <a href="/welcome" className="btn-primary-teal" style={{ marginTop: '28px' }}>
                Start your signup
                <Icon.Arrow />
              </a>
            </div>
            <div className="mp-faq-list">
              {OBJECTIONS.map((o, i) => {
                const isOpen = openIdx === i;
                return (
                  <div key={i} className={`mp-faq-item ${isOpen ? 'is-open' : ''}`}>
                    <button
                      type="button"
                      className="mp-faq-q"
                      onClick={() => setOpenIdx(isOpen ? -1 : i)}
                      aria-expanded={isOpen}
                    >
                      <span>{o.q}</span>
                      <span className="mp-faq-toggle" aria-hidden>
                        {isOpen ? <Icon.Minus /> : <Icon.Plus />}
                      </span>
                    </button>
                    {isOpen && <div className="mp-faq-a">{o.a}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ============================== FINAL CTA ============================== */}
      <section className="mp-final">
        <div className="absolute inset-0 ambient-mesh-final" aria-hidden />
        <div className="absolute inset-0 ambient-grid-teal" aria-hidden />
        <div className="mp-container relative">
          <div className="mp-final-inner reveal">
            <div className="mp-final-eyebrow">
              <span className="mp-pulse-dot" />
              READY · KYB CLEARS IN 60 SECONDS
            </div>
            <h2 className="mp-final-h">
              <span className="grad-teal">Approve more patients.</span>
              <br />
              <span className="grad-teal-deep">Instantly.</span>
            </h2>
            <p className="mp-final-body">
              Sign up in 5 minutes. KYB clears in 60 seconds. Instant decisions at the chair, payouts
              merchant-direct, generally <strong>within 48 to 72 hours</strong> of the loan settling.
            </p>
            <div className="mp-final-ctas">
              <a href="/welcome" className="btn-primary-teal xl">
                Start MedPay signup
                <Icon.Arrow />
              </a>
              <a href="/apply/medpay" className="btn-ghost-teal xl">
                See a patient flow first
              </a>
            </div>
            <div className="mp-final-foot">
              No credit card · 5-minute setup · hands-on migration if you have a current finance partner.
            </div>
          </div>
        </div>
      </section>

      {/* ============================== FOOTER ============================== */}
      <footer className="mp-footer">
        <div className="mp-container">
          <div className="mp-footer-inner">
            <div className="mp-footer-brand">
              <span className="mp-brand-mark sm">
                <Icon.Logo />
              </span>
              <span className="mp-footer-word">MedPay</span>
              <span className="mp-footer-by">by EazePay</span>
            </div>
            <div className="mp-footer-links">
              <a href="/legal/privacy">Privacy</a>
              <a href="/legal/terms">Terms</a>
              <a href="/legal/disclosures">Disclosures</a>
              <a href="/legal/licenses">Licenses</a>
            </div>
            <div className="mp-footer-copy">© 2026 EazePay · MedPay</div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ----------------------------- styles ---------------------------- */

const CSS = `
:root {
  --mp-teal: #0E7C66;
  --mp-teal-2: #22B8A0;
  --mp-teal-light: #ECFFFE;
  --mp-deep: #062C29;
  --mp-ink: #0A1F1D;
  --mp-ink-2: #163936;
  --mp-mute: #4B6864;
  --mp-line: rgba(14, 124, 102, 0.12);
  --mp-line-strong: rgba(14, 124, 102, 0.22);
}

.medpay-root {
  background: linear-gradient(180deg, #ECFFFE 0%, #FFFFFF 30%, #F3FBFA 65%, #FFFFFF 100%);
  color: var(--mp-ink);
  font-family: inherit;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
  min-height: 100vh;
}
.medpay-root * { box-sizing: border-box; }
.medpay-root a { color: inherit; text-decoration: none; }
.medpay-root button { font-family: inherit; cursor: pointer; }

.mp-container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 32px;
  width: 100%;
  position: relative;
}

/* ============== AMBIENT BACKGROUNDS ============== */
.ambient-mesh {
  background:
    radial-gradient(ellipse 80% 60% at 50% 0%, rgba(34, 184, 160, 0.35), transparent 60%),
    radial-gradient(ellipse 60% 50% at 80% 70%, rgba(14, 124, 102, 0.25), transparent 60%),
    radial-gradient(ellipse 50% 40% at 15% 60%, rgba(236, 255, 254, 0.6), transparent 60%);
  pointer-events: none;
}
.ambient-mesh-final {
  background:
    radial-gradient(ellipse 70% 70% at 50% 0%, rgba(14, 124, 102, 0.30), transparent 60%),
    radial-gradient(ellipse 50% 60% at 80% 80%, rgba(34, 184, 160, 0.25), transparent 60%);
  pointer-events: none;
}
.ambient-grid-teal {
  background-image:
    linear-gradient(rgba(14, 124, 102, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(14, 124, 102, 0.05) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: radial-gradient(ellipse at center, black 40%, transparent 80%);
  pointer-events: none;
}
.noise { position: relative; }
.noise::before {
  content: "";
  position: absolute; inset: 0;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/><feColorMatrix values='0 0 0 0 0.05  0 0 0 0 0.18  0 0 0 0 0.15  0 0 0 0.03 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
  opacity: 0.6; pointer-events: none; mix-blend-mode: multiply;
}

/* ============== GLASS ============== */
.glass-teal {
  background: linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(236,255,254,0.75) 100%);
  border: 1px solid var(--mp-line);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  box-shadow: 0 20px 60px -20px rgba(14, 124, 102, 0.18);
}
.glass-teal-hi {
  background: linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(247,253,252,0.92) 100%);
  border: 1px solid var(--mp-line-strong);
  backdrop-filter: blur(20px);
  box-shadow: 0 30px 80px -30px rgba(14, 124, 102, 0.32);
}

/* ============== BUTTONS ============== */
.btn-primary-teal {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 18px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 14px;
  color: #fff;
  background: linear-gradient(180deg, var(--mp-teal-2) 0%, var(--mp-teal) 100%);
  box-shadow:
    0 10px 30px -10px rgba(14, 124, 102, 0.55),
    inset 0 -2px 0 rgba(0,0,0,0.08),
    inset 0 1px 0 rgba(255,255,255,0.25);
  transition: transform .15s ease, box-shadow .15s ease;
  border: none;
}
.btn-primary-teal:hover { transform: translateY(-1px); box-shadow: 0 16px 40px -12px rgba(14,124,102,0.65); }
.btn-primary-teal.lg { padding: 14px 22px; font-size: 15px; border-radius: 14px; }
.btn-primary-teal.xl { padding: 16px 26px; font-size: 16px; border-radius: 14px; }
.btn-primary-teal.full { width: 100%; justify-content: center; }

.btn-ghost-teal {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 18px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 14px;
  color: var(--mp-teal);
  background: rgba(255,255,255,0.6);
  border: 1px solid var(--mp-line-strong);
  transition: border-color .15s ease, background .15s ease, transform .15s ease;
}
.btn-ghost-teal:hover { border-color: var(--mp-teal); background: rgba(255,255,255,0.9); transform: translateY(-1px); }
.btn-ghost-teal.lg { padding: 14px 22px; font-size: 15px; border-radius: 14px; }
.btn-ghost-teal.xl { padding: 16px 26px; font-size: 16px; border-radius: 14px; }

/* ============== NAV ============== */
.mp-nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 50;
  transition: padding 0.25s ease;
  padding: 16px 0;
}
.mp-nav.is-scrolled { padding: 8px 0; }
.mp-nav-inner {
  max-width: 1280px; margin: 0 auto;
  padding: 12px 20px;
  background: linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(236,255,254,0.75) 100%);
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--mp-line);
  border-radius: 18px;
  display: flex; align-items: center; justify-content: space-between;
  box-shadow: 0 20px 40px -20px rgba(14, 124, 102, 0.20);
  margin-left: 24px; margin-right: 24px;
  transition: padding 0.25s ease, border-radius 0.25s ease, box-shadow 0.25s ease;
}
.mp-nav.is-scrolled .mp-nav-inner {
  padding: 8px 16px;
  border-radius: 14px;
  box-shadow: 0 16px 32px -16px rgba(14, 124, 102, 0.30);
}
.mp-brand { display: flex; align-items: center; gap: 10px; }
.mp-brand-mark {
  width: 32px; height: 32px; border-radius: 10px;
  background: linear-gradient(135deg, var(--mp-teal-2), var(--mp-teal));
  display: inline-flex; align-items: center; justify-content: center;
  box-shadow: 0 6px 20px -6px rgba(14,124,102,0.45);
}
.mp-brand-mark.sm { width: 24px; height: 24px; border-radius: 7px; }
.mp-brand-word { font-weight: 700; font-size: 15px; letter-spacing: -0.01em; color: var(--mp-ink); }
.mp-brand-sub { color: var(--mp-mute); font-weight: 400; }
.mp-nav-links { display: flex; align-items: center; gap: 28px; font-size: 14px; color: var(--mp-mute); }
.mp-nav-links a { transition: color .15s ease; }
.mp-nav-links a:hover { color: var(--mp-teal); }
.mp-nav-cta { display: flex; align-items: center; gap: 8px; }
@media (max-width: 1023px) {
  .mp-nav-links { display: none; }
}
@media (max-width: 640px) {
  .mp-nav-inner { margin-left: 12px; margin-right: 12px; padding: 10px 12px; }
  .mp-nav-cta .btn-ghost-teal { display: none; }
  .mp-brand-sub { display: none; }
}

/* ============== HERO ============== */
.mp-hero { position: relative; padding: 140px 0 64px; }
.mp-hero-grid {
  display: grid;
  grid-template-columns: 1.05fr 1fr;
  gap: 48px;
  align-items: center;
  position: relative;
}
.mp-eyebrow-pill {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 10px; letter-spacing: 0.14em; font-weight: 600;
  color: var(--mp-teal);
  background: rgba(255,255,255,0.7);
  border: 1px solid var(--mp-line-strong);
  backdrop-filter: blur(8px);
}
.mp-pulse-dot {
  width: 7px; height: 7px; border-radius: 999px;
  background: var(--mp-teal-2);
  box-shadow: 0 0 0 4px rgba(34, 184, 160, 0.18);
  animation: mpPulse 2s ease-in-out infinite;
}
@keyframes mpPulse {
  0%, 100% { box-shadow: 0 0 0 4px rgba(34, 184, 160, 0.18); }
  50% { box-shadow: 0 0 0 8px rgba(34, 184, 160, 0.06); }
}
.mp-h1 {
  margin-top: 20px;
  font-size: 64px;
  line-height: 1.04;
  letter-spacing: -0.025em;
  font-weight: 700;
}
.grad-teal {
  background: linear-gradient(180deg, var(--mp-ink) 0%, var(--mp-ink-2) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.grad-teal-deep {
  background: linear-gradient(135deg, var(--mp-teal) 0%, var(--mp-teal-2) 50%, var(--mp-teal) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.grad-text-warning {
  background: linear-gradient(135deg, #F4A261 0%, #E76F51 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.mp-hero-sub {
  margin-top: 18px;
  font-size: 15px;
  line-height: 1.6;
  color: var(--mp-ink-2);
  max-width: 560px;
}
.mp-hero-sub strong { color: var(--mp-teal); font-weight: 700; }
.mp-hero-sub em { color: var(--mp-ink); font-style: italic; }
.mp-hero-ctas {
  margin-top: 24px;
  display: flex; flex-wrap: wrap; gap: 10px;
}
.mp-hero-strip {
  margin-top: 28px;
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: var(--mp-line);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--mp-line);
}
.mp-hero-strip > div {
  background: rgba(255,255,255,0.85);
  padding: 12px 12px;
}
.strip-val {
  font-size: 22px; font-weight: 700; letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--mp-ink);
}
.strip-unit { color: var(--mp-mute); font-size: 0.7em; margin-left: 2px; }
.strip-label {
  margin-top: 3px;
  font-size: 10px; letter-spacing: 0.10em;
  text-transform: uppercase;
  color: var(--mp-mute);
  display: flex; align-items: center; gap: 8px;
}
.strip-live { display: inline-flex; align-items: center; gap: 4px; color: var(--mp-teal); }
.strip-live-dot {
  width: 5px; height: 5px; border-radius: 999px; background: var(--mp-teal-2);
  animation: mpPulse 1.4s ease-in-out infinite;
}

/* HERO RIGHT */
.mp-hero-right { position: relative; min-height: 580px; }
.mp-hero-stage {
  position: relative;
  height: 100%; min-height: 580px;
}
.mp-halo {
  position: absolute;
  inset: 10% 5% 10% 5%;
  background:
    radial-gradient(ellipse at center, rgba(34, 184, 160, 0.35) 0%, transparent 60%),
    radial-gradient(ellipse at 30% 70%, rgba(14, 124, 102, 0.18) 0%, transparent 60%);
  filter: blur(28px);
}
.mp-pixel-grid {
  position: absolute; inset: 8% 8% 14% 8%;
  display: grid; grid-template-columns: repeat(16, 1fr); gap: 6px;
  opacity: 0.7;
  pointer-events: none;
}
.mp-pixel-grid .px {
  aspect-ratio: 1; border-radius: 3px;
  background: rgba(14, 124, 102, 0.06);
  border: 1px solid rgba(14, 124, 102, 0.08);
}
.mp-pixel-grid .px.fired {
  background: rgba(34, 184, 160, 0.55);
  border-color: rgba(34, 184, 160, 0.55);
  box-shadow: 0 0 10px rgba(34, 184, 160, 0.45);
  animation: mpBlink 2.6s ease-in-out infinite;
}
@keyframes mpBlink { 0%,100% { opacity:1;} 50% {opacity:0.45;} }

.mp-offer-card {
  position: absolute;
  top: 4%; left: 2%; right: 42%;
  z-index: 5;
  border-radius: 20px;
  padding: 18px;
}
.mp-offer-head { display: flex; align-items: center; justify-content: space-between; }
.mp-offer-tag {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 10px; letter-spacing: 0.16em; font-weight: 700;
  color: var(--mp-teal);
  padding: 5px 10px; border-radius: 999px;
  background: rgba(34, 184, 160, 0.10);
  border: 1px solid rgba(34, 184, 160, 0.25);
}
.mp-offer-id {
  font-size: 10px; letter-spacing: 0.14em; font-weight: 500;
  color: var(--mp-mute);
  font-variant-numeric: tabular-nums;
}
.mp-offer-title {
  margin-top: 12px;
  font-size: 13px; font-weight: 600; color: var(--mp-mute);
  letter-spacing: -0.01em;
}
.mp-offer-amount {
  margin-top: 4px;
  font-size: 44px; font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--mp-ink);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap;
}
.mp-offer-amount-sub {
  font-size: 11px; font-weight: 600; letter-spacing: 0.14em;
  color: var(--mp-teal);
  text-transform: uppercase;
}
.mp-offer-row {
  margin-top: 18px;
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding-top: 14px;
  border-top: 1px solid var(--mp-line);
}
.mp-offer-row-k {
  font-size: 10px; letter-spacing: 0.14em; font-weight: 600;
  text-transform: uppercase; color: var(--mp-mute);
}
.mp-offer-row-v {
  margin-top: 3px;
  font-size: 16px; font-weight: 700; color: var(--mp-ink);
  font-variant-numeric: tabular-nums;
}
.mp-offer-row-v.sm { font-size: 12px; font-weight: 600; }
.mp-offer-row-v .dim { color: var(--mp-mute); font-weight: 500; font-size: 0.7em; margin-left: 4px; }

.mp-offer-bar { margin-top: 18px; }
.mp-offer-bar-track {
  height: 6px; border-radius: 999px;
  background: rgba(14, 124, 102, 0.08);
  overflow: hidden;
  position: relative;
}
.mp-offer-bar-fill {
  height: 100%; width: 80%;
  background: linear-gradient(90deg, var(--mp-teal-2), var(--mp-teal));
  border-radius: 999px;
  position: relative;
  animation: mpFill 4s ease-in-out infinite;
}
@keyframes mpFill {
  0%, 100% { width: 80%; }
  50% { width: 95%; }
}
.mp-offer-bar-stages {
  margin-top: 10px;
  display: flex; justify-content: space-between;
  font-size: 10px; letter-spacing: 0.10em; font-weight: 600;
  text-transform: uppercase;
}
.mp-offer-bar-stages span { color: var(--mp-mute); }
.mp-offer-bar-stages span.on { color: var(--mp-teal); }
.mp-offer-bar-stages span.cur {
  color: var(--mp-teal);
  position: relative;
}
.mp-offer-bar-stages span.cur::before {
  content: ""; position: absolute; left: -8px; top: 50%;
  width: 5px; height: 5px; border-radius: 999px;
  background: var(--mp-teal-2);
  animation: mpPulse 1.4s ease-in-out infinite;
  transform: translateY(-50%);
}
.mp-offer-cta {
  margin-top: 18px;
  width: 100%;
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 12px;
  border-radius: 12px;
  background: linear-gradient(180deg, var(--mp-teal-2) 0%, var(--mp-teal) 100%);
  color: #fff;
  font-weight: 600; font-size: 13px;
  border: none;
  box-shadow: 0 10px 30px -10px rgba(14,124,102,0.55);
}
.mp-offer-foot {
  margin-top: 12px;
  display: flex; justify-content: space-between;
  font-size: 10px; color: var(--mp-mute);
}
.mp-offer-foot span { display: inline-flex; align-items: center; gap: 6px; }

.mp-hero-side-stat {
  position: absolute;
  top: 56%; right: 0%;
  width: 220px;
  border-radius: 18px;
  padding: 16px;
  z-index: 4;
}
.mp-side-eyebrow {
  font-size: 10px; letter-spacing: 0.16em; font-weight: 700;
  color: var(--mp-teal);
  display: inline-flex; align-items: center; gap: 6px;
}
.mp-side-grid {
  margin-top: 14px;
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 14px 12px;
}
.mp-side-val {
  font-size: 17px; font-weight: 700; color: var(--mp-ink);
  letter-spacing: -0.02em; font-variant-numeric: tabular-nums;
}
.mp-side-label {
  margin-top: 2px;
  font-size: 10px; letter-spacing: 0.10em; font-weight: 600;
  text-transform: uppercase; color: var(--mp-mute);
}
.mp-side-divider { margin-top: 16px; border-top: 1px solid var(--mp-line); }
.mp-side-footrow { margin-top: 12px; }
.mp-side-rail {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 11px; color: var(--mp-ink-2);
}

/* HERO CHIPS (floating) */
.mp-chip {
  position: absolute;
  z-index: 8;
  padding: 7px 12px;
  border-radius: 10px;
  background: rgba(255,255,255,0.95);
  border: 1px solid var(--mp-line-strong);
  box-shadow: 0 12px 30px -10px rgba(14, 124, 102, 0.25);
  font-size: 11px;
  white-space: nowrap;
  display: inline-flex; align-items: center; gap: 8px;
  animation: mpChipFloat 8s ease-in-out infinite;
  backdrop-filter: blur(8px);
}
.mp-chip-k { color: var(--mp-mute); font-weight: 600; letter-spacing: 0.06em; }
.mp-chip-v { color: var(--mp-ink); font-weight: 700; }
@keyframes mpChipFloat {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-7px); }
}

/* ============== TICKER ============== */
.mp-ticker {
  margin-top: 56px;
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: var(--mp-line);
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--mp-line);
  box-shadow: 0 20px 60px -30px rgba(14,124,102,0.25);
}
.mp-ticker-cell {
  background: rgba(255,255,255,0.92);
  padding: 18px 20px;
}
.mp-ticker-val {
  font-size: 28px; font-weight: 700;
  letter-spacing: -0.025em;
  color: var(--mp-ink);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.mp-ticker-lab {
  margin-top: 6px;
  font-size: 11px; letter-spacing: 0.10em; font-weight: 600;
  text-transform: uppercase; color: var(--mp-mute);
}
.mp-ticker-delta {
  margin-top: 8px;
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 10px; color: var(--mp-teal);
}
.delta-dot {
  width: 5px; height: 5px; border-radius: 999px;
  background: var(--mp-teal-2);
}

/* ============== SECTION HEAD ============== */
.mp-section-head { margin-bottom: 36px; }
.mp-section-tag {
  font-size: 10px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--mp-teal);
  text-transform: uppercase;
  margin-bottom: 12px;
}
.mp-section-tag.dark { color: var(--mp-teal-2); }
.mp-section-tag.muted-tag { color: var(--mp-mute); }
.mp-h2 {
  font-size: 32px; line-height: 1.12;
  letter-spacing: -0.022em; font-weight: 700;
}
.mp-h2.light { color: #fff; }
.mp-h2.left { text-align: left; }
.mp-h2.light em { font-style: italic; color: #B5E6DC; font-weight: 600; }
.mp-section-body {
  margin-top: 14px;
  font-size: 14px; line-height: 1.6;
  color: var(--mp-ink-2);
}
.mp-section-body.light { color: #B5E6DC; }

/* ============== PROBLEM (DARK BAND) ============== */
.mp-problem {
  background: var(--mp-deep);
  color: #fff;
  padding: 64px 0;
  position: relative;
  overflow: hidden;
}
.mp-problem::before {
  content: ""; position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%);
  pointer-events: none;
}
.mp-compare {
  margin-top: 36px;
  display: grid; grid-template-columns: 1fr auto 1fr;
  gap: 20px;
  align-items: stretch;
}
.mp-compare-card {
  border-radius: 18px;
  padding: 24px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  display: flex; flex-direction: column;
}
.mp-compare-card.mp-compare-medpay {
  background: linear-gradient(180deg, rgba(34,184,160,0.18) 0%, rgba(14,124,102,0.10) 100%);
  border-color: rgba(34, 184, 160, 0.40);
  box-shadow: 0 30px 80px -30px rgba(34, 184, 160, 0.45);
}
.mp-compare-eyebrow {
  font-size: 10px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--mp-teal-2);
  text-transform: uppercase;
  margin-bottom: 14px;
}
.mp-compare-eyebrow.muted { color: rgba(255,255,255,0.45); }
.mp-compare-list {
  list-style: none; padding: 0; margin: 0;
  display: flex; flex-direction: column; gap: 10px;
}
.mp-compare-list li {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 14px;
  align-items: baseline;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.mp-compare-list li:last-child { border-bottom: none; padding-bottom: 4px; }
.mp-compare-stat {
  font-size: 26px; font-weight: 700; letter-spacing: -0.022em;
  color: #fff;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  text-align: left;
}
.mp-compare-stat.muted { color: rgba(255,255,255,0.55); }
.mp-compare-label {
  font-size: 12px; line-height: 1.45;
  color: rgba(255,255,255,0.68);
}
.mp-compare-label.light { color: #C4ECDF; }
.mp-compare-foot {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid rgba(255,255,255,0.10);
  font-size: 10px; letter-spacing: 0.12em; font-weight: 600;
  text-transform: uppercase;
  color: rgba(255,255,255,0.55);
}
.mp-compare-foot.muted { color: rgba(255,255,255,0.40); }
.mp-compare-foot.light { color: var(--mp-teal-2); }
.mp-compare-divider {
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; letter-spacing: 0.20em; font-weight: 700;
  text-transform: uppercase;
  color: rgba(255,255,255,0.4);
}
.mp-compare-divider span {
  width: 36px; height: 36px;
  border-radius: 999px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.10);
  display: inline-flex; align-items: center; justify-content: center;
}

@media (max-width: 960px) {
  .mp-compare { grid-template-columns: 1fr; gap: 14px; }
  .mp-compare-divider span { transform: rotate(90deg); }
}

/* ============== WATERFALL ============== */
.mp-waterfall { padding: 64px 0; position: relative; }
.mp-waterfall-diagram { position: relative; min-height: 340px; }
.mp-waterfall-svg {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  pointer-events: none;
  opacity: 0.9;
}
.mp-flowline {
  stroke-dasharray: 4 6;
  animation: mpDash 6s linear infinite;
}
@keyframes mpDash { to { stroke-dashoffset: -200; } }
.mp-flowpulse {
  filter: drop-shadow(0 0 8px rgba(14, 124, 102, 0.6));
}

.mp-stages-row {
  position: relative;
  display: grid; grid-template-columns: repeat(5, 1fr);
  gap: 16px;
  padding-top: 28px;
}
.mp-stage-node { display: flex; flex-direction: column; align-items: center; }
.mp-stage-num {
  width: 40px; height: 40px; border-radius: 12px;
  background: linear-gradient(135deg, var(--mp-teal-2), var(--mp-teal));
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 14px;
  letter-spacing: -0.01em;
  box-shadow: 0 12px 30px -8px rgba(14, 124, 102, 0.50);
  margin-bottom: 14px;
  z-index: 2;
}
.mp-stage-card {
  background: rgba(255,255,255,0.92);
  border: 1px solid var(--mp-line);
  border-radius: 14px;
  padding: 14px;
  text-align: center;
  width: 100%;
  box-shadow: 0 14px 36px -16px rgba(14, 124, 102, 0.22);
  backdrop-filter: blur(8px);
}
.mp-stage-stage {
  font-size: 10px; letter-spacing: 0.16em; font-weight: 700;
  color: var(--mp-teal);
  text-transform: uppercase;
}
.mp-stage-title {
  margin-top: 4px;
  font-size: 13px; font-weight: 700;
  color: var(--mp-ink);
  letter-spacing: -0.01em;
  line-height: 1.25;
}
.mp-stage-metric {
  margin-top: 8px;
  font-size: 10px; letter-spacing: 0.14em; font-weight: 700;
  color: var(--mp-teal);
  text-transform: uppercase;
  padding: 3px 8px;
  background: rgba(34, 184, 160, 0.10);
  border-radius: 999px;
  display: inline-block;
}
.mp-stage-body {
  margin-top: 10px;
  font-size: 11px; line-height: 1.5;
  color: var(--mp-mute);
  text-align: left;
}

@media (max-width: 1100px) {
  .mp-stages-row { grid-template-columns: repeat(2, 1fr); }
  .mp-waterfall-svg { display: none; }
}
@media (max-width: 640px) {
  .mp-stages-row { grid-template-columns: 1fr; }
}

/* ============== PILLARS ============== */
.mp-pillars { padding: 64px 0; position: relative; }

.mp-pillar {
  position: relative;
  background: rgba(255,255,255,0.7);
  border: 1px solid var(--mp-line);
  border-radius: 24px;
  padding: 36px;
  box-shadow: 0 28px 80px -40px rgba(14, 124, 102, 0.30);
  backdrop-filter: blur(8px);
  overflow: hidden;
}
.mp-pillar.dominant {
  padding: 40px;
  background:
    radial-gradient(ellipse 60% 60% at 80% 20%, rgba(34, 184, 160, 0.10), transparent 60%),
    linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(247,253,252,0.85) 100%);
  border-color: var(--mp-line-strong);
}
.mp-pillar-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 28px;
}
.mp-pillar-grid.dominant-grid {
  grid-template-columns: 1.05fr 1.15fr;
  gap: 40px;
  align-items: center;
}
@media (max-width: 1023px) {
  .mp-pillar-grid.dominant-grid { grid-template-columns: 1fr; }
  .mp-pillar.dominant { padding: 28px; }
}

.mp-pillar-badge {
  display: inline-flex; align-items: center; gap: 12px;
  font-size: 11px; letter-spacing: 0.16em; font-weight: 700;
  color: var(--mp-mute);
  text-transform: uppercase;
}
.mp-pillar-badge.primary { color: var(--mp-teal); }
.mp-pillar-num {
  background: linear-gradient(135deg, var(--mp-teal-2), var(--mp-teal));
  color: #fff;
  padding: 4px 10px; border-radius: 8px;
  font-weight: 800; font-size: 13px;
}
.mp-pillar-num.muted {
  background: rgba(14, 124, 102, 0.08);
  color: var(--mp-teal);
}
.mp-pillar-tag {
  padding: 4px 10px; border-radius: 999px;
  font-size: 9px; letter-spacing: 0.18em;
  background: rgba(34, 184, 160, 0.12);
  border: 1px solid rgba(34, 184, 160, 0.30);
}
.mp-pillar-tag.primary { color: var(--mp-teal); background: rgba(14, 124, 102, 0.10); border-color: rgba(14, 124, 102, 0.30); }
.mp-pillar-tag.muted { color: var(--mp-mute); background: rgba(14, 124, 102, 0.06); border-color: var(--mp-line); }

.mp-pillar-title {
  margin-top: 16px;
  font-size: 26px; font-weight: 700;
  letter-spacing: -0.022em; line-height: 1.18;
  color: var(--mp-ink);
}
.mp-pillar-title.small {
  font-size: 19px;
  line-height: 1.22;
}
.mp-pillar-title .num-tone { color: var(--mp-teal); }
.mp-pillar-body {
  margin-top: 12px;
  font-size: 14px; line-height: 1.6;
  color: var(--mp-ink-2);
  max-width: 560px;
}
.mp-pillar-body.small { font-size: 13px; line-height: 1.55; }

.mp-pillar-bullets {
  margin-top: 18px;
  list-style: none; padding: 0;
  display: flex; flex-direction: column; gap: 9px;
}
.mp-pillar-bullets.small li { font-size: 12px; gap: 10px; }
.mp-pillar-bullets li {
  display: flex; align-items: flex-start; gap: 10px;
  font-size: 13px; line-height: 1.5; color: var(--mp-ink-2);
}
.mp-bullet-tick {
  flex-shrink: 0;
  width: 20px; height: 20px; border-radius: 999px;
  background: rgba(14, 124, 102, 0.12);
  color: var(--mp-teal);
  display: inline-flex; align-items: center; justify-content: center;
  margin-top: 1px;
}

.mp-pillar-roi {
  margin-top: 22px;
  display: inline-flex; align-items: center; gap: 10px;
  padding: 8px 14px;
  border-radius: 10px;
  background: linear-gradient(180deg, rgba(34, 184, 160, 0.10) 0%, rgba(14, 124, 102, 0.06) 100%);
  border: 1px solid rgba(34, 184, 160, 0.32);
  color: var(--mp-teal);
  font-weight: 700; font-size: 12px;
  letter-spacing: 0.01em;
}
.mp-pillar-roi.muted {
  background: rgba(14, 124, 102, 0.06);
  border-color: var(--mp-line-strong);
  font-size: 11px;
}

/* DOMINANT MOCKUP: offer comparison */
.mp-pillar-mock { position: relative; }
.mock-frame {
  background: #fff;
  border-radius: 22px;
  border: 1px solid var(--mp-line-strong);
  box-shadow:
    0 32px 80px -32px rgba(14, 124, 102, 0.35),
    0 0 0 1px rgba(14, 124, 102, 0.04);
  overflow: hidden;
}
.mock-frame-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px;
  background: linear-gradient(180deg, #F7FDFC, #ECFFFE);
  border-bottom: 1px solid var(--mp-line);
}
.mock-dots { display: flex; gap: 6px; }
.mock-dots span {
  width: 9px; height: 9px; border-radius: 999px;
  background: rgba(14, 124, 102, 0.20);
}
.mock-dots span:first-child { background: #F4A261; }
.mock-dots span:nth-child(2) { background: #E9C46A; }
.mock-dots span:last-child { background: var(--mp-teal-2); }
.mock-frame-title {
  font-size: 11px; letter-spacing: 0.04em; color: var(--mp-mute);
  font-weight: 500;
}
.mock-frame-lock {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 10px; color: var(--mp-teal);
  text-transform: uppercase; letter-spacing: 0.12em;
  font-weight: 700;
}
.mock-body { padding: 20px; }
.mock-greet {
  font-size: 16px; font-weight: 700;
  color: var(--mp-ink);
  letter-spacing: -0.01em;
}
.mock-sub {
  margin-top: 4px;
  font-size: 12px; color: var(--mp-mute);
  line-height: 1.5;
}

.mock-waterfall {
  margin-top: 16px;
  padding: 12px;
  border-radius: 10px;
  background: rgba(14, 124, 102, 0.04);
  border: 1px solid var(--mp-line);
}
.mock-waterfall-bar {
  display: flex;
  height: 22px;
  border-radius: 6px;
  overflow: hidden;
  background: rgba(14, 124, 102, 0.06);
}
.mock-waterfall-bar .seg {
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700;
  color: #fff;
  white-space: nowrap;
}
.mock-waterfall-bar .seg-quoted { flex: 48; background: rgba(34,184,160,0.85); }
.mock-waterfall-bar .seg-approved { flex: 39; background: var(--mp-teal); }
.mock-waterfall-bar .seg-best { flex: 8; background: var(--mp-deep); }
.mock-waterfall-meta {
  margin-top: 8px;
  font-size: 11px; color: var(--mp-mute);
  letter-spacing: 0.04em;
}

.mock-offers { margin-top: 16px; display: flex; flex-direction: column; gap: 8px; }
.mock-offer {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 14px;
  border: 1px solid var(--mp-line);
  border-radius: 12px;
  background: #fff;
  transition: all .15s ease;
}
.mock-offer.is-best {
  border-color: var(--mp-teal);
  background: linear-gradient(180deg, rgba(34, 184, 160, 0.06), #fff);
  box-shadow: 0 12px 30px -10px rgba(14, 124, 102, 0.22);
}
.mock-offer-lender {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; font-weight: 700;
  color: var(--mp-ink);
}
.mock-offer-label {
  font-weight: 700;
  letter-spacing: -0.005em;
}
.mock-best {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 9px; letter-spacing: 0.10em; font-weight: 700;
  color: var(--mp-teal);
  padding: 2px 7px; border-radius: 5px;
  background: rgba(34, 184, 160, 0.16);
}
.mock-offer-note {
  margin-top: 3px;
  font-size: 11px; color: var(--mp-mute);
}
.mock-offer-monthly {
  font-size: 18px; font-weight: 700; letter-spacing: -0.022em;
  color: var(--mp-ink);
  font-variant-numeric: tabular-nums;
}
.mock-offer-monthly .dim { color: var(--mp-mute); font-size: 0.6em; font-weight: 500; margin-left: 2px; }
.mock-offer-meta {
  margin-top: 2px;
  font-size: 10px; color: var(--mp-mute);
  text-align: right;
}

.mock-cta-row {
  margin-top: 14px;
  display: grid; grid-template-columns: 1.4fr 1fr;
  gap: 8px;
}
.mock-cta-primary, .mock-cta-ghost {
  padding: 11px;
  border-radius: 10px;
  font-weight: 700; font-size: 12px;
  border: none;
}
.mock-cta-primary {
  background: linear-gradient(180deg, var(--mp-teal-2) 0%, var(--mp-teal) 100%);
  color: #fff;
}
.mock-cta-ghost {
  background: #fff;
  color: var(--mp-teal);
  border: 1px solid var(--mp-line-strong);
}
.mock-foot {
  margin-top: 10px;
  font-size: 10px; line-height: 1.5;
  color: var(--mp-mute);
}

/* ============== ROI ============== */
.mp-roi { padding: 110px 0; position: relative; }
.mp-roi-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 28px;
  align-items: stretch;
}
@media (max-width: 960px) {
  .mp-roi-grid { grid-template-columns: 1fr; }
}
.mp-roi-card {
  background: rgba(255,255,255,0.85);
  border: 1px solid var(--mp-line-strong);
  border-radius: 24px;
  padding: 40px;
  box-shadow: 0 24px 60px -30px rgba(14, 124, 102, 0.20);
  display: flex; flex-direction: column; gap: 30px;
}
.mp-roi-row { display: flex; flex-direction: column; gap: 12px; }
.mp-roi-label {
  display: flex; justify-content: space-between; align-items: baseline;
  font-size: 13px; font-weight: 600; color: var(--mp-mute);
  letter-spacing: 0.02em;
}
.mp-roi-val {
  font-size: 24px; font-weight: 700; color: var(--mp-ink);
  letter-spacing: -0.02em; font-variant-numeric: tabular-nums;
}
.mp-slider {
  -webkit-appearance: none; appearance: none;
  width: 100%; height: 6px;
  background: linear-gradient(90deg, var(--mp-teal-2) 0%, var(--mp-teal-2) 50%, rgba(14,124,102,0.10) 50%, rgba(14,124,102,0.10) 100%);
  border-radius: 999px;
  outline: none;
}
.mp-slider::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 22px; height: 22px;
  background: #fff;
  border: 3px solid var(--mp-teal);
  border-radius: 999px;
  box-shadow: 0 6px 16px -4px rgba(14, 124, 102, 0.45);
  cursor: grab;
  transition: transform .15s ease;
}
.mp-slider::-webkit-slider-thumb:hover { transform: scale(1.1); }
.mp-slider::-moz-range-thumb {
  width: 22px; height: 22px;
  background: #fff;
  border: 3px solid var(--mp-teal);
  border-radius: 999px;
  cursor: grab;
}
.mp-slider-scale {
  display: flex; justify-content: space-between;
  font-size: 10px; letter-spacing: 0.08em; font-weight: 600;
  color: var(--mp-mute);
  text-transform: uppercase;
}
.mp-roi-assump {
  padding: 14px 18px;
  border-radius: 12px;
  background: rgba(34, 184, 160, 0.08);
  border: 1px solid rgba(34, 184, 160, 0.22);
  font-size: 12px; color: var(--mp-ink-2); line-height: 1.5;
  display: flex; gap: 10px; align-items: flex-start;
}
.mp-roi-assump-k {
  flex-shrink: 0;
  font-size: 10px; letter-spacing: 0.14em; font-weight: 700;
  color: var(--mp-teal);
  text-transform: uppercase;
  padding: 2px 8px;
  background: rgba(34, 184, 160, 0.18);
  border-radius: 6px;
}

.mp-roi-out {
  background:
    radial-gradient(ellipse 60% 60% at 80% 0%, rgba(34, 184, 160, 0.25), transparent 60%),
    linear-gradient(180deg, var(--mp-deep) 0%, #0A3B36 100%);
  color: #fff;
  border-radius: 24px;
  padding: 40px;
  display: flex; flex-direction: column;
  position: relative; overflow: hidden;
  box-shadow: 0 30px 80px -30px rgba(6, 44, 41, 0.55);
}
.mp-roi-out::before {
  content: ""; position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
  background-size: 40px 40px;
  pointer-events: none;
}
.mp-roi-eyebrow {
  position: relative;
  font-size: 11px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--mp-teal-2);
  text-transform: uppercase;
}
.mp-roi-bignum {
  position: relative;
  margin-top: 18px;
  font-size: 88px; font-weight: 800;
  letter-spacing: -0.04em;
  background: linear-gradient(135deg, #fff 0%, var(--mp-teal-2) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.mp-roi-trailing {
  font-size: 24px; font-weight: 500; color: rgba(255,255,255,0.45);
  margin-left: 14px; letter-spacing: -0.02em;
}
.mp-roi-sub {
  position: relative;
  margin-top: 14px;
  font-size: 15px; color: #C4ECDF; line-height: 1.55;
}
.mp-roi-grid-mini {
  position: relative;
  margin-top: 30px;
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: rgba(255,255,255,0.10);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.12);
}
.mp-roi-grid-mini > div {
  padding: 16px;
  background: rgba(6, 44, 41, 0.5);
}
.mp-roi-mini-num {
  font-size: 22px; font-weight: 700;
  letter-spacing: -0.02em;
  color: #fff;
  font-variant-numeric: tabular-nums;
}
.mp-roi-mini-lab {
  margin-top: 4px;
  font-size: 11px; letter-spacing: 0.08em;
  color: rgba(255,255,255,0.6);
  text-transform: uppercase;
}
.mp-roi-out .btn-primary-teal {
  position: relative;
  margin-top: 30px;
}
.mp-roi-uplift-row {
  position: relative;
  margin-top: 22px;
  padding: 14px 16px;
  border-radius: 12px;
  background: rgba(34, 184, 160, 0.10);
  border: 1px solid rgba(34, 184, 160, 0.28);
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  flex-wrap: wrap;
}
.mp-roi-uplift-k {
  font-size: 11px; letter-spacing: 0.08em;
  color: rgba(255,255,255,0.72);
  text-transform: uppercase;
  font-weight: 600;
}
.mp-roi-uplift-v {
  font-size: 18px; font-weight: 700;
  color: var(--mp-teal-2);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}
.mp-roi-foot {
  position: relative;
  margin-top: 16px;
  font-size: 11px; color: rgba(255,255,255,0.45); line-height: 1.5;
}

/* ============== SYNERGY CALLOUT ============== */
.mp-synergy {
  margin-top: 40px;
  background:
    radial-gradient(ellipse 60% 80% at 0% 50%, rgba(34, 184, 160, 0.12), transparent 60%),
    linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(236,255,254,0.85) 100%);
  border: 1px solid var(--mp-line-strong);
  border-radius: 24px;
  padding: 34px 36px;
  box-shadow: 0 24px 60px -28px rgba(14, 124, 102, 0.22);
  position: relative;
  overflow: hidden;
}
.mp-synergy::before {
  content: ""; position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(14, 124, 102, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(14, 124, 102, 0.04) 1px, transparent 1px);
  background-size: 32px 32px;
  mask-image: radial-gradient(ellipse at 0% 50%, black 0%, transparent 70%);
  pointer-events: none;
}
.mp-synergy-grid {
  position: relative;
  display: grid;
  grid-template-columns: minmax(280px, 360px) 1fr;
  gap: 40px;
  align-items: center;
}
@media (max-width: 960px) {
  .mp-synergy-grid { grid-template-columns: 1fr; gap: 24px; }
}
.mp-synergy-side {
  display: flex; flex-direction: column; gap: 18px;
}
.mp-synergy-eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 11px; letter-spacing: 0.16em; font-weight: 700;
  color: var(--mp-teal);
  text-transform: uppercase;
}
.mp-synergy-pair {
  display: flex; align-items: center; gap: 14px;
}
.mp-synergy-half {
  flex: 1;
  padding: 14px 16px;
  border-radius: 12px;
  background: rgba(255,255,255,0.9);
  border: 1px solid var(--mp-line-strong);
}
.mp-synergy-half-k {
  font-size: 10px; letter-spacing: 0.12em; font-weight: 700;
  color: var(--mp-teal); text-transform: uppercase;
}
.mp-synergy-half-v {
  margin-top: 4px;
  font-size: 16px; font-weight: 700; color: var(--mp-ink);
  letter-spacing: -0.01em;
}
.mp-synergy-x {
  font-size: 22px; font-weight: 700; color: var(--mp-teal);
  flex-shrink: 0;
}
.mp-synergy-body {
  font-size: 15px; line-height: 1.65; color: var(--mp-ink-2);
}
.mp-synergy-body p { margin: 0 0 12px 0; }
.mp-synergy-body p:last-child { margin-bottom: 0; }
.mp-synergy-body strong { color: var(--mp-ink); }

/* ============== CALENDAR QUALITY + PIXEL LOOP ============== */
.mp-calendar {
  margin-top: 40px;
  padding-top: 8px;
}
.mp-calendar-head { max-width: 760px; margin-bottom: 28px; }
.mp-calendar-h {
  font-size: 36px; font-weight: 800;
  letter-spacing: -0.025em;
  line-height: 1.05;
  margin: 0;
}
.mp-calendar-sub {
  margin-top: 14px;
  font-size: 17px; line-height: 1.5;
  color: var(--mp-mute);
  font-weight: 500;
}
.mp-calendar-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}
@media (max-width: 960px) {
  .mp-calendar-grid { grid-template-columns: 1fr; }
}
.mp-calendar-card {
  background: rgba(255,255,255,0.92);
  border: 1px solid var(--mp-line-strong);
  border-radius: 22px;
  padding: 32px;
  box-shadow: 0 24px 60px -30px rgba(14, 124, 102, 0.22);
  display: flex; flex-direction: column; gap: 18px;
  position: relative;
  overflow: hidden;
}
.mp-calendar-card.pixel {
  background:
    radial-gradient(ellipse 60% 60% at 100% 0%, rgba(34, 184, 160, 0.10), transparent 60%),
    rgba(255,255,255,0.92);
}
.mp-calendar-card-eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 11px; letter-spacing: 0.16em; font-weight: 700;
  color: var(--mp-teal);
  text-transform: uppercase;
}
.mp-calendar-card-h {
  font-size: 22px; font-weight: 700; color: var(--mp-ink);
  letter-spacing: -0.02em; line-height: 1.25;
  margin: 0;
}
.mp-calendar-card-body {
  font-size: 14px; line-height: 1.65; color: var(--mp-ink-2);
  margin: 0;
}
.mp-calendar-card-body em { color: var(--mp-teal); font-style: normal; font-weight: 600; }

/* mini calendar visualization */
.mp-calendar-cal {
  margin-top: 6px;
  padding: 16px;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(236, 255, 254, 0.6) 0%, rgba(255,255,255, 0.6) 100%);
  border: 1px solid var(--mp-line);
}
.mp-calendar-cal-head {
  display: grid; grid-template-columns: repeat(5, 1fr);
  gap: 6px;
  font-size: 10px; letter-spacing: 0.1em; font-weight: 700;
  color: var(--mp-mute);
  text-transform: uppercase;
  margin-bottom: 8px;
}
.mp-calendar-cal-body {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}
.mp-calendar-cal-slot {
  aspect-ratio: 1;
  border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  transition: transform .15s ease;
}
.mp-calendar-cal-slot.buyer {
  background: linear-gradient(135deg, rgba(34, 184, 160, 0.22), rgba(14, 124, 102, 0.18));
  border: 1px solid rgba(34, 184, 160, 0.45);
}
.mp-calendar-cal-slot.filler {
  background: rgba(180, 180, 180, 0.08);
  border: 1px dashed rgba(120, 120, 120, 0.28);
}
.mp-calendar-cal-dot {
  width: 6px; height: 6px; border-radius: 999px;
}
.mp-calendar-cal-slot.buyer .mp-calendar-cal-dot {
  background: var(--mp-teal);
  box-shadow: 0 0 0 3px rgba(34, 184, 160, 0.22);
}
.mp-calendar-cal-slot.filler .mp-calendar-cal-dot {
  background: rgba(120, 120, 120, 0.4);
}
.mp-calendar-cal-legend {
  margin-top: 12px;
  display: flex; gap: 14px; flex-wrap: wrap;
  font-size: 11px; color: var(--mp-mute);
}
.mp-calendar-cal-legend .lg-dot {
  display: inline-block;
  width: 8px; height: 8px; border-radius: 999px;
  margin-right: 6px;
  vertical-align: -1px;
}
.mp-calendar-cal-legend .lg-buyer .lg-dot {
  background: var(--mp-teal); box-shadow: 0 0 0 3px rgba(34, 184, 160, 0.18);
}
.mp-calendar-cal-legend .lg-filler .lg-dot {
  background: rgba(120, 120, 120, 0.4);
}

/* pixel loop visualization */
.mp-pixel-loop {
  margin-top: 6px;
  padding: 14px 16px;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(236, 255, 254, 0.6) 0%, rgba(255,255,255, 0.6) 100%);
  border: 1px solid var(--mp-line);
  display: flex; flex-direction: column; gap: 8px;
}
.mp-pixel-loop-row {
  display: flex; align-items: center; gap: 12px;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(255,255,255,0.7);
  border: 1px solid var(--mp-line);
  position: relative;
}
.mp-pixel-loop-row:not(.last)::after {
  content: "";
  position: absolute;
  left: 22px;
  bottom: -8px;
  width: 1px; height: 8px;
  background: linear-gradient(180deg, var(--mp-teal-2), transparent);
  opacity: 0.6;
}
.mp-pixel-step {
  flex-shrink: 0;
  width: 26px; height: 26px;
  border-radius: 8px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700; letter-spacing: 0.04em;
  color: #fff;
  background: linear-gradient(135deg, var(--mp-teal-2), var(--mp-teal));
}
.mp-pixel-step-label {
  font-size: 13px; color: var(--mp-ink-2);
  line-height: 1.4;
}
.mp-pixel-step-label strong { color: var(--mp-ink); }

/* ============== STORIES ============== */
.mp-stories { padding: 110px 0; position: relative; }
.mp-stories-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}
@media (max-width: 960px) {
  .mp-stories-grid { grid-template-columns: 1fr; }
}
.mp-story-card {
  background: rgba(255,255,255,0.92);
  border: 1px solid var(--mp-line-strong);
  border-radius: 22px;
  padding: 32px;
  display: flex; flex-direction: column;
  box-shadow: 0 24px 60px -30px rgba(14, 124, 102, 0.22);
  position: relative;
  overflow: hidden;
}
.mp-story-card::before {
  content: ""; position: absolute;
  top: 0; left: 0; right: 0; height: 3px;
  background: linear-gradient(90deg, var(--mp-teal-2), var(--mp-teal));
}
.mp-story-tag {
  display: inline-block;
  font-size: 10px; letter-spacing: 0.14em; font-weight: 700;
  color: var(--mp-teal);
  text-transform: uppercase;
  padding: 4px 10px; border-radius: 999px;
  background: rgba(34, 184, 160, 0.10);
  margin-bottom: 16px;
  align-self: flex-start;
}
.mp-story-quote {
  font-size: 15px; line-height: 1.6;
  color: var(--mp-ink);
  font-style: italic;
  margin: 0;
  flex: 1;
}
.mp-story-outcomes {
  margin-top: 24px;
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 1px;
  background: var(--mp-line);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--mp-line);
}
.mp-story-outcome {
  background: rgba(34, 184, 160, 0.05);
  padding: 12px 14px;
}
.mp-story-out-val {
  font-size: 20px; font-weight: 700;
  letter-spacing: -0.02em; color: var(--mp-teal);
  font-variant-numeric: tabular-nums;
}
.mp-story-out-lab {
  margin-top: 2px;
  font-size: 11px; letter-spacing: 0.08em;
  color: var(--mp-mute);
  text-transform: uppercase;
}
.mp-story-attrib {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--mp-line);
  display: flex; align-items: center; gap: 12px;
}
.mp-story-avatar {
  width: 38px; height: 38px; border-radius: 999px;
  background: linear-gradient(135deg, var(--mp-teal-2), var(--mp-teal));
  color: #fff;
  font-size: 13px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.mp-story-name { font-size: 13px; font-weight: 700; color: var(--mp-ink); }
.mp-story-role { font-size: 11px; color: var(--mp-mute); margin-top: 1px; }

/* ============== INTEGRATIONS ============== */
.mp-integrations {
  padding: 80px 0;
  position: relative;
  background:
    linear-gradient(180deg, rgba(236, 255, 254, 0.4) 0%, transparent 100%);
  border-top: 1px solid var(--mp-line);
  border-bottom: 1px solid var(--mp-line);
}
.mp-integrations-head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 30px;
  flex-wrap: wrap; gap: 12px;
}
.mp-integrations-sub {
  font-size: 13px; color: var(--mp-mute);
  letter-spacing: 0.02em;
}
.mp-marquee {
  overflow: hidden;
  mask-image: linear-gradient(90deg, transparent, black 8%, black 92%, transparent);
  -webkit-mask-image: linear-gradient(90deg, transparent, black 8%, black 92%, transparent);
}
.mp-marquee-track {
  display: flex; gap: 0;
  width: max-content;
  animation: mpMarquee 36s linear infinite;
}
@keyframes mpMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.mp-marquee-cell {
  display: inline-flex; align-items: center; gap: 18px;
  font-size: 16px; letter-spacing: 0.12em; font-weight: 700;
  color: var(--mp-ink-2);
  padding: 0 30px;
  white-space: nowrap;
}
.mp-marquee-dot { color: var(--mp-teal); }

/* ============== FAQ ============== */
.mp-faq { padding: 110px 0; }
.mp-faq-grid {
  display: grid;
  grid-template-columns: 0.9fr 1.4fr;
  gap: 60px;
  align-items: flex-start;
}
@media (max-width: 960px) {
  .mp-faq-grid { grid-template-columns: 1fr; gap: 32px; }
}
.mp-faq-list { display: flex; flex-direction: column; gap: 12px; }
.mp-faq-item {
  background: rgba(255,255,255,0.85);
  border: 1px solid var(--mp-line);
  border-radius: 16px;
  transition: all .2s ease;
  overflow: hidden;
}
.mp-faq-item.is-open {
  border-color: var(--mp-line-strong);
  box-shadow: 0 14px 30px -16px rgba(14, 124, 102, 0.22);
}
.mp-faq-q {
  width: 100%;
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 24px;
  background: transparent;
  border: none;
  text-align: left;
  font-size: 15px; font-weight: 600; color: var(--mp-ink);
  gap: 16px;
}
.mp-faq-toggle {
  width: 28px; height: 28px; border-radius: 8px;
  background: rgba(14, 124, 102, 0.08);
  color: var(--mp-teal);
  display: inline-flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.mp-faq-a {
  padding: 0 24px 22px 24px;
  font-size: 14px; line-height: 1.65;
  color: var(--mp-ink-2);
}

/* ============== FINAL CTA ============== */
.mp-final {
  position: relative;
  padding: 130px 0;
  overflow: hidden;
  border-top: 1px solid var(--mp-line);
}
.mp-final-inner {
  text-align: center;
  max-width: 820px;
  margin: 0 auto;
}
.mp-final-eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 7px 16px;
  border-radius: 999px;
  font-size: 11px; letter-spacing: 0.16em; font-weight: 700;
  color: var(--mp-teal);
  background: rgba(255,255,255,0.85);
  border: 1px solid var(--mp-line-strong);
  margin-bottom: 24px;
}
.mp-final-h {
  font-size: 72px; line-height: 1.04;
  letter-spacing: -0.03em; font-weight: 700;
}
.mp-final-body {
  margin-top: 22px;
  font-size: 18px; line-height: 1.65;
  color: var(--mp-ink-2);
}
.mp-final-body strong { color: var(--mp-teal); font-weight: 700; }
.mp-final-ctas {
  margin-top: 36px;
  display: flex; gap: 14px; justify-content: center; flex-wrap: wrap;
}
.mp-final-foot {
  margin-top: 22px;
  font-size: 12px; color: var(--mp-mute);
  letter-spacing: 0.02em;
}

/* ============== FOOTER ============== */
.mp-footer {
  padding: 36px 0;
  border-top: 1px solid var(--mp-line);
  background: rgba(255,255,255,0.6);
}
.mp-footer-inner {
  display: flex; align-items: center; justify-content: space-between;
  gap: 24px; flex-wrap: wrap;
}
.mp-footer-brand { display: flex; align-items: center; gap: 8px; }
.mp-footer-word { font-weight: 700; color: var(--mp-ink); font-size: 14px; }
.mp-footer-by { font-size: 12px; color: var(--mp-mute); }
.mp-footer-links { display: flex; gap: 22px; font-size: 13px; color: var(--mp-mute); }
.mp-footer-links a:hover { color: var(--mp-teal); }
.mp-footer-copy { font-size: 12px; color: var(--mp-mute); }

/* ============== AGENTIC LAYER ============== */
.mp-agents {
  position: relative;
  padding: 110px 0;
  overflow: hidden;
}
.mp-agents .ambient-grid-teal {
  position: absolute;
  inset: 0;
  opacity: 0.45;
}

.mp-agents-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 18px;
  margin-top: 48px;
  position: relative;
}

.mp-agent-card {
  position: relative;
  padding: 26px 26px 22px;
  border-radius: 22px;
  background: linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(247,253,252,0.82) 100%);
  border: 1px solid var(--mp-line-strong);
  box-shadow: 0 24px 60px -28px rgba(14, 124, 102, 0.28);
  overflow: hidden;
  transition: transform .25s ease, box-shadow .25s ease;
}
.mp-agent-card::before {
  content: "";
  position: absolute; inset: 0;
  background: radial-gradient(ellipse 60% 50% at 100% 0%, rgba(34, 184, 160, 0.10), transparent 65%);
  pointer-events: none;
}
.mp-agent-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 32px 80px -32px rgba(14, 124, 102, 0.38);
}
.mp-agent-card.span-7 { grid-column: span 7; }
.mp-agent-card.span-5 { grid-column: span 5; }
.mp-agent-card.span-12 { grid-column: span 12; }
.mp-agent-card.is-wide .mp-agent-desc { max-width: 760px; }

.mp-agent-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.mp-agent-head-left {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.mp-agent-icon {
  width: 48px; height: 48px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  background: linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(236,255,254,0.85) 100%);
  border: 1px solid var(--mp-line-strong);
  flex: 0 0 auto;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.6), 0 6px 18px -8px rgba(14, 124, 102, 0.35);
}
.mp-agent-pulse {
  position: absolute;
  top: -2px; right: -2px;
  width: 10px; height: 10px;
  border-radius: 999px;
  background: var(--mp-teal-2);
  box-shadow: 0 0 0 3px rgba(34, 184, 160, 0.18);
  animation: mp-pulse 1.8s ease-in-out infinite;
}
@keyframes mp-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.55; transform: scale(0.82); }
}

.mp-agent-titlewrap { min-width: 0; }
.mp-agent-eyebrow {
  font-family: inherit;
  font-size: 10.5px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--mp-mute);
}
.mp-agent-titlerow {
  margin-top: 2px;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--mp-ink);
  line-height: 1.15;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mp-agent-code { color: var(--mp-teal); }
.mp-agent-role {
  color: var(--mp-mute);
  font-weight: 400;
  font-size: 15px;
}

.mp-agent-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  font-family: inherit;
  font-size: 10.5px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--mp-teal);
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(34, 184, 160, 0.10);
  border: 1px solid var(--mp-line-strong);
}
.mp-agent-status.status-learning {
  color: #B97A0E;
  background: rgba(255, 196, 71, 0.14);
  border-color: rgba(185, 122, 14, 0.28);
}
.mp-agent-status-dot {
  width: 6px; height: 6px;
  border-radius: 999px;
  background: var(--mp-teal-2);
  box-shadow: 0 0 0 3px rgba(34, 184, 160, 0.20);
  animation: mp-pulse 1.8s ease-in-out infinite;
}
.mp-agent-status.status-learning .mp-agent-status-dot {
  background: #F2A03B;
  box-shadow: 0 0 0 3px rgba(242, 160, 59, 0.22);
}

.mp-agent-desc {
  margin-top: 18px;
  font-size: 14px;
  line-height: 1.65;
  color: var(--mp-ink-2);
}

.mp-agent-stats {
  display: grid;
  gap: 10px;
  margin-top: 18px;
}
.mp-agent-stat {
  padding: 10px 12px;
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(236,255,254,0.65) 0%, rgba(255,255,255,0.75) 100%);
  border: 1px solid var(--mp-line);
}
.mp-agent-stat-label {
  font-family: inherit;
  font-size: 10.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--mp-mute);
}
.mp-agent-stat-value {
  margin-top: 2px;
  font-size: 15px;
  font-weight: 600;
  color: var(--mp-ink);
  letter-spacing: -0.01em;
}

.mp-agent-lastaction {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--mp-line);
  font-size: 12px;
  color: var(--mp-mute);
  line-height: 1.55;
}
.mp-agent-lastaction-k {
  color: var(--mp-teal);
  font-weight: 600;
  letter-spacing: 0.02em;
}

.mp-agent-foot {
  margin-top: 24px;
  padding: 16px 22px;
  border-radius: 999px;
  border: 1px solid var(--mp-line);
  background: linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(236,255,254,0.72) 100%);
  color: var(--mp-mute);
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  position: relative;
}
.mp-agent-foot svg { color: var(--mp-teal); flex: 0 0 auto; }

/* ECHO split (icon/desc + live event stream) */
.mp-agent-card.is-echo { padding: 28px; }
.mp-agent-echo-grid {
  display: grid;
  grid-template-columns: 5fr 7fr;
  gap: 28px;
  align-items: stretch;
}
.mp-agent-echo-left {
  display: flex;
  flex-direction: column;
}
.mp-agent-echo-left .mp-agent-desc { max-width: 460px; }
.mp-agent-echo-left .mp-agent-lastaction { margin-top: auto; }
.mp-agent-echo-right {
  display: flex;
  align-items: stretch;
}

.mp-agents-stream {
  width: 100%;
  border-radius: 18px;
  padding: 18px 20px;
  background: linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(236,255,254,0.85) 100%);
  border: 1px solid var(--mp-line-strong);
  display: flex;
  flex-direction: column;
}
.mp-agents-stream-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.mp-agents-stream-eyebrow {
  font-family: inherit;
  font-size: 10.5px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--mp-teal);
  font-weight: 600;
}
.mp-agents-stream-meta {
  font-family: inherit;
  font-size: 11px;
  color: var(--mp-mute);
}
.mp-agents-stream-list {
  display: flex;
  flex-direction: column;
}
.mp-agents-stream-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 0;
  border-bottom: 1px solid var(--mp-line);
  font-size: 12.5px;
  font-family: inherit;
}
.mp-agents-stream-row.is-last { border-bottom: none; padding-bottom: 4px; }
.mp-agents-stream-event { color: var(--mp-ink-2); }
.mp-agents-stream-route { color: var(--mp-teal); font-weight: 600; }
.mp-agents-stream-row.is-muted .mp-agents-stream-route { color: var(--mp-mute); font-weight: 500; }

/* Coordination layer pill */
.mp-agents-coord {
  margin-top: 32px;
  padding: 22px 24px;
  border-radius: 22px;
  border: 1px solid var(--mp-line-strong);
  background: linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(236,255,254,0.88) 100%);
  box-shadow: 0 24px 60px -32px rgba(14, 124, 102, 0.30);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  flex-wrap: wrap;
}
.mp-agents-coord-left {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
  flex: 1 1 480px;
}
.mp-agents-coord-icon {
  width: 40px; height: 40px;
  flex: 0 0 auto;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--mp-teal);
  background: linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(236,255,254,0.9) 100%);
  border: 1px solid var(--mp-line-strong);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.7), 0 6px 18px -8px rgba(14, 124, 102, 0.35);
}
.mp-agents-coord-eyebrow {
  font-family: inherit;
  font-size: 10.5px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--mp-mute);
}
.mp-agents-coord-title {
  margin-top: 3px;
  font-size: 15px;
  font-weight: 600;
  color: var(--mp-ink);
  line-height: 1.45;
}
.mp-agents-coord-cta {
  flex: 0 0 auto;
}

/* ============== REVEAL ============== */
.reveal {
  opacity: 0; transform: translateY(20px);
  transition: opacity .8s ease, transform .8s ease;
}
.reveal.in { opacity: 1; transform: none; }

/* ============== RESPONSIVE FIXES ============== */

@media (max-width: 1280px) {
  .mp-h1 { font-size: 62px; }
  .mp-h2 { font-size: 42px; }
  .mp-final-h { font-size: 62px; }
  .mp-roi-bignum { font-size: 74px; }
}

@media (max-width: 1023px) {
  .mp-hero { padding: 130px 0 60px; }
  .mp-hero-grid { grid-template-columns: 1fr; gap: 60px; }
  .mp-hero-right { min-height: 540px; }
  .mp-pillar-title { font-size: 28px; }
  .mp-h1 { font-size: 54px; }
  .mp-h2 { font-size: 36px; }
  .mp-final-h { font-size: 54px; }
}

@media (max-width: 960px) {
  .mp-agents { padding: 80px 0; }
  .mp-agents-grid { grid-template-columns: 1fr; gap: 14px; }
  .mp-agent-card.span-7,
  .mp-agent-card.span-5,
  .mp-agent-card.span-12 { grid-column: span 1; }
  .mp-agent-card { padding: 22px; border-radius: 18px; }
  .mp-agent-card.is-echo { padding: 22px; }
  .mp-agent-titlerow { white-space: normal; font-size: 19px; }
  .mp-agent-role { font-size: 13px; display: block; }
  .mp-agent-stats { grid-template-columns: 1fr 1fr !important; }
  .mp-agent-foot { width: 100%; border-radius: 16px; }
  .mp-agent-echo-grid { grid-template-columns: 1fr; gap: 18px; }
  .mp-agents-coord { flex-direction: column; align-items: flex-start; }
}

@media (max-width: 768px) {
  .mp-container { padding: 0 20px; }
  .mp-h1 { font-size: 42px; }
  .mp-h2 { font-size: 30px; }
  .mp-final-h { font-size: 42px; }
  .mp-hero-sub { font-size: 16px; }
  .mp-hero { padding: 110px 0 50px; }
  .mp-problem, .mp-waterfall, .mp-pillars, .mp-roi, .mp-stories, .mp-faq { padding: 70px 0; }
  .mp-final { padding: 80px 0; }
  .mp-roi-bignum { font-size: 56px; }

  .mp-hero-strip,
  .mp-ticker { grid-template-columns: repeat(2, 1fr); }
  .mp-ticker { margin-top: 60px; }

  .mp-hero-right { min-height: 580px; }
  .mp-offer-card { left: 4%; right: 4%; top: 0; padding: 20px; }
  .mp-offer-amount { font-size: 38px; }
  .mp-hero-side-stat {
    position: relative;
    top: auto; right: auto;
    width: 100%;
    margin-top: 360px;
  }
  .mp-pixel-grid { grid-template-columns: repeat(12, 1fr); }

  .mp-chip { font-size: 10px; padding: 5px 9px; }

  .mp-compare-list li {
    grid-template-columns: 90px 1fr;
    gap: 12px;
  }
  .mp-compare-stat { font-size: 22px; }
  .mp-compare-card { padding: 24px; }

  .mp-pillar { padding: 28px; }
  .mp-pillar.dominant { padding: 28px; }
  .mp-pillar-title { font-size: 24px; }
  .mp-pillar-title.small { font-size: 19px; }

  .mock-side-stat { top: -8px; right: -6px; padding: 10px 12px; min-width: 110px; }
  .mock-side-num { font-size: 22px; }

  .mock-cta-row { grid-template-columns: 1fr; }

  .mp-roi-out { padding: 28px; }
  .mp-roi-card { padding: 24px; }
  .mp-roi-grid-mini { grid-template-columns: 1fr; }

  .mp-synergy { padding: 24px; }
  .mp-synergy-pair { flex-direction: column; align-items: stretch; gap: 10px; }
  .mp-synergy-x { text-align: center; }

  .mp-calendar-card { padding: 22px; }
  .mp-calendar-h { font-size: 26px; }

  .mp-stories-grid { gap: 16px; }
  .mp-story-card { padding: 24px; }

  .mp-footer-inner { flex-direction: column; align-items: flex-start; gap: 14px; }

  .mp-stage-card { text-align: left; }
}

@media (max-width: 480px) {
  .mp-h1 { font-size: 34px; }
  .mp-h2 { font-size: 26px; }
  .mp-final-h { font-size: 34px; }
  .strip-val { font-size: 20px; }
  .mp-ticker-val { font-size: 26px; }
  .mp-roi-bignum { font-size: 46px; }
  .mp-offer-amount { font-size: 32px; }
  .mp-pixel-grid { grid-template-columns: repeat(10, 1fr); }
  /* Hide the bottom-row chips on phones: only 2 top chips remain */
  .mp-chip:nth-child(3),
  .mp-chip:nth-child(4) { display: none; }
}
`;
