'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

/* ============================================================================
 * TradePay · Finance-First Landing
 * Slate (#0F172A) + warm safety orange (#F97316), used sparingly.
 * No icon libraries. Inline SVG only. No external CSS deps beyond Tailwind.
 * ========================================================================== */

type Stage = {
  n: number;
  stage: string;
  title: string;
  body: string;
  metric: string;
};

type RankedOffer = {
  lender: string;
  amount: string;
  apr: string;
  monthly: string;
  term: string;
  status: 'primary' | 'backup' | 'counter' | 'declined';
};

type CaseStudy = {
  quote: string;
  name: string;
  role: string;
  outcomes: { value: string; label: string }[];
};

type Objection = { q: string; a: string };

// Sorted cheapest-monthly-first so the "Recommended" star sits on the
// row a savvy buyer would actually pick — the previous order had
// CoreCredit (more expensive) flagged as Recommended above BuildBank,
// which read as a contradiction. All three offers fund the full ask
// so the comparison reads cleanly without an Amount column.
const HERO_OFFER: RankedOffer[] = [
  {
    lender: 'BuildBank',
    amount: '$24,000',
    apr: '6.99%',
    monthly: '$436 / mo',
    term: '60 mo',
    status: 'primary',
  },
  {
    lender: 'CoreCredit',
    amount: '$24,000',
    apr: '8.49%',
    monthly: '$480 / mo',
    term: '60 mo',
    status: 'backup',
  },
  {
    lender: 'FinWise',
    amount: '$24,000',
    apr: '9.99%',
    monthly: '$510 / mo',
    term: '60 mo',
    status: 'backup',
  },
];

const TICKER = [
  { value: '$12.8M', label: 'Funded last 30 days', delta: '+18% vs prior month' },
  { value: '8,200+', label: 'Homeowners financed', delta: '+940 in 30d' },
  { value: 'Real-time', label: 'Lender marketplace', delta: 'soft pull only' },
  { value: '14s', label: 'Average decision time', delta: 'Soft pull · lender marketplace' },
];

const WATERFALL: Stage[] = [
  {
    n: 1,
    stage: 'Pre-qual',
    title: 'Soft-pull pre-qual at the door',
    body: 'Homeowner enters DOB + last 4 SSN on the rep iPad. Soft pull returns a fundability tier in under 10 seconds. Zero credit impact.',
    metric: '< 10s',
  },
  {
    n: 2,
    stage: 'Brief',
    title: 'Agents pre-qualify on the financial data',
    body: 'PRISM reshapes the apply flow on the rep iPad; ORACLE returns a fundability tier on the soft-pull financial data in under 10 seconds. Software agents qualify silently in the background, not on a phone call.',
    metric: '< 10s',
  },
  {
    n: 3,
    stage: 'Decision',
    title: 'the lender marketplace runs in parallel',
    body: 'TradePay fans the application across every enabled marketplace simultaneously. No waterfall sequencing. Every lender quotes at once.',
    metric: '5s SLA',
  },
  {
    n: 4,
    stage: 'Match',
    title: 'Best offer wins',
    body: 'Offers ranked by consumer-best monthly payment. Promo APRs surface first. Homeowner sees one screen, signs, you book the job.',
    metric: 'Best offer',
  },
  {
    n: 5,
    stage: 'Funded',
    title: 'Lender disburses direct in 48 to 72 hours',
    body: 'Lender disburses straight to your business account, no intermediary holding funds. Funds generally land within 48 to 72 hours of the loan settling. Lender carries the credit risk; no clawback on routine defaults.',
    metric: '48 to 72hr',
  },
];

const PILLAR_FINANCE_BULLETS = [
  'Loans $3,000 to $100,000 · APR from 5.9% for qualifying clients',
  'Terms up to 72 months · lower monthly repayments at the kitchen table',
  '0% interest plans available for qualifying programs (T&Cs apply)',
  'the lender marketplace quotes in parallel at point of sale with a 5-second SLA per round-trip',
  'Merchant-direct payout · funds generally land within 48 to 72 hours of settlement',
  'Lender carries the credit risk · no clawback on routine defaults',
  'White-labeled · homeowner sees YOUR brand on the apply flow',
];

type RouteNode = {
  id: string;
  x: number;
  y: number;
  status: 'depot' | 'qualified' | 'unqualified';
  label?: string;
};

const ESTIMATOR_ROUTES: RouteNode[] = [
  { id: 'depot', x: 50, y: 50, status: 'depot', label: 'Depot' },
  { id: 'n1', x: 22, y: 22, status: 'qualified', label: '$24k roof' },
  { id: 'n2', x: 78, y: 28, status: 'qualified', label: '$18k HVAC' },
  { id: 'n3', x: 86, y: 70, status: 'qualified', label: '$42k solar' },
  { id: 'n4', x: 18, y: 76, status: 'qualified', label: '$9k siding' },
  { id: 'n5', x: 38, y: 18, status: 'unqualified' },
  { id: 'n6', x: 70, y: 86, status: 'unqualified' },
];

type AgentIconKey = 'prism' | 'vega' | 'oracle' | 'helix' | 'nexus' | 'flux' | 'echo';

type EchoEvent = {
  source: string;
  destination: string;
  highlight: boolean;
};

type Agent = {
  n: string;
  code: string;
  role: string;
  span: 5 | 7 | 12;
  status: 'ONLINE' | 'LEARNING';
  iconKey: AgentIconKey;
  description: string;
  stats: { k: string; v: string }[];
  lastAction: string;
  /** Only set on the full-width ECHO card. */
  stream?: {
    title: string;
    rate: string;
    events: EchoEvent[];
  };
};

const AGENTS: Agent[] = [
  {
    n: '01',
    code: 'PRISM',
    role: 'Intake Agent',
    span: 7,
    status: 'ONLINE',
    iconKey: 'prism',
    description:
      'PRISM watches every apply-form session in real time. It reshapes question order based on partial answers, kills friction for high-intent homeowners, and adds verification steps when it detects junk. It learns which question sequences convert per traffic source.',
    stats: [
      { k: 'Sessions / hr', v: '6,140' },
      { k: 'Field skips', v: '38%' },
      { k: 'Form drop-off', v: '−41%' },
    ],
    lastAction:
      'reordered branch on traffic_source=meta_advantage to ask project_type before income_band · 14s ago',
  },
  {
    n: '02',
    code: 'VEGA',
    role: 'Enrichment Agent',
    span: 5,
    status: 'ONLINE',
    iconKey: 'vega',
    description:
      'VEGA orchestrates 12 enrichment providers in parallel. It picks the cheapest source likely to return a match, falls back automatically on failure, and dedupes identity collisions across vendors.',
    stats: [
      { k: 'Avg cost / lead', v: '$0.41' },
      { k: 'Identity match', v: '94%' },
    ],
    lastAction: 'fell back to provider_03 after timeout on provider_01 · saved $0.18 · 2s ago',
  },
  {
    n: '03',
    code: 'ORACLE',
    role: 'Scoring Agent',
    span: 5,
    status: 'LEARNING',
    iconKey: 'oracle',
    description:
      'ORACLE runs a calibrated propensity model trained on your closed-won outcomes, not a generic lookalike. It retrains nightly on every disposition your reps log and surfaces drift before it affects revenue.',
    stats: [
      { k: 'Model AUC', v: '0.89' },
      { k: 'Last retrain', v: '4h ago' },
    ],
    lastAction: 'flagged feature drift on project_value. Recalibrated thresholds · 4h ago',
  },
  {
    n: '04',
    code: 'HELIX',
    role: 'Routing Agent',
    span: 7,
    status: 'ONLINE',
    iconKey: 'helix',
    description:
      'HELIX matches every qualified homeowner to the right rep, not just the next available one. It learns which reps close which tiers, accounts for rep capacity in real time, and routes around vacations, lunch, and underperformance without anyone asking.',
    stats: [
      { k: 'Avg route time', v: '320ms' },
      { k: 'Rep match lift', v: '+31%' },
      { k: 'SLA breach', v: '0.4%' },
    ],
    lastAction: 'rerouted T1 homeowner away from rep_M.Chen (capacity 98%) → rep_S.Patel · 1s ago',
  },
  {
    n: '05',
    code: 'NEXUS',
    role: 'Lender Marketplace Agent',
    span: 7,
    status: 'ONLINE',
    iconKey: 'nexus',
    description:
      'NEXUS routes every qualified homeowner through a curated multi-lender marketplace, prime to subprime, $3,000 to $100,000. Soft pull only. It learns which lenders approve which buyer profiles, watches stip rates in real time, and reroutes around lenders that tighten overnight.',
    stats: [
      { k: 'Marketplace', v: 'parallel quoting' },
      { k: 'Pull type', v: 'Soft' },
      { k: 'Decision', v: '< 10s' },
    ],
    lastAction:
      'matched buyer profile (V4=712, DTI=0.34, ask=$24k) to lender_07 + 2 backups · 12s ago',
  },
  {
    n: '06',
    code: 'FLUX',
    role: 'Funding Agent',
    span: 5,
    status: 'ONLINE',
    iconKey: 'flux',
    description:
      'FLUX shepherds every approved deal from sign to fund. It chases stip documents, walks the homeowner through approval acceptance, watches the lender funding queue, and reconciles every funded job back to the originating ad campaign.',
    stats: [
      { k: 'Funded in 48 to 72hr', v: '94.1%' },
      { k: 'Stip recovery', v: '+22%' },
    ],
    lastAction: 'auto-collected outstanding stip docs on job_8412 · cleared funding · 8s ago',
  },
  {
    n: '07',
    code: 'ECHO',
    role: 'Attribution Agent',
    span: 12,
    status: 'ONLINE',
    iconKey: 'echo',
    description:
      'ECHO closes the loop. It holds pixel events until a homeowner clears qualification, then fires weighted conversions back to Meta and Google via server-side CAPI. It uploads closed-won jobs as offline conversions. The cleanest training signal your ad account will ever see.',
    stats: [],
    lastAction: 'uploaded 47 closed-won jobs to Meta CAPI, weighted by job_value · 6m ago',
    stream: {
      title: 'ECHO · live event stream',
      rate: 'events/min · 142',
      events: [
        {
          source: 'homeowner_qualified · T1',
          destination: '→ Meta CAPI · weight 1.00',
          highlight: true,
        },
        {
          source: 'homeowner_qualified · T2',
          destination: '→ Google Offline · weight 0.65',
          highlight: true,
        },
        {
          source: 'job_closed · $14,200',
          destination: '→ Meta CAPI · weight 2.20',
          highlight: true,
        },
        {
          source: 'homeowner_disqualified · T4',
          destination: '→ suppressed · audience exclude',
          highlight: false,
        },
        {
          source: 'job_closed · $8,900',
          destination: '→ Google Offline · weight 1.40',
          highlight: true,
        },
      ],
    },
  },
];

const CASE_STUDIES: CaseStudy[] = [
  {
    quote:
      'Home Depot installers were beating us on the deferred-interest pitch every week. Plugged in TradePay and our close rate on $10k+ HVAC swaps jumped. Same crew, same prices. We recovered a lot of jobs in year one.',
    name: 'Devin Cho',
    role: 'Owner · Iron Horse HVAC · Las Vegas, NV',
    outcomes: [
      { value: 'Lifted', label: 'Close rate' },
      { value: 'Won', label: 'More jobs' },
    ],
  },
  {
    quote:
      'The agentic layer pre-qualifies every inbound application on the financial data (soft-pull credit, propensity, lender routing) before it ever hits a human. PRISM reshapes the apply flow in real time, ORACLE scores against our actual closed-won data, and HELIX routes the qualified homeowner to the right estimator in under a second. Our estimators only drive to jobs where the homeowner can actually afford the work.',
    name: 'Marisol Tran',
    role: 'GM · Pacific Solar Co. · San Francisco, CA',
    outcomes: [
      { value: 'Filtered', label: 'Junk applications' },
      { value: 'Lifted', label: 'Estimator hit rate' },
    ],
  },
  {
    quote:
      'Instant doorstep approvals are the whole game. Homeowner sees the monthly payment before we leave the driveway, signs at the kitchen table, and we book the job. Doorstep close rate went up. Same crew, same prices.',
    name: 'Mike Henderson',
    role: 'Owner · TradeForce Pro · Sacramento, CA',
    outcomes: [
      { value: 'Won', label: 'More jobs at the door' },
      { value: 'Lifted', label: 'Doorstep close' },
    ],
  },
];

const INTEGRATIONS = [
  'Cross River Bank',
  'engine.tech',
  'FinWise',
  'BuildBank',
  'Plaid',
  'Stripe',
  'Modern Treasury',
  'Persona',
  'Sift',
  'CoreCredit',
];

const OBJECTIONS: Objection[] = [
  {
    q: 'How are you different from PowerPay, Service Finance, EnerBank, or GoodLeap?',
    a: 'Those are single-lender or two-lender programs. TradePay is a parallel lender marketplace. Every quote fires at the same instant, ranked by consumer-best monthly payment. You can keep your incumbent program AND run TradePay; most contractors stack us. One portal, one apply flow, one agentic layer behind it.',
  },
  {
    q: 'What are the lending terms?',
    a: 'Loans run from $3,000 to $100,000, APR from 5.9% for qualifying clients, and terms up to 72 months for lower monthly repayments. 0% interest plans are available for qualifying programs (T&Cs apply). Every homeowner sees multiple lender offers personalized to their situation, ranked by consumer-best monthly payment.',
  },
  {
    q: 'When and how do I get paid?',
    a: 'Merchant-direct. The lender disburses straight to your business account, no intermediary holding funds, no payment-rail switch. Funds generally land within 48 to 72 hours of the loan settling. The lender carries the credit risk and there is no clawback on routine defaults.',
  },
  {
    q: 'Will my margins drop? I hear horror stories about dealer fees.',
    a: 'Dealer fees are transparent, configurable per product type, and set by the lender. On a $14k HVAC swap with a 6% dealer fee, you net $13.16k, and you close more deals because the homeowner sees a yes-able monthly payment on the doorstep. The math heavily favours running the financing. You can also pass the fee through on standard-rate plans.',
  },
  {
    q: 'What about clawbacks if the homeowner defaults?',
    a: 'Lender carries the credit risk after the funds release. There are no contractor clawbacks on routine defaults on standard-rate plans. On promo 0% APR plans, clawback is limited to the promo discount (not the principal) and only if the homeowner fails to convert within the promo window. T&Cs apply per lender program.',
  },
  {
    q: 'How do the AUREAN agents work? Do they call my customers?',
    a: 'No. The seven agents (PRISM, VEGA, ORACLE, HELIX, NEXUS, FLUX, ECHO) are pre-qualification agents that work on the financial data in software: soft-pull credit, identity enrichment, propensity scoring, lender routing, and pixel attribution. They never make outbound calls, never voice-dial, never text-blast. They qualify silently in the background and surface the financially-qualified homeowners to your human sales, estimator, and dispatcher team.',
  },
  {
    q: 'How fast do you onboard a contractor?',
    a: 'Self-serve signup in 5 minutes. KYB clears in 60 seconds in most cases. From there, you can start running soft-pull pre-quals at the door as soon as your first crew is configured.',
  },
];

const NAV_LINKS = [
  { href: '#financing', label: 'Financing' },
  { href: '#how', label: 'How it works' },
  { href: '#agents', label: 'Agents' },
  { href: '#roi', label: 'ROI' },
  { href: '#stories', label: 'Stories' },
];

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(n)));

/* -------------------------------------------------------------------------- */
/* Hooks                                                                       */
/* -------------------------------------------------------------------------- */

function useScrollY(): number {
  const [y, setY] = useState(0);
  useEffect(() => {
    const onScroll = () => setY(window.scrollY);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return y;
}

function useReveal(): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('in');
        });
      },
      { threshold: 0.12 },
    );
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

/* -------------------------------------------------------------------------- */
/* Inline SVG primitives                                                       */
/* -------------------------------------------------------------------------- */

function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-lg"
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(135deg, #0F172A 0%, #334155 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 4px 12px -4px rgba(15,23,42,0.6)',
      }}
    >
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none">
        <path
          d="M4 5h16M10 5v15M14 5v15M4 11h6M14 11h6"
          stroke="#F1F5F9"
          strokeWidth={2.2}
          strokeLinecap="square"
        />
      </svg>
    </span>
  );
}

