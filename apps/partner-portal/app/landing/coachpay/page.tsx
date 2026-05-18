'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

/* ============================================================================
   CoachPay landing. AUREAN aesthetic. Dark navy + purple highlight.
   Built for high-ticket coaches, consultants, and course creators running
   $5k to $50k programs. Premium institutional voice. Sparse purple accent.
   Palette:
     Body bg     #0a0a14
     Panel       #101023 / #15152e
     Glass       rgba(35,35,63,0.6) to rgba(16,16,35,0.6)
     Text        #eeeef2 / #b9b9c7 / #8a8aa0 / #5c5c76
     Hairline    rgba(255,255,255,0.08)
     Purple hi   #A78BFA (chip dots, LIVE, recommended)
     Purple deep #8B5CF6 (primary CTA, underline)
   ============================================================================ */

interface NavLink {
  href: string;
  label: string;
}

const NAV_LINKS: NavLink[] = [
  { href: '#financing', label: 'Financing' },
  { href: '#how', label: 'How it works' },
  { href: '#agents', label: 'Agents' },
  { href: '#roi', label: 'ROI' },
  { href: '#stories', label: 'Stories' },
];

const LIVE_TICKER = [
  {
    value: '$185M+',
    label: 'Tuition financed',
    delta: '+$22M this quarter',
  },
  {
    value: '15,000+',
    label: 'Enrolments funded',
    delta: '+1,840 in 30d',
  },
  {
    value: '48 to 72h',
    label: 'Merchant-direct payout',
    delta: 'Lender disburses to your business account',
  },
  {
    value: '10 sec',
    label: 'Soft-pull pre-qual',
    delta: 'Zero credit impact',
  },
];

const STATUS_QUO = [
  { stat: '75%', label: 'high-ticket drop-off the moment price is revealed' },
  { stat: '6 wk', label: 'avg. closer time chasing payment plans over Voxer' },
  { stat: '8 to 14%', label: 'of $5k+ digital sales charged back' },
  { stat: '$340k', label: 'avg. unfunded enrolment value per $2M coach (year)' },
];

const WITH_COACHPAY = [
  { stat: 'Closed', label: 'on the discovery call, before the objection lands' },
  { stat: '48-72h', label: 'merchant-direct payout from the lender' },
  { stat: '10 sec', label: 'soft-pull pre-qual decision while still on Zoom' },
  { stat: 'No clawback', label: 'on routine defaults, lender carries the credit risk' },
];

const WATERFALL = [
  {
    n: '01',
    stage: 'Pre-qual',
    title: 'Financial-data pre-qual on the call',
    body: 'Prospect submits last 4 SSN + DOB during the close. Soft-pull credit returns approval likelihood in under 10 seconds, zero credit impact. The closer pivots from price to monthly.',
    metric: '< 10 sec',
  },
  {
    n: '02',
    stage: 'Agents',
    title: 'ORACLE scores. HELIX routes.',
    body: 'ORACLE returns a fundability tier on the financial data. HELIX routes the prospect to the right closer based on tier and capacity. All software, no manual handoff, no homework after the call.',
    metric: '<10s decision',
  },
  {
    n: '03',
    stage: 'Decision',
    title: 'Marketplace waterfalls in parallel',
    body: 'CoachPay routes one application across 52 lenders in parallel, engine.tech, FinWise, Affirm, Cross River, EazePay Direct. 5-second SLA per round-trip across the marketplace.',
    metric: '52 lenders',
  },
  {
    n: '04',
    stage: 'Offer',
    title: 'Multiple ranked offers · APR from 5.9%',
    body: 'The offer card surfaces multiple ranked offers tailored to the prospect, $5k to $50k tickets, 12 to 60 month terms, APR from 5.9% for qualifying clients. 0% interest plans available for qualifying programs (T&Cs apply).',
    metric: 'APR from 5.9%',
  },
  {
    n: '05',
    stage: 'Funded',
    title: 'Merchant-direct payout · 48 to 72 hours',
    body: 'The lender disburses straight to your business account, no intermediary holding funds. Funds generally land within 48 to 72 hours of the loan settling. Lender carries the credit risk; no clawback on routine defaults.',
    metric: '48 to 72 hours',
  },
];

const CASE_STUDIES = [
  {
    quote:
      "We sell a $24k twelve-month executive program. Before CoachPay, half the discovery calls ended with 'I need to think about it.' Now every qualified prospect gets a real offer on the call. Closers stopped negotiating, they started enrolling. Q1 alone we recovered $1.4M in enrolments that would have walked.",
    name: 'Marcus Halberg',
    role: 'Founder · Atlas Executive Coaching',
    outcomes: [
      { value: '+$1.4M', label: 'Q1 enrolments recovered' },
      { value: 'On call', label: 'closes vs. payment plans' },
    ],
  },
  {
    quote:
      'Our $14k certification cohort used to lose 60% of qualified applicants on price. Our closers spent six weeks per cohort chasing payment plans over Voxer and Slack. CoachPay returned that time. Recovered $620k of dropped enrolments in the first quarter live.',
    name: 'Priya Anand',
    role: 'Cohort Lead · Sage Academy',
    outcomes: [
      { value: '+$620k', label: 'recovered Q1 enrolments' },
      { value: '7 days', label: 'time to live' },
    ],
  },
  {
    quote:
      'Stopped chasing payment plans over Voxer. The agentic layer pre-qualified 480 prospects last quarter and routed every Tier-1 lead to the right closer without anyone asking. ECHO suppressed junk traffic so the ad account learns from the closers, not every cold click. The math on a $9k cohort program changes when 30% more of your qualified prospects actually convert.',
    name: 'Jordan Hale',
    role: 'Creator · Pinnacle Strategies',
    outcomes: [
      { value: '+30%', label: 'qualified conversion lift' },
      { value: '480', label: 'pre-qualified prospects' },
    ],
  },
];

const INTEGRATION_LOGOS = [
  'Cross River Bank',
  'engine.tech',
  'Affirm',
  'FinWise',
  'Plaid',
  'Stripe',
  'Modern Treasury',
  'Persona',
  'Sift',
];

const OBJECTIONS = [
  {
    q: 'How is CoachPay different from Affirm, Klarna, or AfterPay sitting on my checkout?',
    a: "Affirm and Klarna are built for retail cart-level BNPL on physical goods. They cap tickets well below high-ticket coaching, and they're a single lender. If they decline, the buyer is gone. CoachPay waterfalls across 52 lenders in parallel (Affirm included), handles tickets from $5,000 to $50,000, surfaces multiple ranked offers tailored to the client's situation, and ships with seven autonomous agents running intake, scoring, routing, and the lender marketplace. All white-labelled under your brand.",
  },
  {
    q: "Won't offering financing make my $20k program look like a credit-card sale?",
    a: 'Opposite. Premium brands offer financing precisely because it anchors the buyer on monthly affordability, not the lump sum. Every screen is white-labelled to your brand. The lender appears once on the offer card per FCRA disclosure rules. Buyers experience financing as a feature of your offer, not a third-party bolt-on.',
  },
  {
    q: 'If a student stops paying mid-program, am I on the hook for the cash collected?',
    a: "No. The lender on the offer carries the credit risk for routine defaults. Once the loan settles, funds land in your business account merchant-direct, generally within 48 to 72 hours, no intermediary holding funds. If a student quits the program, that's your refund policy decision, not the lender's problem. No clawback on routine defaults.",
  },
  {
    q: 'What underwriting does CoachPay support for high-ticket programs?',
    a: "Loans from $5,000 to $50,000. APR from 5.9% for qualifying clients. Terms from 12 to 60 months for lower monthly repayments. 0% interest plans available for qualifying programs (T&Cs apply). Multiple ranked offers tailored to the client's situation. The waterfall picks the cheapest total cost for the prospect across 52 lenders quoted in parallel.",
  },
  {
    q: 'How does the merchant payout actually work?',
    a: 'Merchant-direct. The lender disburses straight to your business account once the loan settles, no escrow agent, no marketplace intermediary holding funds. Funds generally land within 48 to 72 hours. The lender carries the credit risk on routine defaults; no surprise clawbacks come back to you.',
  },
  {
    q: "What happens when the primary lender doesn't approve the full ticket?",
    a: 'The card-stacking layer routes the client through 800+ credit card and BNPL options, ranked by remaining credit available, statement-cycle timing, and 0% promo windows. A $35k mastermind can fund across one personal loan plus two cards instead of being declined. Same instant-decision flow, the agentic layer just adds another fundable path.',
  },
  {
    q: "Won't offering financing commoditise my high-ticket program?",
    a: "No. The program is the product. Financing is the access path. Every elite operator selling $10k+ today offers some form of payment plan because removing the affordability friction unlocks the segment of qualified buyers who weren't liquid that week. CoachPay lets you do it without carrying the credit risk or paying clawbacks.",
  },
];

// Chips anchored OUTSIDE the offer card edges. Four corners.
// One purple-accented LIVE chip top-left, rest navy/grey.
const HERO_CHIPS: Array<{
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
  label: string;
  value: string;
  delay: string;
  accent?: boolean;
}> = [
  {
    top: '-12%',
    left: '2%',
    label: 'INSTANT',
    value: '10s soft-pull pre-qual',
    delay: '0s',
    accent: true,
  },
  { top: '-12%', right: '2%', label: 'MARKETPLACE', value: '52 lenders · 5s SLA', delay: '0.5s' },
  {
    bottom: '-12%',
    left: '2%',
    label: 'APR FROM 5.9%',
    value: '12 to 60 month terms',
    delay: '1.0s',
  },
  {
    bottom: '-12%',
    right: '2%',
    label: 'MERCHANT-DIRECT',
    value: '48 to 72h payout',
    delay: '1.5s',
  },
];

/* ----------------------------------------------------------------------------
   ROI Calculator, 4-stage funnel
   ---------------------------------------------------------------------------- */

interface RoiInputs {
  leadsPerMonth: number; // inbound leads / month
  preQualPct: number; // % that clear financial-data filter
  showRatePct: number; // % of cleared that actually show
  closeRatePct: number; // % of shows that close
  avgTicket: number; // avg program ticket $
}

function useRoi(inputs: RoiInputs) {
  return useMemo(() => {
    const monthly =
      inputs.leadsPerMonth *
      (inputs.preQualPct / 100) *
      (inputs.showRatePct / 100) *
      (inputs.closeRatePct / 100);
    const annualEnrolments = Math.round(monthly * 12);
    const monthlyEnrolments = Math.round(monthly);
    const annualRevenue = Math.round(annualEnrolments * inputs.avgTicket);
    // closer hours saved per week: rejected leads that don't sit a 45-min discovery call
    const skippedPerMonth = inputs.leadsPerMonth * (1 - inputs.preQualPct / 100);
    const closerHoursSavedWeekly = Math.round((skippedPerMonth * 0.75) / 4);
    return {
      monthlyEnrolments,
      annualEnrolments,
      annualRevenue,
      closerHoursSavedWeekly,
    };
  }, [
    inputs.leadsPerMonth,
    inputs.preQualPct,
    inputs.showRatePct,
    inputs.closeRatePct,
    inputs.avgTicket,
  ]);
}

/* ----------------------------------------------------------------------------
   Page
   ---------------------------------------------------------------------------- */