function IconArrowRight({ className = '' }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path
        d="M5 12.5l4.5 4.5L19 7"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBlueprint() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 6h18M3 12h12M3 18h18M15 12l3 -3M15 12l3 3"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="square"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export default function TradePayLandingPage() {
  useReveal();
  const scrollY = useScrollY();
  const navCondensed = scrollY > 16;

  return (
    <div className="tp-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <TopNav condensed={navCondensed} />

      <main>
        <Hero />
        <LiveTicker />
        <ProblemSection />
        <WaterfallSection />
        <PillarFinancing />
        <PillarAgents />
        <RoiSection />
        <CaseStudiesSection />
        <IntegrationsMarquee />
        <ObjectionsSection />
        <FinalCta />
      </main>

      <Footer />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Nav                                                                         */
/* -------------------------------------------------------------------------- */

function TopNav({ condensed }: { condensed: boolean }) {
  return (
    <header className={`tp-nav-wrap ${condensed ? 'condensed' : ''}`}>
      <div className="mx-auto max-w-7xl px-6">
        <div className="tp-nav">
          <a href="#top" className="flex items-center gap-2.5">
            <LogoMark />
            <span className="font-semibold tracking-tight text-slate-900">TradePay</span>
            <span className="hidden sm:inline tp-nav-tag">
              Financing for the trades that build America
            </span>
          </a>

          <nav className="hidden lg:flex items-center gap-7 text-sm text-slate-600">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="hover:text-slate-900 transition">
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <a
              href="/apply/tradepay"
              className="hidden sm:inline-flex tp-btn-ghost text-sm px-4 py-2"
            >
              See the contractor flow
            </a>
            <a href="/submit/trade-pay" className="tp-btn-primary text-sm px-4 py-2">
              Start TradePay signup
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Hero                                                                        */
/* -------------------------------------------------------------------------- */

function Hero() {
  return (
    <section id="top" className="relative tp-hero pt-40 pb-24">
      <div className="absolute inset-0 tp-mesh" />
      <div className="absolute inset-0 tp-grid" />
      <div className="absolute inset-0 tp-noise" />

      <div className="relative mx-auto max-w-7xl px-6">
        {/* items-center vertically centers the offer card against the
            headline block instead of top-aligning it with the eyebrow,
            which was making the card look like it floated above. */}
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          {/* LEFT · headline */}
          <div className="lg:col-span-7 reveal">
            <div className="inline-flex items-center gap-2.5 tp-eyebrow-pill">
              <span className="tp-pill-dot" />
              <span className="tracking-[0.18em]">
                FOR ROOFING · HVAC · SOLAR · REMODEL · EXTERIOR
              </span>
            </div>

            <h1 className="mt-7 tp-h1">
              <span className="tp-grad-text">Every customer gets</span>
              <br />
              <span className="tp-grad-text">an instant decision.</span>
              <br />
              <span className="tp-grad-text-darker">At the door.</span>
            </h1>

            <p className="mt-7 text-lg text-slate-600 max-w-2xl leading-relaxed">
              the lender marketplace quotes in parallel on a single soft pull. The homeowner sees
              one screen with the best monthly payment and signs at the kitchen table.{' '}
              <span className="text-slate-900 font-medium">
                The lender carries the credit risk. You book the job before your rep is back to the
                truck.
              </span>
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              {/* /submit/trade-pay is the real merchant application form.
                  The previous /welcome target was a token-gated password
                  setup page intended only for invited Owners after they
                  completed onboarding, so a cold visitor clicking
                  Start signup landed on a broken state. */}
              <a
                href="/submit/trade-pay"
                className="tp-btn-primary tp-cta-glow text-sm px-6 py-3.5"
              >
                Start TradePay signup
                <IconArrowRight className="ml-1.5" />
              </a>
              <a href="/apply/tradepay" className="tp-btn-ghost text-sm px-6 py-3.5">
                See the contractor flow
              </a>
            </div>

            {/* Trust + pricing micro-line — surfaces licensing posture
                and cost model above the fold so contractors can vet
                the deal without scrolling. NMLS placeholder; swap for
                the real number before this domain ships externally. */}
            <div className="mt-5 tp-hero-trust">
              <span className="tp-hero-trust-item">NMLS&nbsp;#2456701</span>
              <span className="tp-hero-trust-dot" aria-hidden>
                ·
              </span>
              <span className="tp-hero-trust-item">% of funded volume only</span>
              <span className="tp-hero-trust-dot" aria-hidden>
                ·
              </span>
              <span className="tp-hero-trust-item">No monthly fee, no contract</span>
            </div>

            {/* Inline trust strip — 3 stats, all quantified. "Soft pull"
                was dropped because it was the only non-numeric cell
                and the same data point lives in the offer-card chip. */}
            <div className="mt-10 tp-trust-strip">
              <div className="tp-trust-cell">
                <div className="tp-trust-num">
                  Real-time<span className="tp-trust-pct"></span>
                </div>
                <div className="tp-trust-lbl">Lenders in parallel</div>
              </div>
              <div className="tp-trust-cell">
                <div className="tp-trust-num">
                  8,200<span className="tp-trust-pct">+</span>
                </div>
                <div className="tp-trust-lbl">Homeowners funded</div>
              </div>
              <div className="tp-trust-cell">
                <div className="tp-trust-num">
                  14<span className="tp-trust-pct">s</span>
                </div>
                <div className="tp-trust-lbl">Decision at the door</div>
              </div>
            </div>
          </div>

          {/* RIGHT · Offer card · wrapped in 3D scene */}
          <div className="lg:col-span-5 relative reveal tp-hero-scene">
            <div className="tp-hero-stage">
              <HeroOfferCard />
            </div>

            {/* Two anchor chips — LIVE on the top-left (proof the
                marketplace is actually quoting) and FUNDED 30D on the
                top-right (proof the money has moved). The previous
                SOFT PULL + DECISION chips at the bottom repeated data
                already inside the offer card. */}
            <div
              className="tp-chip tp-chip-orange tp-chip-pulse"
              style={{ top: '-56px', left: '-8px' }}
            >
              <span className="tp-chip-dot tp-chip-dot-orange" />
              <span className="tp-chip-k">LIVE</span>
              <span className="tp-chip-v">12 deals/hr</span>
            </div>
            <div className="tp-chip tp-chip-funded" style={{ top: '-56px', right: '-8px' }}>
              <span className="tp-chip-dot" />
              <span className="tp-chip-k">FUNDED 30D</span>
              <span className="tp-chip-v">$12.8M</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroOfferCard() {
  return (
    <div className="tp-offer-card">
      {/* Header — single APPROVED indicator (the previous footer chip
          said APPROVED a second time on the same card). */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200/70">
        <div className="tp-status-pill">
          <span className="tp-status-pill-scan" aria-hidden />
          <span className="tp-live-dot" />
          <span className="text-[10.5px] uppercase tracking-[0.22em] font-semibold text-slate-700">
            TradePay · approved
          </span>
        </div>
        <span className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Match · 14s</span>
      </div>

      {/* Project line */}
      <div className="px-5 py-4 border-b border-slate-200/70">
        <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500 flex items-center gap-1.5">
          Roof replacement · Henderson residence
          {/* Explicit "illustrative" tag — the project name, dollar
              amount, and the lender names below are mock data for
              visual demo. Naming specific lenders without the tag
              could imply a partnership that doesn't exist. */}
          <span className="text-[8.5px] tracking-[0.18em] font-semibold text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">
            Illustrative
          </span>
        </div>
        <div className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">$24,000</div>
      </div>

      {/* Ranked offers — 3 cols (LENDER / MONTHLY / TERM). APR column
          dropped to match the defensive sweep on the apply-flow
          calculator (PR #50). */}
      <div className="px-5 py-4 border-b border-slate-200/70">
        <div className="grid grid-cols-12 text-[9.5px] uppercase tracking-[0.18em] text-slate-500 pb-2 border-b border-slate-200/60">
          <div className="col-span-6">Lender</div>
          <div className="col-span-4 text-right">Monthly</div>
          <div className="col-span-2 text-right">Term</div>
        </div>

        {HERO_OFFER.map((o) => (
          <div
            key={o.lender}
            className={`grid grid-cols-12 items-center py-2.5 text-[12.5px] ${
              o.status === 'primary' ? 'tp-offer-row-primary' : 'text-slate-600'
            }`}
          >
            <div className="col-span-6 flex items-center gap-2">
              {o.status === 'primary' ? (
                <span className="tp-star">★</span>
              ) : (
                <span className="tp-row-dot" />
              )}
              <span
                className={
                  o.status === 'primary' ? 'font-semibold text-slate-900' : 'text-slate-700'
                }
              >
                {o.lender}
              </span>
              {o.status === 'primary' && (
                <span className="text-[8.5px] uppercase tracking-[0.18em] text-orange-600 font-semibold ml-1">
                  Recommended
                </span>
              )}
            </div>
            <div
              className={`col-span-4 text-right tabular-nums ${
                o.status === 'primary' ? 'font-semibold text-slate-900' : ''
              }`}
            >
              {o.monthly}
            </div>
            <div className="col-span-2 text-right tabular-nums">{o.term}</div>
          </div>
        ))}
      </div>

      {/* Single trust line — used to be three competing trust surfaces
          (header "Soft pull · 0 impact", inner stats strip, footer
          "Merchant-direct" line). One line, all three points. */}
      <div className="px-5 py-3.5 bg-slate-50/70 text-[10.5px] uppercase tracking-[0.18em] text-slate-600 text-center">
        FCRA soft pull · funds in 48 to 72hr · merchant-direct
      </div>

      {/* In-card CTA — sits inside the card rather than floating
          across the bottom edge with chips around it. Routes to the
          real consumer apply flow. */}
      <div className="px-5 pt-3 pb-5">
        <a
          href="/apply/tradepay"
          className="tp-btn-primary tp-cta-glow text-sm w-full justify-center"
        >
          Start my application
          <IconArrowRight className="ml-1.5" />
        </a>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Live ticker                                                                 */
/* -------------------------------------------------------------------------- */

function LiveTicker() {
  return (
    <section className="relative border-y border-slate-200/70 bg-white/60 backdrop-blur tp-ticker-section">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-6">
          {TICKER.map((t) => (
            <div key={t.label} className="tp-ticker-cell flex flex-col">
              <div className="flex items-baseline gap-2">
                <div className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {t.value}
                </div>
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                {t.label}
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                <span className="tp-delta-dot" />
                {t.delta}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Problem section (dark slate band)                                          */
/* -------------------------------------------------------------------------- */

function ProblemSection() {
  return (
    <section className="relative tp-problem">
      <div className="absolute inset-0 tp-blueprint-grid opacity-[0.12]" />
      <div className="absolute inset-0 tp-problem-glow" />

      <div className="relative mx-auto max-w-7xl px-6 py-28">
        <div className="max-w-3xl reveal">
          <div className="tp-eyebrow-dark">01 · THE COST OF DOING NOTHING</div>
          <h2 className="mt-3 tp-h2 tp-grad-text-on-dark">
            Every homeowner who says "I need to think about it" walks out with $18,000 of unfunded
            work.
          </h2>
          <p className="mt-5 text-lg text-slate-300 leading-relaxed">
            Home Depot installers, Sunrun, every big-box contractor runs financing on the truck.
            They turn an $18k roof into "$310/month for 60 months" before the homeowner can finish
            saying "let me get another quote." When you don't run financing, you don't lose the
            price war. You lose the close.
          </p>
        </div>

        {/* Status quo vs With TradePay */}
        <div className="mt-16 grid lg:grid-cols-2 gap-6 reveal">
          {/* Status quo */}
          <div className="tp-problem-card">
            <div className="flex items-center justify-between mb-6">
              <div className="text-[10.5px] uppercase tracking-[0.22em] text-slate-400 font-semibold">
                Status quo · stitched stack
              </div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Today</div>
            </div>
            <div className="space-y-4">
              <StatusQuoRow value="41%" label="Close rate on $10k+ system swaps" />
              <StatusQuoRow value="$220k" label="Annual jobs lost per crew to 'another quote'" />
              <StatusQuoRow
                value="68%"
                label="Inbound applications never pre-qualified before driveway"
              />
              <StatusQuoRow
                value="3 days"
                label="Wait time before homeowner hears back on financing"
              />
            </div>
            <div className="mt-7 pt-5 border-t border-slate-700/70 text-[12.5px] text-slate-400 leading-relaxed">
              Three logins. Three apply flows. Three rounds of lender phone-tag. Every estimator
              slot burned on a homeowner who can&apos;t afford the work is an $18k job walking down
              the street.
            </div>
          </div>

          {/* With TradePay */}
          <div className="tp-problem-card tp-problem-card-hi">
            <div className="flex items-center justify-between mb-6">
              <div className="text-[10.5px] uppercase tracking-[0.22em] text-orange-400 font-semibold">
                With TradePay · one platform
              </div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-300 flex items-center gap-1.5">
                <span className="tp-pill-dot tp-pill-dot-orange" />
                Live
              </div>
            </div>
            <div className="space-y-4">
              <ResultRow value="One" label="Apply flow on the rep iPad · branded as you" />
              <ResultRow value="Real-time" label="Lender marketplace · single soft pull" />
              <ResultRow
                value="320ms"
                label="HELIX routes every qualified homeowner to the right rep"
              />
              <ResultRow
                value="14s"
                label="Decision at the door · the lender marketplace quotes in parallel"
              />
            </div>
            <div className="mt-7 pt-5 border-t border-slate-600/70 text-[12.5px] text-slate-200 leading-relaxed">
              One apply flow. One ranked-offer screen. The homeowner signs at the kitchen table.{' '}
              <span className="text-white font-semibold">Lender carries the credit risk.</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatusQuoRow({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="text-2xl font-bold text-slate-300 tabular-nums shrink-0 min-w-[6rem]">
        {value}
      </div>
      <div className="text-sm text-slate-400 leading-relaxed mt-1.5">{label}</div>
    </div>
  );
}

function ResultRow({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="text-2xl font-bold tp-result-num tabular-nums shrink-0 min-w-[6rem]">
        {value}
      </div>
      <div className="text-sm text-slate-200 leading-relaxed mt-1.5">{label}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Waterfall section · schematic flow                                          */
/* -------------------------------------------------------------------------- */

function WaterfallSection() {
  return (
    <section id="how" className="relative py-28 border-t border-slate-200/70">
      <div className="absolute inset-0 tp-grid opacity-50" />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="max-w-3xl reveal">
          <div className="tp-eyebrow">02 · HOW IT WORKS</div>
          <h2 className="mt-3 tp-h2 tp-grad-text">
            One platform. Five stages. From doorstep quote to signed job.
          </h2>
          <p className="mt-5 text-lg text-slate-600 leading-relaxed">
            Every TradePay deal moves through the same deterministic pipeline. Soft-pull pre-qual at
            the door. The agentic layer pre-qualifies on the financial data. the lender marketplace
            quote in parallel. Best offer wins. Lender disburses merchant-direct within 48 to 72
            hours. Every stage is logged, replayable, and instrumented.
          </p>
        </div>

        {/* Schematic flow · flat blueprint */}
        <div className="mt-16 reveal tp-schematic-scene">
          <div className="tp-schematic-stage">
            <span className="tp-schematic-scanline" aria-hidden />
            <WaterfallSchematic />
          </div>
        </div>

        {/* Stage detail cards */}
        <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-5 gap-3 reveal">
          {WATERFALL.map((s) => (
            <div key={s.n} className="tp-stage-card">
              <div className="flex items-center justify-between">
                <div className="tp-stage-n">{String(s.n).padStart(2, '0')}</div>
                <div className="tp-stage-tag">{s.stage}</div>
              </div>
              <h3 className="mt-3 text-[15px] font-semibold tracking-tight text-slate-900 leading-snug">
                {s.title}
              </h3>
              <p className="mt-2 text-[13px] text-slate-600 leading-relaxed">{s.body}</p>
              <div className="mt-4 pt-3 border-t border-slate-200/70 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  Latency
                </span>
                <span className="text-[12.5px] font-semibold text-slate-900 tabular-nums">
                  {s.metric}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const SCHEMATIC_CAPTIONS: Record<number, string> = {
  1: 'Soft-pull pre-qual at the door',
  2: 'Pre-call brief for the rep',
  3: 'the lender marketplace runs in parallel',
  4: 'Best offer wins',
  5: 'Lender disburses direct',
};

function WaterfallSchematic() {
  /* A schematic-style horizontal flow with right-angle connectors,
     numbered nodes, dashed annotations. Inline SVG. */
  return (
    <div className="tp-schematic">
      <svg viewBox="0 0 1280 320" className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="schemEdge" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#94A3B8" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#475569" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#94A3B8" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="schemNodeFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#F8FAFC" />
          </linearGradient>
          <filter id="schemNodeLift" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#0F172A" floodOpacity="0.22" />
            <feDropShadow
              dx="0"
              dy="2"
              stdDeviation="1.5"
              floodColor="#0F172A"
              floodOpacity="0.18"
            />
          </filter>
          <marker
            id="schemArr"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M0 0 L10 5 L0 10 Z" fill="#475569" />
          </marker>
        </defs>

        {/* Outer schematic frame · dashed engineering border */}
        <rect
          x="20"
          y="40"
          width="1240"
          height="240"
          fill="none"
          stroke="#CBD5E1"
          strokeWidth="1"
          strokeDasharray="2 6"
        />

        {/* corner tick marks */}
        {[
          [20, 40],
          [1260, 40],
          [20, 280],
          [1260, 280],
        ].map(([x, y], i) => (
          <g key={i}>
            <line
              x1={x as number}
              y1={(y as number) - 8}
              x2={x as number}
              y2={(y as number) + 8}
              stroke="#94A3B8"
              strokeWidth="1.2"
            />
            <line
              x1={(x as number) - 8}
              y1={y as number}
              x2={(x as number) + 8}
              y2={y as number}
              stroke="#94A3B8"
              strokeWidth="1.2"
            />
          </g>
        ))}

        {/* engineering title block */}
        <g>
          <line x1="40" y1="60" x2="220" y2="60" stroke="#94A3B8" strokeWidth="1" />
          <text x="40" y="74" fontFamily="inherit" fontSize="9" fill="#64748B" letterSpacing="2">
            TP-FLOW-001 · REV. 4.2
          </text>
        </g>
        <g>
          <line x1="1060" y1="60" x2="1240" y2="60" stroke="#94A3B8" strokeWidth="1" />
          <text
            x="1240"
            y="74"
            textAnchor="end"
            fontFamily="inherit"
            fontSize="9"
            fill="#64748B"
            letterSpacing="2"
          >
            DETERMINISTIC · 5 STAGES
          </text>
        </g>

        {/* Stage nodes · 5 evenly spaced */}
        {WATERFALL.map((s, i) => {
          const cx = 145 + i * 247;
          const cy = 160;
          return (
            <g key={s.n}>
              {/* Connector to next */}
              {i < WATERFALL.length - 1 && (
                <g>
                  <line
                    x1={cx + 70}
                    y1={cy}
                    x2={cx + 247 - 70}
                    y2={cy}
                    stroke="url(#schemEdge)"
                    strokeWidth="1.6"
                    markerEnd="url(#schemArr)"
                  />
                  {/* parallel hairline above for "data path" feel */}
                  <line
                    x1={cx + 70}
                    y1={cy - 6}
                    x2={cx + 247 - 70}
                    y2={cy - 6}
                    stroke="#CBD5E1"
                    strokeWidth="1"
                    strokeDasharray="3 4"
                  />
                  {/* connector annotation */}
                  <text
                    x={cx + 247 / 2}
                    y={cy - 14}
                    textAnchor="middle"
                    fontFamily="inherit"
                    fontSize="9"
                    fill="#64748B"
                    letterSpacing="1.5"
                  >
                    {s.metric}
                  </text>
                </g>
              )}

              {/* Node ring · raised off the schematic surface */}
              <circle
                cx={cx}
                cy={cy}
                r="56"
                fill="url(#schemNodeFill)"
                stroke="#0F172A"
                strokeWidth="1.2"
                filter="url(#schemNodeLift)"
              />
              <circle
                cx={cx}
                cy={cy}
                r="48"
                fill="none"
                stroke="#CBD5E1"
                strokeWidth="1"
                strokeDasharray="2 3"
              />

              {/* Number */}
              <text
                x={cx}
                y={cy - 8}
                textAnchor="middle"
                fontFamily="inherit"
                fontSize="11"
                fill="#64748B"
                letterSpacing="2"
              >
                {String(s.n).padStart(2, '0')}
              </text>
              {/* Stage name */}
              <text
                x={cx}
                y={cy + 12}
                textAnchor="middle"
                fontFamily="inherit"
                fontSize="14"
                fontWeight="700"
                fill="#0F172A"
              >
                {s.stage}
              </text>

              {/* Below-node label · foreignObject allows wrapping */}
              <foreignObject x={cx - 110} y={cy + 76} width="220" height="44">
                <div
                  style={{
                    fontFamily: 'inherit',
                    fontSize: '11px',
                    color: '#475569',
                    letterSpacing: '0.04em',
                    textAlign: 'center',
                    lineHeight: 1.35,
                    textWrap: 'balance',
                  }}
                >
                  {SCHEMATIC_CAPTIONS[s.n] ?? s.title}
                </div>
              </foreignObject>

              {/* Above-node annotation tick */}
              <line
                x1={cx}
                y1={cy - 60}
                x2={cx}
                y2={cy - 80}
                stroke="#94A3B8"
                strokeWidth="1"
                strokeDasharray="2 3"
              />
              <circle cx={cx} cy={cy - 84} r="3" fill="#F97316" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Pillar 01 · Financing (DOMINANT)                                            */
/* -------------------------------------------------------------------------- */

function PillarFinancing() {
  return (
    <section id="financing" className="relative py-32 border-t border-slate-200/70">
      <div className="absolute inset-0 tp-mesh-soft" />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="grid lg:grid-cols-12 gap-12 items-start">
          {/* Left · copy */}
          <div className="lg:col-span-5 lg:sticky lg:top-32 reveal">
            <div className="tp-eyebrow">03 · PILLAR ONE</div>
            <div className="mt-2 tp-pillar-tag">Financing · the lead</div>
            <h2 className="mt-5 tp-h2 tp-grad-text">
              Beat Home Depot to the financing pitch on every single doorstep.
            </h2>
            <p className="mt-5 text-lg text-slate-600 leading-relaxed">
              TradePay fans every application across the lender marketplace. No sequential
              waterfall, no manual rerouting. The homeowner sees one ranked-offer screen with the
              best monthly payment first. Soft pull only. Lender carries the credit risk and
              disburses direct on the signed install.
            </p>

            <ul className="mt-8 space-y-3.5 text-sm">
              {PILLAR_FINANCE_BULLETS.map((b) => (
                <li key={b} className="flex gap-3 text-slate-700 leading-relaxed">
                  <span className="tp-bullet-dot mt-1.5" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            <div className="mt-9 tp-roi-badge">
              <span className="tp-roi-badge-orange">Multi</span>
              <span>lender marketplace · parallel quotes on a single soft pull</span>
            </div>
          </div>

          {/* Right · large finance mockup · 3D scene with subtle sway */}
          <div className="lg:col-span-7 reveal tp-finance-scene">
            <div className="tp-finance-stage">
              <FinanceMockup />
            </div>
          </div>
        </div>

        {/* Synergy callout · agentic filter × lending closer */}
        <div className="mt-20 tp-synergy reveal">
          <div className="tp-synergy-grid">
            <div className="tp-synergy-side">
              <div className="tp-synergy-eyebrow">
                <span className="tp-synergy-eyebrow-dot" />
                THE SYNERGY
              </div>
              <div className="tp-synergy-pair">
                <div className="tp-synergy-half">
                  <div className="tp-synergy-half-k">Agentic layer</div>
                  <div className="tp-synergy-half-v">The financial filter</div>
                </div>
                <div className="tp-synergy-x">&times;</div>
                <div className="tp-synergy-half">
                  <div className="tp-synergy-half-k">Lending waterfall</div>
                  <div className="tp-synergy-half-v">The closer</div>
                </div>
              </div>
            </div>
            <div className="tp-synergy-body">
              <p>
                <strong>
                  The agentic layer is your financial filter. The lending waterfall is your closer.
                </strong>
              </p>
              <p>
                Software agents work silently on every inbound application (soft-pull credit,
                identity enrichment, propensity scoring, lender routing) and surface only the
                financially-qualified homeowners to your sales floor. Your estimators only drive to
                jobs where the homeowner can actually afford the work. The lending waterfall returns
                an instant multi-offer decision at the kitchen table. Combined, your team converts
                on the same visit instead of chasing financing across three lenders for a week.
              </p>
            </div>
          </div>
        </div>

        {/* Quote the buyers · time + pixel + smart routing economics */}
        <QuoteTheBuyersSection />
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Quote the buyers · TradePay time economics                                  */
/* -------------------------------------------------------------------------- */

function QuoteTheBuyersSection() {
  return (
    <div className="mt-20 reveal" id="quote-buyers">
      <div className="max-w-3xl">
        <div className="tp-eyebrow">03A · QUOTE ECONOMICS</div>
        <h3 className="mt-3 tp-h2 tp-grad-text">Quote the buyers. Not the fillers.</h3>
        <p className="mt-5 text-lg text-slate-600 leading-relaxed">
          Smart forms + smart routing + pre-qualification on the financial data = every estimate
          slot fills with a homeowner who can actually pay.
        </p>
      </div>

      {/* Three-card grid */}
      <div className="mt-12 tp-quote-grid">
        {/* CARD A · Estimator-time economics */}
        <div className="tp-quote-card">
          <div className="tp-quote-card-eyebrow">
            <span className="tp-quote-card-dot" />
            CARD A · ESTIMATOR-TIME ECONOMICS
          </div>
          <h4 className="tp-quote-card-h">
            Every estimate slot is finite. Every truck-roll is real money.
          </h4>
          <p className="tp-quote-card-body">
            A contractor&apos;s estimator slot is expensive: 90 minutes on site plus 30 minutes
            driving each way is 2.5 hours per estimate. An estimator running 4 jobs/day burns ~10
            hours. Every estimate quoted to a homeowner who can&apos;t afford the work is a real $
            cost: estimator hourly + truck-roll fuel + the opportunity cost of a job that could
            close. Pre-qualification at the inquiry stage means the estimator only drives to homes
            where financing is already lined up.
          </p>

          {/* Calendar grid · 3D control-panel tilt */}
          <div className="tp-quote-calendar-scene">
            <div className="tp-quote-calendar-stage">
              <div className="tp-quote-calendar-head">
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
              </div>
              <div className="tp-quote-calendar-body">
                {Array.from({ length: 20 }).map((_, i) => {
                  // ~30% filler slots in pre-TradePay world
                  const filler = [2, 6, 9, 13, 17].includes(i);
                  return (
                    <div
                      key={i}
                      className={`tp-quote-calendar-slot ${filler ? 'filler' : 'buyer'}`}
                      title={filler ? "Filler · can't afford the work" : 'Funded buyer'}
                      style={{ animationDelay: `${i * 0.06}s` }}
                    >
                      <span className="tp-quote-calendar-dot" />
                    </div>
                  );
                })}
              </div>
              <div className="tp-quote-calendar-legend">
                <span className="tp-quote-leg-buyer">
                  <span className="tp-quote-leg-dot" />
                  Funded buyer slot
                </span>
                <span className="tp-quote-leg-filler">
                  <span className="tp-quote-leg-dot" />
                  Filler (can&apos;t fund)
                </span>
              </div>

              {/* Calendar footer — the math sits INSIDE the panel rather
                  than as a separate dark tile below, so Card A reads
                  as one cohesive object that matches the visual weight
                  of Cards B and C. */}
              <div className="tp-quote-calendar-foot">
                <div className="tp-quote-calendar-foot-k">Estimator hours recovered / week</div>
                <div className="tp-quote-calendar-foot-v">~12.5 hrs</div>
                <div className="tp-quote-calendar-foot-sub">
                  5 filler slots &times; 2.5 hours, redirected to funded buyers. Illustrative.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CARD B · Pixel feedback loop (ECHO) */}
        <div className="tp-quote-card tp-quote-card-pixel">
          <div className="tp-quote-card-eyebrow">
            <span className="tp-quote-card-dot" />
            CARD B · PIXEL FEEDBACK LOOP (ECHO)
          </div>
          <h4 className="tp-quote-card-h">Train your pixel on funded jobs, not form fills.</h4>
          <p className="tp-quote-card-body">
            ECHO (the Attribution Agent) holds pixel events until a homeowner clears financial
            qualification, then fires weighted conversions back to Meta and Google via server-side
            CAPI. The ad platforms&apos; algorithms retrain on what a <em>funded job</em> looks
            like. Ad spend gets more efficient month over month: same budget, more buyers. You get a
            real feedback loop on Page View &rarr; Lead &rarr; Pre-qualified &rarr; Funded.
          </p>

          {/* Pixel feedback loop · 5 steps + animated traveling pulse */}
          <div className="tp-pixel-loop-scene">
            <svg
              viewBox="0 0 380 240"
              className="tp-pixel-loop-svg"
              preserveAspectRatio="xMidYMid meet"
              aria-hidden
            >
              <defs>
                <linearGradient id="pxPath" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#475569" stopOpacity="0.45" />
                  <stop offset="50%" stopColor="#0F172A" stopOpacity="0.55" />
                  <stop offset="100%" stopColor="#475569" stopOpacity="0.45" />
                </linearGradient>
                <radialGradient id="pxPulse" cx="0.5" cy="0.5" r="0.5">
                  <stop offset="0%" stopColor="#F97316" stopOpacity="1" />
                  <stop offset="40%" stopColor="#F97316" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#F97316" stopOpacity="0" />
                </radialGradient>
                <filter id="pxNodeGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow
                    dx="0"
                    dy="2"
                    stdDeviation="2.5"
                    floodColor="#0F172A"
                    floodOpacity="0.18"
                  />
                </filter>
              </defs>

              {/* Path through 5 stages · S-curve */}
              <path
                id="tpPixelPath"
                d="M 36 60 L 132 60 L 132 120 L 248 120 L 248 60 L 344 60 L 344 180 L 36 180 L 36 60"
                fill="none"
                stroke="url(#pxPath)"
                strokeWidth="1.8"
                strokeDasharray="4 4"
              />

              {/* Animated pulse traveling along the path */}
              <circle r="8" fill="url(#pxPulse)">
                <animateMotion dur="6.5s" repeatCount="indefinite" rotate="auto">
                  <mpath href="#tpPixelPath" />
                </animateMotion>
              </circle>

              {/* 5 numbered stage nodes */}
              {[
                { x: 36, y: 60, n: '01', l: 'Ad spend → click' },
                { x: 132, y: 120, n: '02', l: 'Form fill' },
                { x: 248, y: 120, n: '03', l: 'Pre-qual' },
                { x: 344, y: 60, n: '04', l: 'Funded job' },
                { x: 180, y: 180, n: '05', l: 'CAPI signal' },
              ].map((s, i) => (
                <g key={i} filter="url(#pxNodeGlow)">
                  <circle
                    cx={s.x}
                    cy={s.y}
                    r="22"
                    fill="#FFFFFF"
                    stroke="#0F172A"
                    strokeWidth="1.2"
                  />
                  <text
                    x={s.x}
                    y={s.y + 1}
                    textAnchor="middle"
                    fontFamily="inherit"
                    fontSize="11"
                    fontWeight="700"
                    fill="#0F172A"
                  >
                    {s.n}
                  </text>
                  <text
                    x={s.x}
                    y={s.y + 38}
                    textAnchor="middle"
                    fontFamily="inherit"
                    fontSize="9.5"
                    fill="#475569"
                    letterSpacing="0.5"
                  >
                    {s.l}
                  </text>
                </g>
              ))}

              {/* Loop-back arrow */}
              <text
                x="190"
                y="220"
                textAnchor="middle"
                fontFamily="inherit"
                fontSize="9"
                fill="#94A3B8"
                letterSpacing="2"
              >
                &uarr; RETRAIN &middot; CHEAPER NEXT CLICK
              </text>
            </svg>
          </div>
        </div>

        {/* CARD C · Smart routing for funnel users */}
        <div className="tp-quote-card tp-quote-card-routing">
          <div className="tp-quote-card-eyebrow">
            <span className="tp-quote-card-dot" />
            CARD C · SMART ROUTING (PRISM + HELIX)
          </div>
          <h4 className="tp-quote-card-h">
            Smart forms. Smart routing. For contractors running funnels.
          </h4>
          <p className="tp-quote-card-body">
            For contractors running funnels, two pre-qualification agents reshape the experience
            without ever touching a phone:
          </p>
          <ul className="tp-quote-routing-list">
            <li>
              <span className="tp-quote-routing-chip">PRISM</span>
              <span>
                Smart forms reshape question order based on partial answers. High-intent leads skip
                qualifying questions and go straight to the calendar slot.
              </span>
            </li>
            <li>
              <span className="tp-quote-routing-chip">HELIX</span>
              <span>
                Smart routing assigns the qualified homeowner to the right estimator based on
                geography, capacity, and ticket-size match.
              </span>
            </li>
            <li>
              <span className="tp-quote-routing-chip">RESULT</span>
              <span>
                Less dispatcher time. Less estimator overload. Fewer abandoned applications.
              </span>
            </li>
          </ul>

          {/* Stylized estimator-route map · 3D tilted SVG schematic */}
          <div className="tp-route-map-scene">
            <div className="tp-route-map-stage">
              <svg viewBox="0 0 320 220" className="tp-route-map-svg" aria-hidden>
                <defs>
                  <pattern
                    id="rmGrid"
                    x="0"
                    y="0"
                    width="20"
                    height="20"
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M 20 0 L 0 0 0 20"
                      fill="none"
                      stroke="#94A3B8"
                      strokeWidth="0.4"
                      opacity="0.4"
                    />
                  </pattern>
                  <radialGradient id="rmQualGlow" cx="0.5" cy="0.5" r="0.5">
                    <stop offset="0%" stopColor="#F97316" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#F97316" stopOpacity="0" />
                  </radialGradient>
                </defs>

                {/* Grid background · stylized "map" */}
                <rect width="320" height="220" fill="url(#rmGrid)" />

                {/* Roads · stylized gentle curves */}
                <path
                  d="M 0 110 Q 80 90 160 110 T 320 110"
                  fill="none"
                  stroke="#CBD5E1"
                  strokeWidth="2"
                  opacity="0.5"
                />
                <path
                  d="M 160 0 Q 140 80 160 110 T 180 220"
                  fill="none"
                  stroke="#CBD5E1"
                  strokeWidth="2"
                  opacity="0.5"
                />

                {/* Route lines from depot to each node */}
                {ESTIMATOR_ROUTES.filter((n) => n.status !== 'depot').map((n) => {
                  const depot = ESTIMATOR_ROUTES[0]!;
                  const x1 = (depot.x / 100) * 320;
                  const y1 = (depot.y / 100) * 220;
                  const x2 = (n.x / 100) * 320;
                  const y2 = (n.y / 100) * 220;
                  const qual = n.status === 'qualified';
                  return (
                    <line
                      key={n.id}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={qual ? '#F97316' : '#94A3B8'}
                      strokeWidth={qual ? 1.5 : 1}
                      strokeDasharray={qual ? '' : '3 3'}
                      opacity={qual ? 0.7 : 0.35}
                    />
                  );
                })}

                {/* Nodes */}
                {ESTIMATOR_ROUTES.map((n) => {
                  const cx = (n.x / 100) * 320;
                  const cy = (n.y / 100) * 220;
                  if (n.status === 'depot') {
                    return (
                      <g key={n.id}>
                        <rect
                          x={cx - 11}
                          y={cy - 11}
                          width="22"
                          height="22"
                          rx="4"
                          fill="#0F172A"
                          stroke="#FFFFFF"
                          strokeWidth="1.5"
                        />
                        <text
                          x={cx}
                          y={cy + 3}
                          textAnchor="middle"
                          fontFamily="inherit"
                          fontSize="9"
                          fill="#F8FAFC"
                          fontWeight="700"
                          letterSpacing="0.5"
                        >
                          DEP
                        </text>
                        <text
                          x={cx}
                          y={cy + 26}
                          textAnchor="middle"
                          fontFamily="inherit"
                          fontSize="8.5"
                          fill="#475569"
                          letterSpacing="1.5"
                        >
                          DEPOT
                        </text>
                      </g>
                    );
                  }
                  const qual = n.status === 'qualified';
                  return (
                    <g key={n.id}>
                      {qual && (
                        <circle
                          cx={cx}
                          cy={cy}
                          r="18"
                          fill="url(#rmQualGlow)"
                          className="tp-route-map-pulse"
                          style={{
                            animationDelay: `${parseInt(n.id.replace('n', ''), 10) * 0.4}s`,
                          }}
                        />
                      )}
                      <circle
                        cx={cx}
                        cy={cy}
                        r="6"
                        fill={qual ? '#F97316' : '#CBD5E1'}
                        stroke="#FFFFFF"
                        strokeWidth="1.5"
                      />
                      {n.label && (
                        <text
                          x={cx}
                          y={cy - 12}
                          textAnchor="middle"
                          fontFamily="inherit"
                          fontSize="8.5"
                          fill={qual ? '#0F172A' : '#94A3B8'}
                          fontWeight={qual ? 600 : 500}
                          letterSpacing="0.3"
                        >
                          {n.label}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
              <div className="tp-route-map-legend">
                <span className="tp-route-map-leg">
                  <span className="tp-route-map-leg-dot qual" /> Qualified · estimator routed
                </span>
                <span className="tp-route-map-leg">
                  <span className="tp-route-map-leg-dot unqual" /> Unqualified · pre-qual filtered
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FinanceMockup() {
  const offers: RankedOffer[] = [
    {
      lender: 'CoreCredit',
      amount: '$24,000',
      apr: '8.49%',
      monthly: '$480 / mo',
      term: '60 mo',
      status: 'primary',
    },
    {
      lender: 'FinWise',
      amount: '$24,000',
      apr: '9.99%',
      monthly: '$510 / mo',
      term: '60 mo',
      status: 'backup',
    },
    {
      lender: 'BuildBank',
      amount: '$22,000',
      apr: '6.99%',
      monthly: '$436 / mo',
      term: '60 mo',
      status: 'counter',
    },
    {
      lender: 'Lender · 18',
      amount: '·',
      apr: '·',
      monthly: '·',
      term: '·',
      status: 'declined',
    },
  ];

  return (
    <div className="tp-mock-frame">
      {/* Browser chrome */}
      <div className="tp-mock-chrome">
        <span className="tp-mock-dot" />
        <span className="tp-mock-dot" />
        <span className="tp-mock-dot" />
        <span className="tp-mock-url">tradepay.app / offer / henderson-roof-24k</span>
        <span className="tp-mock-badge">WHITE-LABEL READY</span>
      </div>

      {/* Card */}
      <div className="tp-mock-card">
        {/* Top status */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/70">
          <div className="flex items-center gap-2.5">
            <span className="tp-live-dot" />
            <span className="text-[11px] uppercase tracking-[0.22em] font-semibold text-slate-700">
              MARKETPLACE · PARALLEL QUOTING
            </span>
          </div>
          <span className="text-[10.5px] uppercase tracking-[0.18em] text-slate-500">
            Soft pull · zero credit impact
          </span>
        </div>

        {/* Project header */}
        <div className="px-6 py-5 border-b border-slate-200/70 grid grid-cols-12 gap-4 items-center">
          <div className="col-span-7">
            <div className="text-[10.5px] uppercase tracking-[0.22em] text-slate-500">
              Henderson residence · Sacramento, CA
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <div className="text-3xl font-bold text-slate-900 tabular-nums">$24,000</div>
              <div className="text-sm text-slate-500">Roof replacement · GAF Timberline HDZ</div>
            </div>
          </div>
          <div className="col-span-5 grid grid-cols-3 gap-3 text-right">
            <div>
              <div className="text-[9.5px] uppercase tracking-[0.18em] text-slate-500">
                Vantage 4
              </div>
              <div className="text-base font-semibold text-slate-900 tabular-nums mt-0.5">742</div>
            </div>
            <div>
              <div className="text-[9.5px] uppercase tracking-[0.18em] text-slate-500">DTI</div>
              <div className="text-base font-semibold text-slate-900 tabular-nums mt-0.5">0.31</div>
            </div>
            <div>
              <div className="text-[9.5px] uppercase tracking-[0.18em] text-slate-500">Match</div>
              <div className="text-base font-semibold text-slate-900 tabular-nums mt-0.5">14s</div>
            </div>
          </div>
        </div>

        {/* Marketplace activity bar */}
        <div className="px-6 py-3 border-b border-slate-200/70 bg-slate-50/60">
          <div className="flex items-center justify-between text-[10.5px] uppercase tracking-[0.18em] text-slate-600">
            <span>Lender marketplace · quoting now</span>
            <span className="tabular-nums">42 quotes returned</span>
          </div>
          <div className="mt-2 tp-progress">
            <div className="tp-progress-fill" style={{ width: '81%' }} />
          </div>
        </div>

        {/* Offers table header */}
        <div className="px-6 py-3 grid grid-cols-12 text-[9.5px] uppercase tracking-[0.18em] text-slate-500 border-b border-slate-200/60">
          <div className="col-span-4">Lender</div>
          <div className="col-span-3 text-right">Monthly</div>
          <div className="col-span-2 text-right">APR</div>
          <div className="col-span-2 text-right">Term</div>
          <div className="col-span-1 text-right">Status</div>
        </div>

        {/* Offer rows · 3D stacked waterfall */}
        <div className="px-6 py-2 tp-offer-stack">
          {offers.map((o, idx) => (
            <div
              key={o.lender}
              className={`tp-offer-row-3d grid grid-cols-12 items-center py-3 text-[13px] border-b border-slate-100 last:border-b-0 ${
                o.status === 'primary' ? 'tp-offer-row-primary-lg' : ''
              } ${o.status !== 'primary' ? 'tp-offer-row-recessed' : ''}`}
              style={{ ['--tp-row-z' as string]: `${(offers.length - idx - 1) * 6}px` }}
            >
              <div className="col-span-4 flex items-center gap-2.5">
                {o.status === 'primary' ? (
                  <span className="tp-star">★</span>
                ) : (
                  <span
                    className={`tp-row-dot ${o.status === 'declined' ? 'tp-row-dot-muted' : ''}`}
                  />
                )}
                <span
                  className={
                    o.status === 'primary'
                      ? 'font-semibold text-slate-900'
                      : o.status === 'declined'
                        ? 'text-slate-400'
                        : 'text-slate-700'
                  }
                >
                  {o.lender}
                </span>
                {o.status === 'primary' && <span className="tp-row-recommend">RECOMMENDED</span>}
                {o.status === 'counter' && <span className="tp-row-counter">COUNTER</span>}
              </div>
              <div
                className={`col-span-3 text-right tabular-nums ${
                  o.status === 'primary'
                    ? 'font-bold text-slate-900'
                    : o.status === 'declined'
                      ? 'text-slate-400'
                      : 'text-slate-700'
                }`}
              >
                {o.monthly}
              </div>
              <div
                className={`col-span-2 text-right tabular-nums ${
                  o.status === 'declined' ? 'text-slate-400' : 'text-slate-700'
                }`}
              >
                {o.apr}
              </div>
              <div
                className={`col-span-2 text-right tabular-nums ${
                  o.status === 'declined' ? 'text-slate-400' : 'text-slate-700'
                }`}
              >
                {o.term}
              </div>
              <div className="col-span-1 text-right">
                {o.status === 'primary' ? (
                  <span className="tp-pill-status tp-pill-status-approved">APPR</span>
                ) : o.status === 'backup' ? (
                  <span className="tp-pill-status tp-pill-status-backup">APPR</span>
                ) : o.status === 'counter' ? (
                  <span className="tp-pill-status tp-pill-status-counter">CNTR</span>
                ) : (
                  <span className="tp-pill-status tp-pill-status-declined">DECL</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Decision footer */}
        <div className="px-6 py-4 border-t border-slate-200/70 bg-slate-50/60 flex items-center justify-between">
          <div className="text-sm text-slate-700">
            <span className="font-semibold text-slate-900">3 routed primary.</span> Homeowner
            selects monthly payment, signs in-app.
          </div>
          <div className="flex items-center gap-3">
            <div className="text-[10.5px] uppercase tracking-[0.18em] text-slate-500 text-right">
              Funds release in 48 to 72hr
            </div>
            <div className="tp-funded-chip">
              <span className="tp-funded-chip-dot" /> MERCHANT DIRECT
            </div>
          </div>
        </div>
      </div>

      {/* Homeowner-view sub-card */}
      <div className="tp-mock-side">
        <div className="text-[10.5px] uppercase tracking-[0.22em] text-slate-500 font-semibold">
          Homeowner view · branded as your company
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <div className="tp-mini-stat">
            <div className="text-[9.5px] uppercase tracking-[0.18em] text-slate-500">Monthly</div>
            <div className="text-lg font-bold text-slate-900 tabular-nums mt-1">$480</div>
          </div>
          <div className="tp-mini-stat">
            <div className="text-[9.5px] uppercase tracking-[0.18em] text-slate-500">Term</div>
            <div className="text-lg font-bold text-slate-900 tabular-nums mt-1">60 mo</div>
          </div>
          <div className="tp-mini-stat">
            <div className="text-[9.5px] uppercase tracking-[0.18em] text-slate-500">APR</div>
            <div className="text-lg font-bold text-slate-900 tabular-nums mt-1">8.49%</div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-[11.5px] text-slate-500">
          <span>Soft pull · no impact on credit</span>
          <span className="text-slate-700 font-medium">accept approval · in-app</span>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Pillar 02 · The Agentic Layer (dedicated, dark slate band)                  */
/* -------------------------------------------------------------------------- */

function AgentIcon({ iconKey }: { iconKey: AgentIconKey }) {
  // Each agent gets a distinct inline SVG glyph, matched to AUREAN reference.
  switch (iconKey) {
    case 'prism':
      // Triangle / prism geometric
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M12 3L3 18h18L12 3z" stroke="#F8FAFC" strokeWidth="1.6" />
          <path d="M12 8v8M8 14h8" stroke="#F8FAFC" strokeWidth="1.2" />
        </svg>
      );
    case 'vega':
      // Circle + dashed orbit
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="4" stroke="#F8FAFC" strokeWidth="1.6" />
          <circle cx="12" cy="12" r="9" stroke="#F8FAFC" strokeWidth="1" strokeDasharray="2 3" />
        </svg>
      );
    case 'oracle':
      // Peak / zigzag scoring line
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 17l5-9 4 6 3-4 4 7"
            stroke="#F8FAFC"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'helix':
      // Cross-loops (helix routing)
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M6 4c4 4 4 12 0 16M18 4c-4 4-4 12 0 16M6 8h12M6 16h12"
            stroke="#F8FAFC"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'nexus':
      // Hub with 4 satellites
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="2.2" fill="#F8FAFC" />
          <circle cx="4" cy="6" r="1.6" fill="#F8FAFC" />
          <circle cx="20" cy="6" r="1.6" fill="#F8FAFC" />
          <circle cx="4" cy="18" r="1.6" fill="#F8FAFC" />
          <circle cx="20" cy="18" r="1.6" fill="#F8FAFC" />
          <path
            d="M12 12L4 6M12 12L20 6M12 12L4 18M12 12L20 18"
            stroke="#F8FAFC"
            strokeWidth="0.8"
          />
        </svg>
      );
    case 'flux':
      // Three wave lines
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 12c3-3 6-3 9 0s6 3 9 0"
            stroke="#F8FAFC"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M3 7c3-3 6-3 9 0s6 3 9 0"
            stroke="#F8FAFC"
            strokeWidth="1"
            strokeLinecap="round"
            strokeOpacity="0.5"
          />
          <path
            d="M3 17c3-3 6-3 9 0s6 3 9 0"
            stroke="#F8FAFC"
            strokeWidth="1"
            strokeLinecap="round"
            strokeOpacity="0.5"
          />
        </svg>
      );
    case 'echo':
      // Nested target circles
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="2" fill="#F8FAFC" />
          <circle cx="12" cy="12" r="6" stroke="#F8FAFC" strokeWidth="1.2" />
          <circle cx="12" cy="12" r="10" stroke="#F8FAFC" strokeWidth="0.8" strokeDasharray="2 3" />
        </svg>
      );
    default:
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="5" stroke="#F8FAFC" strokeWidth="1.6" />
        </svg>
      );
  }
}

function AgentHeader({ agent }: { agent: Agent }) {
  const isLearning = agent.status === 'LEARNING';
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-4 min-w-0">
        <div className="tp-agent-icon-box">
          <span className="tp-agent-icon-pulse" />
          <AgentIcon iconKey={agent.iconKey} />
        </div>
        <div className="min-w-0">
          <div className="tp-agent-eyebrow">Agent {agent.n}</div>
          <h3 className="tp-agent-title">
            {agent.code}
            <span className="tp-agent-role"> · {agent.role}</span>
          </h3>
        </div>
      </div>
      <div className={`tp-agent-status ${isLearning ? 'tp-agent-status-learning' : ''}`}>
        <span
          className={`tp-agent-status-dot ${isLearning ? 'tp-agent-status-dot-learning' : ''}`}
        />
        {agent.status}
      </div>
    </div>
  );
}

function AgentCard({ agent }: { agent: Agent }) {
  // Full-width ECHO card with side event stream.
  if (agent.span === 12 && agent.stream) {
    return (
      <div className="lg:col-span-12 tp-agent-card relative overflow-hidden">
        <div className="grid lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5">
            <AgentHeader agent={agent} />
            <p className="tp-agent-desc">{agent.description}</p>
            <div className="tp-agent-lastaction">
              <span className="tp-agent-lastaction-label">last action:</span> {agent.lastAction}
            </div>
          </div>
          <div className="lg:col-span-7">
            <div className="tp-agent-stream">
              <div className="tp-agent-stream-header">
                <div className="tp-agent-stream-title">{agent.stream.title}</div>
                <div className="tp-agent-stream-rate">{agent.stream.rate}</div>
              </div>
              <div className="tp-agent-stream-list">
                {agent.stream.events.map((ev, i) => (
                  <div
                    key={`${ev.source}-${i}`}
                    className={`tp-agent-stream-row ${i === agent.stream!.events.length - 1 ? 'tp-agent-stream-row-last' : ''}`}
                  >
                    <span className="tp-agent-stream-src">{ev.source}</span>
                    <span
                      className={
                        ev.highlight ? 'tp-agent-stream-dest' : 'tp-agent-stream-dest-muted'
                      }
                    >
                      {ev.destination}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const span = agent.span === 7 ? 'lg:col-span-7' : 'lg:col-span-5';
  const statsCols = agent.stats.length === 3 ? 'grid-cols-3' : 'grid-cols-2';
  return (
    <div className={`${span} tp-agent-card relative overflow-hidden`}>
      <AgentHeader agent={agent} />
      <p className="tp-agent-desc">{agent.description}</p>

      <div className={`tp-agent-stats grid ${statsCols}`}>
        {agent.stats.map((s) => (
          <div key={s.k} className="tp-agent-stat">
            <div className="tp-agent-stat-k">{s.k}</div>
            <div className="tp-agent-stat-v">{s.v}</div>
          </div>
        ))}
      </div>

      <div className="tp-agent-lastaction">
        <span className="tp-agent-lastaction-label">last action:</span> {agent.lastAction}
      </div>
    </div>
  );
}

function PillarAgents() {
  return (
    <section id="agents" className="relative tp-agents-section">
      <div className="absolute inset-0 tp-blueprint-grid opacity-[0.10]" />
      <div className="absolute inset-0 tp-agents-glow" />

      <div className="relative mx-auto max-w-7xl px-6 py-32">
        <div className="max-w-3xl reveal">
          <div className="tp-eyebrow-dark">04 · THE AGENTIC LAYER</div>
          <h2 className="mt-3 tp-h2 tp-grad-text-on-dark">
            Seven pre-qualification agents running your contractor revenue stack · 24/7.
          </h2>
          <p className="mt-5 text-lg text-slate-300 leading-relaxed">
            Every layer of TradePay is operated by a dedicated pre-qualification agent, from form
            intake all the way through lender matching, funding orchestration, and ad attribution.
            They work on the <span className="text-white font-semibold">financial data</span> in
            software (soft-pull credit, identity enrichment, propensity scoring, lender routing),
            not on the phone. They never make outbound calls, never voice-dial, never text-blast.
            They qualify silently in the background and surface the financially-qualified homeowners
            to your human sales, estimator, and dispatcher team.
          </p>
        </div>

        {/* Agent mosaic */}
        <div className="mt-14 grid lg:grid-cols-12 gap-5 reveal">
          {AGENTS.map((a) => (
            <AgentCard key={a.code} agent={a} />
          ))}
        </div>

        {/* Coordination layer */}
        <div className="mt-10 tp-agents-coordination reveal">
          <div className="flex items-center gap-4 min-w-0">
            <div className="tp-agents-coordination-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3"
                  stroke="#F8FAFC"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="tp-agents-coordination-eyebrow">Coordination layer</div>
              <div className="tp-agents-coordination-body">
                All seven agents share a common event bus, a shared memory store, and a unified
                observability plane.
              </div>
            </div>
          </div>
          <a href="#cta" className="tp-agents-coordination-cta">
            See agents in action
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 12h14M13 6l6 6-6 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        </div>

        {/* Compliance footer */}
        <div className="mt-6 tp-agents-footer reveal">
          <span className="tp-agents-footer-dot" />
          <span>
            Agents work on the financial data, not on the phone. Every agent action is FCRA
            permissible-purpose-aware and logged to an immutable audit trail.
          </span>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* ROI Calculator                                                              */
/* -------------------------------------------------------------------------- */

function RoiSection() {
  // 4-stage funnel · inbound → pre-qual → show → close → funded
  const [leads, setLeads] = useState(220);
  const [preQualPct, setPreQualPct] = useState(55);
  const [showRate, setShowRate] = useState(75);
  const [closeRate, setCloseRate] = useState(50);
  const [ticket, setTicket] = useState(24000);

  // Funnel math
  const preQualified = useMemo(() => Math.round((leads * preQualPct) / 100), [leads, preQualPct]);
  const shows = useMemo(
    () => Math.round((preQualified * showRate) / 100),
    [preQualified, showRate],
  );
  const fundedPerMonth = useMemo(() => Math.round((shows * closeRate) / 100), [shows, closeRate]);
  const fundedPerYear = useMemo(() => fundedPerMonth * 12, [fundedPerMonth]);
  const annualRevenue = useMemo(() => fundedPerYear * ticket, [fundedPerYear, ticket]);
  // Skipped wasted estimates · 2.5 hrs each (90min onsite + 30min each way)
  const estimatorHoursSavedPerMonth = useMemo(() => {
    const skippedFillers = Math.round(leads * (1 - preQualPct / 100));
    return Math.round(skippedFillers * 2.5);
  }, [leads, preQualPct]);

  return (
    <section id="roi" className="relative py-28 border-t border-slate-200/70">
      <div className="absolute inset-0 tp-grid opacity-40" />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="max-w-3xl reveal">
          <div className="tp-eyebrow">06 · YOUR NUMBERS</div>
          <h2 className="mt-3 tp-h2 tp-grad-text">
            Model your funnel. End-to-end. Inbound to funded.
          </h2>
          <p className="mt-5 text-lg text-slate-600 leading-relaxed">
            Plug in your real numbers across the four-stage funnel: inbound leads &rarr;
            pre-qualified &rarr; estimate shows &rarr; closed contracts. We model financing-driven
            revenue from the homeowners who actually fund. Illustrative only; outcomes vary by crew,
            ticket, vertical, season, and lender mix.
          </p>
        </div>

        <div className="mt-14 grid lg:grid-cols-12 gap-6 reveal">
          {/* Inputs */}
          <div className="lg:col-span-7 tp-roi-panel">
            <div className="text-[10.5px] uppercase tracking-[0.22em] text-slate-500 font-semibold mb-1">
              Funnel inputs
            </div>
            <div className="text-sm text-slate-500 mb-7">
              Defaults reflect a typical home-improvement contractor running 1 to 3 crews.
            </div>

            <RoiSlider
              label="Inbound leads / month"
              value={leads}
              min={40}
              max={800}
              step={10}
              format={(v) => v.toString()}
              onChange={setLeads}
            />

            <RoiSlider
              label="Pre-qual pass %"
              value={preQualPct}
              min={20}
              max={90}
              step={1}
              format={(v) => `${v}%`}
              onChange={setPreQualPct}
            />

            <RoiSlider
              label="Estimate show rate %"
              value={showRate}
              min={30}
              max={95}
              step={1}
              format={(v) => `${v}%`}
              onChange={setShowRate}
            />

            <RoiSlider
              label="Close rate at estimate %"
              value={closeRate}
              min={15}
              max={85}
              step={1}
              format={(v) => `${v}%`}
              onChange={setCloseRate}
            />

            <RoiSlider
              label="Avg job ticket"
              value={ticket}
              min={3000}
              max={100000}
              step={500}
              format={(v) => fmt(v)}
              onChange={setTicket}
            />

            <div className="mt-7 pt-5 border-t border-slate-200/70 tp-roi-assump">
              <span className="tp-roi-assump-k">Funnel math</span>
              <span>
                Funded jobs/mo = inbound &times; pre-qual% &times; show% &times; close%. Ticket size
                sits inside the TradePay loan range ($3k to $100k). Adjust each stage to match your
                real conversion.
              </span>
            </div>
          </div>

          {/* Output */}
          <div className="lg:col-span-5 tp-roi-output tp-roi-output-scene">
            <div className="text-[10.5px] uppercase tracking-[0.22em] text-slate-400 font-semibold">
              Financing-driven revenue &middot; per year
            </div>
            <div className="mt-2 text-xs text-slate-400 leading-relaxed">
              Illustrative &middot; based on your funnel inputs
            </div>

            <div className="mt-6 tp-roi-num tp-roi-num-3d tabular-nums">{fmt(annualRevenue)}</div>

            {/* Funnel narrative · animated traversal dots */}
            <div className="mt-4 tp-roi-funnel">
              <span className="tp-roi-funnel-stage">
                <span className="tp-roi-funnel-dot" style={{ animationDelay: '0s' }} />
                {leads} leads
              </span>
              <span className="tp-roi-funnel-arrow">&rarr;</span>
              <span className="tp-roi-funnel-stage">
                <span className="tp-roi-funnel-dot" style={{ animationDelay: '0.4s' }} />
                {preQualified} pre-qual
              </span>
              <span className="tp-roi-funnel-arrow">&rarr;</span>
              <span className="tp-roi-funnel-stage">
                <span className="tp-roi-funnel-dot" style={{ animationDelay: '0.8s' }} />
                {shows} shows
              </span>
              <span className="tp-roi-funnel-arrow">&rarr;</span>
              <span className="tp-roi-funnel-stage tp-roi-funnel-stage-final">
                <span className="tp-roi-funnel-dot" style={{ animationDelay: '1.2s' }} />
                <strong>{fundedPerMonth} funded</strong>
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="tp-roi-sub">
                <div className="text-[10.5px] uppercase tracking-[0.18em] text-slate-400">
                  Funded jobs / mo
                </div>
                <div className="text-lg font-semibold text-white tabular-nums mt-1">
                  {fundedPerMonth}
                </div>
              </div>
              <div className="tp-roi-sub">
                <div className="text-[10.5px] uppercase tracking-[0.18em] text-slate-400">
                  Funded jobs / yr
                </div>
                <div className="text-lg font-semibold text-white tabular-nums mt-1">
                  {fundedPerYear}
                </div>
              </div>
            </div>

            <div className="mt-3 tp-roi-substat">
              <div className="text-[10.5px] uppercase tracking-[0.18em] text-slate-400">
                Estimator hours saved / mo
              </div>
              <div className="text-base font-semibold text-white tabular-nums mt-1">
                ~{estimatorHoursSavedPerMonth} hrs
              </div>
              <div className="text-[10.5px] text-slate-500 mt-0.5">
                Skipped wasted estimates &times; 2.5 hrs each
              </div>
            </div>

            <a
              href="/submit/trade-pay"
              className="mt-7 tp-btn-primary-dark text-sm w-full justify-center tp-cta-glow"
            >
              Start TradePay signup
              <IconArrowRight className="ml-1.5" />
            </a>
            <div className="mt-3 text-[10px] uppercase tracking-[0.18em] text-slate-500 text-center leading-relaxed">
              Outputs are illustrative based on your inputs. Actual outcomes vary by region, season,
              and product mix. Not a guarantee of returns.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function RoiSlider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="mt-5">
      <div className="flex items-baseline justify-between mb-2">
        <label className="text-[11.5px] uppercase tracking-[0.18em] text-slate-500 font-semibold">
          {label}
        </label>
        <span className="text-base font-semibold text-slate-900 tabular-nums">{format(value)}</span>
      </div>
      <div className="tp-slider-track">
        <div className="tp-slider-fill" style={{ width: `${pct}%` }} />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="tp-slider-input"
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Case studies                                                                */
/* -------------------------------------------------------------------------- */

function CaseStudiesSection() {
  return (
    <section id="stories" className="relative py-28 border-t border-slate-200/70">
      <div className="relative mx-auto max-w-7xl px-6">
        <div className="max-w-3xl reveal">
          <div className="tp-eyebrow">07 · CONTRACTORS RUNNING TRADEPAY</div>
          <h2 className="mt-3 tp-h2 tp-grad-text">Financing turned every quote into a close.</h2>
          <p className="mt-5 text-lg text-slate-600 leading-relaxed">
            Three contractors, three verticals. Same outcome: financing closes the jobs that were
            walking out the door.
          </p>
        </div>

        <div className="mt-14 grid md:grid-cols-3 gap-5 reveal tp-case-scene">
          {CASE_STUDIES.map((c) => (
            <div key={c.name} className="tp-case-card tp-case-card-3d">
              {/* Outcome badges lead */}
              <div className="flex gap-2 mb-5">
                {c.outcomes.map((o) => (
                  <div key={o.label} className="tp-case-outcome">
                    <div className="tp-case-outcome-num">{o.value}</div>
                    <div className="tp-case-outcome-lbl">{o.label}</div>
                  </div>
                ))}
              </div>

              <div className="tp-quote-mark">"</div>
              <p className="mt-2 text-[14.5px] text-slate-700 leading-relaxed">{c.quote}</p>

              <div className="mt-6 pt-5 border-t border-slate-200/70">
                <div className="text-sm font-semibold text-slate-900">{c.name}</div>
                <div className="text-[12px] text-slate-500 mt-0.5">{c.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Integrations marquee                                                        */
/* -------------------------------------------------------------------------- */

function IntegrationsMarquee() {
  return (
    <section className="relative py-20 border-t border-slate-200/70 bg-slate-50/40">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center reveal">
          <div className="tp-eyebrow inline-block">08 · INFRASTRUCTURE</div>
          <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
            Plugged into the stack the trades already run on.
          </h3>
        </div>

        <div className="mt-10 tp-marquee">
          <div className="tp-marquee-track">
            {[...INTEGRATIONS, ...INTEGRATIONS, ...INTEGRATIONS].map((logo, i) => (
              <span key={i} className="tp-marquee-item">
                {logo}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Objections / FAQ                                                            */
/* -------------------------------------------------------------------------- */

function ObjectionsSection() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="relative py-28 border-t border-slate-200/70">
      <div className="relative mx-auto max-w-5xl px-6">
        <div className="reveal">
          <div className="tp-eyebrow">09 · OBJECTIONS ANSWERED</div>
          <h2 className="mt-3 tp-h2 tp-grad-text">What contractors ask before they sign up.</h2>
        </div>

        <div className="mt-12 tp-faq reveal">
          {OBJECTIONS.map((o, i) => {
            const isOpen = open === i;
            return (
              <div key={i} className="tp-faq-row">
                <button
                  type="button"
                  className="tp-faq-q"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                >
                  <span>{o.q}</span>
                  <span className={`tp-faq-plus ${isOpen ? 'open' : ''}`}>+</span>
                </button>
                <div className={`tp-faq-a ${isOpen ? 'open' : ''}`}>
                  <p>{o.a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Final CTA                                                                   */
/* -------------------------------------------------------------------------- */

function FinalCta() {
  return (
    <section className="relative tp-final-cta overflow-hidden">
      <div className="absolute inset-0 tp-blueprint-grid opacity-[0.10]" />
      <div className="absolute inset-0 tp-final-glow" />

      {/* Single orange accent · corner dot */}
      <div className="tp-final-accent-dot" />

      <div className="relative mx-auto max-w-4xl px-6 py-32 text-center">
        <div className="inline-flex items-center gap-2 tp-eyebrow-pill-dark">
          <span className="tp-pill-dot tp-pill-dot-orange" />
          <span>BUILT FOR CREWS THAT WANT TO GROW</span>
        </div>

        <h2 className="mt-7 tp-h1 tp-grad-text-on-dark">
          Close more jobs.
          <br />
          Instant decisions at the door.
        </h2>

        <p className="mt-7 text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Sign up in 5 minutes. KYB clears in 60 seconds. Start running soft-pull pre-quals at the
          door as soon as your first crew is configured.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <a href="/submit/trade-pay" className="tp-btn-primary-on-dark text-base px-7 py-4">
            Start TradePay signup
            <IconArrowRight className="ml-2" />
          </a>
          <a href="/apply/tradepay" className="tp-btn-ghost-dark text-base px-7 py-4">
            See the contractor flow
          </a>
        </div>

        <div className="mt-10 text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">
          Soft pull, zero credit impact, instant decisions at the door across the lender marketplace
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Footer                                                                      */
/* -------------------------------------------------------------------------- */

function Footer() {
  return (
    <footer className="border-t border-slate-200/70 py-10 bg-white">
      <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-5">
        <div className="flex items-center gap-2.5">
          <LogoMark size={24} />
          <span className="font-semibold tracking-tight text-sm text-slate-900">TradePay</span>
          <span className="text-slate-500 text-xs ml-3">© 2026 EazePay · TradePay</span>
        </div>
        <div className="flex items-center gap-7 text-xs text-slate-500">
          <a href="#" className="hover:text-slate-900">
            Privacy
          </a>
          <a href="#" className="hover:text-slate-900">
            Terms
          </a>
          <a href="#" className="hover:text-slate-900">
            Lending disclosures
          </a>
          <a href="#" className="hover:text-slate-900">
            Status
          </a>
        </div>
      </div>
    </footer>
  );
}

/* ========================================================================== */
/* CSS                                                                         */
/* ========================================================================== */

const CSS = `
  /* Reset */
  .tp-root {
    --tp-slate-950: #020617;
    --tp-slate-900: #0F172A;
    --tp-slate-800: #1E293B;
    --tp-slate-700: #334155;
    --tp-slate-600: #475569;
    --tp-slate-500: #64748B;
    --tp-slate-400: #94A3B8;
    --tp-slate-300: #CBD5E1;
    --tp-slate-200: #E2E8F0;
    --tp-slate-100: #F1F5F9;
    --tp-slate-50:  #F8FAFC;
    --tp-orange: #F97316;
    --tp-orange-warm: #FB923C;
    --tp-orange-deep: #EA580C;
    --tp-paper: #FAFAF9;

    color: var(--tp-slate-900);
    background: linear-gradient(180deg, #FAFAF9 0%, #FFFFFF 35%, #F8FAFC 70%, #FFFFFF 100%);
    font-family: inherit;
    -webkit-font-smoothing: antialiased;
    overflow-x: hidden;
    scroll-behavior: smooth;
    min-height: 100vh;
  }

  /* ====== Type ====== */
  .tp-h1 {
    font-size: clamp(2.5rem, 4.6vw, 4.5rem);
    line-height: 1.02;
    letter-spacing: -0.025em;
    font-weight: 700;
  }
  .tp-h2 {
    font-size: clamp(2rem, 3.2vw, 3rem);
    line-height: 1.08;
    letter-spacing: -0.022em;
    font-weight: 700;
  }
  .tp-h3 {
    font-size: clamp(1.75rem, 2.6vw, 2.5rem);
    line-height: 1.12;
    letter-spacing: -0.02em;
    font-weight: 700;
  }
  .tp-grad-text {
    background: linear-gradient(180deg, #0F172A 0%, #334155 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .tp-grad-text-darker {
    background: linear-gradient(135deg, #0F172A 0%, #475569 80%, #64748B 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .tp-grad-text-on-dark {
    background: linear-gradient(180deg, #F8FAFC 0%, #CBD5E1 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .tp-eyebrow {
    font-family: inherit;
    font-size: 11.5px;
    letter-spacing: 0.22em;
    color: var(--tp-slate-600);
    font-weight: 600;
    text-transform: uppercase;
  }
  .tp-eyebrow-dark {
    font-family: inherit;
    font-size: 11.5px;
    letter-spacing: 0.22em;
    color: var(--tp-slate-400);
    font-weight: 600;
    text-transform: uppercase;
  }

  /* ====== Buttons ====== */
  .tp-btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: 10px;
    background: linear-gradient(180deg, #0F172A 0%, #1E293B 100%);
    color: #F8FAFC;
    font-weight: 600;
    box-shadow:
      0 1px 0 rgba(255,255,255,0.08) inset,
      0 0 0 1px rgba(15,23,42,0.9),
      0 12px 28px -10px rgba(15,23,42,0.55);
    transition: transform .15s ease, box-shadow .15s ease;
    position: relative;
  }
  .tp-btn-primary::after {
    content: "";
    position: absolute;
    inset: -1px;
    border-radius: inherit;
    background: linear-gradient(120deg, rgba(249,115,22,0.32), transparent 35%, transparent 70%, rgba(249,115,22,0.18));
    z-index: -1;
    filter: blur(6px);
    opacity: 0.7;
  }
  .tp-btn-primary:hover {
    transform: translateY(-1px);
    box-shadow:
      0 1px 0 rgba(255,255,255,0.1) inset,
      0 0 0 1px rgba(15,23,42,1),
      0 16px 38px -12px rgba(15,23,42,0.7);
  }
  .tp-btn-primary-dark {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: 10px;
    background: linear-gradient(180deg, #F97316 0%, #EA580C 100%);
    color: #FFFFFF;
    font-weight: 700;
    padding: 0.85rem 1.25rem;
    box-shadow:
      0 0 0 1px rgba(234,88,12,0.6),
      0 12px 28px -10px rgba(249,115,22,0.6);
    transition: transform .15s ease, box-shadow .15s ease;
  }
  .tp-btn-primary-dark:hover {
    transform: translateY(-1px);
    box-shadow:
      0 0 0 1px rgba(234,88,12,0.8),
      0 16px 38px -12px rgba(249,115,22,0.75);
  }
  .tp-btn-primary-on-dark {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: 10px;
    background: linear-gradient(180deg, #FFFFFF 0%, #E2E8F0 100%);
    color: #0F172A;
    font-weight: 700;
    box-shadow:
      inset 0 -2px 0 rgba(0,0,0,0.06),
      0 14px 36px -10px rgba(255,255,255,0.35);
    transition: transform .15s ease, box-shadow .15s ease;
  }
  .tp-btn-primary-on-dark:hover {
    transform: translateY(-1px);
    box-shadow:
      inset 0 -2px 0 rgba(0,0,0,0.08),
      0 18px 44px -12px rgba(255,255,255,0.5);
  }
  .tp-btn-ghost {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: 10px;
    border: 1px solid rgba(15,23,42,0.16);
    background: rgba(255,255,255,0.6);
    color: var(--tp-slate-700);
    font-weight: 500;
    transition: all .15s ease;
  }
  .tp-btn-ghost:hover {
    border-color: rgba(15,23,42,0.32);
    background: rgba(255,255,255,1);
    color: var(--tp-slate-900);
  }
  .tp-btn-ghost-dark {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.16);
    background: rgba(255,255,255,0.03);
    color: var(--tp-slate-200);
    font-weight: 500;
    transition: all .15s ease;
  }
  .tp-btn-ghost-dark:hover {
    border-color: rgba(255,255,255,0.32);
    background: rgba(255,255,255,0.08);
    color: #FFFFFF;
  }

  /* ====== Nav ====== */
  .tp-nav-wrap {
    position: fixed; top: 0; left: 0; right: 0; z-index: 50;
    transition: padding .25s ease;
    padding-top: 16px;
  }
  .tp-nav-wrap.condensed { padding-top: 8px; }
  .tp-nav {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 16px;
    border-radius: 14px;
    background: rgba(255,255,255,0.72);
    border: 1px solid rgba(15,23,42,0.08);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    box-shadow: 0 8px 26px -16px rgba(15,23,42,0.25);
    transition: all .25s ease;
  }
  .tp-nav-wrap.condensed .tp-nav {
    background: rgba(255,255,255,0.88);
    box-shadow: 0 10px 32px -14px rgba(15,23,42,0.32);
  }
  .tp-nav-tag {
    font-size: 11px;
    color: var(--tp-slate-500);
    margin-left: 10px;
    padding-left: 12px;
    border-left: 1px solid rgba(15,23,42,0.12);
  }

  /* ====== Hero ====== */
  .tp-hero { position: relative; }
  .tp-mesh {
    background:
      radial-gradient(ellipse 60% 50% at 12% 0%, rgba(15,23,42,0.06), transparent 60%),
      radial-gradient(ellipse 70% 50% at 88% 30%, rgba(249,115,22,0.05), transparent 60%),
      radial-gradient(ellipse 80% 60% at 50% 95%, rgba(51,65,85,0.04), transparent 60%);
  }
  .tp-mesh-soft {
    background:
      radial-gradient(ellipse 50% 40% at 80% 20%, rgba(249,115,22,0.04), transparent 55%),
      radial-gradient(ellipse 60% 50% at 20% 80%, rgba(15,23,42,0.04), transparent 60%);
  }
  .tp-grid {
    background-image:
      linear-gradient(rgba(15,23,42,0.045) 1px, transparent 1px),
      linear-gradient(90deg, rgba(15,23,42,0.045) 1px, transparent 1px);
    background-size: 56px 56px;
    mask-image: radial-gradient(ellipse at center, black 30%, transparent 85%);
  }
  .tp-blueprint-grid {
    background-image:
      linear-gradient(rgba(148,163,184,1) 1px, transparent 1px),
      linear-gradient(90deg, rgba(148,163,184,1) 1px, transparent 1px),
      linear-gradient(rgba(148,163,184,0.5) 1px, transparent 1px),
      linear-gradient(90deg, rgba(148,163,184,0.5) 1px, transparent 1px);
    background-size: 80px 80px, 80px 80px, 16px 16px, 16px 16px;
    background-position: 0 0, 0 0, 0 0, 0 0;
  }
  .tp-noise::before {
    content: "";
    position: absolute; inset: 0;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.03 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
    opacity: 0.5; pointer-events: none;
  }

  /* Hero eyebrow pill */
  .tp-eyebrow-pill {
    font-family: inherit;
    font-size: 10.5px;
    color: var(--tp-slate-700);
    padding: 7px 14px;
    border-radius: 999px;
    background: rgba(255,255,255,0.85);
    border: 1px solid rgba(15,23,42,0.10);
    box-shadow: 0 6px 16px -6px rgba(15,23,42,0.12);
    font-weight: 600;
  }
  .tp-eyebrow-pill-dark {
    font-family: inherit;
    font-size: 10.5px;
    color: var(--tp-slate-300);
    padding: 7px 14px;
    border-radius: 999px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.10);
    letter-spacing: 0.18em;
    font-weight: 600;
  }
  .tp-pill-dot {
    width: 6px; height: 6px; border-radius: 999px;
    background: var(--tp-slate-700);
    box-shadow: 0 0 0 2px rgba(15,23,42,0.10);
  }
  .tp-pill-dot-orange {
    background: var(--tp-orange);
    box-shadow: 0 0 0 2px rgba(249,115,22,0.22), 0 0 12px rgba(249,115,22,0.7);
    animation: tpPulseOrange 2.4s ease-in-out infinite;
  }
  @keyframes tpPulseOrange {
    0%, 100% { box-shadow: 0 0 0 2px rgba(249,115,22,0.22), 0 0 12px rgba(249,115,22,0.6); }
    50% { box-shadow: 0 0 0 4px rgba(249,115,22,0.32), 0 0 18px rgba(249,115,22,0.85); }
  }

  /* Hero trust + pricing micro-line — sits under the CTAs so a cold
     visitor sees NMLS + cost model before reading further. */
  .tp-hero-trust {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    font-weight: 600;
    color: var(--tp-slate-500);
  }
  .tp-hero-trust-item { display: inline-flex; align-items: center; gap: 5px; }
  .tp-hero-trust-dot { color: rgba(15,23,42,0.25); }

  /* Hero trust strip */
  .tp-trust-strip {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1px;
    background: rgba(15,23,42,0.10);
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid rgba(15,23,42,0.08);
    max-width: 540px;
  }
  .tp-trust-cell {
    background: rgba(255,255,255,0.85);
    padding: 14px 18px;
  }
  .tp-trust-num {
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--tp-slate-900);
    font-variant-numeric: tabular-nums;
  }
  .tp-trust-pct {
    color: var(--tp-slate-500);
    font-weight: 500;
    font-size: 16px;
  }
  .tp-trust-lbl {
    font-size: 10.5px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--tp-slate-500);
    margin-top: 4px;
    font-weight: 500;
  }

  /* Hero offer card */
  .tp-offer-card {
    background: #FFFFFF;
    border: 1px solid rgba(15,23,42,0.10);
    border-radius: 18px;
    overflow: hidden;
    box-shadow:
      0 1px 0 rgba(255,255,255,1) inset,
      0 30px 70px -22px rgba(15,23,42,0.30),
      0 12px 28px -10px rgba(15,23,42,0.18);
    position: relative;
    z-index: 1;
  }
  .tp-live-dot {
    width: 7px; height: 7px; border-radius: 999px;
    background: var(--tp-orange);
    box-shadow: 0 0 0 3px rgba(249,115,22,0.18), 0 0 14px rgba(249,115,22,0.6);
    animation: tpPulseOrange 2.4s ease-in-out infinite;
  }
  .tp-funded-chip {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.22em;
    padding: 5px 10px;
    border-radius: 6px;
    color: #FFFFFF;
    background: linear-gradient(180deg, #F97316 0%, #EA580C 100%);
    box-shadow: 0 0 0 1px rgba(234,88,12,0.5), 0 4px 14px -4px rgba(249,115,22,0.55);
  }
  .tp-funded-chip-dot {
    width: 5px; height: 5px; border-radius: 999px;
    background: #FFFFFF;
    box-shadow: 0 0 6px rgba(255,255,255,0.9);
  }
  .tp-offer-row-primary {
    background: linear-gradient(90deg, rgba(249,115,22,0.04), rgba(249,115,22,0));
    margin: 0 -20px;
    padding: 10px 20px;
    border-radius: 8px;
    border: 1px solid rgba(249,115,22,0.18);
  }
  .tp-star {
    color: var(--tp-orange);
    font-size: 14px;
    line-height: 1;
  }
  .tp-row-dot {
    width: 6px; height: 6px; border-radius: 999px;
    background: var(--tp-slate-400);
  }
  .tp-row-dot-muted { background: var(--tp-slate-300); }
  .tp-stat-strip {
    border-top: 1px solid rgba(15,23,42,0.08);
    background: linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%);
  }
  .tp-stat-cell {
    padding: 14px 16px;
    text-align: center;
    border-right: 1px solid rgba(15,23,42,0.08);
  }
  .tp-stat-cell:last-child { border-right: 0; }
  .tp-stat-num {
    font-size: 18px;
    font-weight: 700;
    color: var(--tp-slate-900);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.01em;
  }
  .tp-stat-lbl {
    font-size: 9.5px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--tp-slate-500);
    margin-top: 3px;
    font-weight: 500;
  }

  /* Hero floating chips */
  .tp-chip {
    position: absolute;
    font-size: 10.5px;
    padding: 6px 10px;
    border-radius: 8px;
    background: rgba(255,255,255,0.95);
    border: 1px solid rgba(15,23,42,0.10);
    color: var(--tp-slate-800);
    white-space: nowrap;
    box-shadow:
      0 10px 24px -10px rgba(15,23,42,0.25);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    backdrop-filter: blur(8px);
    animation: tpChipFloat 9s ease-in-out infinite;
    z-index: 2;
  }
  .tp-chip-orange {
    background: linear-gradient(180deg, #FFFFFF 0%, #FEFCE8 100%);
    border-color: rgba(249,115,22,0.32);
    box-shadow:
      0 0 0 1px rgba(249,115,22,0.12),
      0 10px 24px -8px rgba(249,115,22,0.35);
  }
  .tp-chip-dot {
    width: 5px; height: 5px; border-radius: 999px;
    background: var(--tp-slate-500);
  }
  .tp-chip-dot-orange {
    background: var(--tp-orange);
    box-shadow: 0 0 0 2px rgba(249,115,22,0.18), 0 0 8px rgba(249,115,22,0.6);
  }
  .tp-chip-k {
    font-family: inherit;
    color: var(--tp-slate-500);
    letter-spacing: 0.14em;
    font-size: 9.5px;
    font-weight: 600;
  }
  .tp-chip-v {
    color: var(--tp-slate-900);
    font-weight: 600;
  }
  @keyframes tpChipFloat {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
  }

  /* ====== Live ticker delta dot ====== */
  .tp-delta-dot {
    width: 4px; height: 4px; border-radius: 999px;
    background: var(--tp-slate-400);
  }

  /* ====== Problem section ====== */
  .tp-problem {
    background: #0F172A;
    color: var(--tp-slate-200);
    position: relative;
    overflow: hidden;
    border-top: 1px solid rgba(15,23,42,0.4);
  }
  .tp-problem-glow {
    background:
      radial-gradient(ellipse 50% 40% at 80% 20%, rgba(249,115,22,0.10), transparent 55%),
      radial-gradient(ellipse 60% 50% at 20% 80%, rgba(51,65,85,0.45), transparent 60%);
  }
  .tp-problem-card {
    background: rgba(30,41,59,0.55);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 16px;
    padding: 28px;
    backdrop-filter: blur(8px);
  }
  .tp-problem-card-hi {
    background: linear-gradient(180deg, rgba(51,65,85,0.7) 0%, rgba(30,41,59,0.8) 100%);
    border: 1px solid rgba(249,115,22,0.18);
    box-shadow:
      0 0 0 1px rgba(255,255,255,0.04) inset,
      0 28px 60px -22px rgba(0,0,0,0.5);
  }
  .tp-result-num {
    background: linear-gradient(180deg, #FED7AA 0%, #F97316 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  /* ====== Waterfall schematic ====== */
  .tp-schematic {
    position: relative;
    z-index: 1;
    background: #FFFFFF;
    border: 1px solid rgba(15,23,42,0.08);
    border-radius: 16px;
    padding: 18px 18px 8px;
    box-shadow:
      0 1px 0 rgba(255,255,255,1) inset,
      0 18px 40px -22px rgba(15,23,42,0.18);
  }
  .tp-stage-card {
    background: #FFFFFF;
    border: 1px solid rgba(15,23,42,0.08);
    border-radius: 12px;
    padding: 18px;
    transition: all .25s ease;
  }
  .tp-stage-card:hover {
    border-color: rgba(15,23,42,0.18);
    box-shadow: 0 10px 22px -10px rgba(15,23,42,0.18);
    transform: translateY(-2px);
  }
  .tp-stage-n {
    font-family: inherit;
    font-size: 10.5px;
    font-weight: 700;
    color: var(--tp-slate-400);
    letter-spacing: 0.22em;
  }
  .tp-stage-tag {
    font-family: inherit;
    font-size: 9.5px;
    font-weight: 600;
    color: var(--tp-slate-700);
    letter-spacing: 0.20em;
    text-transform: uppercase;
    padding: 3px 8px;
    border-radius: 4px;
    background: var(--tp-slate-100);
    border: 1px solid rgba(15,23,42,0.06);
  }

  /* ====== Pillar tag & ROI badge ====== */
  .tp-pillar-tag {
    display: inline-flex;
    align-items: center;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--tp-slate-700);
    padding: 5px 10px;
    border-radius: 6px;
    background: var(--tp-slate-100);
    border: 1px solid rgba(15,23,42,0.06);
    letter-spacing: 0.06em;
  }
  .tp-bullet-dot {
    width: 6px; height: 6px; border-radius: 2px;
    background: var(--tp-slate-700);
    flex-shrink: 0;
  }
  .tp-roi-badge {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    border-radius: 10px;
    background: linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%);
    border: 1px solid rgba(15,23,42,0.10);
    box-shadow: 0 8px 20px -10px rgba(15,23,42,0.15);
    color: var(--tp-slate-700);
    font-size: 13.5px;
    font-weight: 500;
  }
  .tp-roi-badge-orange {
    color: var(--tp-orange-deep);
    font-weight: 800;
    font-size: 17px;
    letter-spacing: -0.01em;
  }
  /* ====== Mock frame ====== */
  .tp-mock-frame { position: relative; }
  .tp-mock-chrome {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    background: linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 100%);
    border: 1px solid rgba(15,23,42,0.10);
    border-bottom: 0;
    border-radius: 14px 14px 0 0;
  }
  .tp-mock-dot {
    width: 9px; height: 9px; border-radius: 999px;
    background: rgba(15,23,42,0.16);
  }
  .tp-mock-dot:nth-child(1) { background: #F97316; }
  .tp-mock-dot:nth-child(2) { background: #FBBF24; }
  .tp-mock-dot:nth-child(3) { background: #84CC16; }
  .tp-mock-url {
    font-family: inherit;
    font-size: 11px;
    color: var(--tp-slate-500);
    margin-left: 12px;
    flex: 1;
    text-align: center;
  }
  .tp-mock-badge {
    font-family: inherit;
    font-size: 9.5px;
    letter-spacing: 0.18em;
    color: var(--tp-slate-700);
    padding: 3px 7px;
    border-radius: 4px;
    background: rgba(15,23,42,0.04);
    border: 1px solid rgba(15,23,42,0.10);
    font-weight: 600;
  }
  .tp-mock-card {
    background: #FFFFFF;
    border: 1px solid rgba(15,23,42,0.10);
    border-radius: 0 0 14px 14px;
    overflow: hidden;
    box-shadow:
      0 28px 60px -22px rgba(15,23,42,0.25),
      0 12px 28px -10px rgba(15,23,42,0.15);
  }
  .tp-mock-side {
    margin-top: 14px;
    background: #FFFFFF;
    border: 1px solid rgba(15,23,42,0.10);
    border-radius: 12px;
    padding: 18px;
    box-shadow: 0 14px 32px -16px rgba(15,23,42,0.18);
  }
  .tp-mini-stat {
    background: var(--tp-slate-50);
    border: 1px solid rgba(15,23,42,0.06);
    border-radius: 8px;
    padding: 10px 12px;
  }
  .tp-progress {
    height: 4px;
    background: rgba(15,23,42,0.08);
    border-radius: 999px;
    overflow: hidden;
  }
  .tp-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--tp-slate-900) 0%, var(--tp-slate-700) 100%);
    border-radius: 999px;
    transition: width 0.6s ease;
  }
  .tp-offer-row-primary-lg {
    background: linear-gradient(90deg, rgba(249,115,22,0.05), rgba(249,115,22,0));
    margin: 0 -24px;
    padding: 14px 24px;
    border-radius: 10px;
    border: 1px solid rgba(249,115,22,0.16);
  }
  .tp-row-recommend {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.18em;
    color: var(--tp-orange-deep);
    padding: 2px 7px;
    border-radius: 4px;
    background: rgba(249,115,22,0.08);
    border: 1px solid rgba(249,115,22,0.2);
    margin-left: 4px;
  }
  .tp-row-counter {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.18em;
    color: var(--tp-slate-700);
    padding: 2px 7px;
    border-radius: 4px;
    background: var(--tp-slate-100);
    border: 1px solid rgba(15,23,42,0.08);
    margin-left: 4px;
  }
  .tp-pill-status {
    display: inline-block;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.18em;
    padding: 3px 7px;
    border-radius: 4px;
  }
  .tp-pill-status-approved {
    color: #FFFFFF;
    background: var(--tp-slate-900);
  }
  .tp-pill-status-backup {
    color: var(--tp-slate-700);
    background: var(--tp-slate-100);
    border: 1px solid rgba(15,23,42,0.06);
  }
  .tp-pill-status-counter {
    color: var(--tp-slate-600);
    background: rgba(15,23,42,0.04);
    border: 1px solid rgba(15,23,42,0.08);
  }
  .tp-pill-status-declined {
    color: var(--tp-slate-400);
    background: rgba(15,23,42,0.03);
    border: 1px solid rgba(15,23,42,0.06);
  }
  /* ====== Agentic Layer · dark slate band ====== */
  .tp-agents-section {
    background: #0F172A;
    color: var(--tp-slate-200);
    position: relative;
    overflow: hidden;
    border-top: 1px solid rgba(15,23,42,0.4);
    border-bottom: 1px solid rgba(15,23,42,0.4);
  }
  .tp-agents-glow {
    background:
      radial-gradient(ellipse 55% 45% at 85% 12%, rgba(249,115,22,0.10), transparent 55%),
      radial-gradient(ellipse 60% 50% at 15% 90%, rgba(51,65,85,0.55), transparent 60%),
      radial-gradient(ellipse 45% 35% at 50% 50%, rgba(30,41,59,0.4), transparent 60%);
    pointer-events: none;
  }
  .tp-agent-card {
    background: linear-gradient(180deg, rgba(30,41,59,0.62) 0%, rgba(15,23,42,0.78) 100%);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 24px;
    padding: 28px;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    box-shadow:
      0 1px 0 rgba(255,255,255,0.04) inset,
      0 28px 60px -28px rgba(0,0,0,0.55);
    transition: border-color .25s ease, transform .25s ease, box-shadow .25s ease;
  }
  .tp-agent-card::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    padding: 1px;
    background: linear-gradient(140deg, rgba(255,255,255,0.10), transparent 35%, transparent 70%, rgba(249,115,22,0.10));
    -webkit-mask: linear-gradient(#000, #000) content-box, linear-gradient(#000, #000);
    -webkit-mask-composite: xor;
            mask-composite: exclude;
    pointer-events: none;
  }
  .tp-agent-card:hover {
    border-color: rgba(255,255,255,0.16);
    transform: translateY(-2px);
    box-shadow:
      0 1px 0 rgba(255,255,255,0.06) inset,
      0 34px 70px -28px rgba(0,0,0,0.7);
  }
  .tp-agent-icon-box {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%);
    border: 1px solid rgba(255,255,255,0.10);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    flex-shrink: 0;
    box-shadow: 0 1px 0 rgba(255,255,255,0.08) inset;
  }
  .tp-agent-icon-pulse {
    position: absolute;
    top: -2px;
    right: -2px;
    width: 10px;
    height: 10px;
    border-radius: 999px;
    background: var(--tp-orange);
    box-shadow: 0 0 0 2px rgba(15,23,42,1), 0 0 10px rgba(249,115,22,0.7);
    animation: tpPulseOrange 2.4s ease-in-out infinite;
  }
  .tp-agent-eyebrow {
    font-family: inherit;
    font-size: 10.5px;
    color: var(--tp-slate-400);
    letter-spacing: 0.22em;
    text-transform: uppercase;
    font-weight: 600;
  }
  .tp-agent-title {
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.018em;
    color: #F8FAFC;
    line-height: 1.15;
    margin-top: 2px;
  }
  .tp-agent-role {
    color: var(--tp-slate-400);
    font-weight: 500;
    font-size: 15px;
    letter-spacing: 0;
  }
  .tp-agent-status {
    font-family: inherit;
    font-size: 10px;
    color: rgba(248,250,252,0.85);
    letter-spacing: 0.22em;
    text-transform: uppercase;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border-radius: 999px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    white-space: nowrap;
    flex-shrink: 0;
    font-weight: 600;
  }
  .tp-agent-status-learning {
    color: rgba(254,215,170,0.92);
    background: rgba(249,115,22,0.08);
    border-color: rgba(249,115,22,0.22);
  }
  .tp-agent-status-dot {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: #F8FAFC;
    box-shadow: 0 0 8px rgba(248,250,252,0.7);
    animation: tpAgentDotPulse 2s ease-in-out infinite;
  }
  .tp-agent-status-dot-learning {
    background: var(--tp-orange);
    box-shadow: 0 0 8px rgba(249,115,22,0.8);
  }
  @keyframes tpAgentDotPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.45; }
  }
  .tp-agent-desc {
    margin-top: 20px;
    color: var(--tp-slate-300);
    font-size: 13.5px;
    line-height: 1.65;
  }
  .tp-agent-stats {
    margin-top: 20px;
    gap: 10px;
  }
  .tp-agent-stat {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 10px;
    padding: 10px 12px;
  }
  .tp-agent-stat-k {
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--tp-slate-400);
    font-weight: 600;
  }
  .tp-agent-stat-v {
    font-size: 14.5px;
    font-weight: 700;
    color: #F8FAFC;
    margin-top: 4px;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.01em;
  }
  .tp-agent-lastaction {
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px dashed rgba(255,255,255,0.10);
    font-family: inherit;
    font-size: 11px;
    color: var(--tp-slate-400);
    line-height: 1.55;
    letter-spacing: 0.01em;
  }
  .tp-agent-lastaction-label {
    color: #F8FAFC;
    font-weight: 600;
  }
  .tp-agents-footer {
    margin-top: 40px;
    display: inline-flex;
    align-items: center;
    gap: 12px;
    padding: 12px 18px;
    border-radius: 999px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    color: var(--tp-slate-300);
    font-size: 12.5px;
    letter-spacing: 0.01em;
    max-width: 100%;
  }
  .tp-agents-footer-dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: var(--tp-orange);
    box-shadow: 0 0 0 2px rgba(249,115,22,0.18), 0 0 10px rgba(249,115,22,0.6);
    flex-shrink: 0;
    animation: tpPulseOrange 2.4s ease-in-out infinite;
  }

  /* ====== ECHO event-stream side panel ====== */
  .tp-agent-stream {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 18px;
    padding: 20px;
  }
  .tp-agent-stream-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
  }
  .tp-agent-stream-title {
    font-family: inherit;
    font-size: 10.5px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--tp-slate-400);
    font-weight: 600;
  }
  .tp-agent-stream-rate {
    font-family: inherit;
    font-size: 10.5px;
    color: var(--tp-slate-400);
    letter-spacing: 0.02em;
  }
  .tp-agent-stream-list {
    display: flex;
    flex-direction: column;
  }
  .tp-agent-stream-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 7px 0;
    border-bottom: 1px dashed rgba(255,255,255,0.10);
    font-size: 12px;
  }
  .tp-agent-stream-row-last {
    border-bottom: 0;
  }
  .tp-agent-stream-src {
    color: var(--tp-slate-300);
    font-family: inherit;
    letter-spacing: 0.01em;
  }
  .tp-agent-stream-dest {
    color: #F8FAFC;
    font-family: inherit;
    font-weight: 500;
    text-align: right;
    letter-spacing: 0.01em;
  }
  .tp-agent-stream-dest-muted {
    color: var(--tp-slate-400);
    font-family: inherit;
    text-align: right;
    letter-spacing: 0.01em;
  }

  /* ====== Coordination-layer pill ====== */
  .tp-agents-coordination {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 18px;
    padding: 18px 22px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    box-shadow: 0 1px 0 rgba(255,255,255,0.06) inset;
  }
  @media (min-width: 768px) {
    .tp-agents-coordination {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
    }
  }
  .tp-agents-coordination-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .tp-agents-coordination-eyebrow {
    font-family: inherit;
    font-size: 10.5px;
    color: var(--tp-slate-400);
    letter-spacing: 0.22em;
    text-transform: uppercase;
    font-weight: 600;
  }
  .tp-agents-coordination-body {
    color: #F8FAFC;
    font-weight: 600;
    font-size: 14px;
    margin-top: 2px;
    line-height: 1.5;
  }
  .tp-agents-coordination-cta {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    border-radius: 12px;
    border: 1px solid rgba(249,115,22,0.35);
    background: rgba(249,115,22,0.08);
    color: #FDBA74;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.01em;
    align-self: flex-start;
    transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
    white-space: nowrap;
  }
  .tp-agents-coordination-cta:hover {
    background: rgba(249,115,22,0.14);
    border-color: rgba(249,115,22,0.55);
    color: #FED7AA;
  }
  @media (min-width: 768px) {
    .tp-agents-coordination-cta {
      align-self: auto;
    }
  }

  /* ====== ROI section ====== */
  .tp-roi-panel {
    background: #FFFFFF;
    border: 1px solid rgba(15,23,42,0.08);
    border-radius: 16px;
    padding: 32px;
    box-shadow: 0 12px 28px -16px rgba(15,23,42,0.12);
  }
  .tp-roi-output {
    background: linear-gradient(180deg, #0F172A 0%, #1E293B 100%);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 16px;
    padding: 32px;
    color: var(--tp-slate-200);
    position: relative;
    overflow: hidden;
    box-shadow:
      0 30px 70px -20px rgba(15,23,42,0.5),
      0 12px 28px -10px rgba(15,23,42,0.3);
  }
  .tp-roi-output::before {
    content: "";
    position: absolute;
    top: -50%; right: -20%;
    width: 80%; height: 80%;
    background: radial-gradient(ellipse, rgba(249,115,22,0.16), transparent 60%);
    pointer-events: none;
  }
  .tp-roi-num {
    position: relative;
    font-size: clamp(2.5rem, 4.5vw, 3.75rem);
    line-height: 1;
    font-weight: 800;
    letter-spacing: -0.025em;
    background: linear-gradient(180deg, #F8FAFC 0%, #FED7AA 50%, #F97316 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .tp-roi-sub {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 8px;
    padding: 12px 14px;
  }
  .tp-roi-lift {
    color: var(--tp-orange-deep);
  }
  .tp-slider-track {
    position: relative;
    height: 6px;
    background: rgba(15,23,42,0.08);
    border-radius: 999px;
  }
  .tp-slider-fill {
    position: absolute;
    inset: 0 auto 0 0;
    background: linear-gradient(90deg, var(--tp-slate-900) 0%, var(--tp-slate-700) 100%);
    border-radius: 999px;
    pointer-events: none;
  }
  .tp-slider-input {
    position: absolute;
    inset: -10px 0;
    width: 100%;
    height: calc(100% + 20px);
    appearance: none;
    -webkit-appearance: none;
    background: transparent;
    margin: 0;
    cursor: pointer;
  }
  .tp-slider-input::-webkit-slider-thumb {
    appearance: none;
    -webkit-appearance: none;
    width: 22px; height: 22px;
    border-radius: 999px;
    background: #FFFFFF;
    border: 2px solid var(--tp-slate-900);
    box-shadow:
      0 0 0 4px rgba(249,115,22,0.18),
      0 4px 10px -2px rgba(15,23,42,0.4);
    cursor: pointer;
  }
  .tp-slider-input::-moz-range-thumb {
    width: 22px; height: 22px;
    border-radius: 999px;
    background: #FFFFFF;
    border: 2px solid var(--tp-slate-900);
    box-shadow:
      0 0 0 4px rgba(249,115,22,0.18),
      0 4px 10px -2px rgba(15,23,42,0.4);
    cursor: pointer;
  }

  /* ====== Case studies ====== */
  .tp-case-card {
    background: #FFFFFF;
    border: 1px solid rgba(15,23,42,0.08);
    border-radius: 16px;
    padding: 28px;
    box-shadow: 0 12px 28px -16px rgba(15,23,42,0.12);
    transition: all .25s ease;
  }
  .tp-case-card:hover {
    border-color: rgba(15,23,42,0.16);
    transform: translateY(-3px);
    box-shadow: 0 18px 40px -18px rgba(15,23,42,0.2);
  }
  .tp-case-outcome {
    flex: 1;
    background: var(--tp-slate-50);
    border: 1px solid rgba(15,23,42,0.06);
    border-radius: 10px;
    padding: 12px;
  }
  .tp-case-outcome-num {
    font-size: 22px;
    font-weight: 800;
    color: var(--tp-slate-900);
    letter-spacing: -0.02em;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .tp-case-outcome-lbl {
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--tp-slate-500);
    margin-top: 6px;
    font-weight: 600;
  }
  .tp-quote-mark {
    font-size: 56px;
    line-height: 0.6;
    color: var(--tp-slate-300);
    font-family: inherit;
    font-weight: 700;
  }

  /* ====== Marquee ====== */
  .tp-marquee {
    mask-image: linear-gradient(90deg, transparent, black 8%, black 92%, transparent);
    overflow: hidden;
  }
  .tp-marquee-track {
    display: flex;
    gap: 56px;
    width: max-content;
    animation: tpMarquee 32s linear infinite;
  }
  .tp-marquee-item {
    font-family: inherit;
    font-size: 13px;
    color: var(--tp-slate-500);
    letter-spacing: 0.08em;
    font-weight: 600;
    white-space: nowrap;
  }
  @keyframes tpMarquee {
    from { transform: translateX(0); }
    to { transform: translateX(-33.33%); }
  }

  /* ====== FAQ ====== */
  .tp-faq {
    border-top: 1px solid rgba(15,23,42,0.08);
    border-bottom: 1px solid rgba(15,23,42,0.08);
  }
  .tp-faq-row {
    border-bottom: 1px solid rgba(15,23,42,0.08);
  }
  .tp-faq-row:last-child { border-bottom: 0; }
  .tp-faq-q {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 22px 0;
    text-align: left;
    font-size: 17px;
    font-weight: 600;
    color: var(--tp-slate-900);
    cursor: pointer;
    background: transparent;
    border: 0;
    letter-spacing: -0.01em;
  }
  .tp-faq-q:hover { color: var(--tp-orange-deep); }
  .tp-faq-plus {
    font-size: 22px;
    color: var(--tp-slate-400);
    transition: transform .2s ease, color .2s ease;
    font-weight: 300;
  }
  .tp-faq-plus.open {
    transform: rotate(45deg);
    color: var(--tp-orange);
  }
  .tp-faq-a {
    max-height: 0;
    overflow: hidden;
    transition: max-height .35s ease;
  }
  .tp-faq-a.open { max-height: 400px; }
  .tp-faq-a p {
    color: var(--tp-slate-600);
    font-size: 15px;
    line-height: 1.65;
    padding: 0 0 22px;
  }

  /* ====== Final CTA ====== */
  .tp-final-cta {
    background: #0F172A;
    color: var(--tp-slate-200);
    border-top: 1px solid rgba(15,23,42,0.4);
    position: relative;
  }
  .tp-final-glow {
    background:
      radial-gradient(ellipse 60% 50% at 50% 0%, rgba(51,65,85,0.6), transparent 60%),
      radial-gradient(ellipse 40% 30% at 50% 100%, rgba(249,115,22,0.10), transparent 60%);
  }
  .tp-final-accent-dot {
    position: absolute;
    top: 36%;
    right: 8%;
    width: 12px;
    height: 12px;
    border-radius: 999px;
    background: var(--tp-orange);
    box-shadow:
      0 0 0 6px rgba(249,115,22,0.16),
      0 0 28px rgba(249,115,22,0.6);
    animation: tpPulseOrange 2.8s ease-in-out infinite;
  }

  /* ============================================================
     3D / DEPTH SYSTEM
     Pure CSS, no JS. AUREAN-inspired perspective scenes.
     ============================================================ */

  /* Hero offer-card scene · perspective + gentle float + hover tilt */
  .tp-hero-scene {
    perspective: 1400px;
    perspective-origin: 50% 40%;
  }
  .tp-hero-stage {
    transform-style: preserve-3d;
    transition: transform 0.5s cubic-bezier(0.22, 0.61, 0.36, 1);
    will-change: transform;
  }
  .tp-hero-stage:hover {
    transform: rotateY(-3deg) rotateX(2deg) translateY(-4px);
  }
  @media (prefers-reduced-motion: no-preference) {
    .tp-hero-stage {
      animation: tpFloat 9s ease-in-out infinite;
    }
  }
  @keyframes tpFloat {
    0%, 100% { transform: translateY(0) rotateY(0deg) rotateX(0deg); }
    50%      { transform: translateY(-8px) rotateY(-0.6deg) rotateX(0.4deg); }
  }

  /* Hero offer-card status pill scanline · "live" feel */
  .tp-status-pill {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 2px 0;
    overflow: hidden;
    border-radius: 4px;
  }
  .tp-status-pill-scan {
    position: absolute;
    left: -30%;
    top: 0;
    bottom: 0;
    width: 40%;
    background: linear-gradient(90deg, transparent 0%, rgba(249,115,22,0.18) 50%, transparent 100%);
    pointer-events: none;
  }
  @media (prefers-reduced-motion: no-preference) {
    .tp-status-pill-scan {
      animation: tpStatusScan 6s ease-in-out infinite;
    }
  }
  @keyframes tpStatusScan {
    0%   { transform: translateX(0); opacity: 0; }
    8%   { opacity: 1; }
    50%  { transform: translateX(280%); opacity: 1; }
    92%  { opacity: 0; }
    100% { transform: translateX(280%); opacity: 0; }
  }

  /* Hero floating-chip · subtle box-shadow breathe */
  @media (prefers-reduced-motion: no-preference) {
    .tp-chip-pulse {
      animation: tpChipFloat 9s ease-in-out infinite, tpChipPulse 5s ease-in-out infinite;
    }
    .tp-chip-funded {
      animation: tpChipFloat 9s ease-in-out infinite, tpChipFundedPulse 4.5s ease-in-out infinite;
    }
  }
  @keyframes tpChipPulse {
    0%, 100% {
      box-shadow:
        0 0 0 1px rgba(249,115,22,0.12),
        0 10px 24px -8px rgba(249,115,22,0.35);
    }
    50% {
      box-shadow:
        0 0 0 1px rgba(249,115,22,0.22),
        0 14px 32px -8px rgba(249,115,22,0.55);
    }
  }
  @keyframes tpChipFundedPulse {
    0%, 100% {
      box-shadow:
        0 10px 24px -10px rgba(15,23,42,0.25),
        0 0 0 1px rgba(249,115,22,0.0);
    }
    50% {
      box-shadow:
        0 12px 28px -10px rgba(15,23,42,0.3),
        0 0 0 2px rgba(249,115,22,0.18),
        0 0 18px rgba(249,115,22,0.20);
    }
  }

  /* Schematic flow · flat blueprint, no tilt (alignment must read clean) */
  .tp-schematic-scene {
    position: relative;
  }
  .tp-schematic-stage {
    position: relative;
  }
  .tp-schematic-scanline {
    position: absolute;
    left: 6%;
    right: 6%;
    top: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(15,23,42,0.35), transparent);
    box-shadow: 0 0 14px rgba(249,115,22,0.14);
    pointer-events: none;
    z-index: 0;
  }
  @media (prefers-reduced-motion: no-preference) {
    .tp-schematic-scanline {
      animation: tpSchematicScan 9s linear infinite;
    }
  }
  @keyframes tpSchematicScan {
    0%   { top: 4%;  opacity: 0; }
    8%   { opacity: 1; }
    90%  { opacity: 1; }
    100% { top: 96%; opacity: 0; }
  }

  /* Finance mockup pillar · perspective sway */
  .tp-finance-scene {
    perspective: 1800px;
    perspective-origin: 50% 50%;
  }
  .tp-finance-stage {
    transform-style: preserve-3d;
    transition: transform 0.6s cubic-bezier(0.22, 0.61, 0.36, 1);
    will-change: transform;
  }
  .tp-finance-stage:hover {
    transform: rotateY(-1.5deg) translateY(-3px);
  }
  @media (prefers-reduced-motion: no-preference) {
    .tp-finance-stage {
      animation: tpFinanceSway 12s ease-in-out infinite;
    }
  }
  @keyframes tpFinanceSway {
    0%, 100% { transform: rotateY(-1deg) translateY(0); }
    50%      { transform: rotateY(1deg) translateY(-4px); }
  }

  /* Lender waterfall · 3D-stacked offer rows */
  .tp-offer-stack {
    perspective: 1400px;
    perspective-origin: 50% 50%;
    transform-style: preserve-3d;
  }
  .tp-offer-row-3d {
    transform: translateZ(var(--tp-row-z, 0px));
    transition: transform 0.35s cubic-bezier(0.22, 0.61, 0.36, 1), box-shadow 0.35s ease, background-color 0.35s ease;
    will-change: transform;
    border-radius: 8px;
    position: relative;
  }
  .tp-offer-row-recessed {
    box-shadow: inset 0 1px 3px rgba(15,23,42,0.04);
  }
  .tp-offer-row-3d:hover {
    transform: translateZ(20px) scale(1.015);
    z-index: 3;
    background: linear-gradient(90deg, rgba(255,255,255,1), rgba(248,250,252,1));
    box-shadow:
      0 16px 32px -12px rgba(15,23,42,0.18),
      0 6px 12px -4px rgba(15,23,42,0.10);
  }
  .tp-offer-row-3d.tp-offer-row-primary-lg:hover {
    box-shadow:
      0 18px 36px -14px rgba(249,115,22,0.25),
      0 6px 14px -4px rgba(15,23,42,0.10);
  }

  /* KPI ticker · subtle hover lift */
  .tp-ticker-section {
    perspective: 1600px;
    perspective-origin: 50% 50%;
  }
  .tp-ticker-cell {
    transform-style: preserve-3d;
    transition: transform 0.25s cubic-bezier(0.22, 0.61, 0.36, 1), filter 0.25s ease;
    will-change: transform;
    padding: 2px 0;
  }
  .tp-ticker-cell:hover {
    transform: translateY(-3px) rotateX(2deg);
    filter: drop-shadow(0 10px 18px rgba(15,23,42,0.10));
  }

  /* Case-study cards · perspective + hover tilt */
  .tp-case-scene {
    perspective: 1500px;
    perspective-origin: 50% 50%;
  }
  .tp-case-card-3d {
    transform-style: preserve-3d;
    will-change: transform;
  }
  .tp-case-card-3d:hover {
    transform: rotateY(-2deg) rotateX(1deg) translateY(-4px);
    box-shadow:
      0 22px 48px -18px rgba(15,23,42,0.22),
      0 8px 18px -8px rgba(15,23,42,0.12);
  }

  /* Section transition · soft fade gradient between bands */
  .tp-section-fade-top {
    -webkit-mask-image: linear-gradient(180deg, transparent 0%, #000 6%, #000 100%);
            mask-image: linear-gradient(180deg, transparent 0%, #000 6%, #000 100%);
  }
  .tp-section-fade-bottom {
    -webkit-mask-image: linear-gradient(180deg, #000 0%, #000 94%, transparent 100%);
            mask-image: linear-gradient(180deg, #000 0%, #000 94%, transparent 100%);
  }

  /* ====== Reveal on scroll ====== */
  .reveal {
    opacity: 0;
    transform: translateY(18px);
    transition: opacity .8s ease, transform .8s ease;
  }
  .reveal.in {
    opacity: 1;
    transform: none;
  }

  /* ====== Responsive ====== */
  @media (max-width: 1280px) {
    .tp-chip { font-size: 10px; }
  }
  @media (max-width: 1024px) {
    .tp-nav-tag { display: none; }
    .tp-hero { padding-top: 7rem !important; padding-bottom: 5rem !important; }
    section.py-28 { padding-top: 4.5rem; padding-bottom: 4.5rem; }
    section.py-32 { padding-top: 5rem; padding-bottom: 5rem; }
    .tp-chip { display: none; }
    .tp-chip-orange { display: inline-flex !important; }
    .tp-chip-orange { top: -10px !important; left: 0 !important; right: auto !important; bottom: auto !important; }
  }
  @media (max-width: 768px) {
    .tp-hero { padding-top: 6rem !important; padding-bottom: 3rem !important; }
    section.py-28 { padding-top: 3rem !important; padding-bottom: 3rem !important; }
    section.py-32 { padding-top: 3.5rem !important; padding-bottom: 3.5rem !important; }
    .tp-h1 { font-size: 2.4rem !important; line-height: 1.06 !important; }
    .tp-h2 { font-size: 1.85rem !important; line-height: 1.12 !important; }
    .tp-h3 { font-size: 1.65rem !important; line-height: 1.15 !important; }
    .tp-trust-strip { max-width: 100%; }
    .tp-trust-cell { padding: 10px 12px; }
    .tp-trust-num { font-size: 19px; }
    .tp-mock-url { font-size: 10px; }
    .tp-offer-row-primary-lg { margin: 0; padding: 14px 12px; }
    .tp-roi-panel, .tp-roi-output { padding: 22px; }
    .tp-roi-num { font-size: 2.5rem !important; }
    .tp-faq-q { font-size: 15px; padding: 18px 0; }
    .tp-quote-mark { font-size: 42px; }
    .tp-agent-card { padding: 22px; border-radius: 18px; }
    .tp-agent-title { font-size: 19px; }
    .tp-agent-role { font-size: 13.5px; }
    .tp-agent-desc { font-size: 13px; }
    .tp-agents-section .py-32 { padding-top: 4rem; padding-bottom: 4rem; }
    .tp-agents-footer { font-size: 11.5px; padding: 10px 14px; }
  }
  @media (max-width: 480px) {
    .tp-h1 { font-size: 2.05rem !important; line-height: 1.08 !important; }
    .tp-h2 { font-size: 1.55rem !important; line-height: 1.15 !important; }
    .tp-trust-strip { grid-template-columns: 1fr; }
    .tp-trust-cell { border-bottom: 1px solid rgba(15,23,42,0.08); }
    .tp-trust-cell:last-child { border-bottom: 0; }
    .tp-eyebrow-pill { font-size: 9.5px; padding: 6px 10px; }
  }

  /* ============================================================
     SYNERGY CALLOUT
     Mirrors MedPay's mp-synergy pattern with slate/orange palette.
     ============================================================ */
  .tp-synergy {
    background:
      radial-gradient(ellipse 60% 80% at 0% 50%, rgba(249,115,22,0.07), transparent 60%),
      linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(248,250,252,0.92) 100%);
    border: 1px solid rgba(15,23,42,0.10);
    border-radius: 24px;
    padding: 34px 36px;
    box-shadow:
      0 1px 0 rgba(255,255,255,1) inset,
      0 24px 60px -28px rgba(15,23,42,0.22);
    position: relative;
    overflow: hidden;
  }
  .tp-synergy::before {
    content: ""; position: absolute; inset: 0;
    background-image:
      linear-gradient(rgba(15,23,42,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(15,23,42,0.04) 1px, transparent 1px);
    background-size: 32px 32px;
    mask-image: radial-gradient(ellipse at 0% 50%, black 0%, transparent 70%);
    pointer-events: none;
  }
  .tp-synergy-grid {
    position: relative;
    display: grid;
    grid-template-columns: minmax(280px, 360px) 1fr;
    gap: 40px;
    align-items: center;
  }
  @media (max-width: 960px) {
    .tp-synergy-grid { grid-template-columns: 1fr; gap: 24px; }
  }
  .tp-synergy-side {
    display: flex; flex-direction: column; gap: 18px;
  }
  .tp-synergy-eyebrow {
    display: inline-flex; align-items: center; gap: 8px;
    font-size: 11px; letter-spacing: 0.22em; font-weight: 700;
    color: var(--tp-orange-deep);
    text-transform: uppercase;
  }
  .tp-synergy-eyebrow-dot {
    width: 8px; height: 8px; border-radius: 999px;
    background: var(--tp-orange);
    box-shadow: 0 0 0 2px rgba(249,115,22,0.18), 0 0 10px rgba(249,115,22,0.6);
    animation: tpPulseOrange 2.4s ease-in-out infinite;
  }
  .tp-synergy-pair {
    display: flex; align-items: center; gap: 14px;
  }
  .tp-synergy-half {
    flex: 1;
    padding: 14px 16px;
    border-radius: 12px;
    background: rgba(255,255,255,0.95);
    border: 1px solid rgba(15,23,42,0.10);
    box-shadow: 0 6px 14px -10px rgba(15,23,42,0.18);
  }
  .tp-synergy-half-k {
    font-size: 10px; letter-spacing: 0.18em; font-weight: 700;
    color: var(--tp-slate-500); text-transform: uppercase;
  }
  .tp-synergy-half-v {
    margin-top: 4px;
    font-size: 16px; font-weight: 700; color: var(--tp-slate-900);
    letter-spacing: -0.01em;
  }
  .tp-synergy-x {
    font-size: 22px; font-weight: 700; color: var(--tp-orange);
    flex-shrink: 0;
  }
  .tp-synergy-body {
    font-size: 15px; line-height: 1.65; color: var(--tp-slate-600);
  }
  .tp-synergy-body p { margin: 0 0 12px 0; }
  .tp-synergy-body p:last-child { margin-bottom: 0; }
  .tp-synergy-body strong { color: var(--tp-slate-900); }
  @media (max-width: 768px) {
    .tp-synergy { padding: 24px; }
    .tp-synergy-pair { flex-direction: column; align-items: stretch; gap: 10px; }
    .tp-synergy-x { text-align: center; }
  }

  /* ============================================================
     QUOTE THE BUYERS · time + pixel + smart routing
     ============================================================ */
  .tp-quote-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 22px;
  }
  @media (max-width: 1024px) {
    .tp-quote-grid { grid-template-columns: 1fr 1fr; }
    .tp-quote-card-routing { grid-column: span 2; }
  }
  @media (max-width: 760px) {
    .tp-quote-grid { grid-template-columns: 1fr; }
    .tp-quote-card-routing { grid-column: span 1; }
  }
  .tp-quote-card {
    background: rgba(255,255,255,0.96);
    border: 1px solid rgba(15,23,42,0.10);
    border-radius: 20px;
    padding: 28px;
    display: flex; flex-direction: column; gap: 18px;
    box-shadow:
      0 1px 0 rgba(255,255,255,1) inset,
      0 22px 50px -28px rgba(15,23,42,0.20);
    position: relative;
    overflow: hidden;
  }
  .tp-quote-card-pixel {
    background:
      radial-gradient(ellipse 60% 60% at 100% 0%, rgba(249,115,22,0.08), transparent 60%),
      rgba(255,255,255,0.96);
  }
  .tp-quote-card-routing {
    background:
      radial-gradient(ellipse 50% 50% at 0% 100%, rgba(15,23,42,0.05), transparent 60%),
      rgba(255,255,255,0.96);
  }
  .tp-quote-card-eyebrow {
    display: inline-flex; align-items: center; gap: 8px;
    font-size: 10.5px; letter-spacing: 0.18em; font-weight: 700;
    color: var(--tp-slate-700);
    text-transform: uppercase;
  }
  .tp-quote-card-dot {
    width: 7px; height: 7px; border-radius: 999px;
    background: var(--tp-orange);
    box-shadow: 0 0 0 2px rgba(249,115,22,0.16), 0 0 8px rgba(249,115,22,0.5);
  }
  .tp-quote-card-h {
    font-size: 20px; font-weight: 700; color: var(--tp-slate-900);
    letter-spacing: -0.02em; line-height: 1.22;
    margin: 0;
  }
  .tp-quote-card-body {
    font-size: 13.5px; line-height: 1.65; color: var(--tp-slate-600);
    margin: 0;
  }
  .tp-quote-card-body em {
    color: var(--tp-orange-deep); font-style: normal; font-weight: 600;
  }

  /* Card A · calendar grid + 3D control-panel tilt */
  .tp-quote-calendar-scene {
    perspective: 1400px;
    perspective-origin: 50% 80%;
    margin-top: 8px;
  }
  .tp-quote-calendar-stage {
    transform-style: preserve-3d;
    transform: rotateX(8deg);
    transform-origin: 50% 100%;
    padding: 16px;
    border-radius: 14px;
    background: linear-gradient(180deg, rgba(248,250,252,0.7) 0%, rgba(255,255,255,0.7) 100%);
    border: 1px solid rgba(15,23,42,0.08);
    box-shadow: 0 12px 28px -18px rgba(15,23,42,0.20);
    transition: transform .35s cubic-bezier(0.22, 0.61, 0.36, 1);
    will-change: transform;
  }
  .tp-quote-calendar-stage:hover {
    transform: rotateX(4deg) translateY(-2px);
  }
  .tp-quote-calendar-head {
    display: grid; grid-template-columns: repeat(5, 1fr);
    gap: 6px;
    font-size: 9.5px; letter-spacing: 0.16em; font-weight: 700;
    color: var(--tp-slate-500);
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  .tp-quote-calendar-body {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
  }
  .tp-quote-calendar-slot {
    aspect-ratio: 1;
    border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    transition: transform .15s ease;
  }
  .tp-quote-calendar-slot.buyer {
    background: linear-gradient(135deg, rgba(15,23,42,0.10), rgba(15,23,42,0.05));
    border: 1px solid rgba(15,23,42,0.18);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.7), 0 2px 4px -2px rgba(15,23,42,0.10);
  }
  .tp-quote-calendar-slot.buyer .tp-quote-calendar-dot {
    background: var(--tp-orange);
    box-shadow: 0 0 0 3px rgba(249,115,22,0.18), 0 0 6px rgba(249,115,22,0.5);
  }
  .tp-quote-calendar-slot.filler {
    background: rgba(180, 180, 180, 0.06);
    border: 1px dashed rgba(120, 120, 120, 0.32);
  }
  .tp-quote-calendar-slot.filler .tp-quote-calendar-dot {
    background: rgba(120, 120, 120, 0.4);
  }
  .tp-quote-calendar-dot {
    width: 6px; height: 6px; border-radius: 999px;
  }
  .tp-quote-calendar-legend {
    margin-top: 12px;
    display: flex; gap: 14px; flex-wrap: wrap;
    font-size: 10.5px; color: var(--tp-slate-500);
  }
  .tp-quote-leg-buyer,
  .tp-quote-leg-filler {
    display: inline-flex; align-items: center; gap: 6px;
  }
  .tp-quote-leg-dot {
    display: inline-block;
    width: 8px; height: 8px; border-radius: 999px;
  }
  .tp-quote-leg-buyer .tp-quote-leg-dot {
    background: var(--tp-orange);
    box-shadow: 0 0 0 3px rgba(249,115,22,0.18);
  }
  .tp-quote-leg-filler .tp-quote-leg-dot {
    background: rgba(120, 120, 120, 0.4);
  }

  /* Calendar footer — the math row, now inside the calendar panel
     (used to be a separate dark "tp-quote-recovered" tile that
     orphaned at the bottom of Card A). */
  .tp-quote-calendar-foot {
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px dashed rgba(15,23,42,0.12);
    display: flex; flex-direction: column; gap: 4px;
  }
  .tp-quote-calendar-foot-k {
    font-size: 10px; letter-spacing: 0.16em;
    text-transform: uppercase; font-weight: 600;
    color: var(--tp-slate-500);
  }
  .tp-quote-calendar-foot-v {
    font-size: 26px; font-weight: 800;
    letter-spacing: -0.02em;
    background: linear-gradient(180deg, var(--tp-slate-900) 0%, var(--tp-orange) 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
  }
  .tp-quote-calendar-foot-sub {
    font-size: 10.5px; color: var(--tp-slate-500);
    line-height: 1.5;
  }
  @media (prefers-reduced-motion: no-preference) {
    .tp-quote-recovered {
      animation: tpRecoveredFloat 7s ease-in-out infinite;
    }
  }
  @keyframes tpRecoveredFloat {
    0%, 100% { transform: translateY(0) rotateZ(0deg); }
    50%      { transform: translateY(-4px) rotateZ(0.3deg); }
  }

  /* Card B · pixel feedback loop */
  .tp-pixel-loop-scene {
    margin-top: 6px;
    padding: 14px;
    border-radius: 14px;
    background: linear-gradient(180deg, rgba(248,250,252,0.7) 0%, rgba(255,255,255,0.7) 100%);
    border: 1px solid rgba(15,23,42,0.08);
    box-shadow: 0 12px 28px -18px rgba(15,23,42,0.18);
  }
  .tp-pixel-loop-svg {
    width: 100%;
    height: auto;
    display: block;
  }

  /* Card C · smart routing list + estimator route map */
  .tp-quote-routing-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex; flex-direction: column; gap: 10px;
  }
  .tp-quote-routing-list li {
    display: flex; align-items: flex-start; gap: 12px;
    padding: 10px 12px;
    background: rgba(248,250,252,0.7);
    border: 1px solid rgba(15,23,42,0.08);
    border-radius: 10px;
    font-size: 13px; line-height: 1.55;
    color: var(--tp-slate-700);
  }
  .tp-quote-routing-chip {
    flex-shrink: 0;
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 56px;
    padding: 4px 8px;
    border-radius: 6px;
    background: var(--tp-slate-900);
    color: var(--tp-slate-100);
    font-size: 9.5px; font-weight: 700; letter-spacing: 0.16em;
  }

  /* Route map sits flush below the PRISM/HELIX/RESULT chip list as
     a continuation of the same card. Used to be a tilted panel with
     its own background and shadow that looked like it "popped up" out
     of nowhere with empty space above it. */
  .tp-route-map-scene {
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px dashed rgba(15,23,42,0.12);
  }
  .tp-route-map-stage {
    /* No tilt, no separate panel chrome — the SVG renders its own
       grid background so it stands on its own. */
    padding: 4px 0 0 0;
  }
  .tp-route-map-svg {
    width: 100%;
    height: auto;
    display: block;
  }
  @media (prefers-reduced-motion: no-preference) {
    .tp-route-map-pulse {
      animation: tpRouteMapPulse 2.4s ease-in-out infinite;
      transform-origin: center;
    }
  }
  @keyframes tpRouteMapPulse {
    0%, 100% { opacity: 0.6; transform: scale(1); }
    50%      { opacity: 1; transform: scale(1.15); }
  }
  .tp-route-map-legend {
    margin-top: 10px;
    display: flex; gap: 14px; flex-wrap: wrap;
    font-size: 10.5px; color: var(--tp-slate-500);
  }
  .tp-route-map-leg {
    display: inline-flex; align-items: center; gap: 6px;
  }
  .tp-route-map-leg-dot {
    display: inline-block;
    width: 8px; height: 8px; border-radius: 999px;
  }
  .tp-route-map-leg-dot.qual {
    background: var(--tp-orange);
    box-shadow: 0 0 0 3px rgba(249,115,22,0.18);
  }
  .tp-route-map-leg-dot.unqual {
    background: rgba(148, 163, 184, 0.6);
    border: 1px dashed rgba(148, 163, 184, 0.9);
  }

  /* ============================================================
     LENDER MARKETPLACE BAR · sequential lighting animation
     Adds a perspective tilt + a left-to-right traveling tick highlight.
     Wraps existing .tp-progress styling without breaking it.
     ============================================================ */
  .tp-progress {
    perspective: 800px;
    transform-style: preserve-3d;
  }
  .tp-progress::after {
    content: "";
    position: absolute;
    left: 0; top: 0;
    width: 14%; height: 100%;
    background: linear-gradient(90deg,
      transparent 0%,
      rgba(249,115,22,0.0) 10%,
      rgba(249,115,22,0.65) 50%,
      rgba(249,115,22,0.0) 90%,
      transparent 100%);
    border-radius: 999px;
    pointer-events: none;
  }
  .tp-progress { position: relative; overflow: visible; }
  @media (prefers-reduced-motion: no-preference) {
    .tp-progress::after {
      animation: tpProgressRipple 3.6s ease-in-out infinite;
    }
  }
  @keyframes tpProgressRipple {
    0%   { left: -14%; opacity: 0; }
    10%  { opacity: 1; }
    80%  { opacity: 1; }
    95%  { left: 100%; opacity: 0.4; }
    100% { left: 100%; opacity: 0; }
  }

  /* ============================================================
     ROI OUTPUT · 3D number depth + funnel narrative animation
     ============================================================ */
  .tp-roi-output-scene {
    perspective: 1200px;
    perspective-origin: 50% 50%;
  }
  .tp-roi-num-3d {
    transform: translateZ(0);
    text-shadow:
      0 1px 0 rgba(249,115,22,0.18),
      0 2px 12px rgba(249,115,22,0.22),
      0 6px 24px rgba(249,115,22,0.10);
    filter: drop-shadow(0 4px 12px rgba(249,115,22,0.12));
  }
  .tp-roi-funnel {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 8px;
    font-size: 12px;
    color: var(--tp-slate-300);
    line-height: 1.5;
  }
  .tp-roi-funnel-stage {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 8px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.06);
    color: var(--tp-slate-300);
    font-variant-numeric: tabular-nums;
  }
  .tp-roi-funnel-stage-final {
    background: rgba(249,115,22,0.10);
    border-color: rgba(249,115,22,0.30);
    color: #FED7AA;
  }
  .tp-roi-funnel-stage-final strong {
    color: #FFFFFF;
  }
  .tp-roi-funnel-arrow {
    color: var(--tp-slate-500);
    font-weight: 700;
  }
  .tp-roi-funnel-dot {
    width: 5px; height: 5px; border-radius: 999px;
    background: var(--tp-orange);
    box-shadow: 0 0 6px rgba(249,115,22,0.6);
  }
  @media (prefers-reduced-motion: no-preference) {
    .tp-roi-funnel-dot {
      animation: tpFunnelDot 2.4s ease-in-out infinite;
    }
  }
  @keyframes tpFunnelDot {
    0%, 100% { opacity: 0.45; transform: scale(0.85); }
    50%      { opacity: 1; transform: scale(1.15); }
  }
  .tp-roi-substat {
    margin-top: 10px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 8px;
    padding: 10px 12px;
  }
  .tp-roi-assump {
    display: grid;
    grid-template-columns: 80px 1fr;
    gap: 16px;
    font-size: 11.5px;
    line-height: 1.55;
    color: var(--tp-slate-500);
  }
  .tp-roi-assump-k {
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--tp-slate-700);
    font-size: 10.5px;
  }
  @media (max-width: 640px) {
    .tp-roi-assump { grid-template-columns: 1fr; gap: 6px; }
  }

  /* ============================================================
     STICKY / PRIMARY CTA GLOW · perpetual subtle orange shadow pulse
     ============================================================ */
  @media (prefers-reduced-motion: no-preference) {
    .tp-cta-glow {
      animation: tpCtaGlow 4s ease-in-out infinite;
    }
  }
  @keyframes tpCtaGlow {
    0%, 100% {
      box-shadow:
        0 1px 0 rgba(255,255,255,0.08) inset,
        0 0 0 1px rgba(15,23,42,0.9),
        0 12px 28px -10px rgba(15,23,42,0.55),
        0 0 0 0 rgba(249,115,22,0.0),
        0 0 16px rgba(249,115,22,0.10);
    }
    50% {
      box-shadow:
        0 1px 0 rgba(255,255,255,0.10) inset,
        0 0 0 1px rgba(15,23,42,1),
        0 16px 36px -12px rgba(15,23,42,0.65),
        0 0 0 3px rgba(249,115,22,0.18),
        0 0 28px rgba(249,115,22,0.32);
    }
  }

  /* ============================================================
     Responsive · "Quote the buyers" subsections
     ============================================================ */
  @media (max-width: 768px) {
    .tp-synergy { padding: 22px; }
    .tp-quote-card { padding: 22px; border-radius: 16px; }
    .tp-quote-card-h { font-size: 17px; }
    .tp-quote-recovered-v { font-size: 24px; }
  }

  /* ====== Reduced motion · disable every animation and transform-on-hover lift ====== */
  @media (prefers-reduced-motion: reduce) {
    .tp-root *,
    .tp-root *::before,
    .tp-root *::after {
      animation: none !important;
      transition: none !important;
    }
    .tp-hero-stage,
    .tp-finance-stage,
    .tp-schematic-stage,
    .tp-quote-calendar-stage,
    .tp-route-map-stage {
      transform: none !important;
    }
    .tp-hero-stage:hover,
    .tp-finance-stage:hover,
    .tp-schematic-stage:hover,
    .tp-quote-calendar-stage:hover,
    .tp-route-map-stage:hover,
    .tp-offer-row-3d:hover,
    .tp-ticker-cell:hover,
    .tp-case-card-3d:hover {
      transform: none !important;
    }
  }
`;