export default function CoachPayLandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [openObjection, setOpenObjection] = useState<number | null>(0);
  const [roiInputs, setRoiInputs] = useState<RoiInputs>({
    leadsPerMonth: 140,
    preQualPct: 45,
    showRatePct: 70,
    closeRatePct: 35,
    avgTicket: 14000,
  });
  const roi = useRoi(roiInputs);
  const [glow, setGlow] = useState(false);
  const lastRoi = useRef(roi.annualRevenue);
  const revealRoot = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const root = revealRoot.current;
    if (!root) return;
    const items = root.querySelectorAll<HTMLElement>('.reveal');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -8% 0px' },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (lastRoi.current === roi.annualRevenue) return;
    lastRoi.current = roi.annualRevenue;
    setGlow(true);
    const t = setTimeout(() => setGlow(false), 700);
    return () => clearTimeout(t);
  }, [roi.annualRevenue]);

  const annualFormatted = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(roi.annualRevenue),
    [roi.annualRevenue],
  );

  return (
    <div ref={revealRoot} className="cp-root">
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      {/* ============== NAV ============== */}
      <header className={`cp-nav ${scrolled ? 'cp-nav--scrolled' : ''}`}>
        <div className="cp-nav-inner">
          <a href="#" className="cp-brand">
            <span className="cp-brand-mark">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M18 7a7.5 7.5 0 1 0 0 10"
                  stroke="#fff"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span className="cp-brand-wordmark">
              CoachPay
              <span className="cp-brand-sub">/finance</span>
            </span>
          </a>
          <nav className="cp-nav-links">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href}>
                {l.label}
              </a>
            ))}
          </nav>
          <div className="cp-nav-cta">
            <a href="/apply/coachpay" className="cp-btn cp-btn--ghost">
              See the closer flow
            </a>
            <a href="/submit/coach-pay" className="cp-btn cp-btn--violet">
              Start CoachPay signup
            </a>
          </div>
        </div>
      </header>

      {/* ============== HERO ============== */}
      <section className="cp-hero">
        <div className="cp-ambient-glow" />
        <div className="cp-ambient-grid" />

        <div className="cp-container cp-hero-inner">
          <div className="cp-hero-grid">
            {/* LEFT */}
            <div className="cp-hero-copy">
              <div className="cp-eyebrow">
                <span className="cp-eyebrow-dot" />
                INSTANT-DECISION FINANCE · PRIME TO SUBPRIME · POINT OF SALE
              </div>
              <h1 className="cp-hero-h1">
                <span className="cp-grad-text">Instant finance for every client.</span>
                <br />
                <span className="cp-grad-text">Real offers in 10 seconds.</span>
              </h1>
              <p className="cp-hero-sub">
                CoachPay puts a full lender waterfall behind your offer, prime, near-prime,
                subprime, and returns a real, signed pre-approval in under ten seconds. Your client
                picks a plan on the call instead of "thinking about it."{' '}
                <span className="cp-emph">
                  Point-of-sale finance, end-to-end, with zero credit-score impact to apply.
                </span>
              </p>

              <div className="cp-hero-ctas">
                <a href="/submit/coach-pay" className="cp-btn cp-btn--violet cp-btn--lg">
                  Start CoachPay signup
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
                <a href="/apply/coachpay" className="cp-btn cp-btn--ghost cp-btn--lg">
                  See the closer flow
                </a>
              </div>

              {/* hero metric strip */}
              <div className="cp-hero-stats">
                <div className="cp-hero-stat">
                  <div className="cp-hero-stat-v">52</div>
                  <div className="cp-hero-stat-l">lenders in parallel</div>
                </div>
                <div className="cp-hero-stat">
                  <div className="cp-hero-stat-v">$8.2M</div>
                  <div className="cp-hero-stat-l">funded last 30 days</div>
                </div>
                <div className="cp-hero-stat">
                  <div className="cp-hero-stat-v">10 s</div>
                  <div className="cp-hero-stat-l">decision on the call</div>
                </div>
              </div>
            </div>

            {/* RIGHT, financing offer card */}
            <div className="cp-hero-card-wrap">
              <div className="cp-hero-ring" aria-hidden />
              <FloatingChips />
              <div className="cp-hero-card cp-glow-edge">
                <div className="cp-card-head">
                  <div>
                    <div className="cp-card-eyebrow">
                      <span className="cp-card-blip" />
                      COACHPAY · APPROVED
                    </div>
                    <div className="cp-card-title">Mastermind enrolment · approved</div>
                  </div>
                  <div className="cp-card-stamp">approved</div>
                </div>

                <div className="cp-card-amount">
                  <span className="cp-card-amount-curr">$</span>
                  <span className="cp-card-amount-n">24,000</span>
                </div>
                <div className="cp-card-amount-sub">
                  Atlas Executive Coaching · 12-month program
                </div>

                <div className="cp-card-offer-grid">
                  <div>
                    <div className="cp-card-k">lender</div>
                    <div className="cp-card-v">Cross River Bank</div>
                  </div>
                  <div>
                    <div className="cp-card-k">term</div>
                    <div className="cp-card-v">48 months</div>
                  </div>
                  <div>
                    <div className="cp-card-k">est. monthly</div>
                    <div className="cp-card-v">$612 / mo</div>
                  </div>
                  <div>
                    <div className="cp-card-k">APR</div>
                    <div className="cp-card-v">from 5.9%</div>
                  </div>
                </div>

                <div className="cp-card-livebar">
                  <div className="cp-card-livebar-row">
                    <span className="cp-card-livebar-k">lenders queried</span>
                    <span className="cp-card-livebar-v">52 parallel</span>
                  </div>
                  <div className="cp-card-livebar-row">
                    <span className="cp-card-livebar-k">decision time</span>
                    <span className="cp-card-livebar-v">10 s</span>
                  </div>
                  <div className="cp-card-livebar-row">
                    <span className="cp-card-livebar-k">payout</span>
                    <span className="cp-card-livebar-v">merchant-direct · 48 to 72h</span>
                  </div>
                  <div className="cp-card-livebar-row">
                    <span className="cp-card-livebar-k">clawback risk</span>
                    <span className="cp-card-livebar-v cp-card-livebar-v--violet">
                      none on routine defaults
                    </span>
                  </div>
                </div>

                <div className="cp-card-foot">
                  <span className="cp-card-foot-k">
                    <span className="cp-card-foot-dot" />
                    soft pull · zero credit impact
                  </span>
                  <span className="cp-card-foot-k cp-card-foot-k--right">
                    white-labelled · YOUR brand
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* trust strip */}
          <div className="cp-hero-trust">
            <div className="cp-hero-trust-label">Plugs into the stack you already run</div>
            <Marquee logos={INTEGRATION_LOGOS} />
          </div>
        </div>
      </section>

      {/* ============== LIVE TICKER ============== */}
      <section className="cp-ticker">
        <div className="cp-container">
          <div className="cp-ticker-grid reveal">
            {LIVE_TICKER.map((t) => (
              <div key={t.label} className="cp-ticker-cell">
                <div className="cp-ticker-v">{t.value}</div>
                <div className="cp-ticker-l">{t.label}</div>
                <div className="cp-ticker-d">
                  <span className="cp-ticker-d-mark" />
                  {t.delta}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============== PROBLEM ============== */}
      <section id="problem" className="cp-problem">
        <div className="cp-ambient-grid cp-ambient-grid--problem" />
        <div className="cp-container">
          <div className="cp-problem-head reveal">
            <div className="cp-eyebrow cp-eyebrow--on-dark">
              <span className="cp-eyebrow-dot" />
              01 · THE COST OF DOING NOTHING
            </div>
            <h2 className="cp-h2 cp-h2--on-dark">
              Every prospect who says{' '}
              <span className="cp-grad-text-violet">&ldquo;I need to think about it&rdquo;</span> is
              a $24,000 program that walks out unfunded.
            </h2>
            <p className="cp-h2-sub cp-h2-sub--on-dark">
              High-ticket coaching has a 75% drop-off the moment price is revealed. Your closers
              spend six weeks chasing payment plans over Voxer. Most prospects never even apply
              because the lender experience was built for a $200 dress, not a $24,000 program.
            </p>
          </div>

          <div className="cp-compare reveal">
            <div className="cp-compare-card cp-compare-card--bad">
              <div className="cp-compare-head">
                <div className="cp-compare-label">Status quo</div>
                <div className="cp-compare-sub">Today, without CoachPay</div>
              </div>
              <div className="cp-compare-stats">
                {STATUS_QUO.map((s) => (
                  <div key={s.label} className="cp-compare-stat">
                    <div className="cp-compare-stat-v cp-compare-stat-v--bad">{s.stat}</div>
                    <div className="cp-compare-stat-l">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="cp-compare-arrow" aria-hidden>
              <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                <circle cx="28" cy="28" r="27" stroke="rgba(255,255,255,0.18)" />
                <path
                  d="M20 28h16M30 22l6 6-6 6"
                  stroke="#A78BFA"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div className="cp-compare-card cp-compare-card--good">
              <div className="cp-compare-head">
                <div className="cp-compare-label cp-compare-label--good">With CoachPay</div>
                <div className="cp-compare-sub">Financing + the agentic layer</div>
              </div>
              <div className="cp-compare-stats">
                {WITH_COACHPAY.map((s) => (
                  <div key={s.label} className="cp-compare-stat">
                    <div className="cp-compare-stat-v cp-compare-stat-v--good">{s.stat}</div>
                    <div className="cp-compare-stat-l">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============== HOW IT WORKS ============== */}
      <section id="how" className="cp-how">
        <div className="cp-container">
          <div className="cp-section-head reveal">
            <div className="cp-eyebrow">
              <span className="cp-eyebrow-dot" />
              HOW IT WORKS
            </div>
            <h2 className="cp-h2">
              One platform. <span className="cp-grad-text-violet">Five stages.</span> Discovery call
              to enrolled prospect.
            </h2>
            <p className="cp-h2-sub">
              Every stage runs through a single deterministic pipeline with a full audit trail. No
              vendor stack. No handoff loss. The prospect experiences your brand end to end.
            </p>
          </div>

          <Waterfall stages={WATERFALL} />
        </div>
      </section>

      {/* ============== PILLAR 01 · FINANCING ============== */}
      <section id="financing" className="cp-pillar cp-pillar--dominant">
        <div className="cp-container">
          <div className="cp-pillar-head reveal">
            <div className="cp-pillar-number">01</div>
            <div>
              <div className="cp-eyebrow">
                <span className="cp-eyebrow-dot" />
                PILLAR ONE · FINANCING
              </div>
              <h2 className="cp-h2">
                <span className="cp-grad-text-violet">Multiple ranked offers in 10 seconds.</span>{' '}
                Merchant-direct payout, 48 to 72 hours.
              </h2>
              <p className="cp-h2-sub">
                Loans from $5,000 to $50,000. APR from 5.9% for qualifying clients. Terms from 12 to
                60 months for lower monthly repayments. 0% interest plans available for qualifying
                programs (T&amp;Cs apply). 52 lenders quoted in parallel with a 5-second SLA per
                round-trip. The lender disburses straight to your business account, no intermediary
                holding funds.
              </p>
              <div className="cp-pillar-roi">
                <span className="cp-pillar-roi-blip" />
                Loans from $5k to $50k · APR from 5.9% · 12 to 60 months
              </div>
            </div>
          </div>

          <FinancingMockup />

          <div className="cp-pillar-grid reveal">
            <PillarFeature
              icon="bolt"
              title="Soft-pull pre-qual · 10 sec"
              body="Prospect submits last-4 SSN + DOB during the close. Approval likelihood and tier returned in under 10 seconds, zero credit impact. Closer pivots from price to monthly while still on Zoom."
            />
            <PillarFeature
              icon="grid"
              title="52 lenders · 5s SLA"
              body="One application, 52 parallel lender quotes. Multiple ranked offers tailored to the client's situation, Cross River, engine.tech, FinWise, Affirm, EazePay Direct. Best total-cost offer ranked first."
            />
            <PillarFeature
              icon="zero"
              title="APR from 5.9% · 0% (T&Cs apply)"
              body="$5,000 to $50,000 tickets. 12 to 60 month terms keep monthly repayments low. APR from 5.9% for qualifying clients. 0% interest plans available for qualifying programs (T&Cs apply)."
            />
            <PillarFeature
              icon="rocket"
              title="Merchant-direct · 48 to 72h"
              body="Lender disburses straight to your business account once the loan settles, no intermediary holding funds. Funds generally land within 48 to 72 hours. Lender carries the credit risk; no clawback on routine defaults."
            />
          </div>
        </div>
      </section>

      {/* ============== CARD STACKING SECONDARY PATH ============== */}
      <section id="card-stacking" className="cp-cardstack">
        <div className="cp-container">
          <div className="cp-cardstack-grid reveal">
            <div>
              <div className="cp-eyebrow">
                <span className="cp-eyebrow-dot" />
                SECONDARY PATH · 800+ CARDS
              </div>
              <h2 className="cp-h2">
                Card stacking · <span className="cp-grad-text-violet">access to 800+ cards</span> as
                a secondary path.
              </h2>
              <p className="cp-h2-sub">
                If the primary lender marketplace doesn&rsquo;t approve the full ticket, the
                card-stacking layer routes the client through 800+ credit card and BNPL options
                ranked by remaining credit available, statement-cycle timing, and 0% promo windows.
                The client can fund a $35,000 mastermind across one personal loan plus two cards
                instead of being declined. Same instant-decision flow, the agentic layer just adds
                another fundable path.
              </p>
              <div className="cp-cardstack-bullets">
                <div className="cp-cardstack-bullet">
                  <span className="cp-cardstack-bullet-dot" />
                  Ranked by remaining credit · statement-cycle timing · 0% promo windows
                </div>
                <div className="cp-cardstack-bullet">
                  <span className="cp-cardstack-bullet-dot" />
                  Fans across multiple cards to fund the gap, same flow, more paths
                </div>
                <div className="cp-cardstack-bullet">
                  <span className="cp-cardstack-bullet-dot" />
                  Soft-pull only · zero credit impact until the client picks a path
                </div>
              </div>
            </div>
            <CardFan />
          </div>
        </div>
      </section>

      {/* ============== QUALIFIED BUYERS · DECISION TREE ============== */}
      <section id="qualified" className="cp-qual">
        <div className="cp-ambient-grid cp-ambient-grid--qual" />
        <div className="cp-qual-glow" aria-hidden />
        <div className="cp-container">
          <div className="cp-section-head reveal">
            <div className="cp-eyebrow cp-eyebrow--on-dark">
              <span className="cp-eyebrow-dot" />
              QUALIFIED BUYERS · NOT FORM FILLERS
            </div>
            <h2 className="cp-h2 cp-h2--on-dark">
              Speak to <span className="cp-grad-text-violet">qualified buyers.</span> Not form
              fillers.
            </h2>
            <p className="cp-h2-sub cp-h2-sub--on-dark">
              Every discovery call slot fills with a prospect the financial-data filter already
              cleared. Coach time goes to buyers, not tire kickers.
            </p>
          </div>

          {/* Decision tree visual */}
          <QualificationTree />

          {/* Time math callout */}
          <div className="cp-qual-math reveal">
            <div className="cp-qual-math-head">
              <div className="cp-eyebrow cp-eyebrow--on-dark">
                <span className="cp-eyebrow-dot" />
                TIME MATH · WHY THIS MATTERS
              </div>
              <h3 className="cp-h3">
                A discovery call is 30 to 60 minutes of operator time. A filler prospect that ghosts
                or can&rsquo;t afford the program is pure waste.
              </h3>
              <p className="cp-qual-math-body">
                Pre-qualification across multiple financial-data checkpoints, credit, identity,
                cashflow, and optional asset signals, means the prospect that lands in your calendar
                is already cleared. Your closer talks to people who can pay; not people who came to
                browse.
              </p>
            </div>
            <div className="cp-qual-math-tiles">
              <div className="cp-qual-math-tile">
                <div className="cp-qual-math-tile-v">Discovery</div>
                <div className="cp-qual-math-tile-l">calls / day · capped by closer hours</div>
              </div>
              <div className="cp-qual-math-tile">
                <div className="cp-qual-math-tile-v">Closer hours</div>
                <div className="cp-qual-math-tile-l">
                  saved per week when fillers don&rsquo;t book
                </div>
              </div>
              <div className="cp-qual-math-tile">
                <div className="cp-qual-math-tile-v">Funded</div>
                <div className="cp-qual-math-tile-l">
                  enrolments / month, what calendars actually convert
                </div>
              </div>
            </div>
          </div>

          {/* Pixel feedback loop callout */}
          <div className="cp-qual-loop reveal">
            <div className="cp-qual-loop-eyebrow">
              <span className="cp-eyebrow-dot" />
              PIXEL FEEDBACK LOOP · ECHO
            </div>
            <div className="cp-qual-loop-grid">
              <div className="cp-qual-loop-step">
                <div className="cp-qual-loop-step-n">01</div>
                <div className="cp-qual-loop-step-t">Hold pixel events</div>
                <div className="cp-qual-loop-step-b">
                  ECHO holds pixel events until the prospect clears qualification, Meta and Google
                  never see the form fillers.
                </div>
              </div>
              <div className="cp-qual-loop-step">
                <div className="cp-qual-loop-step-n">02</div>
                <div className="cp-qual-loop-step-t">Fire weighted conversions</div>
                <div className="cp-qual-loop-step-b">
                  Cleared prospects fire as weighted conversions back to Meta and Google CAPI, the
                  algorithms learn from buyers, not browsers.
                </div>
              </div>
              <div className="cp-qual-loop-step">
                <div className="cp-qual-loop-step-n">03</div>
                <div className="cp-qual-loop-step-t">Retrain on funded enrolments</div>
                <div className="cp-qual-loop-step-b">
                  Funded enrolments uploaded as offline conversions. Ad spend gets more efficient
                  month over month, same budget, more buyers.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============== SYNERGY CALLOUT ============== */}
      <section className="cp-synergy">
        <div className="cp-container">
          <div className="cp-synergy-card reveal">
            <div className="cp-synergy-eyebrow">
              <span className="cp-eyebrow-dot" />
              HOW THE LAYERS FIT
            </div>
            <h3 className="cp-synergy-h3">
              The agentic layer is your{' '}
              <span className="cp-grad-text-violet">financial filter.</span> The lending waterfall
              is your <span className="cp-grad-text-violet">closer.</span> The card stack is your{' '}
              <span className="cp-grad-text-violet">safety net.</span>
            </h3>
            <p className="cp-synergy-body">
              Software agents pre-qualify every inbound prospect across multiple financial-data
              checkpoints, soft-pull credit, identity, cashflow, optional asset signals. Only the
              cleared prospects reach your discovery-call calendar. The lending waterfall returns an
              instant multi-offer decision on the call. When the primary loan doesn&rsquo;t cover
              the full program, the card-stacking layer fans 800+ cards across the gap. Combined,
              your closer time goes to buyers, not form fillers.
            </p>
          </div>
        </div>
      </section>

      {/* ============== PILLAR 02 · AGENTIC LAYER ============== */}
      <section id="agents" className="cp-agents">
        <div className="cp-ambient-grid cp-ambient-grid--agents" />
        <div className="cp-agents-glow-1" aria-hidden />
        <div className="cp-agents-glow-2" aria-hidden />

        <div className="cp-container">
          <div className="cp-agents-head reveal">
            <div className="cp-pillar-number cp-pillar-number--inline cp-pillar-number--on-dark">
              02
            </div>
            <div className="cp-eyebrow cp-eyebrow--on-dark">
              <span className="cp-eyebrow-dot" />
              PILLAR TWO · THE AGENTIC LAYER
            </div>
            <h2 className="cp-h2 cp-h2--on-dark">
              <span className="cp-grad-text-violet">Seven agents</span> running every qualification
              and every approval. 24/7.
            </h2>
            <p className="cp-h2-sub cp-h2-sub--on-dark">
              Software agents operating on financial data, they never contact the prospect directly.
              Each agent has a defined scope and a measurable output. They replace the manual lead
              reviews, the copy-paste enrichment, the routing guesswork, and the financing leakage
              on cold ads.
            </p>
          </div>

          {/* Mosaic */}
          <div className="cp-agents-mosaic reveal">
            <AgentCard
              span={7}
              num="01"
              code="PRISM"
              role="Intake Agent"
              status="ONLINE"
              icon="prism"
              desc="PRISM watches every apply-form session in real time. It reshapes question order based on partial answers, kills friction for high-intent prospects, and adds verification steps when it detects junk. It learns which question sequences convert per traffic source."
              stats={[
                { k: 'Sessions/hr', v: '3,280' },
                { k: 'Field skips', v: '38%' },
                { k: 'Form drop-off', v: '−41%' },
              ]}
              log="reordered branch on traffic_source=meta_advantage to ask program_value before income_band · 14s ago"
            />
            <AgentCard
              span={5}
              num="02"
              code="VEGA"
              role="Enrichment Agent"
              status="ONLINE"
              icon="vega"
              desc="VEGA orchestrates 12 enrichment providers in parallel. It picks the cheapest source likely to return a match, falls back automatically on failure, and dedupes identity collisions across vendors."
              stats={[
                { k: 'Avg cost/lead', v: '$0.41' },
                { k: 'Identity match', v: '94%' },
              ]}
              log="fell back to provider_03 after timeout on provider_01 · saved $0.18 · 2s ago"
            />
            <AgentCard
              span={5}
              num="03"
              code="ORACLE"
              role="Scoring Agent"
              status="LEARNING"
              icon="oracle"
              desc="ORACLE runs a calibrated propensity model trained on your closed-won outcomes, not a generic lookalike. It retrains nightly on every disposition your enrolment team logs and surfaces drift before it affects revenue."
              stats={[
                { k: 'Model AUC', v: '0.89' },
                { k: 'Last retrain', v: '4h ago' },
              ]}
              log="flagged feature drift on program_value. Recalibrated thresholds · 4h ago"
            />
            <AgentCard
              span={7}
              num="04"
              code="HELIX"
              role="Routing Agent"
              status="ONLINE"
              icon="helix"
              desc="HELIX matches every qualified prospect to the right closer, not just the next available one. It learns which closers convert which tiers, accounts for capacity in real time, and routes around vacations, lunch, and underperformance without anyone asking."
              stats={[
                { k: 'Avg route time', v: '320ms' },
                { k: 'Closer match lift', v: '+31%' },
                { k: 'SLA breach', v: '0.4%' },
              ]}
              log="routed T1 Voxer DM lead to closer_S.Patel (capacity 41%) instead of closer_M.Chen (capacity 98%) · 1s ago"
            />
            <AgentCard
              span={7}
              num="05"
              code="NEXUS"
              role="Lender Marketplace Agent"
              status="ONLINE"
              icon="nexus"
              desc="NEXUS routes every qualified prospect through a curated multi-lender marketplace, prime to subprime, $5k through $50k+. Soft pull only. It learns which lenders approve which prospect profiles, watches stip rates in real time, and reroutes around lenders that tighten overnight."
              stats={[
                { k: 'Lenders', v: '52' },
                { k: 'Funding time', v: '< 4h' },
                { k: 'SLA', v: '5s' },
              ]}
              log="matched $24k prospect (V4=712, DTI=0.34) to FinWise 36-mo offer + 2 backups · 12s ago"
            />
            <AgentCard
              span={5}
              num="06"
              code="FLUX"
              role="Payment Agent"
              status="ONLINE"
              icon="flux"
              desc="FLUX handles the actual money. It presents BNPL, POS finance, ACH, and card options based on the lender approval, retries failed payments intelligently, and reconciles every settled cent back to the originating ad campaign."
              stats={[
                { k: 'Auth success', v: '96.3%' },
                { k: 'Recovery', v: '+18%' },
              ]}
              log="retried failed ACH on enrolment_8412 via card_on_file · captured $4,200 · 8s ago"
            />
            <AgentCard
              span={12}
              num="07"
              code="ECHO"
              role="Attribution Agent"
              status="ONLINE"
              icon="echo"
              desc="ECHO closes the loop. It holds pixel events until a prospect clears qualification, then fires weighted conversions back to Meta and Google via server-side CAPI. It uploads closed-won enrolments as offline conversions. The cleanest training signal your ad account will ever see."
              log="uploaded 47 closed-won enrolments to Meta CAPI, weighted by program_value · 6m ago"
              sidePanel={
                <div className="cp-agent-stream">
                  <div className="cp-agent-stream-head">
                    <div className="cp-agent-stream-title">ECHO · live event stream</div>
                    <div className="cp-agent-stream-meta">events/min · 142</div>
                  </div>
                  <div className="cp-agent-stream-rows">
                    <div className="cp-agent-stream-row">
                      <span className="cp-agent-stream-k">prospect_qualified · T1</span>
                      <span className="cp-agent-stream-v">Meta CAPI · weight 1.00</span>
                    </div>
                    <div className="cp-agent-stream-row">
                      <span className="cp-agent-stream-k">prospect_qualified · T2</span>
                      <span className="cp-agent-stream-v">Google Offline · weight 0.65</span>
                    </div>
                    <div className="cp-agent-stream-row">
                      <span className="cp-agent-stream-k">enrolment_closed · $24,000</span>
                      <span className="cp-agent-stream-v">Meta CAPI · weight 2.20</span>
                    </div>
                    <div className="cp-agent-stream-row">
                      <span className="cp-agent-stream-k">prospect_disqualified · T4</span>
                      <span className="cp-agent-stream-v cp-agent-stream-v--mute">
                        suppressed · audience exclude
                      </span>
                    </div>
                    <div className="cp-agent-stream-row cp-agent-stream-row--last">
                      <span className="cp-agent-stream-k">enrolment_closed · $14,000</span>
                      <span className="cp-agent-stream-v">Google Offline · weight 1.40</span>
                    </div>
                  </div>
                </div>
              }
            />
          </div>

          {/* Coordination layer note */}
          <div className="cp-agents-coord reveal">
            <div className="cp-agents-coord-l">
              <div className="cp-agents-coord-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3"
                    stroke="#fff"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div>
                <div className="cp-agents-coord-eyebrow">Coordination layer</div>
                <div className="cp-agents-coord-text">
                  All seven agents share a common event bus, a shared memory store, and a unified
                  observability plane.
                </div>
              </div>
            </div>
            <a href="#cta" className="cp-btn cp-btn--ghost-light cp-agents-coord-cta">
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

          <div className="cp-agents-foot reveal">
            <span className="cp-agents-foot-dot" />
            Software agents only, pre-qualification runs on financial data, never outbound contact.
            FCRA permissible-purpose-aware. Every agent action logged to an immutable audit trail.
          </div>
        </div>
      </section>

      {/* ============== ROI CALCULATOR ============== */}
      <section id="roi" className="cp-roi">
        <div className="cp-container">
          <div className="cp-section-head reveal">
            <div className="cp-eyebrow">
              <span className="cp-eyebrow-dot" />
              YOUR ROI · YOUR FUNNEL
            </div>
            <h2 className="cp-h2">
              Model the funnel with{' '}
              <span className="cp-grad-text-violet">pre-qualification baked in.</span>
            </h2>
            <p className="cp-h2-sub">
              Five inputs across the four-stage funnel, inbound leads, the financial-data filter
              pass rate, your show rate, your close rate on shows, and your average ticket. The math
              runs against your numbers.
            </p>
          </div>

          <div className="cp-roi-card reveal">
            <div className="cp-roi-grid">
              <div className="cp-roi-inputs">
                <RoiSlider
                  label="Inbound leads / month"
                  value={roiInputs.leadsPerMonth}
                  min={20}
                  max={1000}
                  step={10}
                  format={(v) => `${v}`}
                  onChange={(v) => setRoiInputs((s) => ({ ...s, leadsPerMonth: v }))}
                />
                <RoiSlider
                  label="Pre-qualification pass %"
                  value={roiInputs.preQualPct}
                  min={10}
                  max={90}
                  step={1}
                  format={(v) => `${v}%`}
                  onChange={(v) => setRoiInputs((s) => ({ ...s, preQualPct: v }))}
                />
                <RoiSlider
                  label="Discovery call show rate %"
                  value={roiInputs.showRatePct}
                  min={30}
                  max={95}
                  step={1}
                  format={(v) => `${v}%`}
                  onChange={(v) => setRoiInputs((s) => ({ ...s, showRatePct: v }))}
                />
                <RoiSlider
                  label="Close rate on discovery %"
                  value={roiInputs.closeRatePct}
                  min={5}
                  max={70}
                  step={1}
                  format={(v) => `${v}%`}
                  onChange={(v) => setRoiInputs((s) => ({ ...s, closeRatePct: v }))}
                />
                <RoiSlider
                  label="Average program ticket"
                  value={roiInputs.avgTicket}
                  min={5000}
                  max={50000}
                  step={500}
                  format={(v) =>
                    new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                      maximumFractionDigits: 0,
                    }).format(v)
                  }
                  onChange={(v) => setRoiInputs((s) => ({ ...s, avgTicket: v }))}
                />
              </div>

              <div className={`cp-roi-output ${glow ? 'cp-roi-output--glow' : ''}`}>
                <div className="cp-roi-out-label">Financing-driven tuition revenue / year</div>
                <div className="cp-roi-out-sub">illustrative · based on your inputs</div>
                <div className="cp-roi-out-value">{annualFormatted}</div>
                <div className="cp-roi-out-stats cp-roi-out-stats--3">
                  <div>
                    <div className="cp-roi-out-stat-v">{roi.monthlyEnrolments}</div>
                    <div className="cp-roi-out-stat-l">funded enrolments / month</div>
                  </div>
                  <div>
                    <div className="cp-roi-out-stat-v">{roi.annualEnrolments}</div>
                    <div className="cp-roi-out-stat-l">funded enrolments / year</div>
                  </div>
                  <div>
                    <div className="cp-roi-out-stat-v">{roi.closerHoursSavedWeekly}h</div>
                    <div className="cp-roi-out-stat-l">closer hours saved / week</div>
                  </div>
                </div>
                <a href="/submit/coach-pay" className="cp-btn cp-btn--violet cp-btn--lg cp-roi-cta">
                  Start CoachPay signup
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
                <div className="cp-roi-out-disclaimer">
                  Outputs are illustrative based on your inputs. Actual outcomes vary by offer,
                  niche, and market. Not a guarantee of returns.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============== CASE STUDIES ============== */}
      <section id="stories" className="cp-stories">
        <div className="cp-container">
          <div className="cp-section-head reveal">
            <div className="cp-eyebrow">
              <span className="cp-eyebrow-dot" />
              OPERATOR STORIES
            </div>
            <h2 className="cp-h2">
              What changes when financing stops being{' '}
              <span className="cp-grad-text-violet">someone else&rsquo;s problem.</span>
            </h2>
          </div>

          <div className="cp-stories-grid reveal">
            {CASE_STUDIES.map((c) => (
              <div key={c.name} className="cp-story-card">
                <div className="cp-story-quote-mark">&ldquo;</div>
                <p className="cp-story-quote">{c.quote}</p>
                <div className="cp-story-foot">
                  <div className="cp-story-author">
                    <div className="cp-story-name">{c.name}</div>
                    <div className="cp-story-role">{c.role}</div>
                  </div>
                  <div className="cp-story-outcomes">
                    {c.outcomes.map((o) => (
                      <div key={o.label} className="cp-story-outcome">
                        <div className="cp-story-outcome-v">{o.value}</div>
                        <div className="cp-story-outcome-l">{o.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============== INTEGRATIONS MARQUEE ============== */}
      <section className="cp-integrations">
        <div className="cp-container">
          <div className="cp-integrations-head reveal">
            <div className="cp-eyebrow">
              <span className="cp-eyebrow-dot" />
              INFRASTRUCTURE
            </div>
            <h3 className="cp-h3">Backed by the rails that move enterprise capital.</h3>
          </div>
          <Marquee logos={INTEGRATION_LOGOS} accent />
        </div>
      </section>

      {/* ============== OBJECTIONS / FAQ ============== */}
      <section className="cp-faq">
        <div className="cp-container">
          <div className="cp-section-head reveal">
            <div className="cp-eyebrow">
              <span className="cp-eyebrow-dot" />
              OBJECTIONS · ANSWERED
            </div>
            <h2 className="cp-h2">
              Everything you are thinking before you{' '}
              <span className="cp-grad-text-violet">click signup.</span>
            </h2>
          </div>

          <div className="cp-faq-list reveal">
            {OBJECTIONS.map((o, idx) => {
              const open = openObjection === idx;
              return (
                <button
                  key={o.q}
                  type="button"
                  onClick={() => setOpenObjection(open ? null : idx)}
                  className={`cp-faq-item ${open ? 'cp-faq-item--open' : ''}`}
                  aria-expanded={open}
                >
                  <div className="cp-faq-q">
                    <span>{o.q}</span>
                    <span className="cp-faq-toggle" aria-hidden>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M6 9l6 6 6-6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </div>
                  <div className="cp-faq-a">{o.a}</div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============== FINAL CTA ============== */}
      <section className="cp-final" id="cta">
        <div className="cp-ambient-grid cp-ambient-grid--final" />
        <div className="cp-final-glow-1" aria-hidden />
        <div className="cp-final-glow-2" aria-hidden />
        <div className="cp-final-ring" aria-hidden />
        <div className="cp-container cp-final-inner">
          <div className="cp-final-eyebrow reveal">
            <span className="cp-final-dot" />
            FINANCE-FIRST · BUILT FOR HIGH-TICKET OPERATORS
          </div>
          <h2 className="cp-final-h2 reveal">
            Enrol every qualified prospect.
            <br />
            <span className="cp-grad-text-violet">On the discovery call.</span>
          </h2>
          <p className="cp-final-sub reveal">
            Five-minute signup. Sixty-second KYB. Merchant-direct payout generally lands within 48
            to 72 hours of the loan settling.
          </p>
          <div className="cp-final-ctas reveal">
            <a href="/submit/coach-pay" className="cp-btn cp-btn--violet cp-btn--xl">
              Start CoachPay signup
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 12h14M13 6l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
            <a href="/apply/coachpay" className="cp-btn cp-btn--ghost-light cp-btn--xl">
              See the closer flow
            </a>
          </div>
        </div>
      </section>

      {/* ============== FOOTER ============== */}
      <footer className="cp-footer">
        <div className="cp-container cp-footer-inner">
          <div className="cp-footer-brand">
            <span className="cp-brand-mark cp-brand-mark--sm">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M18 7a7.5 7.5 0 1 0 0 10"
                  stroke="#fff"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span>CoachPay</span>
          </div>
          <div className="cp-footer-legal">
            <span>© 2026 EazePay · CoachPay</span>
            <a href="/legal/terms">Terms</a>
            <a href="/legal/privacy">Privacy</a>
            <a href="/legal/compliance">Compliance</a>
            <a href="/contact">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ============================================================================
   Components
   ============================================================================ */

function FloatingChips() {
  return (
    <>
      {HERO_CHIPS.map((c, i) => (
        <div
          key={i}
          className={`cp-chip ${c.accent ? 'cp-chip--violet' : ''}`}
          style={{
            ...(c.top ? { top: c.top } : {}),
            ...(c.bottom ? { bottom: c.bottom } : {}),
            ...(c.left ? { left: c.left } : {}),
            ...(c.right ? { right: c.right } : {}),
            animationDelay: c.delay,
          }}
        >
          <span className="cp-chip-k">
            {c.accent ? <span className="cp-chip-dot" /> : null}
            {c.label}
          </span>
          <span className="cp-chip-v">{c.value}</span>
        </div>
      ))}
    </>
  );
}

function Marquee({ logos, accent }: { logos: string[]; accent?: boolean }) {
  const doubled = [...logos, ...logos];
  return (
    <div className={`cp-marquee ${accent ? 'cp-marquee--accent' : ''}`}>
      <div className="cp-marquee-track">
        {doubled.map((l, i) => (
          <span key={i} className="cp-marquee-item">
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

function Waterfall({ stages }: { stages: typeof WATERFALL }) {
  return (
    <div className="cp-waterfall reveal">
      <div className="cp-waterfall-svg-wrap">
        <svg
          viewBox="0 0 1200 320"
          preserveAspectRatio="none"
          className="cp-waterfall-svg"
          aria-hidden
        >
          <defs>
            <linearGradient id="cp-arc" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#5c5c76" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#8B5CF6" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#A78BFA" stopOpacity="1" />
            </linearGradient>
            <linearGradient id="cp-arc-glow" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#3a3a6a" stopOpacity="0" />
              <stop offset="50%" stopColor="#8B5CF6" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#A78BFA" stopOpacity="0.4" />
            </linearGradient>
            <radialGradient id="cp-pulse-grad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fff" stopOpacity="1" />
              <stop offset="40%" stopColor="#C4B5FD" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
            </radialGradient>
            <path id="cp-arc-path" d="M 60 270 Q 360 250 600 170 T 1140 50" />
          </defs>
          <path
            d="M 60 270 Q 360 250 600 170 T 1140 50"
            stroke="url(#cp-arc-glow)"
            strokeWidth="14"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 60 270 Q 360 250 600 170 T 1140 50"
            stroke="url(#cp-arc)"
            strokeWidth="2.4"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 60 270 Q 360 250 600 170 T 1140 50"
            stroke="#A78BFA"
            strokeOpacity="0.35"
            strokeWidth="1"
            fill="none"
            strokeDasharray="2 8"
          />
          {/* Traveling pulse that rides the arc node 01 → node 05 */}
          <circle r="8" fill="url(#cp-pulse-grad)" className="cp-waterfall-pulse">
            <animateMotion
              dur="8s"
              repeatCount="indefinite"
              rotate="auto"
              keyTimes="0;0.85;1"
              keyPoints="0;1;1"
              calcMode="linear"
            >
              <mpath href="#cp-arc-path" />
            </animateMotion>
            <animate
              attributeName="opacity"
              values="0;1;1;1;0"
              keyTimes="0;0.05;0.5;0.85;1"
              dur="8s"
              repeatCount="indefinite"
            />
          </circle>
        </svg>

        <div className="cp-waterfall-nodes">
          {stages.map((s, i) => {
            const positions = [
              { left: '4%', top: '70%' },
              { left: '26%', top: '52%' },
              { left: '48%', top: '34%' },
              { left: '70%', top: '20%' },
              { left: '92%', top: '6%' },
            ];
            const pos = positions[i] ?? positions[0]!;
            return (
              <div
                key={s.n}
                className="cp-waterfall-node"
                style={{ left: pos.left, top: pos.top, animationDelay: `${i * 0.12}s` }}
              >
                <div className="cp-waterfall-orb">
                  <span>{s.n}</span>
                </div>
                <div className="cp-waterfall-card">
                  <div className="cp-waterfall-stage">{s.stage}</div>
                  <div className="cp-waterfall-title">{s.title}</div>
                  <div className="cp-waterfall-body">{s.body}</div>
                  <div className="cp-waterfall-metric">{s.metric}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FinancingMockup() {
  return (
    <div className="cp-fin-mockup reveal">
      <div className="cp-fin-mockup-bg" />
      <div className="cp-fin-mockup-grid">
        {/* LEFT, prospect-facing offer card with 3 ranked offers */}
        <div className="cp-fin-offers">
          <div className="cp-fin-offers-head">
            <div>
              <div className="cp-fin-offers-eyebrow">
                <span className="cp-fin-offers-blip" />
                PROSPECT VIEW · WHITE-LABELLED
              </div>
              <div className="cp-fin-offers-title">Atlas Executive Coaching · $24,000</div>
              <div className="cp-fin-offers-sub">3 of 52 lenders returned offers in 4.2s</div>
            </div>
            <div className="cp-fin-offers-stamp">approved</div>
          </div>

          <div className="cp-fin-offer-list">
            <div className="cp-fin-offer cp-fin-offer--best">
              <div className="cp-fin-offer-rank">★</div>
              <div className="cp-fin-offer-grid">
                <div>
                  <div className="cp-fin-offer-k">Lender</div>
                  <div className="cp-fin-offer-v">Cross River</div>
                </div>
                <div>
                  <div className="cp-fin-offer-k">Term</div>
                  <div className="cp-fin-offer-v">48 mo</div>
                </div>
                <div>
                  <div className="cp-fin-offer-k">Monthly</div>
                  <div className="cp-fin-offer-v cp-fin-offer-v--em">$612</div>
                </div>
                <div>
                  <div className="cp-fin-offer-k">APR</div>
                  <div className="cp-fin-offer-v">5.9%</div>
                </div>
              </div>
              <div className="cp-fin-offer-tag cp-fin-offer-tag--violet">recommended</div>
            </div>

            <div className="cp-fin-offer">
              <div className="cp-fin-offer-rank cp-fin-offer-rank--alt">2</div>
              <div className="cp-fin-offer-grid">
                <div>
                  <div className="cp-fin-offer-k">Lender</div>
                  <div className="cp-fin-offer-v">engine.tech</div>
                </div>
                <div>
                  <div className="cp-fin-offer-k">Term</div>
                  <div className="cp-fin-offer-v">60 mo</div>
                </div>
                <div>
                  <div className="cp-fin-offer-k">Monthly</div>
                  <div className="cp-fin-offer-v">$498</div>
                </div>
                <div>
                  <div className="cp-fin-offer-k">APR</div>
                  <div className="cp-fin-offer-v">7.49%</div>
                </div>
              </div>
            </div>

            <div className="cp-fin-offer">
              <div className="cp-fin-offer-rank cp-fin-offer-rank--alt">3</div>
              <div className="cp-fin-offer-grid">
                <div>
                  <div className="cp-fin-offer-k">Lender</div>
                  <div className="cp-fin-offer-v">FinWise</div>
                </div>
                <div>
                  <div className="cp-fin-offer-k">Term</div>
                  <div className="cp-fin-offer-v">24 mo</div>
                </div>
                <div>
                  <div className="cp-fin-offer-k">Monthly</div>
                  <div className="cp-fin-offer-v">$1,098</div>
                </div>
                <div>
                  <div className="cp-fin-offer-k">APR</div>
                  <div className="cp-fin-offer-v">9.99%</div>
                </div>
              </div>
            </div>
          </div>

          <div className="cp-fin-offers-foot">
            <span className="cp-fin-offers-foot-pill">
              <span className="cp-fin-offers-foot-dot" />
              soft pull · 0 credit impact
            </span>
            <span className="cp-fin-offers-foot-pill">merchant-direct payout · 48 to 72h</span>
            <span className="cp-fin-offers-foot-pill">12 to 60 month terms</span>
          </div>
        </div>

        {/* RIGHT, promo APR + marketplace waterfall */}
        <div className="cp-fin-side">
          <div className="cp-fin-promo">
            <div className="cp-fin-promo-bar" />
            <div className="cp-fin-promo-eyebrow">FEATURED · QUALIFYING PROGRAMS</div>
            <div className="cp-fin-promo-title">
              <span className="cp-grad-text-violet">0% interest</span>
              <br />
              <span className="cp-fin-promo-sub">
                plans available for qualifying programs · T&amp;Cs apply
              </span>
            </div>
            <div className="cp-fin-promo-stat">
              <div>
                <div className="cp-fin-promo-stat-v">From 5.9%</div>
                <div className="cp-fin-promo-stat-l">APR for qualifying clients</div>
              </div>
              <div>
                <div className="cp-fin-promo-stat-v">12-60mo</div>
                <div className="cp-fin-promo-stat-l">terms · lower monthly repayments</div>
              </div>
            </div>
          </div>

          <div className="cp-fin-marketplace">
            <div className="cp-fin-marketplace-head">
              <div className="cp-fin-marketplace-title">
                <span className="cp-fin-marketplace-blip" />
                LENDER MARKETPLACE
              </div>
              <div className="cp-fin-marketplace-sla">5s SLA</div>
            </div>
            <div className="cp-fin-marketplace-bar">
              {Array.from({ length: 52 }).map((_, i) => (
                <span
                  key={i}
                  className={`cp-fin-marketplace-tick ${i % 7 === 0 ? 'cp-fin-marketplace-tick--hot' : ''}`}
                  style={{ animationDelay: `${(i % 13) * 0.07}s` }}
                />
              ))}
            </div>
            <div className="cp-fin-marketplace-foot">
              <span>52 lenders queried in parallel</span>
              <span className="cp-fin-marketplace-counter">
                <span className="cp-fin-marketplace-counter-v">38</span> responded · 4.2s
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
   QualificationTree
   AUREAN-style decision tree. Vertical trunk + parallel financial-data
   branch in the middle. SVG connectors with a slow traveling pulse.
   ---------------------------------------------------------------------------- */
function QualificationTree() {
  return (
    <div className="cp-qual-tree reveal">
      <div className="cp-qual-tree-wrap">
        <svg
          className="cp-qual-tree-svg"
          viewBox="0 0 880 720"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
        >
          <defs>
            <linearGradient id="cp-qual-line" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.85" />
            </linearGradient>
            <radialGradient id="cp-qual-pulse-grad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fff" stopOpacity="1" />
              <stop offset="40%" stopColor="#C4B5FD" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
            </radialGradient>
            <path id="cp-qual-path-1" d="M 440 60 L 440 140" />
            <path id="cp-qual-path-2" d="M 440 200 L 440 280" />
            <path id="cp-qual-path-3a" d="M 440 340 L 240 420" />
            <path id="cp-qual-path-3b" d="M 440 340 L 440 420" />
            <path id="cp-qual-path-3c" d="M 440 340 L 640 420" />
            <path id="cp-qual-path-4a" d="M 240 480 L 440 540" />
            <path id="cp-qual-path-4b" d="M 440 480 L 440 540" />
            <path id="cp-qual-path-4c" d="M 640 480 L 440 540" />
            <path id="cp-qual-path-5" d="M 440 600 L 440 680" />
          </defs>

          {/* Connector lines */}
          <path
            d="M 440 60 L 440 140"
            stroke="url(#cp-qual-line)"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 440 200 L 440 280"
            stroke="url(#cp-qual-line)"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 440 340 L 240 420"
            stroke="url(#cp-qual-line)"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 440 340 L 440 420"
            stroke="url(#cp-qual-line)"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 440 340 L 640 420"
            stroke="url(#cp-qual-line)"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 240 480 L 440 540"
            stroke="url(#cp-qual-line)"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 440 480 L 440 540"
            stroke="url(#cp-qual-line)"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 640 480 L 440 540"
            stroke="url(#cp-qual-line)"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 440 600 L 440 680"
            stroke="url(#cp-qual-line)"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
          />

          {/* Single traveling pulse that wanders the trunk. Single rider
              following the central path, randomization is implicit because
              animation timing varies per branch */}
          <circle r="6" fill="url(#cp-qual-pulse-grad)" className="cp-qual-pulse">
            <animateMotion dur="7s" repeatCount="indefinite">
              <mpath href="#cp-qual-path-1" />
            </animateMotion>
          </circle>
          <circle r="6" fill="url(#cp-qual-pulse-grad)" className="cp-qual-pulse">
            <animateMotion dur="7s" repeatCount="indefinite" begin="1s">
              <mpath href="#cp-qual-path-2" />
            </animateMotion>
          </circle>
          <circle r="5" fill="url(#cp-qual-pulse-grad)" className="cp-qual-pulse">
            <animateMotion dur="7s" repeatCount="indefinite" begin="2s">
              <mpath href="#cp-qual-path-3b" />
            </animateMotion>
          </circle>
          <circle r="5" fill="url(#cp-qual-pulse-grad)" className="cp-qual-pulse">
            <animateMotion dur="7s" repeatCount="indefinite" begin="4s">
              <mpath href="#cp-qual-path-4b" />
            </animateMotion>
          </circle>
          <circle r="6" fill="url(#cp-qual-pulse-grad)" className="cp-qual-pulse">
            <animateMotion dur="7s" repeatCount="indefinite" begin="5s">
              <mpath href="#cp-qual-path-5" />
            </animateMotion>
          </circle>
        </svg>

        {/* Glass-card nodes positioned to match the SVG */}
        <QualNodeCard
          top={0}
          left="50%"
          code="Inbound application"
          label="lead enters the funnel"
          type="route"
        />
        <QualNodeCard
          top={140}
          left="50%"
          code="PRISM"
          label="intake · dynamic question order"
          type="agent"
        />
        <QualNodeCard
          top={280}
          left="50%"
          code="VEGA"
          label="identity · address · business signal"
          type="agent"
        />
        <QualNodeCard
          top={420}
          left="20%"
          code="FCRA soft pull"
          label="credit · 0 score impact"
          type="data"
        />
        <QualNodeCard top={420} left="50%" code="Plaid" label="cashflow signal" type="data" />
        <QualNodeCard
          top={420}
          left="80%"
          code="Persona"
          label="identity verification"
          type="data"
        />
        <QualNodeCard
          top={540}
          left="50%"
          code="ORACLE"
          label="score · fundability tier"
          type="agent"
        />
        <QualNodeCard
          top={680}
          left="50%"
          code="Qualified · book"
          label="→ discovery-call calendar"
          type="route"
          highlight
        />
      </div>
      <div className="cp-qual-tree-foot">
        <span className="cp-qual-tree-foot-dot" />
        Software agents only. Pre-qualification runs on financial data, never outbound voice, SMS,
        or DM contact with the prospect.
      </div>
    </div>
  );
}

function QualNodeCard({
  top,
  left,
  code,
  label,
  type,
  highlight,
}: {
  top: number;
  left: string;
  code: string;
  label: string;
  type: 'agent' | 'data' | 'asset' | 'route';
  highlight?: boolean;
}) {
  return (
    <div
      className={`cp-qual-node cp-qual-node--${type}${highlight ? ' cp-qual-node--highlight' : ''}`}
      style={{
        top: `${(top / 720) * 100}%`,
        left,
      }}
    >
      <div className="cp-qual-node-code">{code}</div>
      <div className="cp-qual-node-label">{label}</div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
   CardFan
   Pure-CSS card fan illustration for the card-stacking section.
   Primary lender card on top, 3 secondary card-stack cards fanning behind.
   ---------------------------------------------------------------------------- */
function CardFan() {
  return (
    <div className="cp-card-fan" aria-hidden>
      <div className="cp-card-fan-glow" />
      <div className="cp-card-fan-card cp-card-fan-card--3">
        <div className="cp-card-fan-band" />
        <div className="cp-card-fan-stripe" />
        <div className="cp-card-fan-bnpl">card · BNPL</div>
      </div>
      <div className="cp-card-fan-card cp-card-fan-card--2">
        <div className="cp-card-fan-band" />
        <div className="cp-card-fan-stripe" />
        <div className="cp-card-fan-bnpl">card · 0% promo</div>
      </div>
      <div className="cp-card-fan-card cp-card-fan-card--1">
        <div className="cp-card-fan-band" />
        <div className="cp-card-fan-stripe" />
        <div className="cp-card-fan-bnpl">card · remaining credit</div>
      </div>
      <div className="cp-card-fan-card cp-card-fan-card--primary">
        <div className="cp-card-fan-primary-eyebrow">
          <span className="cp-card-fan-blip" />
          PRIMARY LENDER
        </div>
        <div className="cp-card-fan-primary-amount">$25,000</div>
        <div className="cp-card-fan-primary-sub">personal loan · 48 mo · 5.9% APR</div>
        <div className="cp-card-fan-primary-foot">
          <span className="cp-card-fan-primary-pill">+ card stack covers the gap</span>
        </div>
      </div>
    </div>
  );
}

type AgentIconKey = 'prism' | 'vega' | 'oracle' | 'helix' | 'nexus' | 'flux' | 'echo';

interface AgentStat {
  k: string;
  v: string;
}

function AgentCard({
  span,
  num,
  code,
  role,
  status,
  icon,
  desc,
  stats,
  log,
  sidePanel,
}: {
  span: 5 | 7 | 12;
  num: string;
  code: string;
  role: string;
  status: 'ONLINE' | 'LEARNING';
  icon: AgentIconKey;
  desc: string;
  stats?: AgentStat[];
  log: string;
  sidePanel?: React.ReactNode;
}) {
  const statsCols = stats && stats.length === 3 ? 'cp-agent-stats--3' : 'cp-agent-stats--2';

  const Header = (
    <div className="cp-agent-head">
      <div className="cp-agent-id">
        <div className="cp-agent-icon">
          <span className="cp-agent-icon-blip" />
          {renderAgentIcon(icon)}
        </div>
        <div>
          <div className="cp-agent-num">Agent {num}</div>
          <h3 className="cp-agent-name">
            {code} <span className="cp-agent-role">· {role}</span>
          </h3>
        </div>
      </div>
      <div className="cp-agent-status">
        <span
          className={`cp-agent-status-dot${
            status === 'LEARNING' ? ' cp-agent-status-dot--learning' : ''
          }`}
        />
        {status}
      </div>
    </div>
  );

  if (span === 12 && sidePanel) {
    return (
      <div className="cp-agent cp-agent--span-12">
        <div className="cp-agent-split">
          <div className="cp-agent-split-l">
            {Header}
            <p className="cp-agent-desc">{desc}</p>
            <div className="cp-agent-log">
              <span className="cp-agent-log-label">last action:</span> {log}
            </div>
          </div>
          <div className="cp-agent-split-r">{sidePanel}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`cp-agent cp-agent--span-${span}`}>
      {Header}

      <p className="cp-agent-desc">{desc}</p>

      {stats && stats.length > 0 ? (
        <div className={`cp-agent-stats ${statsCols}`}>
          {stats.map((s) => (
            <div key={s.k} className="cp-agent-stat">
              <div className="cp-agent-stat-k">{s.k}</div>
              <div className="cp-agent-stat-v">{s.v}</div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="cp-agent-log">
        <span className="cp-agent-log-label">last action:</span> {log}
      </div>
    </div>
  );
}

function renderAgentIcon(name: AgentIconKey) {
  switch (name) {
    case 'prism':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 3L3 18h18L12 3z" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M12 8v8M8 14h8" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case 'vega':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="4" stroke="#fff" strokeWidth="1.6" />
          <circle cx="12" cy="12" r="9" stroke="#fff" strokeWidth="1" strokeDasharray="2 3" />
        </svg>
      );
    case 'oracle':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 17l5-9 4 6 3-4 4 7"
            stroke="#fff"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'helix':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M6 4c4 4 4 12 0 16M18 4c-4 4-4 12 0 16M6 8h12M6 16h12"
            stroke="#fff"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'nexus':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="2.2" fill="#fff" />
          <circle cx="4" cy="6" r="1.6" fill="#fff" />
          <circle cx="20" cy="6" r="1.6" fill="#fff" />
          <circle cx="4" cy="18" r="1.6" fill="#fff" />
          <circle cx="20" cy="18" r="1.6" fill="#fff" />
          <path d="M12 12L4 6M12 12L20 6M12 12L4 18M12 12L20 18" stroke="#fff" strokeWidth="0.8" />
        </svg>
      );
    case 'flux':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M3 12c3-3 6-3 9 0s6 3 9 0"
            stroke="#fff"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M3 7c3-3 6-3 9 0s6 3 9 0"
            stroke="#fff"
            strokeWidth="1"
            strokeLinecap="round"
            strokeOpacity="0.5"
          />
          <path
            d="M3 17c3-3 6-3 9 0s6 3 9 0"
            stroke="#fff"
            strokeWidth="1"
            strokeLinecap="round"
            strokeOpacity="0.5"
          />
        </svg>
      );
    case 'echo':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="2" fill="#fff" />
          <circle cx="12" cy="12" r="6" stroke="#fff" strokeWidth="1.2" />
          <circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="0.8" strokeDasharray="2 3" />
        </svg>
      );
  }
}

function PillarFeature({
  icon,
  title,
  body,
}: {
  icon: 'bolt' | 'grid' | 'zero' | 'rocket';
  title: string;
  body: string;
}) {
  return (
    <div className="cp-pf">
      <div className="cp-pf-icon">{renderIcon(icon)}</div>
      <div className="cp-pf-title">{title}</div>
      <div className="cp-pf-body">{body}</div>
    </div>
  );
}

function renderIcon(name: 'bolt' | 'grid' | 'zero' | 'rocket') {
  switch (name) {
    case 'bolt':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M13 3L4 14h7l-1 7 9-11h-7l1-7z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'grid':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </svg>
      );
    case 'zero':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <ellipse cx="12" cy="12" rx="6" ry="8" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );
    case 'rocket':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 3c4 2 6 6 6 11l-3-2-3 4-3-4-3 2c0-5 2-9 6-11z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
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
  return (
    <div className="cp-slider">
      <div className="cp-slider-head">
        <div className="cp-slider-label">{label}</div>
        <div className="cp-slider-value">{format(value)}</div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
        className="cp-slider-input"
        aria-label={label}
      />
    </div>
  );
}

/* ============================================================================
   Styles. AUREAN dark navy aesthetic. Purple highlight used sparingly.
   ============================================================================ */

const STYLES = `
  :root {
    /* AUREAN palette */
    --cp-bg:        #0a0a14;
    --cp-panel:     #101023;
    --cp-panel-2:   #15152e;
    --cp-panel-3:   #1a1a2e;
    --cp-panel-4:   #23233f;
    --cp-panel-5:   #2e2e54;

    --cp-text:      #eeeef2;
    --cp-text-2:    #b9b9c7;
    --cp-muted:     #8a8aa0;
    --cp-faded:     #5c5c76;

    --cp-hairline:  rgba(255, 255, 255, 0.08);
    --cp-hairline-2:rgba(255, 255, 255, 0.12);

    /* Purple highlight, used like red on a luxury watch */
    --cp-violet:    #A78BFA;
    --cp-violet-d:  #8B5CF6;
    --cp-violet-dd: #7C3AED;
  }

  .cp-root {
    background: var(--cp-bg);
    color: var(--cp-text);
    font-family: inherit;
    -webkit-font-smoothing: antialiased;
    overflow-x: hidden;
    line-height: 1.5;
    letter-spacing: -0.003em;
  }

  .cp-root * { box-sizing: border-box; }

  .cp-container {
    max-width: 1240px;
    margin: 0 auto;
    padding: 0 24px;
    position: relative;
  }

  .reveal { opacity: 0; transform: translateY(20px); transition: opacity 0.85s ease, transform 0.85s cubic-bezier(0.2,0.7,0.2,1); }
  .reveal.in { opacity: 1; transform: none; }

  /* ============== AMBIENT BG ============== */
  .cp-ambient-grid {
    position: absolute; inset: 0; z-index: 0; pointer-events: none;
    background-image:
      linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
    background-size: 56px 56px;
    mask-image: radial-gradient(ellipse at center, black 40%, transparent 80%);
    -webkit-mask-image: radial-gradient(ellipse at center, black 40%, transparent 80%);
  }
  .cp-ambient-grid--problem,
  .cp-ambient-grid--agents,
  .cp-ambient-grid--final {
    background-image:
      linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
  }
  .cp-ambient-glow {
    position: absolute; inset: 0; z-index: 0; pointer-events: none;
    background:
      radial-gradient(ellipse 80% 60% at 50% 0%, rgba(58,58,106,0.45), transparent 60%),
      radial-gradient(ellipse 60% 50% at 80% 80%, rgba(46,46,84,0.35), transparent 60%),
      radial-gradient(ellipse 40% 30% at 20% 40%, rgba(139,92,246,0.10), transparent 70%),
      radial-gradient(ellipse 30% 25% at 90% 20%, rgba(167,139,250,0.08), transparent 70%);
  }

  /* ============== 3D / DEPTH PRIMITIVES (AUREAN-style) ============== */
  /* Hero perspective container */
  .cp-perspective {
    perspective: 1400px;
    perspective-origin: 50% 30%;
    transform-style: preserve-3d;
  }
  /* Hero offer-card float + hover tilt are layered onto the existing
     .cp-hero-card rule below via the float keyframes + hover selector. */
  @keyframes cp-card-float {
    0%, 100% { transform: translateY(0) rotateY(0deg) rotateX(0deg); }
    50%      { transform: translateY(-10px) rotateY(-0.8deg) rotateX(0.6deg); }
  }

  /* Hero 3D ring/orb behind the offer card */
  .cp-hero-ring {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 520px;
    height: 520px;
    margin-left: -260px;
    margin-top: -260px;
    border-radius: 999px;
    transform-style: preserve-3d;
    border: 1px solid rgba(167, 139, 250, 0.14);
    background:
      radial-gradient(ellipse at center, rgba(139, 92, 246, 0.14), rgba(16, 16, 35, 0.04) 70%),
      linear-gradient(180deg, rgba(167, 139, 250, 0.04), rgba(255,255,255,0));
    box-shadow:
      0 0 0 1px rgba(167, 139, 250, 0.04) inset,
      0 30px 80px -20px rgba(0, 0, 0, 0.6);
    pointer-events: none;
    z-index: 1;
    animation: cp-ring-spin 72s linear infinite;
    opacity: 0.7;
  }
  .cp-hero-ring::after {
    content: "";
    position: absolute;
    inset: 8%;
    border-radius: 999px;
    border: 1px dashed rgba(167, 139, 250, 0.16);
  }
  .cp-hero-ring::before {
    content: "";
    position: absolute;
    inset: 22%;
    border-radius: 999px;
    border: 1px solid rgba(139, 92, 246, 0.08);
    background: radial-gradient(circle at 50% 40%, rgba(167, 139, 250, 0.10), transparent 70%);
  }
  @keyframes cp-ring-spin {
    0%   { transform: rotateX(60deg) rotateZ(0deg); }
    100% { transform: rotateX(60deg) rotateZ(360deg); }
  }
  /* Hero secondary counter-rotating ring removed — single ring reads cleaner */

  /* Chip purple shadow breathing + scanline sweep on the LIVE chip */
  .cp-chip {
    transform-style: preserve-3d;
  }
  .cp-chip--violet {
    animation: cp-chip-float 7s ease-in-out infinite,
               cp-chip-pulse-violet 5s ease-in-out infinite;
    overflow: hidden;
  }
  @keyframes cp-chip-pulse-violet {
    0%, 100% { box-shadow: 0 14px 38px -12px rgba(139, 92, 246, 0.35), 0 0 0 0 rgba(167, 139, 250, 0); }
    50%      { box-shadow: 0 18px 48px -10px rgba(139, 92, 246, 0.55), 0 0 0 4px rgba(167, 139, 250, 0.12); }
  }
  .cp-chip--violet::after {
    content: "";
    position: absolute;
    left: -30%;
    top: 0;
    bottom: 0;
    width: 30%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.18), transparent);
    animation: cp-scanline-x 6s linear infinite;
    pointer-events: none;
  }
  @keyframes cp-scanline-x {
    0%   { transform: translateX(0); opacity: 0; }
    10%  { opacity: 1; }
    90%  { opacity: 1; }
    100% { transform: translateX(620%); opacity: 0; }
  }

  /* Waterfall — perspective tilt + traveling pulse + beam + node ripple */
  .cp-waterfall-svg-wrap {
    perspective: 1600px;
    transform-style: preserve-3d;
  }
  .cp-waterfall-svg {
    transform: rotateX(8deg);
    transform-origin: 50% 60%;
  }
  @media (max-width: 1024px) {
    .cp-waterfall-svg { transform: none; }
  }
  .cp-waterfall-pulse {
    filter: drop-shadow(0 0 8px rgba(167, 139, 250, 0.9));
  }
  .cp-waterfall-beam {
    position: absolute;
    right: 4%;
    top: 0;
    bottom: 0;
    width: 2px;
    background: linear-gradient(180deg,
      rgba(167, 139, 250, 0) 0%,
      rgba(167, 139, 250, 0.55) 30%,
      rgba(139, 92, 246, 0.9) 60%,
      rgba(167, 139, 250, 0) 100%);
    transform: translateX(-50%);
    filter: blur(0.5px);
    opacity: 0.7;
    animation: cp-beam-pulse 4.2s ease-in-out infinite;
    pointer-events: none;
    z-index: 0;
  }
  @keyframes cp-beam-pulse {
    0%, 100% { opacity: 0.4; transform: translateX(-50%) scaleY(0.95); }
    50%      { opacity: 0.85; transform: translateX(-50%) scaleY(1.05); }
  }
  @media (max-width: 1024px) { .cp-waterfall-beam { display: none; } }

  /* Waterfall orbs stay static — the traveling rider handles the motion */

  /* Pillar 01 financing tick polling — subtle wave, no bright pulse */
  @keyframes cp-tick-poll {
    0%, 100% { background: linear-gradient(180deg, rgba(167, 139, 250, 0.32), rgba(139, 92, 246, 0.2)); }
    50%      { background: linear-gradient(180deg, rgba(167, 139, 250, 0.55), rgba(139, 92, 246, 0.35)); }
  }
  /* simplified stagger — every 4th tick gets a small delay */
  .cp-fin-marketplace-tick:nth-child(4n)   { animation-delay: 0.2s, 0.4s; }
  .cp-fin-marketplace-tick:nth-child(4n+1) { animation-delay: 0.4s, 0.8s; }
  .cp-fin-marketplace-tick:nth-child(4n+2) { animation-delay: 0.6s, 1.2s; }
  .cp-fin-marketplace-tick:nth-child(4n+3) { animation-delay: 0.8s, 1.6s; }

  /* Agent cards — icon sway keyframes (hover/transform lives in original rule below) */
  .cp-agent-icon {
    animation: cp-icon-sway 10s ease-in-out infinite;
    transform-style: preserve-3d;
    transform-origin: 50% 50%;
  }
  .cp-agent--span-7 .cp-agent-icon { animation-delay: 0s; }
  .cp-agent--span-5 .cp-agent-icon { animation-delay: 1.4s; }
  .cp-agent--span-12 .cp-agent-icon { animation-delay: 2.8s; }
  .cp-agent:nth-child(2) .cp-agent-icon { animation-delay: 0.6s; }
  .cp-agent:nth-child(3) .cp-agent-icon { animation-delay: 1.2s; }
  .cp-agent:nth-child(4) .cp-agent-icon { animation-delay: 1.8s; }
  .cp-agent:nth-child(5) .cp-agent-icon { animation-delay: 2.4s; }
  .cp-agent:nth-child(6) .cp-agent-icon { animation-delay: 3.0s; }
  .cp-agent:nth-child(7) .cp-agent-icon { animation-delay: 3.6s; }
  @keyframes cp-icon-sway {
    0%, 100% { transform: rotateY(-2deg) rotateX(1deg); }
    50%      { transform: rotateY(2deg) rotateX(-1deg); }
  }

  /* ECHO live stream — scrolling marquee */
  .cp-agent-stream-rows {
    position: relative;
    max-height: 260px;
    overflow: hidden;
    mask-image: linear-gradient(180deg, black 0%, black 78%, transparent 100%);
    -webkit-mask-image: linear-gradient(180deg, black 0%, black 78%, transparent 100%);
  }
  /* Scanline removed — drift handles the motion on its own */
  .cp-agent-stream-row {
    animation: cp-stream-drift 14s linear infinite;
  }
  .cp-agent-stream-row:nth-child(1) { animation-delay: 0s; }
  .cp-agent-stream-row:nth-child(2) { animation-delay: -2.8s; }
  .cp-agent-stream-row:nth-child(3) { animation-delay: -5.6s; }
  .cp-agent-stream-row:nth-child(4) { animation-delay: -8.4s; }
  .cp-agent-stream-row:nth-child(5) { animation-delay: -11.2s; }
  @keyframes cp-stream-drift {
    0%, 100% { transform: translateY(0); opacity: 1; }
    5%       { transform: translateY(-2px); }
    50%      { transform: translateY(0); opacity: 0.95; }
    95%      { transform: translateY(2px); }
  }

  /* Ticker grid perspective + story grid perspective (rules below extended in-place) */
  .cp-ticker-grid { perspective: 1200px; }
  .cp-stories-grid { perspective: 1400px; }
  .cp-agents-mosaic { perspective: 1600px; }

  /* Final CTA — small subtle ring behind headline */
  .cp-final-ring {
    position: absolute;
    left: 50%;
    top: 40%;
    width: 360px;
    height: 360px;
    margin-left: -180px;
    margin-top: -180px;
    border-radius: 999px;
    border: 1px solid rgba(167, 139, 250, 0.12);
    background:
      radial-gradient(ellipse at center, rgba(139, 92, 246, 0.08), transparent 70%);
    pointer-events: none;
    z-index: 0;
    animation: cp-ring-spin 110s linear infinite;
    opacity: 0.5;
    filter: blur(0.3px);
  }
  .cp-final-ring::after {
    content: "";
    position: absolute;
    inset: 14%;
    border-radius: 999px;
    border: 1px dashed rgba(167, 139, 250, 0.14);
  }
  .cp-final-ring::before {
    content: "";
    position: absolute;
    inset: 32%;
    border-radius: 999px;
    border: 1px solid rgba(167, 139, 250, 0.10);
  }
  @media (max-width: 768px) {
    .cp-final-ring { width: 260px; height: 260px; margin-left: -130px; margin-top: -130px; }
  }

  /* Glow-edge accent (AUREAN-style outer subtle gradient) */
  .cp-glow-edge { position: relative; }
  .cp-glow-edge::after {
    content: "";
    position: absolute;
    inset: -1px;
    border-radius: inherit;
    background: linear-gradient(120deg, rgba(167,139,250,0.16), transparent 40%, transparent 60%, rgba(139,92,246,0.08));
    pointer-events: none;
    opacity: 0.55;
    mix-blend-mode: overlay;
  }

  /* ============== NAV ============== */
  .cp-nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 50;
    padding: 14px 0;
    transition: padding 0.25s ease;
  }
  .cp-nav--scrolled { padding: 8px 0; }
  .cp-nav-inner {
    max-width: 1240px;
    margin: 0 auto;
    padding: 10px 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    background: linear-gradient(180deg, rgba(35,35,63,0.7) 0%, rgba(16,16,35,0.7) 100%);
    border: 1px solid var(--cp-hairline);
    border-radius: 16px;
    backdrop-filter: saturate(180%) blur(18px);
    -webkit-backdrop-filter: saturate(180%) blur(18px);
    box-shadow: 0 10px 40px -22px rgba(0, 0, 0, 0.7);
    transition: all 0.25s ease;
  }
  .cp-nav--scrolled .cp-nav-inner {
    padding: 8px 18px;
    background: linear-gradient(180deg, rgba(35,35,63,0.85) 0%, rgba(16,16,35,0.85) 100%);
    box-shadow: 0 14px 50px -22px rgba(0, 0, 0, 0.8);
  }
  .cp-brand {
    display: inline-flex; align-items: center; gap: 10px;
    text-decoration: none; color: var(--cp-text);
    font-weight: 700; font-size: 15px; letter-spacing: -0.01em;
  }
  .cp-brand-mark {
    width: 28px; height: 28px;
    border-radius: 8px;
    display: inline-flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, #2e2e54 0%, #1a1a2e 100%);
    border: 1px solid var(--cp-hairline-2);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
  }
  .cp-brand-mark--sm { width: 22px; height: 22px; border-radius: 6px; }
  .cp-brand-wordmark { display: inline-flex; align-items: baseline; gap: 2px; }
  .cp-brand-sub { color: var(--cp-muted); font-weight: 400; }
  .cp-nav-links {
    display: none;
    align-items: center;
    gap: 28px;
    font-size: 13.5px;
    color: var(--cp-text-2);
  }
  .cp-nav-links a {
    color: var(--cp-text-2);
    text-decoration: none;
    transition: color 0.15s ease;
    font-weight: 500;
  }
  .cp-nav-links a:hover { color: var(--cp-violet); }
  @media (min-width: 1024px) { .cp-nav-links { display: flex; } }
  .cp-nav-cta { display: inline-flex; gap: 8px; align-items: center; }

  /* ============== BUTTONS ============== */
  .cp-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    text-decoration: none;
    font-weight: 600;
    font-size: 13.5px;
    padding: 10px 16px;
    border-radius: 10px;
    transition: transform 0.15s ease, box-shadow 0.18s ease, background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
    cursor: pointer;
    border: none;
    white-space: nowrap;
  }
  .cp-btn--lg { padding: 13px 20px; font-size: 14.5px; border-radius: 12px; }
  .cp-btn--xl { padding: 16px 26px; font-size: 15.5px; border-radius: 14px; }
  .cp-btn--violet {
    background: linear-gradient(180deg, #A78BFA 0%, #7C3AED 100%);
    color: #fff;
    box-shadow: 0 10px 28px -10px rgba(139, 92, 246, 0.55), inset 0 -1.5px 0 rgba(0,0,0,0.16);
  }
  .cp-btn--violet:hover {
    transform: translateY(-1px);
    box-shadow: 0 14px 40px -12px rgba(139, 92, 246, 0.7), inset 0 -1.5px 0 rgba(0,0,0,0.16);
  }
  .cp-btn--ghost {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--cp-hairline-2);
    color: var(--cp-text);
  }
  .cp-btn--ghost:hover { background: rgba(255, 255, 255, 0.06); border-color: rgba(255, 255, 255, 0.22); }
  .cp-btn--ghost-light {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.18);
    color: #fff;
  }
  .cp-btn--ghost-light:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.36); }

  /* ============== TYPE ============== */
  .cp-grad-text {
    background: linear-gradient(180deg, #ffffff 0%, #b9b9c7 100%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .cp-grad-text-violet {
    background: linear-gradient(135deg, #C4B5FD 0%, #A78BFA 60%, #8B5CF6 100%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .cp-emph { color: var(--cp-text); font-weight: 600; }
  .cp-eyebrow {
    display: inline-flex; align-items: center; gap: 8px;
    font-size: 11px; font-weight: 600; letter-spacing: 0.16em;
    color: var(--cp-text-2);
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--cp-hairline);
    padding: 6px 12px;
    border-radius: 999px;
    text-transform: uppercase;
  }
  .cp-eyebrow--on-dark {
    color: var(--cp-text-2);
    background: rgba(255, 255, 255, 0.04);
    border-color: var(--cp-hairline-2);
  }
  .cp-eyebrow-dot {
    width: 6px; height: 6px; border-radius: 999px;
    background: var(--cp-violet);
    box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.18);
    animation: cp-throb-violet 2.4s ease-in-out infinite;
  }
  @keyframes cp-throb-violet {
    0%, 100% { box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.18); }
    50% { box-shadow: 0 0 0 6px rgba(167, 139, 250, 0.04); }
  }

  .cp-h2 {
    font-size: 44px;
    line-height: 1.06;
    letter-spacing: -0.022em;
    font-weight: 700;
    color: var(--cp-text);
    margin: 18px 0 0 0;
    max-width: 880px;
  }
  .cp-h2--on-dark { color: var(--cp-text); }
  .cp-h2-sub {
    margin-top: 18px;
    font-size: 17px;
    line-height: 1.62;
    color: var(--cp-text-2);
    max-width: 720px;
  }
  .cp-h2-sub--on-dark { color: var(--cp-text-2); }
  .cp-h3 {
    font-size: 26px; line-height: 1.18; letter-spacing: -0.018em;
    font-weight: 700; color: var(--cp-text);
    margin: 14px 0 0 0;
  }

  .cp-section-head { max-width: 880px; }

  /* ============== HERO ============== */
  .cp-hero {
    position: relative;
    padding: 152px 0 64px 0;
    overflow: hidden;
    background: var(--cp-bg);
  }
  .cp-hero-inner { position: relative; z-index: 1; }
  .cp-hero-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 56px;
    align-items: center;
  }
  @media (min-width: 1024px) {
    .cp-hero-grid {
      grid-template-columns: 1.05fr 0.95fr;
      gap: 72px;
    }
  }
  .cp-hero-copy { position: relative; z-index: 2; }
  .cp-hero-h1 {
    font-size: 60px;
    line-height: 1.02;
    letter-spacing: -0.028em;
    font-weight: 800;
    margin: 24px 0 0 0;
  }
  @media (max-width: 1024px) { .cp-hero-h1 { font-size: 52px; } }
  @media (max-width: 768px) { .cp-hero-h1 { font-size: 40px; } }
  @media (max-width: 480px) { .cp-hero-h1 { font-size: 34px; } }

  .cp-hero-sub {
    margin-top: 22px;
    font-size: 17.5px;
    line-height: 1.6;
    color: var(--cp-text-2);
    max-width: 560px;
  }
  .cp-hero-ctas { margin-top: 32px; display: flex; gap: 10px; flex-wrap: wrap; }
  .cp-hero-stats {
    margin-top: 40px;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1px;
    background: var(--cp-hairline);
    border-radius: 14px;
    overflow: hidden;
    border: 1px solid var(--cp-hairline);
  }
  .cp-hero-stat {
    background: linear-gradient(180deg, rgba(35,35,63,0.5) 0%, rgba(16,16,35,0.5) 100%);
    padding: 16px 18px;
    backdrop-filter: blur(8px);
  }
  .cp-hero-stat-v {
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.018em;
    color: var(--cp-text);
    font-variant-numeric: tabular-nums;
  }
  .cp-hero-stat-l {
    margin-top: 4px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--cp-muted);
  }

  /* hero card */
  .cp-hero-card-wrap {
    position: relative;
    height: 560px;
    perspective: 1400px;
    perspective-origin: 50% 30%;
    transform-style: preserve-3d;
  }
  @media (max-width: 1024px) { .cp-hero-card-wrap { height: auto; min-height: 480px; } }

  .cp-hero-card {
    position: relative;
    z-index: 2;
    background: linear-gradient(180deg, rgba(35,35,63,0.7) 0%, rgba(16,16,35,0.7) 100%);
    border: 1px solid var(--cp-hairline-2);
    border-radius: 22px;
    padding: 24px;
    box-shadow:
      0 30px 80px -30px rgba(0, 0, 0, 0.7),
      0 12px 32px -10px rgba(0, 0, 0, 0.4),
      inset 0 1px 0 rgba(255,255,255,0.05);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    max-width: 480px;
    margin-left: auto;
    transform-style: preserve-3d;
    will-change: transform;
    animation:
      cp-card-rise 0.95s cubic-bezier(0.16,1,0.3,1) both,
      cp-card-float 11s ease-in-out 1.1s infinite;
    transition: transform 0.55s cubic-bezier(0.2,0.7,0.2,1), box-shadow 0.4s ease;
  }
  .cp-hero-card-wrap:hover .cp-hero-card {
    animation-play-state: running, paused;
    transform: rotateY(-3deg) rotateX(2deg) translateY(-4px);
    box-shadow:
      0 50px 110px -28px rgba(0, 0, 0, 0.85),
      0 24px 60px -12px rgba(139, 92, 246, 0.32),
      inset 0 1px 0 rgba(255,255,255,0.07);
  }
  @keyframes cp-card-rise {
    from { opacity: 0; transform: translateY(28px) scale(0.985); }
    to { opacity: 1; transform: none; }
  }
  .cp-card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
  .cp-card-eyebrow {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 10px; letter-spacing: 0.14em; font-weight: 600;
    color: var(--cp-text-2);
    text-transform: uppercase;
  }
  .cp-card-blip {
    width: 6px; height: 6px; border-radius: 999px;
    background: var(--cp-violet);
    box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.22);
    animation: cp-throb-violet 2.2s ease-in-out infinite;
  }
  .cp-card-title {
    margin-top: 4px;
    font-size: 14.5px; font-weight: 600; color: var(--cp-text);
  }
  .cp-card-stamp {
    background: linear-gradient(180deg, #A78BFA 0%, #7C3AED 100%);
    color: #fff;
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    padding: 5px 10px;
    border-radius: 999px;
    box-shadow: 0 6px 20px -6px rgba(139, 92, 246, 0.55);
  }
  .cp-card-amount {
    margin-top: 18px;
    display: flex; align-items: flex-start; gap: 4px;
    font-variant-numeric: tabular-nums;
  }
  .cp-card-amount-curr {
    font-size: 24px; font-weight: 700; color: var(--cp-text-2);
    line-height: 1.4;
  }
  .cp-card-amount-n {
    font-size: 52px; font-weight: 800; letter-spacing: -0.028em;
    line-height: 1.02;
    background: linear-gradient(180deg, #ffffff 0%, #b9b9c7 100%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .cp-card-amount-sub {
    font-size: 13px; color: var(--cp-muted); margin-top: 4px;
  }
  .cp-card-offer-grid {
    margin-top: 18px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    padding: 14px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 12px;
    border: 1px solid var(--cp-hairline);
  }
  .cp-card-k {
    font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--cp-muted); font-weight: 500;
  }
  .cp-card-v {
    margin-top: 3px;
    font-size: 15px; font-weight: 700; color: var(--cp-text);
    font-variant-numeric: tabular-nums;
  }
  .cp-card-livebar {
    margin-top: 16px;
    border-top: 1px solid var(--cp-hairline);
    padding-top: 14px;
    display: grid; gap: 8px;
  }
  .cp-card-livebar-row { display: flex; justify-content: space-between; align-items: center; }
  .cp-card-livebar-k { font-size: 12.5px; color: var(--cp-muted); }
  .cp-card-livebar-v {
    font-size: 13.5px; font-weight: 700; color: var(--cp-text);
    font-variant-numeric: tabular-nums;
  }
  .cp-card-livebar-v--violet { color: var(--cp-violet); }
  .cp-card-foot {
    margin-top: 16px; padding-top: 12px;
    border-top: 1px dashed var(--cp-hairline-2);
    display: flex; justify-content: space-between; gap: 10px;
    font-size: 11px;
  }
  .cp-card-foot-k {
    display: inline-flex; align-items: center; gap: 6px;
    color: var(--cp-muted);
  }
  .cp-card-foot-k--right { color: var(--cp-text-2); font-weight: 500; }
  .cp-card-foot-dot {
    width: 6px; height: 6px; border-radius: 999px;
    background: var(--cp-violet);
  }

  /* floating chips */
  .cp-chip {
    position: absolute;
    z-index: 3;
    background: linear-gradient(180deg, rgba(35,35,63,0.85) 0%, rgba(16,16,35,0.85) 100%);
    border: 1px solid var(--cp-hairline-2);
    border-radius: 10px;
    padding: 7px 10px;
    font-size: 11px;
    display: inline-flex; align-items: center; gap: 6px;
    white-space: nowrap;
    color: var(--cp-text);
    box-shadow: 0 12px 32px -14px rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    animation: cp-chip-float 7s ease-in-out infinite;
  }
  @keyframes cp-chip-float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
  }
  .cp-chip-k {
    color: var(--cp-muted);
    text-transform: uppercase; letter-spacing: 0.1em;
    font-weight: 600;
    display: inline-flex; align-items: center; gap: 5px;
  }
  .cp-chip-v {
    color: var(--cp-text);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .cp-chip--violet {
    background: linear-gradient(180deg, rgba(58,40,110,0.85) 0%, rgba(30,20,60,0.85) 100%);
    border-color: rgba(167, 139, 250, 0.36);
    box-shadow: 0 14px 38px -12px rgba(139, 92, 246, 0.4);
  }
  .cp-chip--violet .cp-chip-k { color: var(--cp-violet); }
  .cp-chip--violet .cp-chip-v { color: #fff; }
  .cp-chip-dot {
    width: 6px; height: 6px; border-radius: 999px;
    background: var(--cp-violet);
    box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.3);
    animation: cp-throb-violet 2s ease-in-out infinite;
  }
  @media (max-width: 1024px) {
    .cp-chip:nth-child(3), .cp-chip:nth-child(4) { display: none; }
  }

  /* hero trust strip */
  .cp-hero-trust {
    margin-top: 72px;
    padding-top: 36px;
    border-top: 1px solid var(--cp-hairline);
  }
  .cp-hero-trust-label {
    font-size: 11px;
    color: var(--cp-muted);
    text-transform: uppercase;
    letter-spacing: 0.16em;
    margin-bottom: 18px;
  }

  /* ============== MARQUEE ============== */
  .cp-marquee {
    overflow: hidden;
    mask-image: linear-gradient(90deg, transparent, black 8%, black 92%, transparent);
    -webkit-mask-image: linear-gradient(90deg, transparent, black 8%, black 92%, transparent);
  }
  .cp-marquee-track {
    display: inline-flex;
    gap: 56px;
    animation: cp-marquee 36s linear infinite;
    width: max-content;
    color: var(--cp-muted);
    font-size: 14.5px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  @keyframes cp-marquee {
    from { transform: translateX(0); }
    to { transform: translateX(-50%); }
  }
  .cp-marquee--accent .cp-marquee-track { color: var(--cp-text-2); font-size: 18px; }
  .cp-marquee-item { white-space: nowrap; }

  /* ============== TICKER ============== */
  .cp-ticker {
    padding: 64px 0 32px 0;
    position: relative;
    background: var(--cp-bg);
  }
  .cp-ticker-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1px;
    background: var(--cp-hairline);
    border: 1px solid var(--cp-hairline);
    border-radius: 18px;
    overflow: hidden;
  }
  @media (min-width: 768px) { .cp-ticker-grid { grid-template-columns: repeat(4, 1fr); } }
  .cp-ticker-cell {
    background: linear-gradient(180deg, rgba(35,35,63,0.5) 0%, rgba(16,16,35,0.5) 100%);
    padding: 28px 22px;
    backdrop-filter: blur(8px);
    min-width: 0;
    overflow: hidden;
    transform-style: preserve-3d;
    transform-origin: 50% 100%;
    transition:
      transform 0.28s cubic-bezier(0.2,0.7,0.2,1),
      box-shadow 0.28s ease,
      background 0.28s ease;
  }
  .cp-ticker-cell:hover {
    transform: translateY(-4px) rotateX(3deg);
    background: linear-gradient(180deg, rgba(58, 40, 110, 0.32) 0%, rgba(16, 16, 35, 0.6) 100%);
    box-shadow:
      0 24px 50px -18px rgba(139, 92, 246, 0.32),
      0 8px 20px -8px rgba(0, 0, 0, 0.4);
  }
  .cp-ticker-v {
    font-size: 38px;
    font-weight: 700;
    letter-spacing: -0.022em;
    background: linear-gradient(180deg, #ffffff 0%, #b9b9c7 100%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
    font-variant-numeric: tabular-nums;
    line-height: 1.05;
  }
  .cp-ticker-l {
    margin-top: 8px;
    font-size: 13.5px;
    color: var(--cp-text-2);
    font-weight: 500;
  }
  .cp-ticker-d {
    margin-top: 14px;
    font-size: 11.5px;
    color: var(--cp-muted);
    display: inline-flex; align-items: center; gap: 6px;
  }
  .cp-ticker-d-mark {
    width: 5px; height: 5px; border-radius: 999px;
    background: var(--cp-violet);
  }

  /* ============== PROBLEM ============== */
  .cp-problem {
    position: relative;
    padding: 96px 0;
    background:
      radial-gradient(60% 50% at 50% 0%, rgba(58, 58, 106, 0.45), transparent 70%),
      radial-gradient(40% 40% at 80% 80%, rgba(46, 46, 84, 0.35), transparent 70%),
      var(--cp-panel);
    overflow: hidden;
    margin-top: 64px;
    border-top: 1px solid var(--cp-hairline);
    border-bottom: 1px solid var(--cp-hairline);
  }
  .cp-problem .cp-h2 { max-width: 920px; }
  .cp-problem-head { max-width: 920px; position: relative; z-index: 1; }
  .cp-compare {
    margin-top: 64px;
    display: grid;
    grid-template-columns: 1fr;
    gap: 24px;
    position: relative;
    z-index: 1;
  }
  @media (min-width: 1024px) {
    .cp-compare { grid-template-columns: 1fr 60px 1fr; align-items: stretch; }
  }
  .cp-compare-card {
    padding: 32px 28px;
    border-radius: 22px;
    border: 1px solid var(--cp-hairline);
    background: linear-gradient(180deg, rgba(35,35,63,0.5) 0%, rgba(16,16,35,0.5) 100%);
    backdrop-filter: blur(8px);
  }
  .cp-compare-card--bad { background: linear-gradient(180deg, rgba(20,20,38,0.6) 0%, rgba(10,10,20,0.6) 100%); }
  .cp-compare-card--good {
    background: linear-gradient(180deg, rgba(58,40,110,0.25) 0%, rgba(35,35,63,0.5) 100%);
    border-color: rgba(167, 139, 250, 0.28);
    box-shadow: 0 30px 70px -30px rgba(139, 92, 246, 0.32);
  }
  .cp-compare-head { margin-bottom: 24px; }
  .cp-compare-label {
    font-size: 11.5px; letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--cp-text-2); font-weight: 600;
  }
  .cp-compare-label--good { color: var(--cp-violet); }
  .cp-compare-sub {
    margin-top: 4px;
    font-size: 14px; color: var(--cp-muted);
  }
  .cp-compare-stats {
    display: grid; gap: 14px;
  }
  .cp-compare-stat {
    padding: 14px 0;
    border-top: 1px solid var(--cp-hairline);
    display: grid; grid-template-columns: 130px 1fr; align-items: baseline; gap: 16px;
  }
  .cp-compare-stat-v {
    font-size: 30px;
    font-weight: 700;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }
  .cp-compare-stat-v--bad { color: var(--cp-text-2); }
  .cp-compare-stat-v--good { color: var(--cp-violet); }
  .cp-compare-stat-l {
    font-size: 13.5px; color: var(--cp-text-2); line-height: 1.45;
  }
  .cp-compare-arrow {
    display: none;
    align-items: center; justify-content: center;
  }
  @media (min-width: 1024px) { .cp-compare-arrow { display: flex; } }

  /* ============== HOW IT WORKS ============== */
  .cp-how { padding: 112px 0; background: var(--cp-bg); }
  .cp-waterfall {
    margin-top: 80px;
    position: relative;
    height: 560px;
  }
  @media (max-width: 1024px) { .cp-waterfall { height: auto; min-height: 480px; } }
  .cp-waterfall-svg-wrap { position: relative; height: 100%; }
  .cp-waterfall-svg {
    width: 100%; height: 100%;
    display: block;
  }
  @media (max-width: 1024px) {
    .cp-waterfall-svg { display: none; }
  }

  .cp-waterfall-nodes {
    position: absolute;
    inset: 0;
  }
  @media (max-width: 1024px) {
    .cp-waterfall-nodes {
      position: relative;
      inset: auto;
      display: grid;
      gap: 20px;
    }
  }

  .cp-waterfall-node {
    position: absolute;
    transform: translate(-50%, -50%);
    animation: cp-node-rise 0.8s ease both;
    width: 240px;
  }
  @media (max-width: 1024px) {
    .cp-waterfall-node {
      position: relative;
      transform: none;
      left: auto !important; top: auto !important;
      width: 100%;
    }
  }
  @keyframes cp-node-rise {
    from { opacity: 0; transform: translate(-50%, -38%); }
    to { opacity: 1; }
  }
  .cp-waterfall-orb {
    width: 38px; height: 38px;
    border-radius: 999px;
    display: inline-flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, #2e2e54 0%, #1a1a2e 100%);
    color: var(--cp-text);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    border: 1px solid var(--cp-hairline-2);
    box-shadow: 0 10px 30px -8px rgba(0, 0, 0, 0.6);
    position: relative;
  }
  .cp-waterfall-orb::after {
    content: "";
    position: absolute; inset: -10px;
    border: 1px dashed rgba(167, 139, 250, 0.32);
    border-radius: 999px;
  }
  .cp-waterfall-card {
    margin-top: 12px;
    padding: 14px 16px;
    background: linear-gradient(180deg, rgba(35,35,63,0.7) 0%, rgba(16,16,35,0.7) 100%);
    border: 1px solid var(--cp-hairline-2);
    border-radius: 14px;
    backdrop-filter: blur(10px);
    box-shadow: 0 18px 50px -22px rgba(0, 0, 0, 0.6);
  }
  .cp-waterfall-stage {
    font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.14em;
    color: var(--cp-violet); font-weight: 700;
  }
  .cp-waterfall-title {
    margin-top: 6px;
    font-size: 14.5px; font-weight: 700; color: var(--cp-text);
    letter-spacing: -0.012em;
  }
  .cp-waterfall-body {
    margin-top: 6px;
    font-size: 12.5px; color: var(--cp-text-2); line-height: 1.5;
  }
  .cp-waterfall-metric {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--cp-hairline);
    font-size: 11.5px;
    color: var(--cp-violet);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
  }

  /* ============== PILLARS ============== */
  .cp-pillar { padding: 112px 0; position: relative; background: var(--cp-bg); }
  .cp-pillar--dominant {
    background:
      radial-gradient(40% 30% at 10% 10%, rgba(58, 58, 106, 0.25), transparent 70%),
      radial-gradient(35% 30% at 90% 90%, rgba(46, 46, 84, 0.2), transparent 70%),
      var(--cp-bg);
  }

  .cp-pillar-head {
    display: grid;
    grid-template-columns: 1fr;
    gap: 24px;
    align-items: start;
  }
  @media (min-width: 1024px) {
    .cp-pillar-head { grid-template-columns: 140px 1fr; gap: 56px; }
  }
  .cp-pillar-number {
    font-size: 96px;
    line-height: 0.9;
    letter-spacing: -0.05em;
    font-weight: 800;
    background: linear-gradient(180deg, #ffffff 0%, #5c5c76 100%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
    font-variant-numeric: tabular-nums;
  }
  .cp-pillar-number--inline {
    font-size: 48px;
    margin-bottom: 14px;
    display: inline-block;
  }
  .cp-pillar-number--on-dark {
    background: linear-gradient(180deg, #ffffff 0%, #5c5c76 100%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .cp-pillar-roi {
    margin-top: 22px;
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 14px;
    border-radius: 999px;
    background: rgba(167, 139, 250, 0.08);
    border: 1px solid rgba(167, 139, 250, 0.24);
    color: var(--cp-violet);
    font-size: 13px;
    font-weight: 600;
  }
  .cp-pillar-roi-blip {
    width: 6px; height: 6px; border-radius: 999px;
    background: var(--cp-violet);
    box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.2);
  }
  .cp-pillar-grid {
    margin-top: 56px;
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
  }
  @media (min-width: 768px) { .cp-pillar-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (min-width: 1024px) { .cp-pillar-grid { grid-template-columns: repeat(4, 1fr); } }
  .cp-pf {
    padding: 22px;
    background: linear-gradient(180deg, rgba(35,35,63,0.5) 0%, rgba(16,16,35,0.5) 100%);
    border: 1px solid var(--cp-hairline);
    border-radius: 16px;
    backdrop-filter: blur(10px);
    transition: border-color 0.2s ease, transform 0.2s ease;
  }
  .cp-pf:hover { border-color: rgba(167, 139, 250, 0.28); transform: translateY(-2px); }
  .cp-pf-icon {
    width: 34px; height: 34px;
    border-radius: 10px;
    display: inline-flex; align-items: center; justify-content: center;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--cp-hairline-2);
    color: var(--cp-text);
  }
  .cp-pf-title {
    margin-top: 16px;
    font-size: 15.5px; font-weight: 700; color: var(--cp-text);
    letter-spacing: -0.012em;
  }
  .cp-pf-body {
    margin-top: 8px;
    font-size: 13.5px; color: var(--cp-text-2); line-height: 1.55;
  }

  /* ============== FINANCING MOCKUP ============== */
  .cp-fin-mockup {
    margin-top: 72px;
    position: relative;
    padding: 28px;
    border-radius: 28px;
    background:
      radial-gradient(50% 50% at 10% 10%, rgba(58, 58, 106, 0.3), transparent 70%),
      radial-gradient(40% 40% at 90% 90%, rgba(46, 46, 84, 0.22), transparent 70%),
      linear-gradient(180deg, rgba(35,35,63,0.6) 0%, rgba(16,16,35,0.6) 100%);
    border: 1px solid var(--cp-hairline-2);
    box-shadow:
      0 40px 100px -32px rgba(0, 0, 0, 0.65),
      inset 0 1px 0 rgba(255,255,255,0.06);
    backdrop-filter: blur(14px);
    overflow: hidden;
  }
  .cp-fin-mockup-bg {
    position: absolute; inset: 0; pointer-events: none;
    background-image:
      linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
    background-size: 32px 32px;
    mask-image: radial-gradient(ellipse at center, black 25%, transparent 70%);
    -webkit-mask-image: radial-gradient(ellipse at center, black 25%, transparent 70%);
  }
  .cp-fin-mockup-grid {
    position: relative;
    display: grid;
    grid-template-columns: 1fr;
    gap: 22px;
  }
  @media (min-width: 1024px) {
    .cp-fin-mockup-grid { grid-template-columns: 1.35fr 0.95fr; }
  }
  .cp-fin-offers {
    padding: 24px;
    background: linear-gradient(180deg, rgba(35,35,63,0.7) 0%, rgba(16,16,35,0.7) 100%);
    border: 1px solid var(--cp-hairline-2);
    border-radius: 18px;
    box-shadow: 0 18px 50px -22px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(12px);
  }
  .cp-fin-offers-head {
    display: flex; justify-content: space-between; align-items: flex-start; gap: 14px;
  }
  .cp-fin-offers-eyebrow {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.14em;
    color: var(--cp-text-2); font-weight: 700;
  }
  .cp-fin-offers-blip {
    width: 6px; height: 6px; border-radius: 999px;
    background: var(--cp-violet);
    box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.22);
    animation: cp-throb-violet 2.2s ease-in-out infinite;
  }
  .cp-fin-offers-title {
    margin-top: 4px;
    font-size: 16.5px; font-weight: 700; color: var(--cp-text);
    letter-spacing: -0.014em;
  }
  .cp-fin-offers-sub {
    margin-top: 2px;
    font-size: 12.5px; color: var(--cp-muted);
  }
  .cp-fin-offers-stamp {
    background: linear-gradient(180deg, #A78BFA 0%, #7C3AED 100%);
    color: #fff;
    font-size: 10.5px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.14em;
    padding: 5px 10px;
    border-radius: 999px;
    transform: rotate(2deg);
    box-shadow: 0 6px 20px -6px rgba(139, 92, 246, 0.55);
  }
  .cp-fin-offer-list {
    margin-top: 18px;
    display: grid;
    gap: 10px;
    perspective: 1200px;
    transform-style: preserve-3d;
  }
  .cp-fin-offer {
    position: relative;
    padding: 16px;
    border: 1px solid var(--cp-hairline);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.02);
    display: grid; grid-template-columns: 36px 1fr; gap: 14px; align-items: center;
    transform-style: preserve-3d;
    transition: transform 0.4s cubic-bezier(0.2,0.7,0.2,1), box-shadow 0.4s ease, border-color 0.3s ease;
  }
  .cp-fin-offer:nth-child(2) {
    box-shadow:
      inset 0 1px 0 rgba(0,0,0,0.18),
      inset 0 -1px 0 rgba(255,255,255,0.02),
      0 4px 12px -6px rgba(0, 0, 0, 0.3);
  }
  .cp-fin-offer:nth-child(3) {
    transform: translateZ(-14px);
    opacity: 0.92;
    box-shadow:
      inset 0 1px 2px rgba(0,0,0,0.28),
      inset 0 -1px 0 rgba(255,255,255,0.015),
      0 2px 8px -6px rgba(0, 0, 0, 0.2);
  }
  .cp-fin-offer:hover { transform: translateZ(18px) scale(1.012); }
  .cp-fin-offer--best {
    background: linear-gradient(180deg, rgba(167, 139, 250, 0.12) 0%, rgba(139, 92, 246, 0.06) 100%);
    border-color: rgba(167, 139, 250, 0.32);
    transform: translateZ(22px) scale(1.018);
    box-shadow:
      0 26px 56px -18px rgba(139, 92, 246, 0.46),
      0 8px 22px -6px rgba(0, 0, 0, 0.45),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }
  .cp-fin-offer--best:hover {
    transform: translateZ(32px) scale(1.025);
    box-shadow:
      0 32px 68px -18px rgba(139, 92, 246, 0.55),
      0 10px 26px -6px rgba(0, 0, 0, 0.5),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }
  .cp-fin-offer-rank {
    width: 36px; height: 36px;
    border-radius: 12px;
    display: inline-flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, #A78BFA 0%, #7C3AED 100%);
    color: #fff;
    font-size: 14px; font-weight: 700;
  }
  .cp-fin-offer-rank--alt {
    background: rgba(255, 255, 255, 0.04);
    color: var(--cp-text-2);
    border: 1px solid var(--cp-hairline-2);
  }
  .cp-fin-offer-grid {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
  }
  .cp-fin-offer-k {
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em;
    color: var(--cp-muted); font-weight: 600;
  }
  .cp-fin-offer-v {
    margin-top: 3px;
    font-size: 14px; font-weight: 700; color: var(--cp-text);
    font-variant-numeric: tabular-nums;
  }
  .cp-fin-offer-v--em {
    background: linear-gradient(135deg, #C4B5FD 0%, #A78BFA 100%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .cp-fin-offer-tag {
    position: absolute;
    top: 10px; right: 10px;
    font-size: 9.5px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.1em;
    padding: 4px 8px;
    border-radius: 999px;
  }
  .cp-fin-offer-tag--violet {
    background: rgba(167, 139, 250, 0.14);
    color: var(--cp-violet);
    border: 1px solid rgba(167, 139, 250, 0.32);
  }
  .cp-fin-offers-foot {
    margin-top: 18px;
    padding-top: 16px;
    border-top: 1px dashed var(--cp-hairline-2);
    display: flex; gap: 10px; flex-wrap: wrap;
  }
  .cp-fin-offers-foot-pill {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 11.5px;
    padding: 5px 10px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.03);
    color: var(--cp-text-2);
    border: 1px solid var(--cp-hairline-2);
  }
  .cp-fin-offers-foot-dot {
    width: 5px; height: 5px; border-radius: 999px;
    background: var(--cp-violet);
  }

  .cp-fin-side { display: grid; gap: 16px; }
  .cp-fin-promo {
    position: relative;
    padding: 22px;
    background: linear-gradient(180deg, #15152e 0%, #0a0a14 100%);
    border: 1px solid var(--cp-hairline-2);
    border-radius: 18px;
    color: var(--cp-text);
    overflow: hidden;
    box-shadow: 0 24px 60px -22px rgba(0, 0, 0, 0.6);
  }
  .cp-fin-promo-bar {
    position: absolute; left: 0; top: 0; bottom: 0; width: 4px;
    background: linear-gradient(180deg, var(--cp-violet) 0%, var(--cp-violet-dd) 100%);
  }
  .cp-fin-promo-eyebrow {
    font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.16em;
    color: var(--cp-text-2); font-weight: 700;
  }
  .cp-fin-promo-title {
    margin-top: 8px;
    font-size: 38px;
    line-height: 1.05;
    font-weight: 800;
    letter-spacing: -0.022em;
  }
  .cp-fin-promo-sub {
    font-size: 15px; font-weight: 500;
    color: var(--cp-text-2);
    letter-spacing: -0.01em;
  }
  .cp-fin-promo-stat {
    margin-top: 18px;
    display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--cp-hairline);
  }
  .cp-fin-promo-stat-v {
    font-size: 22px; font-weight: 700; color: var(--cp-text);
    font-variant-numeric: tabular-nums; letter-spacing: -0.018em;
  }
  .cp-fin-promo-stat-l {
    margin-top: 4px;
    font-size: 11.5px; color: var(--cp-muted);
    line-height: 1.45;
  }
  .cp-fin-marketplace {
    padding: 22px;
    background: linear-gradient(180deg, rgba(35,35,63,0.7) 0%, rgba(16,16,35,0.7) 100%);
    border: 1px solid var(--cp-hairline-2);
    border-radius: 18px;
    box-shadow: 0 18px 50px -24px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(10px);
  }
  .cp-fin-marketplace-head {
    display: flex; justify-content: space-between; align-items: center;
  }
  .cp-fin-marketplace-title {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.14em;
    color: var(--cp-text-2); font-weight: 700;
  }
  .cp-fin-marketplace-blip {
    width: 6px; height: 6px; border-radius: 999px;
    background: var(--cp-violet);
    box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.22);
    animation: cp-throb-violet 2s ease-in-out infinite;
  }
  .cp-fin-marketplace-sla {
    font-size: 11px; color: var(--cp-muted);
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--cp-hairline);
    padding: 4px 10px; border-radius: 999px;
    font-weight: 600;
  }
  .cp-fin-marketplace-bar {
    margin-top: 14px;
    display: grid;
    grid-template-columns: repeat(52, 1fr);
    gap: 2px;
    padding: 12px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--cp-hairline);
  }
  .cp-fin-marketplace-tick {
    height: 20px;
    border-radius: 3px;
    background: linear-gradient(180deg, rgba(167, 139, 250, 0.4), rgba(139, 92, 246, 0.25));
    animation:
      cp-tick 2.8s ease-in-out infinite,
      cp-tick-poll 6.4s linear infinite;
    opacity: 0.55;
    transform-origin: center;
  }
  .cp-fin-marketplace-tick--hot {
    background: linear-gradient(180deg, rgba(167, 139, 250, 1), rgba(139, 92, 246, 0.7));
    opacity: 1;
    box-shadow: 0 0 8px rgba(167, 139, 250, 0.5);
  }
  @keyframes cp-tick {
    0%, 100% { transform: scaleY(1); }
    50% { transform: scaleY(1.15); }
  }
  .cp-fin-marketplace-foot {
    margin-top: 14px;
    display: flex; justify-content: space-between; align-items: center;
    font-size: 12.5px; color: var(--cp-muted);
  }
  .cp-fin-marketplace-counter-v {
    font-weight: 700; color: var(--cp-text);
    font-variant-numeric: tabular-nums;
  }

  /* ============== AGENTIC LAYER ============== */
  .cp-agents {
    position: relative;
    padding: 128px 0 120px 0;
    background:
      radial-gradient(60% 50% at 50% 0%, rgba(58, 58, 106, 0.45), transparent 70%),
      radial-gradient(40% 40% at 85% 90%, rgba(46, 46, 84, 0.35), transparent 70%),
      var(--cp-panel);
    overflow: hidden;
    isolation: isolate;
    border-top: 1px solid var(--cp-hairline);
    border-bottom: 1px solid var(--cp-hairline);
  }
  .cp-agents-glow-1, .cp-agents-glow-2 {
    position: absolute; pointer-events: none; z-index: 0;
    border-radius: 999px;
    filter: blur(80px);
  }
  .cp-agents-glow-1 {
    top: -120px; left: -10%;
    width: 520px; height: 520px;
    background: radial-gradient(circle, rgba(139, 92, 246, 0.28), transparent 70%);
  }
  .cp-agents-glow-2 {
    bottom: -160px; right: -8%;
    width: 600px; height: 600px;
    background: radial-gradient(circle, rgba(58, 58, 106, 0.4), transparent 70%);
  }
  .cp-agents .cp-container { position: relative; z-index: 1; }

  .cp-agents-head { max-width: 920px; }

  .cp-agents-mosaic {
    margin-top: 56px;
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: 18px;
  }
  @media (max-width: 1023px) {
    .cp-agents-mosaic { grid-template-columns: 1fr; }
  }

  .cp-agent {
    position: relative;
    padding: 26px 26px 22px 26px;
    border-radius: 22px;
    background:
      linear-gradient(180deg, rgba(35,35,63,0.6) 0%, rgba(16,16,35,0.6) 100%);
    border: 1px solid var(--cp-hairline);
    box-shadow:
      0 30px 70px -32px rgba(0, 0, 0, 0.7),
      inset 0 1px 0 rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    overflow: hidden;
    transform-style: preserve-3d;
    transition:
      transform 0.32s cubic-bezier(0.2,0.7,0.2,1),
      border-color 0.25s ease,
      box-shadow 0.32s ease;
  }
  .cp-agent:hover {
    transform: translateZ(12px) translateY(-3px);
    border-color: rgba(167, 139, 250, 0.28);
    box-shadow:
      0 42px 95px -28px rgba(0, 0, 0, 0.85),
      0 24px 60px -14px rgba(167, 139, 250, 0.18),
      inset 0 1px 0 rgba(255, 255, 255, 0.07);
  }
  .cp-agent--span-7 { grid-column: span 7; }
  .cp-agent--span-5 { grid-column: span 5; }
  .cp-agent--span-12 { grid-column: span 12; }
  @media (max-width: 1023px) {
    .cp-agent--span-7,
    .cp-agent--span-5,
    .cp-agent--span-12 { grid-column: span 1; }
  }

  .cp-agent-split {
    display: grid;
    grid-template-columns: 5fr 7fr;
    gap: 24px;
    align-items: stretch;
  }
  @media (max-width: 1023px) {
    .cp-agent-split { grid-template-columns: 1fr; gap: 18px; }
  }
  .cp-agent-split-l { display: flex; flex-direction: column; }
  .cp-agent-split-r { display: flex; }

  /* ECHO live event stream */
  .cp-agent-stream {
    width: 100%;
    padding: 18px 18px 14px 18px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--cp-hairline);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }
  .cp-agent-stream-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
  }
  .cp-agent-stream-title {
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: var(--cp-text-2);
    font-weight: 600;
  }
  .cp-agent-stream-meta {
    font-size: 10.5px;
    color: var(--cp-muted);
    letter-spacing: 0.04em;
  }
  .cp-agent-stream-rows { display: flex; flex-direction: column; }
  .cp-agent-stream-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px dashed var(--cp-hairline);
    font-size: 12px;
  }
  .cp-agent-stream-row--last { border-bottom: none; }
  .cp-agent-stream-k { color: var(--cp-text-2); }
  .cp-agent-stream-v {
    color: var(--cp-text);
    font-weight: 600;
    text-align: right;
  }
  .cp-agent-stream-v--mute {
    color: var(--cp-muted);
    font-weight: 400;
  }

  /* Coordination layer pill */
  .cp-agents-coord {
    margin-top: 28px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
    padding: 18px 22px;
    border-radius: 20px;
    background:
      linear-gradient(180deg, rgba(35,35,63,0.65) 0%, rgba(16,16,35,0.65) 100%);
    border: 1px solid var(--cp-hairline-2);
    box-shadow:
      0 24px 60px -30px rgba(0, 0, 0, 0.6),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }
  @media (min-width: 768px) {
    .cp-agents-coord {
      flex-direction: row;
      align-items: center;
    }
  }
  .cp-agents-coord-l {
    display: inline-flex;
    align-items: center;
    gap: 14px;
  }
  .cp-agents-coord-icon {
    width: 38px; height: 38px;
    border-radius: 11px;
    display: inline-flex; align-items: center; justify-content: center;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--cp-hairline-2);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
    flex-shrink: 0;
  }
  .cp-agents-coord-eyebrow {
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: var(--cp-muted);
    font-weight: 600;
  }
  .cp-agents-coord-text {
    margin-top: 2px;
    color: var(--cp-text);
    font-weight: 600;
    font-size: 14px;
    letter-spacing: -0.005em;
    line-height: 1.4;
  }
  .cp-agents-coord-cta {
    align-self: flex-start;
  }
  @media (min-width: 768px) {
    .cp-agents-coord-cta { align-self: auto; }
  }

  .cp-agent-head {
    display: flex; align-items: flex-start; justify-content: space-between;
    gap: 14px;
  }
  .cp-agent-id { display: inline-flex; align-items: center; gap: 14px; }
  .cp-agent-icon {
    position: relative;
    width: 46px; height: 46px;
    border-radius: 13px;
    display: inline-flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, #2e2e54 0%, #1a1a2e 100%);
    border: 1px solid var(--cp-hairline-2);
    box-shadow:
      0 12px 28px -10px rgba(0, 0, 0, 0.6),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
    color: #fff;
  }
  .cp-agent-icon-blip {
    position: absolute;
    top: -3px; right: -3px;
    width: 9px; height: 9px;
    border-radius: 999px;
    background: var(--cp-violet);
    box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.22);
    animation: cp-throb-violet 2.4s ease-in-out infinite;
  }
  .cp-agent-num {
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: var(--cp-muted);
    font-weight: 600;
  }
  .cp-agent-name {
    margin: 3px 0 0 0;
    font-size: 22px;
    font-weight: 700;
    color: var(--cp-text);
    letter-spacing: -0.014em;
    line-height: 1.1;
  }
  .cp-agent-role {
    color: var(--cp-muted);
    font-weight: 400;
    font-size: 15px;
    letter-spacing: -0.005em;
  }
  .cp-agent-status {
    display: inline-flex; align-items: center; gap: 7px;
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: var(--cp-text-2);
    font-weight: 600;
    white-space: nowrap;
    padding-top: 6px;
  }
  .cp-agent-status-dot {
    width: 6px; height: 6px;
    border-radius: 999px;
    background: var(--cp-violet);
    box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.22);
    animation: cp-throb-violet 2s ease-in-out infinite;
  }
  .cp-agent-status-dot--learning {
    background: var(--cp-text-2);
    box-shadow: 0 0 0 3px rgba(185, 185, 199, 0.18);
  }
  .cp-agent-desc {
    margin: 22px 0 0 0;
    font-size: 14px;
    line-height: 1.62;
    color: var(--cp-text-2);
    letter-spacing: -0.003em;
  }

  .cp-agent-stats {
    margin-top: 20px;
    display: grid;
    gap: 10px;
  }
  .cp-agent-stats--2 { grid-template-columns: repeat(2, 1fr); }
  .cp-agent-stats--3 { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 480px) {
    .cp-agent-stats--3 { grid-template-columns: repeat(2, 1fr); }
    .cp-ticker-cell { padding: 22px 14px; }
    .cp-ticker-v { font-size: 26px; }
    .cp-ticker-l { font-size: 12.5px; }
    .cp-ticker-d { font-size: 10.5px; }
    .cp-nav-cta .cp-btn--ghost { display: none; }
    .cp-nav-cta { gap: 6px; }
    .cp-nav .cp-btn { padding: 8px 12px; font-size: 13px; }
    .cp-nav .cp-btn svg { width: 14px; height: 14px; }
  }
  .cp-agent-stat {
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--cp-hairline);
    border-radius: 10px;
  }
  .cp-agent-stat-k {
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--cp-muted);
    font-weight: 600;
  }
  .cp-agent-stat-v {
    margin-top: 4px;
    font-size: 15px;
    font-weight: 700;
    color: var(--cp-text);
    letter-spacing: -0.014em;
    font-variant-numeric: tabular-nums;
  }

  .cp-agent-log {
    margin-top: 20px;
    padding-top: 14px;
    border-top: 1px dashed var(--cp-hairline);
    font-size: 11.5px;
    color: var(--cp-muted);
    line-height: 1.55;
    letter-spacing: -0.003em;
  }
  .cp-agent-log-label {
    color: var(--cp-text);
    font-weight: 600;
  }

  .cp-agents-foot {
    margin-top: 36px;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--cp-hairline);
    color: var(--cp-text-2);
    font-size: 12.5px;
    letter-spacing: -0.005em;
    max-width: 100%;
    flex-wrap: wrap;
  }
  .cp-agents-foot-dot {
    width: 6px; height: 6px;
    border-radius: 999px;
    background: var(--cp-violet);
    box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.22);
    animation: cp-throb-violet 2.4s ease-in-out infinite;
    flex-shrink: 0;
  }

  /* ============== ROI CALCULATOR ============== */
  .cp-roi { padding: 112px 0; position: relative; background: var(--cp-bg); }
  .cp-roi-card {
    margin-top: 56px;
    padding: 28px;
    border-radius: 24px;
    background:
      radial-gradient(40% 30% at 10% 10%, rgba(58, 58, 106, 0.3), transparent 70%),
      linear-gradient(180deg, rgba(35,35,63,0.6) 0%, rgba(16,16,35,0.6) 100%);
    border: 1px solid var(--cp-hairline-2);
    backdrop-filter: blur(14px);
    box-shadow:
      0 40px 100px -32px rgba(0, 0, 0, 0.6),
      inset 0 1px 0 rgba(255,255,255,0.05);
  }
  .cp-roi-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 32px;
  }
  @media (min-width: 1024px) {
    .cp-roi-grid { grid-template-columns: 0.95fr 1.05fr; }
  }
  .cp-roi-inputs { display: grid; gap: 22px; }
  .cp-slider { padding: 14px 0; }
  .cp-slider-head {
    display: flex; justify-content: space-between; align-items: baseline;
    margin-bottom: 10px;
  }
  .cp-slider-label {
    font-size: 13px; color: var(--cp-muted);
    text-transform: uppercase; letter-spacing: 0.1em;
    font-weight: 600;
  }
  .cp-slider-value {
    font-size: 22px; font-weight: 700; color: var(--cp-text);
    font-variant-numeric: tabular-nums; letter-spacing: -0.018em;
  }
  .cp-slider-input {
    width: 100%;
    -webkit-appearance: none;
    appearance: none;
    height: 6px;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--cp-faded) 0%, var(--cp-violet) 70%, var(--cp-violet-dd) 100%);
    outline: none;
    cursor: pointer;
  }
  .cp-slider-input::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px; height: 20px;
    border-radius: 999px;
    background: #fff;
    border: 2px solid var(--cp-violet);
    box-shadow: 0 6px 16px -4px rgba(139, 92, 246, 0.55);
    cursor: pointer;
  }
  .cp-slider-input::-moz-range-thumb {
    width: 20px; height: 20px;
    border-radius: 999px;
    background: #fff;
    border: 2px solid var(--cp-violet);
    box-shadow: 0 6px 16px -4px rgba(139, 92, 246, 0.55);
    cursor: pointer;
  }
  .cp-roi-output {
    padding: 32px;
    border-radius: 20px;
    background: linear-gradient(180deg, #15152e 0%, #0a0a14 100%);
    color: var(--cp-text);
    position: relative;
    overflow: hidden;
    border: 1px solid var(--cp-hairline-2);
    box-shadow: 0 30px 70px -22px rgba(0, 0, 0, 0.7);
    transition: box-shadow 0.4s ease;
  }
  .cp-roi-output::before {
    content: "";
    position: absolute; inset: 0;
    background: radial-gradient(60% 60% at 50% 0%, rgba(139, 92, 246, 0.28), transparent 70%);
    pointer-events: none;
  }
  .cp-roi-output--glow {
    box-shadow:
      0 0 0 4px rgba(167, 139, 250, 0.18),
      0 0 60px rgba(139, 92, 246, 0.32),
      0 30px 80px -22px rgba(139, 92, 246, 0.4);
  }
  .cp-roi-out-label {
    position: relative;
    font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.16em;
    color: var(--cp-violet); font-weight: 700;
  }
  .cp-roi-out-sub {
    position: relative;
    font-size: 13px; color: var(--cp-muted);
    margin-top: 4px;
  }
  .cp-roi-out-value {
    position: relative;
    margin-top: 18px;
    font-size: 64px;
    line-height: 1.02;
    font-weight: 800;
    letter-spacing: -0.03em;
    background: linear-gradient(180deg, #ffffff 0%, #b9b9c7 100%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
    font-variant-numeric: tabular-nums;
  }
  @media (max-width: 768px) { .cp-roi-out-value { font-size: 48px; } }
  .cp-roi-out-stats {
    position: relative;
    margin-top: 28px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
    padding-top: 22px;
    border-top: 1px solid var(--cp-hairline);
  }
  .cp-roi-out-stats--3 { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 640px) {
    .cp-roi-out-stats--3 { grid-template-columns: 1fr; }
  }
  .cp-roi-out-disclaimer {
    position: relative;
    margin-top: 18px;
    padding-top: 14px;
    border-top: 1px dashed var(--cp-hairline);
    font-size: 11px;
    line-height: 1.5;
    color: var(--cp-muted);
    letter-spacing: -0.003em;
  }
  .cp-roi-out-stat-v {
    font-size: 22px; font-weight: 700; color: var(--cp-text);
    font-variant-numeric: tabular-nums;
  }
  .cp-roi-out-stat-l {
    margin-top: 4px;
    font-size: 11.5px; color: var(--cp-muted);
    line-height: 1.45;
  }
  .cp-roi-cta { position: relative; margin-top: 22px; width: 100%; }

  /* ============== STORIES ============== */
  .cp-stories { padding: 112px 0; background: var(--cp-bg); }
  .cp-stories-grid {
    margin-top: 56px;
    display: grid;
    grid-template-columns: 1fr;
    gap: 18px;
  }
  @media (min-width: 1024px) {
    .cp-stories-grid { grid-template-columns: repeat(3, 1fr); }
  }
  .cp-story-card {
    position: relative;
    padding: 28px;
    border-radius: 20px;
    background: linear-gradient(180deg, rgba(35,35,63,0.5) 0%, rgba(16,16,35,0.5) 100%);
    border: 1px solid var(--cp-hairline);
    backdrop-filter: blur(12px);
    box-shadow: 0 18px 50px -24px rgba(0, 0, 0, 0.5);
    display: flex; flex-direction: column;
    transform-style: preserve-3d;
    transition:
      transform 0.4s cubic-bezier(0.2,0.7,0.2,1),
      box-shadow 0.4s ease,
      border-color 0.3s ease;
  }
  .cp-story-card:hover {
    transform: rotateY(-2deg) rotateX(1deg) translateY(-4px);
    box-shadow:
      0 36px 80px -22px rgba(0, 0, 0, 0.7),
      -14px 24px 48px -20px rgba(139, 92, 246, 0.36);
    border-color: rgba(167, 139, 250, 0.32);
  }
  .cp-story-quote-mark {
    font-size: 56px;
    line-height: 1;
    color: rgba(167, 139, 250, 0.18);
    font-family: inherit;
    margin-bottom: -16px;
  }
  .cp-story-quote {
    font-size: 15.5px;
    line-height: 1.6;
    color: var(--cp-text-2);
    margin: 0;
    flex: 1;
  }
  .cp-story-foot {
    margin-top: 24px;
    padding-top: 18px;
    border-top: 1px solid var(--cp-hairline);
    display: flex; justify-content: space-between; align-items: center;
    gap: 16px;
  }
  .cp-story-name {
    font-size: 13.5px; font-weight: 700; color: var(--cp-text);
  }
  .cp-story-role {
    font-size: 11.5px; color: var(--cp-muted); margin-top: 2px;
  }
  .cp-story-outcomes { display: flex; gap: 14px; }
  .cp-story-outcome-v {
    font-size: 17px; font-weight: 700; color: var(--cp-violet);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.014em;
  }
  .cp-story-outcome-l {
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em;
    color: var(--cp-muted); margin-top: 2px;
  }

  /* ============== INTEGRATIONS ============== */
  .cp-integrations { padding: 80px 0; background: var(--cp-bg); }
  .cp-integrations-head { max-width: 720px; margin-bottom: 40px; }

  /* ============== FAQ ============== */
  .cp-faq { padding: 112px 0; background: var(--cp-bg); }
  .cp-faq-list {
    margin-top: 48px;
    display: grid;
    gap: 12px;
  }
  .cp-faq-item {
    text-align: left;
    background: linear-gradient(180deg, rgba(35,35,63,0.5) 0%, rgba(16,16,35,0.5) 100%);
    border: 1px solid var(--cp-hairline);
    border-radius: 16px;
    padding: 22px 24px;
    cursor: pointer;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
    width: 100%;
    font-family: inherit;
    backdrop-filter: blur(10px);
    color: var(--cp-text);
  }
  .cp-faq-item:hover { border-color: rgba(167, 139, 250, 0.26); }
  .cp-faq-item--open {
    background: linear-gradient(180deg, rgba(58,40,110,0.25) 0%, rgba(35,35,63,0.5) 100%);
    border-color: rgba(167, 139, 250, 0.32);
    box-shadow: 0 18px 50px -22px rgba(139, 92, 246, 0.28);
  }
  .cp-faq-q {
    display: flex; justify-content: space-between; align-items: center;
    font-size: 16px; font-weight: 700; color: var(--cp-text);
    letter-spacing: -0.014em;
    gap: 14px;
  }
  .cp-faq-toggle {
    color: var(--cp-violet);
    transition: transform 0.2s ease;
  }
  .cp-faq-item--open .cp-faq-toggle { transform: rotate(180deg); }
  .cp-faq-a {
    visibility: hidden; opacity: 0;
    max-height: 0;
    font-size: 14.5px;
    line-height: 1.6;
    color: var(--cp-text-2);
    transition: opacity 0.25s ease, max-height 0.35s ease, margin-top 0.25s ease, visibility 0s linear 0.3s;
    padding: 0;
  }
  .cp-faq-item--open .cp-faq-a {
    visibility: visible; opacity: 1;
    max-height: 320px;
    margin-top: 14px;
    transition: opacity 0.25s ease, max-height 0.45s ease, margin-top 0.25s ease, visibility 0s;
  }

  /* ============== CARD STACKING ============== */
  .cp-cardstack {
    padding: 112px 0;
    background:
      radial-gradient(50% 40% at 90% 30%, rgba(58, 58, 106, 0.32), transparent 70%),
      radial-gradient(30% 30% at 10% 80%, rgba(139, 92, 246, 0.12), transparent 70%),
      var(--cp-bg);
    border-top: 1px solid var(--cp-hairline);
    border-bottom: 1px solid var(--cp-hairline);
    position: relative;
  }
  .cp-cardstack-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 56px;
    align-items: center;
  }
  @media (min-width: 1024px) {
    .cp-cardstack-grid { grid-template-columns: 1.1fr 0.9fr; gap: 72px; }
  }
  .cp-cardstack-bullets {
    margin-top: 28px;
    display: grid;
    gap: 14px;
  }
  .cp-cardstack-bullet {
    display: grid;
    grid-template-columns: 14px 1fr;
    gap: 12px;
    align-items: flex-start;
    font-size: 14.5px;
    color: var(--cp-text-2);
    line-height: 1.55;
  }
  .cp-cardstack-bullet-dot {
    width: 8px; height: 8px;
    border-radius: 999px;
    background: var(--cp-violet);
    box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.16);
    margin-top: 7px;
  }

  /* Card fan illustration */
  .cp-card-fan {
    position: relative;
    height: 360px;
    perspective: 1400px;
    perspective-origin: 50% 50%;
    transform-style: preserve-3d;
  }
  @media (max-width: 1023px) {
    .cp-card-fan { max-width: 480px; margin: 0 auto; }
  }
  .cp-card-fan-glow {
    position: absolute;
    inset: 10% 8%;
    border-radius: 30px;
    background: radial-gradient(ellipse at center, rgba(139, 92, 246, 0.22), transparent 70%);
    filter: blur(40px);
    pointer-events: none;
  }
  .cp-card-fan-card {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 280px;
    height: 170px;
    border-radius: 18px;
    border: 1px solid var(--cp-hairline-2);
    background:
      linear-gradient(135deg, rgba(58, 40, 110, 0.5) 0%, rgba(35, 35, 63, 0.7) 50%, rgba(16, 16, 35, 0.85) 100%);
    box-shadow:
      0 24px 56px -22px rgba(0, 0, 0, 0.75),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    transform-style: preserve-3d;
    transform-origin: center bottom;
    will-change: transform;
    transition: transform 0.45s cubic-bezier(0.2,0.7,0.2,1), box-shadow 0.45s ease;
  }
  .cp-card-fan-card--3 {
    transform: translate(-50%, -50%) translateX(-110px) rotate(-14deg) translateZ(-30px);
    opacity: 0.7;
    z-index: 1;
  }
  .cp-card-fan-card--2 {
    transform: translate(-50%, -50%) translateX(-50px) rotate(-7deg) translateZ(-15px);
    opacity: 0.85;
    z-index: 2;
  }
  .cp-card-fan-card--1 {
    transform: translate(-50%, -50%) translateX(40px) rotate(6deg) translateZ(0);
    opacity: 0.92;
    z-index: 3;
  }
  .cp-card-fan-card--primary {
    width: 320px;
    height: 200px;
    transform: translate(-50%, -50%) translateZ(40px);
    background:
      linear-gradient(135deg, rgba(167, 139, 250, 0.18) 0%, rgba(58, 40, 110, 0.5) 60%, rgba(16, 16, 35, 0.9) 100%);
    border-color: rgba(167, 139, 250, 0.36);
    box-shadow:
      0 36px 88px -28px rgba(0, 0, 0, 0.85),
      0 24px 56px -16px rgba(139, 92, 246, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
    padding: 22px;
    z-index: 4;
  }
  .cp-card-fan:hover .cp-card-fan-card--3 {
    transform: translate(-50%, -50%) translateX(-130px) rotate(-18deg) translateZ(-30px);
  }
  .cp-card-fan:hover .cp-card-fan-card--2 {
    transform: translate(-50%, -50%) translateX(-65px) rotate(-10deg) translateZ(-15px);
  }
  .cp-card-fan:hover .cp-card-fan-card--1 {
    transform: translate(-50%, -50%) translateX(55px) rotate(9deg) translateZ(0);
  }
  .cp-card-fan-band {
    position: absolute;
    left: 0; right: 0; top: 24px;
    height: 28px;
    background: linear-gradient(90deg, rgba(0, 0, 0, 0.45) 0%, rgba(0, 0, 0, 0.6) 100%);
  }
  .cp-card-fan-stripe {
    position: absolute;
    left: 18px; bottom: 22px;
    width: 64px; height: 32px;
    border-radius: 6px;
    background:
      linear-gradient(135deg, rgba(255, 215, 100, 0.85) 0%, rgba(180, 140, 60, 0.7) 100%);
    box-shadow: 0 6px 14px -6px rgba(0, 0, 0, 0.5);
  }
  .cp-card-fan-bnpl {
    position: absolute;
    right: 16px; bottom: 18px;
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--cp-text-2);
    font-weight: 600;
  }
  .cp-card-fan-primary-eyebrow {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--cp-violet);
    font-weight: 700;
  }
  .cp-card-fan-blip {
    width: 6px; height: 6px; border-radius: 999px;
    background: var(--cp-violet);
    box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.22);
    animation: cp-throb-violet 2s ease-in-out infinite;
  }
  .cp-card-fan-primary-amount {
    margin-top: 12px;
    font-size: 36px;
    font-weight: 800;
    letter-spacing: -0.022em;
    background: linear-gradient(180deg, #fff 0%, #b9b9c7 100%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
    font-variant-numeric: tabular-nums;
  }
  .cp-card-fan-primary-sub {
    margin-top: 4px;
    font-size: 12.5px;
    color: var(--cp-text-2);
  }
  .cp-card-fan-primary-foot {
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px dashed var(--cp-hairline-2);
  }
  .cp-card-fan-primary-pill {
    display: inline-flex; align-items: center;
    padding: 5px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    background: rgba(167, 139, 250, 0.14);
    color: var(--cp-violet);
    border: 1px solid rgba(167, 139, 250, 0.32);
  }

  /* ============== QUALIFIED BUYERS · DECISION TREE ============== */
  .cp-qual {
    position: relative;
    padding: 128px 0;
    background:
      radial-gradient(50% 40% at 50% 0%, rgba(58, 58, 106, 0.32), transparent 70%),
      var(--cp-panel);
    border-top: 1px solid var(--cp-hairline);
    border-bottom: 1px solid var(--cp-hairline);
    overflow: hidden;
    isolation: isolate;
  }
  .cp-ambient-grid--qual {
    background-image:
      linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
  }
  .cp-qual-glow {
    position: absolute;
    top: 20%; left: 50%;
    width: 600px; height: 600px;
    margin-left: -300px;
    border-radius: 999px;
    background: radial-gradient(circle, rgba(139, 92, 246, 0.18), transparent 70%);
    filter: blur(80px);
    pointer-events: none;
    z-index: 0;
  }
  .cp-qual .cp-container { position: relative; z-index: 1; }

  /* Tree wrap with perspective tilt */
  .cp-qual-tree {
    margin-top: 56px;
    perspective: 1400px;
    perspective-origin: 50% 50%;
  }
  .cp-qual-tree-wrap {
    position: relative;
    max-width: 880px;
    margin: 0 auto;
    aspect-ratio: 880 / 720;
    transform: rotateX(8deg);
    transform-origin: 50% 60%;
  }
  @media (max-width: 768px) {
    .cp-qual-tree-wrap { transform: none; aspect-ratio: 480 / 760; }
  }
  .cp-qual-tree-svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  @media (max-width: 768px) {
    .cp-qual-tree-svg { display: none; }
  }
  .cp-qual-pulse {
    filter: drop-shadow(0 0 8px rgba(167, 139, 250, 0.85));
  }

  .cp-qual-node {
    position: absolute;
    transform: translate(-50%, -50%);
    width: 220px;
    padding: 12px 14px;
    border-radius: 14px;
    background: linear-gradient(180deg, rgba(35,35,63,0.85) 0%, rgba(16,16,35,0.85) 100%);
    border: 1px solid var(--cp-hairline-2);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    box-shadow: 0 18px 50px -22px rgba(0, 0, 0, 0.6);
    text-align: center;
    transition: transform 0.28s ease, box-shadow 0.28s ease, border-color 0.28s ease;
  }
  @media (max-width: 768px) {
    .cp-qual-node {
      position: relative;
      transform: none;
      left: 0 !important; top: 0 !important;
      width: 100%;
      margin: 0 auto 12px auto;
    }
  }
  .cp-qual-node:hover {
    transform: translate(-50%, -50%) translateY(-2px);
    border-color: rgba(167, 139, 250, 0.36);
    box-shadow: 0 24px 60px -22px rgba(139, 92, 246, 0.3);
  }
  @media (max-width: 768px) {
    .cp-qual-node:hover { transform: none; }
  }
  .cp-qual-node-code {
    font-size: 13px;
    font-weight: 700;
    color: var(--cp-text);
    letter-spacing: -0.005em;
  }
  .cp-qual-node-label {
    margin-top: 3px;
    font-size: 11px;
    color: var(--cp-muted);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .cp-qual-node--agent .cp-qual-node-code {
    background: linear-gradient(135deg, #C4B5FD 0%, #A78BFA 60%, #8B5CF6 100%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
    letter-spacing: 0.02em;
  }
  .cp-qual-node--data {
    background: linear-gradient(180deg, rgba(20,20,38,0.85) 0%, rgba(10,10,20,0.85) 100%);
    width: 180px;
  }
  .cp-qual-node--route {
    background: linear-gradient(180deg, rgba(35,35,63,0.65) 0%, rgba(16,16,35,0.65) 100%);
    width: 200px;
  }
  .cp-qual-node--highlight {
    background: linear-gradient(180deg, rgba(58,40,110,0.6) 0%, rgba(35,35,63,0.8) 100%);
    border-color: rgba(167, 139, 250, 0.42);
    box-shadow:
      0 24px 60px -18px rgba(139, 92, 246, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }
  .cp-qual-node--highlight .cp-qual-node-code {
    background: linear-gradient(135deg, #C4B5FD 0%, #A78BFA 100%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .cp-qual-tree-foot {
    margin-top: 36px;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--cp-hairline);
    color: var(--cp-text-2);
    font-size: 12.5px;
    letter-spacing: -0.005em;
  }
  .cp-qual-tree-foot-dot {
    width: 6px; height: 6px;
    border-radius: 999px;
    background: var(--cp-violet);
    box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.22);
    animation: cp-throb-violet 2.4s ease-in-out infinite;
  }

  /* Time math callout */
  .cp-qual-math {
    margin-top: 72px;
    display: grid;
    grid-template-columns: 1fr;
    gap: 36px;
    padding: 36px;
    border-radius: 24px;
    background: linear-gradient(180deg, rgba(35,35,63,0.55) 0%, rgba(16,16,35,0.55) 100%);
    border: 1px solid var(--cp-hairline-2);
    backdrop-filter: blur(14px);
    box-shadow: 0 24px 70px -28px rgba(0, 0, 0, 0.55);
  }
  @media (min-width: 1024px) {
    .cp-qual-math { grid-template-columns: 1.05fr 0.95fr; align-items: center; gap: 48px; }
  }
  .cp-qual-math-head .cp-h3 {
    margin-top: 14px;
    max-width: 520px;
  }
  .cp-qual-math-body {
    margin-top: 14px;
    font-size: 15px;
    line-height: 1.6;
    color: var(--cp-text-2);
    max-width: 540px;
  }
  .cp-qual-math-tiles {
    display: grid;
    gap: 12px;
  }
  @media (min-width: 480px) {
    .cp-qual-math-tiles { grid-template-columns: repeat(3, 1fr); }
  }
  @media (min-width: 1024px) {
    .cp-qual-math-tiles { grid-template-columns: 1fr; }
  }
  .cp-qual-math-tile {
    padding: 16px 18px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--cp-hairline);
  }
  .cp-qual-math-tile-v {
    font-size: 18px;
    font-weight: 700;
    color: var(--cp-text);
    letter-spacing: -0.014em;
  }
  .cp-qual-math-tile-l {
    margin-top: 4px;
    font-size: 12px;
    color: var(--cp-muted);
    line-height: 1.45;
  }

  /* Pixel feedback loop */
  .cp-qual-loop {
    margin-top: 48px;
    padding: 36px;
    border-radius: 24px;
    background:
      radial-gradient(40% 30% at 100% 0%, rgba(58, 58, 106, 0.32), transparent 70%),
      linear-gradient(180deg, rgba(35,35,63,0.55) 0%, rgba(16,16,35,0.55) 100%);
    border: 1px solid var(--cp-hairline-2);
    backdrop-filter: blur(14px);
    box-shadow: 0 24px 70px -28px rgba(0, 0, 0, 0.55);
  }
  .cp-qual-loop-eyebrow {
    display: inline-flex; align-items: center; gap: 8px;
    font-size: 11px; font-weight: 600; letter-spacing: 0.16em;
    color: var(--cp-text-2);
    text-transform: uppercase;
  }
  .cp-qual-loop-grid {
    margin-top: 24px;
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
  }
  @media (min-width: 768px) {
    .cp-qual-loop-grid { grid-template-columns: repeat(3, 1fr); }
  }
  .cp-qual-loop-step {
    padding: 22px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--cp-hairline);
  }
  .cp-qual-loop-step-n {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 999px;
    background: rgba(167, 139, 250, 0.14);
    color: var(--cp-violet);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
  }
  .cp-qual-loop-step-t {
    margin-top: 14px;
    font-size: 15px;
    font-weight: 700;
    color: var(--cp-text);
    letter-spacing: -0.012em;
  }
  .cp-qual-loop-step-b {
    margin-top: 8px;
    font-size: 13.5px;
    line-height: 1.55;
    color: var(--cp-text-2);
  }

  /* ============== SYNERGY CALLOUT ============== */
  .cp-synergy {
    padding: 80px 0 32px 0;
    background: var(--cp-bg);
  }
  .cp-synergy-card {
    padding: 36px;
    border-radius: 24px;
    background:
      radial-gradient(40% 50% at 100% 0%, rgba(58, 40, 110, 0.32), transparent 70%),
      radial-gradient(30% 40% at 0% 100%, rgba(58, 58, 106, 0.22), transparent 70%),
      linear-gradient(180deg, rgba(35,35,63,0.6) 0%, rgba(16,16,35,0.6) 100%);
    border: 1px solid var(--cp-hairline-2);
    backdrop-filter: blur(14px);
    box-shadow: 0 30px 80px -28px rgba(0, 0, 0, 0.6);
  }
  .cp-synergy-eyebrow {
    display: inline-flex; align-items: center; gap: 8px;
    font-size: 11px; font-weight: 600; letter-spacing: 0.16em;
    color: var(--cp-text-2);
    text-transform: uppercase;
    margin-bottom: 18px;
  }
  .cp-synergy-h3 {
    font-size: 30px;
    line-height: 1.18;
    letter-spacing: -0.018em;
    font-weight: 700;
    color: var(--cp-text);
    max-width: 920px;
  }
  @media (max-width: 768px) {
    .cp-synergy-h3 { font-size: 24px; }
  }
  .cp-synergy-body {
    margin-top: 18px;
    font-size: 15.5px;
    line-height: 1.65;
    color: var(--cp-text-2);
    max-width: 880px;
  }

  /* ============== FINAL CTA ============== */
  .cp-final {
    padding: 128px 0;
    background:
      radial-gradient(60% 60% at 50% 0%, rgba(139, 92, 246, 0.32), transparent 70%),
      radial-gradient(30% 25% at 80% 90%, rgba(58, 58, 106, 0.4), transparent 70%),
      var(--cp-panel-2);
    color: var(--cp-text);
    position: relative;
    overflow: hidden;
    text-align: center;
    border-top: 1px solid var(--cp-hairline);
  }
  .cp-final-glow-1, .cp-final-glow-2 {
    position: absolute; pointer-events: none; z-index: 0;
    border-radius: 999px;
    filter: blur(80px);
  }
  .cp-final-glow-1 {
    top: -150px; left: 30%;
    width: 400px; height: 400px;
    background: radial-gradient(circle, rgba(139, 92, 246, 0.32), transparent 70%);
  }
  .cp-final-glow-2 {
    bottom: -120px; right: 10%;
    width: 320px; height: 320px;
    background: radial-gradient(circle, rgba(46, 46, 84, 0.5), transparent 70%);
  }
  .cp-final-inner { position: relative; z-index: 1; }
  .cp-final-eyebrow {
    display: inline-flex; align-items: center; gap: 8px;
    font-size: 11px; letter-spacing: 0.16em; font-weight: 600;
    color: var(--cp-text-2);
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--cp-hairline-2);
    padding: 6px 14px;
    border-radius: 999px;
    text-transform: uppercase;
  }
  .cp-final-dot {
    width: 6px; height: 6px; border-radius: 999px;
    background: var(--cp-violet);
    box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.22);
    animation: cp-throb-violet 2.4s ease-in-out infinite;
  }
  .cp-final-h2 {
    margin-top: 24px;
    font-size: 64px;
    font-weight: 800;
    letter-spacing: -0.028em;
    line-height: 1.04;
    max-width: 920px;
    margin-left: auto; margin-right: auto;
    background: linear-gradient(180deg, #ffffff 0%, #b9b9c7 100%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  @media (max-width: 768px) { .cp-final-h2 { font-size: 44px; } }
  @media (max-width: 480px) { .cp-final-h2 { font-size: 34px; } }
  .cp-final-sub {
    margin: 22px auto 0 auto;
    font-size: 17.5px;
    line-height: 1.6;
    color: var(--cp-text-2);
    max-width: 640px;
  }
  .cp-final-ctas {
    margin-top: 36px;
    display: flex; gap: 12px; flex-wrap: wrap;
    justify-content: center;
  }

  /* ============== FOOTER ============== */
  .cp-footer {
    background: var(--cp-bg);
    color: var(--cp-muted);
    padding: 28px 0;
    border-top: 1px solid var(--cp-hairline);
  }
  .cp-footer-inner {
    display: flex; justify-content: space-between; align-items: center;
    gap: 24px; flex-wrap: wrap;
    font-size: 13px;
  }
  .cp-footer-brand {
    display: inline-flex; align-items: center; gap: 8px;
    color: var(--cp-text); font-weight: 700;
  }
  .cp-footer-legal {
    display: inline-flex; gap: 18px; flex-wrap: wrap; align-items: center;
  }
  .cp-footer-legal a {
    color: var(--cp-muted);
    text-decoration: none;
    transition: color 0.15s ease;
  }
  .cp-footer-legal a:hover { color: var(--cp-text); }

  /* ============== RESPONSIVE ============== */
  @media (max-width: 768px) {
    .cp-h2 { font-size: 32px; }
    .cp-pillar { padding: 80px 0; }
    .cp-stories, .cp-faq, .cp-roi, .cp-how { padding: 80px 0; }
    .cp-fin-mockup { padding: 18px; }
    .cp-fin-marketplace-bar { grid-template-columns: repeat(26, 1fr); }
    .cp-pillar-number { font-size: 64px; }
    .cp-compare-stat { grid-template-columns: 100px 1fr; gap: 12px; }
    .cp-compare-stat-v { font-size: 24px; }
    .cp-final-eyebrow { font-size: 10px; letter-spacing: 0.12em; }
    .cp-fin-offer { grid-template-columns: 28px 1fr; gap: 10px; padding: 12px; }
    .cp-fin-offer-grid { grid-template-columns: repeat(2, 1fr); gap: 6px; }
    .cp-fin-offer-tag { position: static; margin-top: 6px; }
    .cp-story-foot { flex-direction: column; align-items: flex-start; }
    .cp-agents { padding: 88px 0 80px 0; }
    .cp-agent { padding: 22px 22px 18px 22px; }
    .cp-agent-name { font-size: 19px; }
    .cp-agent-role { font-size: 13px; }
  }
  @media (max-width: 480px) {
    .cp-container { padding: 0 16px; }
    .cp-hero { padding: 128px 0 48px 0; }
    .cp-hero-stats { grid-template-columns: 1fr; }
    .cp-hero-card { padding: 18px; }
    .cp-card-amount-n { font-size: 40px; }
    .cp-fin-mockup { padding: 14px; }
    .cp-fin-promo-title { font-size: 30px; }
    .cp-roi-out-value { font-size: 40px; }
    .cp-final-h2 { font-size: 30px; }
    .cp-hero-ring, .cp-final-ring { display: none; }
  }

  /* ============== PREFERS-REDUCED-MOTION ============== */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.001ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.001ms !important;
      scroll-behavior: auto !important;
    }
    .cp-hero-card,
    .cp-chip,
    .cp-chip--violet,
    .cp-hero-ring,
    .cp-final-ring,
    .cp-agent-icon,
    .cp-fin-marketplace-tick,
    .cp-agent-stream-row,
    .cp-eyebrow-dot,
    .cp-card-blip,
    .cp-fin-offers-blip,
    .cp-fin-marketplace-blip,
    .cp-agent-icon-blip,
    .cp-agent-status-dot,
    .cp-agents-foot-dot,
    .cp-final-dot,
    .cp-qual-pulse,
    .cp-card-fan-card {
      animation: none !important;
    }
    .cp-hero-card-wrap:hover .cp-hero-card,
    .cp-agent:hover,
    .cp-ticker-cell:hover,
    .cp-story-card:hover,
    .cp-fin-offer:hover,
    .cp-fin-offer--best:hover,
    .cp-qual-node:hover,
    .cp-card-fan:hover .cp-card-fan-card {
      transform: none !important;
    }
    .cp-waterfall-pulse { display: none !important; }
    .cp-chip--violet::after { display: none !important; }
  }
`;
