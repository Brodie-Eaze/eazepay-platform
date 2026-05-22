/**
 * EZ Check · Landing page (root "/" of the standalone ez-check app).
 *
 * Marketing surface for the standalone pre-qualification product. The
 * whole ez-check app is its own deployable — separate Railway service,
 * separate domain. Funnel:
 *
 *   /  →  /sales  →  /checkout  →  /onboarding
 *
 * The public copy here deliberately does NOT name the back-office
 * SaaS systems that the qualified-buyer payload is forwarded to
 * during onboarding — those are internal wiring details that change
 * over time without changing the product story.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { EZ_CHECK_COPY, EZ_CHECK_MODULES } from '../lib/ez-check-theme';

/* ----------------------------- copy / config ---------------------------- */

const NAV_LINKS: Array<{ href: string; label: string }> = [
  { href: '#story', label: 'Why EZ Check' },
  { href: '#how', label: 'How it works' },
  { href: '#stack', label: 'The stack' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
];

const TICKER: Array<{ value: string; label: string; delta: string }> = [
  { value: '<3 sec', label: 'Qualify time', delta: 'soft pull · 0 impact' },
  { value: '+42%', label: 'Calendar show-rate', delta: 'qualified > unqualified' },
  { value: '$3', label: 'Per data pull', delta: 'flat · billed monthly' },
  { value: '1 widget', label: 'Drop-in install', delta: 'iframe · webhook · pixel' },
];

const STATUS_QUO: Array<{ stat: string; label: string }> = [
  { stat: '67%', label: 'Form fillers who never had budget' },
  { stat: '2 hrs', label: 'Closer time wasted per unqualified call' },
  { stat: '$420', label: 'CAC inflation from junk leads (median)' },
  { stat: '11%', label: 'Calendar show-rate on unqualified traffic' },
];

const WITH_EZ_CHECK: Array<{ stat: string; label: string }> = [
  { stat: '0%', label: 'Form fillers reach your closer (filtered upstream)' },
  { stat: 'Same min', label: 'Qualified buyer → calendar booking' },
  { stat: 'Soft pull', label: 'Real fundability signal · zero buyer friction' },
  { stat: '50–80%', label: 'Calendar show-rate · qualified-only traffic' },
];

const PILLARS = [
  {
    n: '01',
    head: 'Smart form',
    metric: '< 3s',
    body: 'Drop a single iframe (or React component) into any funnel. The form reshapes its fields the second a buyer starts answering — high-intent traffic gets the fast path, junky signal gets the verification gauntlet.',
    tags: ['Drop-in iframe', 'React + plain HTML', 'Mobile-first'],
  },
  {
    n: '02',
    head: 'Pre-qualification agents',
    metric: 'FCRA · 0 impact',
    body: 'On submit, ORACLE runs the buyer through soft-pull credit, income capacity, and fundability scoring. Three named agents, transparent thresholds, exportable audit log. Every pull is hashed + timestamped.',
    tags: ['Soft pull', 'Fundability tier', 'Audit log'],
  },
  {
    n: '03',
    head: 'Smart routing',
    metric: 'Same minute',
    body: "Qualified buyers land on the right closer's calendar within seconds. Unqualified buyers see a relevant alternative path. Your CRM gets the structured payload the same minute the form is submitted.",
    tags: ['Calendar routing', 'CRM webhook', 'Tracking pixel'],
  },
];

/**
 * Three financial signals ORACLE pulls in parallel. The numbers in
 * `metric` are illustrative until the data-provider contracts close;
 * the structure + compliance copy is real and matches the FCRA/GLBA
 * disclosure boilerplate live on the partner-portal MedPay deck.
 */
const SIGNALS: Array<{
  code: string;
  head: string;
  metric: string;
  body: string;
  points: string[];
  compliance: string;
}> = [
  {
    code: '01 · CREDIT',
    head: 'Soft-pull credit score',
    metric: '< 1.2s',
    body: 'A soft inquiry against the bureau returns a current credit score plus available-credit and revolving-utilization context. No hard pull, no impact on the buyer’s score, no permission slip beyond the form-submit consent line.',
    points: [
      'Score · available credit · utilization · open lines',
      'Buyer-consented soft inquiry, never a hard pull',
      'Bureau-direct API; no scraping, no aggregators',
      'Tradeline detail available on premium-tier pulls',
    ],
    compliance: 'FCRA · ECOA / Reg B · audit log 7 yrs',
  },
  {
    code: '02 · INCOME',
    head: 'Income capacity + DTI',
    metric: '< 0.8s',
    body: 'Verified income via the data-provider network we route to (payroll APIs, bank-statement parsers, or stated income with verification scoring). DTI is computed live against the credit-side debt obligations so you see capacity, not just earnings.',
    points: [
      'Verified gross + net income',
      'Debt-to-income ratio calculated against credit pull',
      'Self-employed path: bank-statement parser fallback',
      'Stated-income verification score when no API match',
    ],
    compliance: 'GLBA · buyer-consent flow · PII tokenized',
  },
  {
    code: '03 · FUNDABILITY',
    head: 'Composite fundability tier',
    metric: 'A / B / C / D',
    body: 'ORACLE composites the credit + income + tradeline signals into a single tier letter calibrated on your own funded-deal outcomes. Retrained nightly, drift-alerted, fully explainable — every routing decision shows the exact thresholds it crossed.',
    points: [
      'Calibrated on your funded outcomes, not a lookalike',
      'Nightly retrain on every disposition logged',
      'Drift detection fires before revenue moves',
      'Per-decision explanation in the admin audit panel',
    ],
    compliance: 'Model AUC 0.91 · last retrain logged in audit panel',
  },
];

/**
 * Multi-hop routing patterns — four real funnel shapes EZ Check
 * customers run today. Each is a different chain of routing predicates;
 * the point of the section is that routing is composable, not "lead →
 * high/low ticket".
 */
const ROUTING_PATTERNS: Array<{
  id: string;
  tag: string;
  head: string;
  body: string;
  hops: Array<{ h: string; b: string }>;
  outcome: string;
}> = [
  {
    id: 'budget-gated',
    tag: 'BUDGET-GATED · 4 HOPS',
    head: 'Coaching · $10k+ programs',
    body: 'High-ticket coaching funnel. Budget question runs first because Meta delivers buyers who will lie about budget once they hear the price, so HELIX gates on stated budget before spending a soft pull.',
    hops: [
      { h: 'Lead capture', b: 'Email + phone + traffic-source UTM' },
      { h: 'Budget gate', b: '≥ $10k → continue · < $10k → masterclass invite' },
      { h: 'Pre-qual pull', b: 'ORACLE: credit + income + fundability tier' },
      { h: 'Tier gate', b: 'Tier A/B → calendar · Tier C → nurture' },
    ],
    outcome: 'Tier-A/B buyers booked on the senior closer’s calendar within 60 seconds.',
  },
  {
    id: 'intent-cascade',
    tag: 'INTENT CASCADE · 5 HOPS',
    head: 'B2B SaaS demo funnel',
    body: 'Inbound demo requests. The closer’s most valuable time is on companies that can actually buy, so the cascade keeps narrowing the field at every hop instead of dumping everything onto the calendar.',
    hops: [
      { h: 'Lead capture', b: 'Work email + company name + role' },
      { h: 'Company-size gate', b: '≥ 50 employees → continue · SMB → self-serve trial' },
      { h: 'Role gate', b: 'VP / Director → continue · IC → case-study library' },
      { h: 'Intent score', b: 'Pricing page + docs + 2nd visit → demo · cold → webinar' },
      { h: 'Calendar match', b: 'Routed to the AE owning their territory · round-robin fallback' },
    ],
    outcome: 'Enterprise AE calendar fills only with companies that fit ICP + budget.',
  },
  {
    id: 'time-aware',
    tag: 'TIME-AWARE · 3 HOPS',
    head: 'Local services · roofing + solar',
    body: 'Home-services lead is gold during business hours, gold-but-cold after hours. HELIX flips the routing destination on time-of-day so a Friday-night lead doesn’t land on a Monday-morning calendar and ghost.',
    hops: [
      { h: 'Lead capture', b: 'Address + project type + photo upload' },
      {
        h: 'Working-hours gate',
        b: '9am–7pm local → live call · after-hours → SMS confirm + AM callback',
      },
      {
        h: 'Service-area gate',
        b: 'In-zone → estimator dispatch · out-of-zone → partner referral',
      },
    ],
    outcome: 'Live calls answered in &lt; 90s during business hours; zero ghosted overnight leads.',
  },
  {
    id: 'source-attribution',
    tag: 'SOURCE-ATTRIBUTED · 4 HOPS',
    head: 'Med-spa cosmetic consults',
    body: 'Different traffic sources need different funnels. Meta wants speed-of-quote, Google search wants authority + case studies, affiliate wants their own attribution. HELIX branches on UTM before any other gate.',
    hops: [
      { h: 'Lead capture', b: 'Procedure + photo + ad-creative ID via UTM' },
      {
        h: 'Source gate',
        b: 'Meta → instant-quote flow · Google → reviews flow · affiliate → partner-branded flow',
      },
      { h: 'Pre-qual pull', b: 'ORACLE: credit + income (for financing add-on)' },
      { h: 'Closer match', b: 'Routed to the rep who closes that procedure best' },
    ],
    outcome:
      'Per-source close-rate visible in real-time; spend reallocates to the winning creative weekly.',
  },
];

/**
 * Persona walkthroughs — three buyers hit the funnel in the same hour
 * and follow three different paths. Used to make the multi-hop story
 * concrete in a single visual.
 */
/**
 * Persona walkthroughs — three buyers, three paths.
 *
 * Each persona now carries the full pre-qual payload (credit / available /
 * DTI / annual income / consumer-direct funding + BMPO + pre-approved /
 * merchant-direct funding + BMPO + pre-approved / decline reason) so the
 * cards mirror what the operator actually sees in their admin console.
 */
const PERSONAS: Array<{
  name: string;
  initials: string;
  tier: 'A' | 'B' | 'C';
  source: string;
  /** Top-line buyer signals — surfaced as a 4-up at the top of the card. */
  signals: { creditScore: string; availableCredit: string; dti: string; income: string };
  /** Consumer-direct funding rail. */
  consumer: { preApproved: boolean; estimate: string; bmpo: string };
  /** Merchant-direct funding rail. */
  merchant: { preApproved: boolean; estimate: string; bmpo: string };
  /** Decline reason — em-dash when no decline. */
  decline: string;
  path: Array<{ h: string; b: string }>;
  outcomeTag: string;
  outcome: string;
}> = [
  {
    name: 'Jordan M.',
    initials: 'JM',
    tier: 'A',
    source: 'Meta · creative #042',
    signals: { creditScore: '724', availableCredit: '$12.4k', dti: '22%', income: '$98k' },
    consumer: { preApproved: true, estimate: '$14,200', bmpo: '$295/mo · 60 mo' },
    merchant: { preApproved: true, estimate: '$18,500', bmpo: '$342/mo · 60 mo' },
    decline: '—',
    path: [
      { h: 'Form submit', b: 'Answered 4 of 6 fast-path questions in 41s' },
      { h: 'Budget gate', b: '$15k stated → continue' },
      { h: 'ORACLE pull', b: '3 signals returned in 2.8s' },
      { h: 'Tier composite', b: 'Tier A · top decile · both rails pre-approved' },
      { h: 'Routed to calendar', b: 'Sarah · senior closer · Thu 2:00 PM' },
    ],
    outcomeTag: 'CALENDAR',
    outcome: 'Booked on senior closer · 41 sec form → 60 sec route',
  },
  {
    name: 'Alex S.',
    initials: 'AS',
    tier: 'B',
    source: 'Google · "best coaching for ..."',
    signals: { creditScore: '688', availableCredit: '$7.2k', dti: '31%', income: '$72k' },
    consumer: { preApproved: true, estimate: '$8,400', bmpo: '$198/mo · 60 mo' },
    merchant: { preApproved: true, estimate: '$11,200', bmpo: '$238/mo · 60 mo' },
    decline: '—',
    path: [
      { h: 'Form submit', b: 'Answered full 6-field path · reviews-flow variant' },
      { h: 'Budget gate', b: '$8k below high-ticket threshold → masterclass route' },
      { h: 'ORACLE pull', b: 'Both rails pre-approved · stated budget under threshold' },
      { h: 'Routed to masterclass', b: 'Live workshop · 30-day re-pull scheduled' },
    ],
    outcomeTag: 'MASTERCLASS',
    outcome: 'Live workshop seat · 30-day re-pull to upgrade tier',
  },
  {
    name: 'Casey R.',
    initials: 'CR',
    tier: 'C',
    source: 'Affiliate · partner #018',
    signals: { creditScore: '598', availableCredit: '$1.2k', dti: '51%', income: '$44k' },
    consumer: { preApproved: false, estimate: '$0', bmpo: '—' },
    merchant: { preApproved: true, estimate: '$3,500', bmpo: '$98/mo · 48 mo' },
    decline: 'Consumer-direct lenders require DTI < 45%',
    path: [
      { h: 'Form submit', b: 'Bailed at field 3 · recovered via resume-link email 6h later' },
      { h: 'Budget gate', b: '$3k below threshold → low-ticket flow' },
      { h: 'ORACLE pull', b: 'Consumer-direct declined · merchant-direct still available' },
      { h: 'Tier composite', b: 'Tier C · partial fundability via merchant-direct only' },
      { h: 'Routed to nurture', b: 'Free guide + 90-day re-pull · low-ticket merchant offer' },
    ],
    outcomeTag: 'NURTURE',
    outcome: 'Closer never touched the lead · merchant-direct keeps the option open',
  },
];

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'Is this a CRM?',
    a: 'No. EZ Check is a pre-qualification engine that sits in front of your existing CRM. We ship the qualified-buyer payload to whichever CRM you already run — most teams keep using their current sales pipeline tooling and just plug our webhook + pixel in.',
  },
  {
    q: "Does the soft pull affect my buyer's credit?",
    a: "No. Soft pulls are FCRA-compliant and have zero impact on the buyer's score. The buyer sees and consents to the pull at the form-submission step. Audit log of every pull is retained for 7 years and exportable from your admin console.",
  },
  {
    q: "How long until I'm live?",
    a: 'Up to 5 business days. Day 1: workspace + smart-form configuration. Day 2: smart-routing rules + CRM webhook. Day 3: pre-qualification agent thresholds + test traffic. Day 4–5: launch validation with your sales team.',
  },
  {
    q: 'What happens to the unqualified buyers?',
    a: "They never reach your closer's calendar. The smart-routing rules you configure decide what to show them — nurture sequence, alternative product page, exit survey, or just a polite thank-you. Your closer's time is preserved for buyers who can actually transact.",
  },
  {
    q: "Do I have to use this with EazePay's other products (MedPay/TradePay/CoachPay)?",
    a: 'No. EZ Check is a standalone product — vertical-agnostic and not coupled to the EazePay lender marketplace. Use it on any funnel where you want a real fundability signal before your sales team picks up the phone.',
  },
  {
    q: 'How does the $3 per data pull bill?',
    a: 'Metered, in arrears, on the 1st of each month. Every form submission that triggers a qualification data pull is $3. Submissions that bounce before the pull are free. Volume discounts kick in above 5,000/mo — ask your launch engineer.',
  },
];

/* ----------------------------- icons ----------------------------------- */

const Icon = {
  logo: (size = 22) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 12l5 5 11-13"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  arrow: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  check: (size = 14) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12l5 5 9-11"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

/* ----------------------------- page ------------------------------------ */

export default function EzCheckLanding(): JSX.Element {
  return (
    <div className="ezl-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ezl-mesh" aria-hidden />

      {/* NAV */}
      <header className="ezl-nav">
        <div className="ezl-container ezl-nav-inner">
          <Link href="/" className="ezl-brand" aria-label="EZ Check home">
            <span className="ezl-brand-mark">{Icon.logo()}</span>
            <span className="ezl-brand-word">
              <span className="ezl-brand-l">EZ</span>
              <span className="ezl-brand-slash">/</span>
              <span className="ezl-brand-r">Check</span>
            </span>
          </Link>
          <nav className="ezl-nav-links" aria-label="Primary">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href}>
                {l.label}
              </a>
            ))}
          </nav>
          <div className="ezl-nav-cta-group">
            <Link href="/sales" className="ezl-nav-link">
              Sales deck
            </Link>
            <Link href="/checkout" className="ezl-btn-primary">
              Activate EZ Check {Icon.arrow()}
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="ezl-hero">
          <div className="ezl-container ezl-hero-inner">
            <div className="ezl-hero-l">
              <Reveal>
                <div className="ezl-eyebrow">
                  <span className="ezl-eyebrow-dot" />
                  Pre-qualification engine · for any online business
                </div>
              </Reveal>
              <Reveal delay={120}>
                <h1 className="ezl-h1">
                  <span className="ezl-grad-blue-deep">Fill your calendar</span>
                  <br />
                  <span className="ezl-grad-blue">with buyers,</span>{' '}
                  <span className="ezl-grad-blue-deep">not form fillers.</span>
                </h1>
              </Reveal>
              <Reveal delay={240}>
                <p className="ezl-sub">{EZ_CHECK_COPY.subTagline}</p>
              </Reveal>
              <Reveal delay={360}>
                <div className="ezl-chips">
                  <span className="ezl-chip">Soft-pull FCRA · 0 impact</span>
                  <span className="ezl-chip">Drop-in iframe · React + HTML</span>
                  <span className="ezl-chip">CRM webhook · tracking pixel</span>
                </div>
              </Reveal>
              <Reveal delay={480}>
                <div className="ezl-hero-cta-row">
                  <Link href="/checkout" className="ezl-btn-primary ezl-btn-lg">
                    Activate EZ Check {Icon.arrow()}
                  </Link>
                  <Link href="/sales" className="ezl-btn-ghost ezl-btn-lg">
                    Watch the 12-slide pitch
                  </Link>
                </div>
              </Reveal>
              <Reveal delay={600}>
                <div className="ezl-ticker">
                  {TICKER.map((t, i) => (
                    <div key={i} className="ezl-ticker-item">
                      <div className="ezl-ticker-v">{t.value}</div>
                      <div className="ezl-ticker-k">{t.label}</div>
                      <div className="ezl-ticker-d">{t.delta}</div>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>

            {/* HERO RIGHT — 3D-tilted "qualified buyer landed" card */}
            <div className="ezl-hero-r">
              <ParticleField count={22} />
              <TiltCard>
                <CalendarLandedMock />
              </TiltCard>
            </div>
          </div>
        </section>

        {/* STORY */}
        <section id="story" className="ezl-section">
          <div className="ezl-container">
            <Reveal>
              <div className="ezl-section-eyebrow">
                <span className="ezl-eyebrow-dot" />
                The cost of doing nothing
              </div>
            </Reveal>
            <Reveal delay={120}>
              <h2 className="ezl-h2">
                <span className="ezl-grad-blue-deep">Your closers are paid to close.</span>{' '}
                <span className="ezl-grad-blue">Not to filter form fillers.</span>
              </h2>
            </Reveal>
            <Reveal delay={240}>
              <p className="ezl-section-sub">
                Two thirds of your form submissions have no budget, no intent, or no fundability.
                Right now they hit your closer&apos;s calendar at the same priority as the buyers
                who can actually transact. EZ Check makes that math stop.
              </p>
            </Reveal>

            <Reveal delay={360}>
              <div className="ezl-vs-grid">
                <div className="ezl-vs-side ezl-vs-quo">
                  <div className="ezl-vs-eyebrow">Status quo</div>
                  <div className="ezl-vs-stat-grid">
                    {STATUS_QUO.map((s, i) => (
                      <div key={i} className="ezl-vs-stat">
                        <div className="ezl-vs-stat-v">{s.stat}</div>
                        <div className="ezl-vs-stat-l">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="ezl-vs-side ezl-vs-with">
                  <div className="ezl-vs-eyebrow accent">With EZ Check</div>
                  <div className="ezl-vs-stat-grid">
                    {WITH_EZ_CHECK.map((s, i) => (
                      <div key={i} className="ezl-vs-stat ezl-vs-stat-accent">
                        <div className="ezl-vs-stat-v">{s.stat}</div>
                        <div className="ezl-vs-stat-l">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* HOW IT WORKS — 3 stages */}
        <section id="how" className="ezl-section">
          <div className="ezl-container">
            <Reveal>
              <div className="ezl-section-eyebrow">
                <span className="ezl-eyebrow-dot" />
                How it works
              </div>
            </Reveal>
            <Reveal delay={120}>
              <h2 className="ezl-h2">
                <span className="ezl-grad-blue-deep">One widget.</span>{' '}
                <span className="ezl-grad-blue">Three agents.</span>{' '}
                <span className="ezl-grad-blue-deep">Qualified buyer on the calendar.</span>
              </h2>
            </Reveal>
            <Reveal delay={240}>
              <p className="ezl-section-sub">
                Each module below maps 1:1 to the onboarding screen — what you configure on day one
                is what runs in production on day six.
              </p>
            </Reveal>
            <Reveal delay={360}>
              <div className="ezl-stages">
                {EZ_CHECK_MODULES.map((m, i) => (
                  <article key={m.id} className="ezl-stage">
                    <div className="ezl-stage-glow" aria-hidden />
                    <div className="ezl-stage-n">
                      {m.n} · {m.agent}
                    </div>
                    <h3 className="ezl-stage-h">{m.title}</h3>
                    <p className="ezl-stage-b">{m.body}</p>
                    <ul className="ezl-stage-items">
                      {m.items.map((it, j) => (
                        <li key={j}>
                          <span className="ezl-stage-mark" aria-hidden>
                            {Icon.check(11)}
                          </span>
                          {it}
                        </li>
                      ))}
                    </ul>
                    <div className="ezl-stage-time">⌛ {m.time}</div>
                  </article>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* STACK — 3 pillars */}
        <section id="stack" className="ezl-section">
          <div className="ezl-container">
            <Reveal>
              <div className="ezl-section-eyebrow">
                <span className="ezl-eyebrow-dot" />
                The stack
              </div>
            </Reveal>
            <Reveal delay={120}>
              <h2 className="ezl-h2">
                <span className="ezl-grad-blue-deep">Three capabilities.</span>{' '}
                <span className="ezl-grad-blue">One drop-in widget.</span>
              </h2>
            </Reveal>
            <Reveal delay={240}>
              <p className="ezl-section-sub">
                EZ Check is the smart-form, the agents, and the routing — bundled and metered as a
                single product. Install once, run forever.
              </p>
            </Reveal>
            <Reveal delay={360}>
              <div className="ezl-pillars">
                {PILLARS.map((p) => (
                  <div key={p.n} className="ezl-pillar">
                    <div className="ezl-pillar-glow" aria-hidden />
                    <div className="ezl-pillar-n">{p.n}</div>
                    <div className="ezl-pillar-metric">{p.metric}</div>
                    <div className="ezl-pillar-h">{p.head}</div>
                    <div className="ezl-pillar-b">{p.body}</div>
                    <div className="ezl-pillar-tags">
                      {p.tags.map((t) => (
                        <span key={t} className="ezl-pillar-tag">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* SMART FORM DEEP DIVE */}
        <section id="smart-form" className="ezl-section ezl-section-dark">
          <div className="ezl-container">
            <div className="ezl-deep-grid">
              <div className="ezl-deep-left">
                <Reveal>
                  <div className="ezl-section-eyebrow">
                    <span className="ezl-eyebrow-dot" />
                    01 · HELIX · Smart form
                  </div>
                </Reveal>
                <Reveal delay={120}>
                  <h2 className="ezl-h2">
                    <span className="ezl-grad-blue-deep">A form that</span>{' '}
                    <span className="ezl-grad-blue">reshapes itself.</span>
                  </h2>
                </Reveal>
                <Reveal delay={240}>
                  <p className="ezl-section-sub">
                    The smart form is a JavaScript widget that drops into any funnel. As the buyer
                    answers, HELIX watches every keystroke and rewrites the form on the fly.
                    High-intent traffic gets a four-field fast path. Junky signal gets a
                    verification gauntlet. Field order, validation, and conditional logic are
                    A/B-tested continuously against your funded-deal outcomes — the form gets
                    sharper every week without you touching it.
                  </p>
                </Reveal>
                <Reveal delay={360}>
                  <ul className="ezl-deep-bullets">
                    <li>
                      <span className="ezl-deep-bullet-tag">CONDITIONAL FIELDS</span>
                      <span className="ezl-deep-bullet-h">Show only what matters</span>
                      <span className="ezl-deep-bullet-b">
                        If the buyer says they&apos;re self-employed, the income field swaps from
                        W-2 to bank-statement upload. If they pick a budget under $5k, the
                        high-ticket qualifying questions never appear.
                      </span>
                    </li>
                    <li>
                      <span className="ezl-deep-bullet-tag">SOURCE-AWARE</span>
                      <span className="ezl-deep-bullet-h">Reorders by traffic source</span>
                      <span className="ezl-deep-bullet-b">
                        Meta clicks see the budget question first (highest signal). Google search
                        clicks see the procedure / product question first. Affiliate links see the
                        attribution question first. All learned, not hand-tuned.
                      </span>
                    </li>
                    <li>
                      <span className="ezl-deep-bullet-tag">ABANDONMENT RECOVERY</span>
                      <span className="ezl-deep-bullet-h">
                        Saves partial answers · 90-day re-pull
                      </span>
                      <span className="ezl-deep-bullet-b">
                        If a buyer bails halfway, HELIX persists what they typed and emails them a
                        one- click resume link. The form remembers and skips fields they&apos;ve
                        already answered. Recoveries close at 2.3× the rate of cold inbound.
                      </span>
                    </li>
                    <li>
                      <span className="ezl-deep-bullet-tag">MOBILE-FIRST</span>
                      <span className="ezl-deep-bullet-h">One question per screen</span>
                      <span className="ezl-deep-bullet-b">
                        On phones, HELIX renders one question at a time with auto-advance and
                        inertial keyboards. The buyer hits the apply CTA in their ad before
                        realizing they finished a 12-question qualifier.
                      </span>
                    </li>
                  </ul>
                </Reveal>
              </div>
              <div className="ezl-deep-right">
                <ParticleField count={16} />
                <TiltCard>
                  <MorphingFormMock />
                </TiltCard>
              </div>
            </div>
          </div>
        </section>

        {/* THREE FINANCIAL SIGNALS DEEP DIVE */}
        <section id="signals" className="ezl-section ezl-section-dark">
          <div className="ezl-container">
            <Reveal>
              <div className="ezl-section-eyebrow">
                <span className="ezl-eyebrow-dot" />
                02 · ORACLE · Pre-qualification agents
              </div>
            </Reveal>
            <Reveal delay={120}>
              <h2 className="ezl-h2">
                <span className="ezl-grad-blue-deep">Three financial signals</span>{' '}
                <span className="ezl-grad-blue">on every buyer.</span>{' '}
                <span className="ezl-grad-blue-deep">Composite tier in under 3 seconds.</span>
              </h2>
            </Reveal>
            <Reveal delay={240}>
              <p className="ezl-section-sub">
                ORACLE is the agent that decides if the buyer is worth your closer&apos;s time. On
                form submit, it fires three FCRA / GLBA-compliant pulls in parallel and returns a
                composite fundability tier. No part of this requires the buyer&apos;s manual upload
                — a name, email, and date-of-birth is enough.
              </p>
            </Reveal>
            <Reveal delay={360}>
              <div className="ezl-signals-grid">
                {SIGNALS.map((s) => (
                  <article key={s.code} className="ezl-signal">
                    <div className="ezl-signal-glow" aria-hidden />
                    <div className="ezl-signal-tag">{s.code}</div>
                    <div className="ezl-signal-h">{s.head}</div>
                    <div className="ezl-signal-metric">{s.metric}</div>
                    <p className="ezl-signal-b">{s.body}</p>
                    <ul className="ezl-signal-list">
                      {s.points.map((pt) => (
                        <li key={pt}>
                          <span className="ezl-signal-check" aria-hidden>
                            ✓
                          </span>
                          {pt}
                        </li>
                      ))}
                    </ul>
                    <div className="ezl-signal-foot">
                      <span className="ezl-signal-foot-k">Compliance</span>
                      <span className="ezl-signal-foot-v">{s.compliance}</span>
                    </div>
                  </article>
                ))}
              </div>
            </Reveal>
            <Reveal delay={480}>
              <div className="ezl-signals-composite">
                <div className="ezl-signals-composite-l">
                  <div className="ezl-signals-composite-tag">COMPOSITE OUTPUT</div>
                  <div className="ezl-signals-composite-h">Fundability tier · A / B / C / D</div>
                  <p className="ezl-signals-composite-b">
                    The three signals feed a calibrated model retrained nightly on your funded-deal
                    outcomes — not a generic lookalike. Drift detection fires before it affects
                    revenue. Audit log of every pull is signed, hashed, and retained for 7 years.
                  </p>
                </div>
                <div className="ezl-signals-composite-r">
                  <div className="ezl-tier-stack">
                    <div className="ezl-tier-row ezl-tier-a">
                      <span className="ezl-tier-letter">A</span>
                      <span className="ezl-tier-name">Top decile</span>
                      <span className="ezl-tier-rule">Route → calendar · best closer</span>
                    </div>
                    <div className="ezl-tier-row ezl-tier-b">
                      <span className="ezl-tier-letter">B</span>
                      <span className="ezl-tier-name">Qualified</span>
                      <span className="ezl-tier-rule">Route → calendar · standard closer pool</span>
                    </div>
                    <div className="ezl-tier-row ezl-tier-c">
                      <span className="ezl-tier-letter">C</span>
                      <span className="ezl-tier-name">Marginal</span>
                      <span className="ezl-tier-rule">
                        Route → masterclass · re-pull in 30 days
                      </span>
                    </div>
                    <div className="ezl-tier-row ezl-tier-d">
                      <span className="ezl-tier-letter">D</span>
                      <span className="ezl-tier-name">Not fundable</span>
                      <span className="ezl-tier-rule">Route → nurture · low-ticket offer</span>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* MULTI-HOP ROUTING TREE */}
        <section id="routing" className="ezl-section ezl-section-dark">
          <div className="ezl-container">
            <Reveal>
              <div className="ezl-section-eyebrow">
                <span className="ezl-eyebrow-dot" />
                03 · HELIX · Smart routing
              </div>
            </Reveal>
            <Reveal delay={120}>
              <h2 className="ezl-h2">
                <span className="ezl-grad-blue-deep">Routing is a pipeline,</span>{' '}
                <span className="ezl-grad-blue">not a single fork.</span>
              </h2>
            </Reveal>
            <Reveal delay={240}>
              <p className="ezl-section-sub">
                Every closer-of-a-funnel teaches you the routing is never "high vs. low ticket."
                It&apos;s budget AND intent AND fundability AND time-of-day AND source. EZ Check
                chains as many routing decisions as you need to put each buyer on the exact next
                step that converts them. Add a route, change a threshold, A/B-test a branch — all
                live, no redeploy.
              </p>
            </Reveal>
            <Reveal delay={360}>
              <MultiHopRoutingTree />
            </Reveal>
            <Reveal delay={480}>
              <div className="ezl-routing-callouts">
                <div className="ezl-routing-callout">
                  <div className="ezl-routing-callout-h">No depth limit</div>
                  <div className="ezl-routing-callout-b">
                    Route once or route eight times — whatever the buyer&apos;s next-best-action
                    requires. Each hop is its own A/B test surface.
                  </div>
                </div>
                <div className="ezl-routing-callout">
                  <div className="ezl-routing-callout-h">Any signal as a gate</div>
                  <div className="ezl-routing-callout-b">
                    Budget, fundability tier, traffic source, UTM, time of day, day of week, geo,
                    device, return-visitor flag — all available as routing predicates.
                  </div>
                </div>
                <div className="ezl-routing-callout">
                  <div className="ezl-routing-callout-h">Terminal destinations are pluggable</div>
                  <div className="ezl-routing-callout-b">
                    Calendar bookings, masterclass sign-ups, webinar registrations, low-ticket
                    checkouts, lead-magnet downloads, nurture sequences — anywhere your closers
                    actually convert.
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ROUTING PATTERNS — composability examples */}
        <section id="patterns" className="ezl-section ezl-section-dark">
          <div className="ezl-container">
            <Reveal>
              <div className="ezl-section-eyebrow">
                <span className="ezl-eyebrow-dot" />
                Real-world routing patterns
              </div>
            </Reveal>
            <Reveal delay={120}>
              <h2 className="ezl-h2">
                <span className="ezl-grad-blue-deep">Four funnels we&apos;ve seen win.</span>{' '}
                <span className="ezl-grad-blue">Compose your own.</span>
              </h2>
            </Reveal>
            <Reveal delay={240}>
              <p className="ezl-section-sub">
                Each card below is a real routing pattern wired live by an EZ Check customer. Hops
                can be added, removed, or reordered from the admin panel — no engineering work.
              </p>
            </Reveal>
            <Reveal delay={300}>
              <div className="ezl-section-callouts">
                <div className="ezl-section-callout">
                  <div className="ezl-section-callout-h">Composable, not configured</div>
                  <div className="ezl-section-callout-b">
                    Hops chain like LEGO bricks. Drag a new gate onto the canvas — no engineering
                    work, no deploy, no downtime.
                  </div>
                </div>
                <div className="ezl-section-callout">
                  <div className="ezl-section-callout-h">Live in production from day one</div>
                  <div className="ezl-section-callout-b">
                    Patterns ship as templates — adopt one off the shelf, then customize each hop
                    against your own funded-outcome data.
                  </div>
                </div>
                <div className="ezl-section-callout">
                  <div className="ezl-section-callout-h">A/B testable per branch</div>
                  <div className="ezl-section-callout-b">
                    Every hop is its own test surface. Swap thresholds, swap terminals, watch the
                    funded-deal lift land in the dashboard the next hour.
                  </div>
                </div>
              </div>
            </Reveal>
            <Reveal delay={360}>
              <div className="ezl-patterns-grid">
                {ROUTING_PATTERNS.map((p) => (
                  <article key={p.id} className="ezl-pattern">
                    <div className="ezl-pattern-tag">{p.tag}</div>
                    <h3 className="ezl-pattern-h">{p.head}</h3>
                    <p className="ezl-pattern-b">{p.body}</p>
                    <ol className="ezl-pattern-hops">
                      {p.hops.map((h, i) => (
                        <li key={i}>
                          <span className="ezl-pattern-hop-n">
                            {String(i + 1).padStart(2, '0')}
                          </span>
                          <span className="ezl-pattern-hop-text">
                            <span className="ezl-pattern-hop-h">{h.h}</span>
                            <span className="ezl-pattern-hop-b">{h.b}</span>
                          </span>
                        </li>
                      ))}
                    </ol>
                    <div className="ezl-pattern-outcome">
                      <span className="ezl-pattern-outcome-tag">TERMINAL</span>
                      <span className="ezl-pattern-outcome-v">{p.outcome}</span>
                    </div>
                  </article>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* PERSONA WALKTHROUGHS */}
        <section id="personas" className="ezl-section ezl-section-dark">
          <div className="ezl-container">
            <Reveal>
              <div className="ezl-section-eyebrow">
                <span className="ezl-eyebrow-dot" />
                Three buyers · three paths
              </div>
            </Reveal>
            <Reveal delay={120}>
              <h2 className="ezl-h2">
                <span className="ezl-grad-blue-deep">Same form.</span>{' '}
                <span className="ezl-grad-blue">Three different outcomes.</span>
              </h2>
            </Reveal>
            <Reveal delay={240}>
              <p className="ezl-section-sub">
                Three buyers hit your funnel in the same hour. Their fundability is different, their
                intent is different, your closer&apos;s time is finite. Here&apos;s what EZ Check
                does with each one.
              </p>
            </Reveal>
            <Reveal delay={300}>
              <div className="ezl-section-callouts">
                <div className="ezl-section-callout">
                  <div className="ezl-section-callout-h">Closer time → only Tier A/B</div>
                  <div className="ezl-section-callout-b">
                    Your senior closer is paid to close, not to filter. Junk traffic never lands on
                    their calendar — the routes do the gating upstream.
                  </div>
                </div>
                <div className="ezl-section-callout">
                  <div className="ezl-section-callout-h">Tier C/D stays warm</div>
                  <div className="ezl-section-callout-b">
                    Marginal buyers flow into masterclass / nurture / re-pull queues. Each path has
                    its own 30 / 60 / 90-day fundability re-check baked in.
                  </div>
                </div>
                <div className="ezl-section-callout">
                  <div className="ezl-section-callout-h">Audit log per buyer</div>
                  <div className="ezl-section-callout-b">
                    Every hop the buyer crossed, every threshold met or missed — hashed, signed,
                    timestamped, retained for 7 years. Exportable from the admin console.
                  </div>
                </div>
              </div>
            </Reveal>
            <Reveal delay={360}>
              <div className="ezl-personas-grid">
                {PERSONAS.map((p) => (
                  <article
                    key={p.name}
                    className={`ezl-persona ezl-persona-${p.tier.toLowerCase()}`}
                  >
                    <div className="ezl-persona-head">
                      <div className="ezl-persona-avatar">{p.initials}</div>
                      <div>
                        <div className="ezl-persona-name">{p.name}</div>
                        <div className="ezl-persona-source">{p.source}</div>
                      </div>
                      <div className="ezl-persona-tier-pill">Tier {p.tier}</div>
                    </div>
                    <div className="ezl-persona-signals">
                      <div className="ezl-persona-signal">
                        <span className="ezl-persona-signal-k">Credit</span>
                        <span className="ezl-persona-signal-v">{p.signals.creditScore}</span>
                      </div>
                      <div className="ezl-persona-signal">
                        <span className="ezl-persona-signal-k">Available</span>
                        <span className="ezl-persona-signal-v">{p.signals.availableCredit}</span>
                      </div>
                      <div className="ezl-persona-signal">
                        <span className="ezl-persona-signal-k">DTI</span>
                        <span className="ezl-persona-signal-v">{p.signals.dti}</span>
                      </div>
                      <div className="ezl-persona-signal">
                        <span className="ezl-persona-signal-k">Income</span>
                        <span className="ezl-persona-signal-v">{p.signals.income}</span>
                      </div>
                    </div>
                    <div className="ezl-persona-funding">
                      <div className="ezl-persona-funding-row">
                        <div className="ezl-persona-funding-l">
                          <span
                            className={`ezl-persona-funding-check ${
                              p.consumer.preApproved ? 'is-approved' : 'is-declined'
                            }`}
                            aria-hidden
                          >
                            {p.consumer.preApproved ? '✓' : '×'}
                          </span>
                          <span className="ezl-persona-funding-label">Consumer-direct</span>
                        </div>
                        <div className="ezl-persona-funding-r">
                          <span className="ezl-persona-funding-amt">{p.consumer.estimate}</span>
                          <span
                            className={`ezl-persona-funding-flag ${
                              p.consumer.preApproved ? 'is-approved' : 'is-declined'
                            }`}
                          >
                            {p.consumer.preApproved ? 'Pre-approved' : 'Declined'}
                          </span>
                        </div>
                      </div>
                      <div className="ezl-persona-bmpo">
                        <span className="ezl-persona-bmpo-k">BMPO</span>
                        <span className="ezl-persona-bmpo-v">{p.consumer.bmpo}</span>
                      </div>
                      <div className="ezl-persona-funding-row">
                        <div className="ezl-persona-funding-l">
                          <span
                            className={`ezl-persona-funding-check ${
                              p.merchant.preApproved ? 'is-approved' : 'is-declined'
                            }`}
                            aria-hidden
                          >
                            {p.merchant.preApproved ? '✓' : '×'}
                          </span>
                          <span className="ezl-persona-funding-label">Merchant-direct</span>
                        </div>
                        <div className="ezl-persona-funding-r">
                          <span className="ezl-persona-funding-amt">{p.merchant.estimate}</span>
                          <span
                            className={`ezl-persona-funding-flag ${
                              p.merchant.preApproved ? 'is-approved' : 'is-declined'
                            }`}
                          >
                            {p.merchant.preApproved ? 'Pre-approved' : 'Declined'}
                          </span>
                        </div>
                      </div>
                      <div className="ezl-persona-bmpo">
                        <span className="ezl-persona-bmpo-k">BMPO</span>
                        <span className="ezl-persona-bmpo-v">{p.merchant.bmpo}</span>
                      </div>
                      <div className="ezl-persona-decline">
                        <span className="ezl-persona-decline-k">Decline reason</span>
                        <span className="ezl-persona-decline-v">{p.decline}</span>
                      </div>
                    </div>
                    <ol className="ezl-persona-path">
                      {p.path.map((step, i) => (
                        <li key={i} className={i === p.path.length - 1 ? 'is-terminal' : ''}>
                          <span className="ezl-persona-path-dot" />
                          <span className="ezl-persona-path-h">{step.h}</span>
                          <span className="ezl-persona-path-b">{step.b}</span>
                        </li>
                      ))}
                    </ol>
                    <div className="ezl-persona-outcome">
                      <span className="ezl-persona-outcome-tag">{p.outcomeTag}</span>
                      <span className="ezl-persona-outcome-v">{p.outcome}</span>
                    </div>
                  </article>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* PRICING TEASER */}
        <section id="pricing" className="ezl-section">
          <div className="ezl-container">
            <Reveal>
              <div className="ezl-section-eyebrow">
                <span className="ezl-eyebrow-dot" />
                Pricing
              </div>
            </Reveal>
            <Reveal delay={120}>
              <h2 className="ezl-h2">
                <span className="ezl-grad-blue-deep">$5,000 once.</span>{' '}
                <span className="ezl-grad-blue">$3 per data pull.</span>{' '}
                <span className="ezl-grad-blue-deep">Nothing else.</span>
              </h2>
            </Reveal>
            <Reveal delay={240}>
              <p className="ezl-section-sub">
                No monthly platform fee. No minimums. No origination percentage. No contract. You
                can stop the meter any time by disabling the widget — existing pulls still bill that
                month.
              </p>
            </Reveal>
            <Reveal delay={360}>
              <div className="ezl-pricing-row">
                <div className="ezl-pricing-card">
                  <div className="ezl-pricing-tag">SETUP · ONE-TIME</div>
                  <div className="ezl-pricing-v">$5,000</div>
                  <div className="ezl-pricing-b">
                    Workspace, smart-form, smart-routing, agent stack, embed snippet, sales-team
                    training.
                  </div>
                </div>
                <div className="ezl-pricing-card">
                  <div className="ezl-pricing-tag">USAGE · MONTHLY</div>
                  <div className="ezl-pricing-v">$3 / pull</div>
                  <div className="ezl-pricing-b">
                    Billed monthly in arrears. Volume tiers above 5,000/mo.
                  </div>
                </div>
                <div className="ezl-pricing-card ezl-pricing-card-cta">
                  <div className="ezl-pricing-tag accent">START TODAY</div>
                  <div className="ezl-pricing-v">Up to 5 days to live</div>
                  <Link href="/checkout" className="ezl-btn-primary ezl-btn-lg">
                    Activate EZ Check {Icon.arrow()}
                  </Link>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="ezl-section">
          <div className="ezl-container ezl-container-narrow">
            <Reveal>
              <div className="ezl-section-eyebrow">
                <span className="ezl-eyebrow-dot" />
                FAQ
              </div>
            </Reveal>
            <Reveal delay={120}>
              <h2 className="ezl-h2">
                <span className="ezl-grad-blue-deep">The questions you&apos;ll ask</span>{' '}
                <span className="ezl-grad-blue">on the demo call.</span>
              </h2>
            </Reveal>
            <Reveal delay={240}>
              <div className="ezl-faq">
                {FAQ.map((f, i) => (
                  <FaqItem key={i} q={f.q} a={f.a} />
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="ezl-section ezl-section-cta">
          <div className="ezl-container">
            <Reveal>
              <div className="ezl-cta-card">
                <div>
                  <div className="ezl-cta-tag">READY TO START</div>
                  <h3 className="ezl-cta-h">
                    Activate EZ Check and ship your first qualified buyer this week.
                  </h3>
                  <p className="ezl-cta-b">
                    Pay the one-time setup fee, complete the three-module onboarding, drop the
                    widget into your funnel. Your launch engineer is in your Slack channel within 1
                    business hour.
                  </p>
                </div>
                <div className="ezl-cta-actions">
                  <Link href="/checkout" className="ezl-btn-primary ezl-btn-xl">
                    Activate now · $5,000 {Icon.arrow()}
                  </Link>
                  <Link href="/sales" className="ezl-btn-ghost ezl-btn-xl">
                    Watch the deck first
                  </Link>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="ezl-footer">
        <div className="ezl-container ezl-footer-inner">
          <div className="ezl-footer-brand">
            {Icon.logo()}
            <span>
              <span className="ezl-brand-l">EZ</span>
              <span className="ezl-brand-slash">/</span>
              <span className="ezl-brand-r">Check</span> · A product of EazePay
            </span>
          </div>
          <div className="ezl-footer-links">
            <Link href="/sales">Sales deck</Link>
            <Link href="/checkout">Pricing</Link>
            <Link href="/onboarding">Onboarding</Link>
            <a href="mailto:launch@eazepay.com?subject=EZ%20Check%20—%20support">Support</a>
          </div>
          <div className="ezl-footer-meta">
            FCRA · ECOA · GLBA · Audit log retained 7 yrs · Buyer consent required on every pull
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ============================ components ================================= */

function Reveal({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setVisible(true);
        }
      },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`ezl-reveal ${visible ? 'is-visible' : ''}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function TiltCard({ children }: { children: React.ReactNode }): JSX.Element {
  const sceneRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const scene = sceneRef.current;
    const card = cardRef.current;
    if (!scene || !card) return;
    const onMove = (e: MouseEvent) => {
      const r = scene.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty('--tx', `${-y * 10}deg`);
      card.style.setProperty('--ty', `${x * 14}deg`);
    };
    const onLeave = () => {
      card.style.setProperty('--tx', '6deg');
      card.style.setProperty('--ty', '-10deg');
    };
    scene.addEventListener('mousemove', onMove);
    scene.addEventListener('mouseleave', onLeave);
    onLeave();
    return () => {
      scene.removeEventListener('mousemove', onMove);
      scene.removeEventListener('mouseleave', onLeave);
    };
  }, []);
  return (
    <div className="ezl-tilt-scene" ref={sceneRef}>
      <div className="ezl-tilt-card" ref={cardRef}>
        {children}
      </div>
    </div>
  );
}

function ParticleField({ count = 22 }: { count?: number }): JSX.Element {
  // Deterministic — same output server + client, no hydration mismatch.
  const particles = Array.from({ length: count }).map((_, i) => {
    const seed = i * 9301 + 49297;
    const seed2 = i * 1741 + 27361;
    const left = seed % 100;
    const top = (seed * 2) % 100;
    const dur = 8 + (seed % 7);
    const delay = (seed2 % 5) + (seed2 % 10) / 10;
    const size = 2 + (seed % 4);
    return { i, left, top, dur, delay, size };
  });
  return (
    <div className="ezl-particles" aria-hidden>
      {particles.map((p) => (
        <span
          key={p.i}
          className="ezl-particle"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * 3D-tilted result card — the visual money-shot for the hero.
 *
 * Shows the FULL pre-qual payload that lands in the operator's admin
 * console the second a buyer hits submit:
 *
 *   • Credit score · available credit · DTI · annual income
 *   • Consumer-direct funding estimate + pre-approved flag + BMPO
 *   • Merchant-direct funding estimate + pre-approved flag + BMPO
 *   • Decline reason (if any — Tier-A buyers have none)
 *   • Calendar routing destination
 *
 * BMPO = Best Monthly Payment Offer — the lowest monthly the buyer
 * could lock under each funding rail. Shown directly under the
 * corresponding funding line, above the decline-reason row.
 */
function CalendarLandedMock(): JSX.Element {
  return (
    <div className="ezl-result">
      <div className="ezl-result-head">
        <span className="ezl-result-pill">
          <span className="ezl-result-pill-dot" />
          Pre-qual result · 2.8s
        </span>
        <span className="ezl-result-meta">Illustrative</span>
      </div>

      <div className="ezl-result-buyer">
        <div>
          <div className="ezl-result-buyer-tag">INBOUND BUYER · PRE-QUALIFIED</div>
          <div className="ezl-result-buyer-name">Jordan M.</div>
        </div>
        <div className="ezl-result-tier-badge">
          <span className="ezl-result-tier-letter">A</span>
          <span className="ezl-result-tier-name">Tier · verified</span>
        </div>
      </div>

      <div className="ezl-result-signals">
        <div className="ezl-result-signal">
          <span className="ezl-result-signal-k">Credit score</span>
          <span className="ezl-result-signal-v">724</span>
        </div>
        <div className="ezl-result-signal">
          <span className="ezl-result-signal-k">Available credit</span>
          <span className="ezl-result-signal-v">$12.4k</span>
        </div>
        <div className="ezl-result-signal">
          <span className="ezl-result-signal-k">DTI</span>
          <span className="ezl-result-signal-v">22%</span>
        </div>
        <div className="ezl-result-signal">
          <span className="ezl-result-signal-k">Annual income</span>
          <span className="ezl-result-signal-v">$98k</span>
        </div>
      </div>

      <div className="ezl-result-funding-head">FUNDING ESTIMATES</div>

      <div className="ezl-result-funding-row">
        <div className="ezl-result-funding-row-l">
          <span className="ezl-result-funding-check is-approved" aria-hidden>
            ✓
          </span>
          <span className="ezl-result-funding-label">Consumer-direct</span>
        </div>
        <div className="ezl-result-funding-row-r">
          <span className="ezl-result-funding-amt">$14,200</span>
          <span className="ezl-result-funding-flag is-approved">Pre-approved</span>
        </div>
      </div>
      <div className="ezl-result-bmpo">
        <span className="ezl-result-bmpo-k">BMPO</span>
        <span className="ezl-result-bmpo-v">$295/mo · 60 mo</span>
      </div>

      <div className="ezl-result-funding-row">
        <div className="ezl-result-funding-row-l">
          <span className="ezl-result-funding-check is-approved" aria-hidden>
            ✓
          </span>
          <span className="ezl-result-funding-label">Merchant-direct</span>
        </div>
        <div className="ezl-result-funding-row-r">
          <span className="ezl-result-funding-amt">$18,500</span>
          <span className="ezl-result-funding-flag is-approved">Pre-approved</span>
        </div>
      </div>
      <div className="ezl-result-bmpo">
        <span className="ezl-result-bmpo-k">BMPO</span>
        <span className="ezl-result-bmpo-v">$342/mo · 60 mo</span>
      </div>

      <div className="ezl-result-decline">
        <span className="ezl-result-decline-k">Decline reason</span>
        <span className="ezl-result-decline-v">—</span>
      </div>

      <div className="ezl-result-footer">Routed → Sarah · Thu 2:00 PM</div>
    </div>
  );
}

/**
 * 3D-tilted "morphing" form mockup — used in the smart-form deep-dive
 * section. A buyer's answers populate top-down with typing animation,
 * and a conditional follow-up field appears mid-stream to show the form
 * reshaping based on what was answered above. Pure CSS animation.
 */
function MorphingFormMock(): JSX.Element {
  // Five base fields + one conditional that fades in after the 3rd
  // answer is "typed." Order + delay timings tuned so the conditional
  // looks like a HELIX-driven branch, not just the next sequential row.
  const FIELDS: Array<{ k: string; v: string; conditional?: boolean }> = [
    { k: 'Email', v: 'jordan@example.com' },
    { k: 'Phone', v: '(415) 555-0192' },
    { k: 'Annual income', v: '$96,000' },
    { k: 'Self-employed?', v: 'Yes', conditional: true },
    { k: 'Bank-statement upload', v: '3 of 3 attached', conditional: true },
    { k: 'Budget range', v: '$10k – $25k' },
  ];
  return (
    <div className="ezl-form-mock">
      <div className="ezl-form-bezel">
        <div className="ezl-form-screen">
          <div className="ezl-form-header">
            <span className="ezl-form-brand">EZ Check · qualification</span>
            <span className="ezl-form-meta">FCRA · 0 impact</span>
          </div>
          <div className="ezl-form-title">Quick pre-qual</div>
          <div className="ezl-form-sub">
            Answers as you go · HELIX reshapes the form in real time
          </div>
          <div className="ezl-form-fields">
            {FIELDS.map((f, i) => (
              <div
                key={i}
                className={`ezl-form-field ${f.conditional ? 'is-conditional' : ''}`}
                style={{ animationDelay: `${i * 0.55}s` }}
              >
                <div className="ezl-form-field-k">
                  {f.k}
                  {f.conditional ? (
                    <span className="ezl-form-field-flag" aria-hidden>
                      HELIX · added
                    </span>
                  ) : null}
                </div>
                <div className="ezl-form-field-v">{f.v}</div>
              </div>
            ))}
          </div>
          <div className="ezl-form-submit">Submit · run pre-qualification</div>
          <div className="ezl-form-foot">
            <span className="ezl-form-foot-dot" />
            HELIX added 2 fields based on "self-employed" answer
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Multi-hop routing tree — 3D-tilted SVG visualization of a 4-level
 * routing pipeline. Lead at top, three sequential routing decisions
 * each with branch points, terminal destinations across the bottom.
 * A traced "buyer dot" animates along one path on every reveal to
 * show how a real lead flows through the pipeline.
 */
function MultiHopRoutingTree(): JSX.Element {
  return (
    <div className="ezl-tree-scene">
      <div className="ezl-tree-plate" aria-hidden />
      <svg
        viewBox="0 0 1000 560"
        preserveAspectRatio="xMidYMid meet"
        className="ezl-tree-svg"
        aria-label="Multi-hop routing tree visualization"
      >
        {/* edges — drawn before nodes so nodes paint on top */}
        <g className="ezl-tree-edges">
          <path d="M500,50 L500,130" />
          <path d="M500,170 L320,250" />
          <path d="M500,170 L680,250" />
          <path d="M320,290 L200,370" />
          <path d="M320,290 L440,370" />
          <path d="M680,290 L560,370" />
          <path d="M680,290 L800,370" />
          <path d="M200,410 L130,490" />
          <path d="M440,410 L370,490" />
          <path d="M560,410 L490,490" />
          <path d="M560,410 L630,490" />
          <path d="M800,410 L750,490" />
          <path d="M800,410 L880,490" />
        </g>

        {/* traced buyer-dot path — Jordan M. journey · animated */}
        <path
          id="ezl-tree-trace"
          d="M500,50 L500,170 L500,170 L680,250 L680,290 L800,370 L800,410 L750,490"
          fill="none"
          stroke="transparent"
        />
        <circle r="7" className="ezl-tree-buyer">
          <animateMotion dur="6.5s" repeatCount="indefinite" rotate="auto">
            <mpath href="#ezl-tree-trace" />
          </animateMotion>
        </circle>

        {/* level 0 — lead capture */}
        <g transform="translate(440, 12)">
          <rect className="ezl-tree-node ezl-tree-node-root" width="120" height="38" rx="10" />
          <text className="ezl-tree-node-tag" x="60" y="16">
            LEAD CAPTURE
          </text>
          <text className="ezl-tree-node-h" x="60" y="32">
            Form submit
          </text>
        </g>

        {/* level 1 — budget gate */}
        <g transform="translate(440, 132)">
          <rect className="ezl-tree-node ezl-tree-node-gate" width="120" height="38" rx="10" />
          <text className="ezl-tree-node-tag" x="60" y="16">
            HOP 1 · BUDGET
          </text>
          <text className="ezl-tree-node-h" x="60" y="32">
            ≥ $10k?
          </text>
        </g>

        {/* level 2 — fundability tier (high path) + nurture (low path) */}
        <g transform="translate(260, 252)">
          <rect className="ezl-tree-node ezl-tree-node-gate" width="120" height="38" rx="10" />
          <text className="ezl-tree-node-tag" x="60" y="16">
            HOP 2 · TIER
          </text>
          <text className="ezl-tree-node-h" x="60" y="32">
            A / B / C / D?
          </text>
        </g>
        <g transform="translate(620, 252)">
          <rect className="ezl-tree-node ezl-tree-node-gate" width="120" height="38" rx="10" />
          <text className="ezl-tree-node-tag" x="60" y="16">
            HOP 2 · INTENT
          </text>
          <text className="ezl-tree-node-h" x="60" y="32">
            Hot · warm · cold
          </text>
        </g>

        {/* level 3 — time-of-day + source gates */}
        <g transform="translate(140, 372)">
          <rect className="ezl-tree-node ezl-tree-node-gate" width="120" height="38" rx="10" />
          <text className="ezl-tree-node-tag" x="60" y="16">
            HOP 3 · CALENDAR
          </text>
          <text className="ezl-tree-node-h" x="60" y="32">
            Senior · standard
          </text>
        </g>
        <g transform="translate(380, 372)">
          <rect className="ezl-tree-node ezl-tree-node-gate" width="120" height="38" rx="10" />
          <text className="ezl-tree-node-tag" x="60" y="16">
            HOP 3 · OFFER
          </text>
          <text className="ezl-tree-node-h" x="60" y="32">
            Masterclass · ebook
          </text>
        </g>
        <g transform="translate(500, 372)">
          <rect className="ezl-tree-node ezl-tree-node-gate" width="120" height="38" rx="10" />
          <text className="ezl-tree-node-tag" x="60" y="16">
            HOP 3 · WEBINAR
          </text>
          <text className="ezl-tree-node-h" x="60" y="32">
            Live · recorded
          </text>
        </g>
        <g transform="translate(740, 372)">
          <rect
            className="ezl-tree-node ezl-tree-node-gate ezl-tree-node-traced"
            width="120"
            height="38"
            rx="10"
          />
          <text className="ezl-tree-node-tag" x="60" y="16">
            HOP 3 · CALENDAR
          </text>
          <text className="ezl-tree-node-h" x="60" y="32">
            Senior · standard
          </text>
        </g>

        {/* level 4 — terminals */}
        <g transform="translate(70, 492)">
          <rect className="ezl-tree-node ezl-tree-node-term" width="120" height="38" rx="10" />
          <text className="ezl-tree-node-tag" x="60" y="16">
            TERMINAL
          </text>
          <text className="ezl-tree-node-h" x="60" y="32">
            Calendar · senior
          </text>
        </g>
        <g transform="translate(310, 492)">
          <rect className="ezl-tree-node ezl-tree-node-term" width="120" height="38" rx="10" />
          <text className="ezl-tree-node-tag" x="60" y="16">
            TERMINAL
          </text>
          <text className="ezl-tree-node-h" x="60" y="32">
            Masterclass
          </text>
        </g>
        <g transform="translate(430, 492)">
          <rect className="ezl-tree-node ezl-tree-node-term" width="120" height="38" rx="10" />
          <text className="ezl-tree-node-tag" x="60" y="16">
            TERMINAL
          </text>
          <text className="ezl-tree-node-h" x="60" y="32">
            Webinar live
          </text>
        </g>
        <g transform="translate(570, 492)">
          <rect className="ezl-tree-node ezl-tree-node-term" width="120" height="38" rx="10" />
          <text className="ezl-tree-node-tag" x="60" y="16">
            TERMINAL
          </text>
          <text className="ezl-tree-node-h" x="60" y="32">
            Webinar replay
          </text>
        </g>
        <g transform="translate(690, 492)">
          <rect
            className="ezl-tree-node ezl-tree-node-term ezl-tree-node-traced"
            width="120"
            height="38"
            rx="10"
          />
          <text className="ezl-tree-node-tag" x="60" y="16">
            TERMINAL
          </text>
          <text className="ezl-tree-node-h" x="60" y="32">
            Calendar · senior
          </text>
        </g>
        <g transform="translate(820, 492)">
          <rect className="ezl-tree-node ezl-tree-node-term" width="120" height="38" rx="10" />
          <text className="ezl-tree-node-tag" x="60" y="16">
            TERMINAL
          </text>
          <text className="ezl-tree-node-h" x="60" y="32">
            Calendar · standard
          </text>
        </g>
      </svg>

      <div className="ezl-tree-legend">
        <div>
          <span className="ezl-tree-legend-dot ezl-tree-legend-dot-buyer" />
          Animated dot = Jordan M.&apos;s actual path through the pipeline
        </div>
        <div>
          <span className="ezl-tree-legend-dot ezl-tree-legend-dot-edge" />
          Solid edges = current routing rules · dashed = your A/B test surface
        </div>
      </div>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`ezl-faq-item ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="ezl-faq-q"
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
      >
        <span>{q}</span>
        <span className="ezl-faq-chev" aria-hidden>
          {open ? '−' : '+'}
        </span>
      </button>
      {open ? <div className="ezl-faq-a">{a}</div> : null}
    </div>
  );
}

/* ================================= CSS =================================== */

const CSS = `
.ezl-root {
  --ezk-blue: #3B82F6;
  --ezk-blue-2: #60A5FA;
  --ezk-blue-deep: #1E3A8A;
  --ezk-blue-light: #F0F9FF;
  --ezk-ink: #0F172A;
  --ezk-ink-2: #1E293B;
  --ezk-mute: #64748B;
  --ezk-line: rgba(59, 130, 246, 0.12);
  --ezk-line-strong: rgba(59, 130, 246, 0.22);

  position: relative;
  background: linear-gradient(180deg, #F0F9FF 0%, #FFFFFF 30%, #F8FAFC 65%, #FFFFFF 100%);
  color: var(--ezk-ink);
  font-family: inherit;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
  overflow-x: hidden;
}
.ezl-root * { box-sizing: border-box; }
.ezl-root a { color: inherit; text-decoration: none; }
.ezl-root button { font-family: inherit; cursor: pointer; }

.ezl-mesh {
  position: fixed; inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse 60% 40% at 15% 20%, rgba(96, 165, 250, 0.18) 0%, transparent 60%),
    radial-gradient(ellipse 50% 60% at 85% 30%, rgba(59, 130, 246, 0.12) 0%, transparent 55%),
    radial-gradient(ellipse 70% 50% at 50% 90%, rgba(96, 165, 250, 0.10) 0%, transparent 55%);
  animation: ezlMeshDrift 24s ease-in-out infinite;
}
@keyframes ezlMeshDrift {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(-30px, 20px) scale(1.05); }
  66% { transform: translate(20px, -10px) scale(0.98); }
}

.ezl-container { max-width: 1180px; margin: 0 auto; padding: 0 32px; position: relative; z-index: 1; }
.ezl-container-narrow { max-width: 820px; margin: 0 auto; padding: 0 32px; position: relative; z-index: 1; }

.ezl-grad-blue { background: linear-gradient(120deg, var(--ezk-blue) 0%, var(--ezk-blue-2) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent; }
.ezl-grad-blue-deep { background: linear-gradient(120deg, var(--ezk-blue-deep) 0%, var(--ezk-blue) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent; }

/* NAV */
.ezl-nav {
  position: sticky; top: 0; z-index: 40;
  background: rgba(255, 255, 255, 0.85);
  border-bottom: 1px solid var(--ezk-line);
  backdrop-filter: blur(10px);
}
.ezl-nav-inner {
  padding: 14px 32px;
  display: flex; align-items: center; gap: 32px;
}
.ezl-brand {
  display: inline-flex; align-items: center; gap: 10px;
  color: var(--ezk-blue);
}
.ezl-brand-mark {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--ezk-blue) 0%, var(--ezk-blue-2) 100%);
  color: #fff;
  box-shadow: 0 8px 24px -8px rgba(59, 130, 246, 0.45);
}
.ezl-brand-word { font-weight: 700; font-size: 16px; letter-spacing: -0.01em; color: var(--ezk-ink); }
.ezl-brand-l { color: var(--ezk-blue); }
.ezl-brand-slash { color: var(--ezk-mute); margin: 0 1px; font-weight: 400; }
.ezl-brand-r { color: var(--ezk-ink); }
.ezl-nav-links {
  display: inline-flex; gap: 22px;
  margin-left: 16px;
  font-size: 13.5px; color: var(--ezk-ink-2);
}
.ezl-nav-links a:hover { color: var(--ezk-blue); }
.ezl-nav-cta-group { margin-left: auto; display: inline-flex; align-items: center; gap: 14px; }
.ezl-nav-link { font-size: 13.5px; color: var(--ezk-ink-2); }
.ezl-nav-link:hover { color: var(--ezk-blue); }

/* BUTTONS */
.ezl-btn-primary {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 18px;
  background: linear-gradient(135deg, var(--ezk-blue) 0%, var(--ezk-blue-2) 100%);
  color: #fff;
  font-size: 13.5px; font-weight: 600;
  border-radius: 999px;
  border: 0;
  box-shadow: 0 12px 24px -8px rgba(59, 130, 246, 0.45);
  transition: transform .15s ease, box-shadow .15s ease;
}
.ezl-btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 32px -8px rgba(59, 130, 246, 0.55);
}
.ezl-btn-lg { padding: 13px 26px; font-size: 14.5px; }
.ezl-btn-xl { padding: 16px 30px; font-size: 16px; }
.ezl-btn-ghost {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 18px;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid var(--ezk-line-strong);
  color: var(--ezk-ink);
  font-size: 13.5px; font-weight: 600;
  border-radius: 999px;
  transition: all .15s ease;
}
.ezl-btn-ghost:hover {
  background: #fff;
  border-color: var(--ezk-blue);
  color: var(--ezk-blue);
}

/* REVEAL */
.ezl-reveal {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.7s cubic-bezier(0.22, 0.61, 0.36, 1),
              transform 0.7s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.ezl-reveal.is-visible {
  opacity: 1;
  transform: translateY(0);
}

/* EYEBROW */
.ezl-eyebrow, .ezl-section-eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 11px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--ezk-blue);
  text-transform: uppercase;
  padding: 6px 14px;
  background: rgba(59, 130, 246, 0.10);
  border: 1px solid var(--ezk-line);
  border-radius: 999px;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
}
.ezl-eyebrow-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--ezk-blue-2);
  box-shadow: 0 0 0 0 rgba(96, 165, 250, 0.5);
  animation: ezlPulse 1.6s ease-in-out infinite;
}
@keyframes ezlPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(96, 165, 250, 0.5); }
  50% { box-shadow: 0 0 0 8px rgba(96, 165, 250, 0); }
}

/* HERO */
.ezl-hero {
  position: relative;
  padding: 80px 0 56px;
}
.ezl-hero-inner {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  gap: 56px;
  align-items: center;
}
.ezl-hero-l { display: flex; flex-direction: column; gap: 24px; align-items: flex-start; }
.ezl-hero-r {
  position: relative;
  min-height: 480px;
  display: flex; align-items: center; justify-content: center;
}
.ezl-h1 {
  font-size: clamp(48px, 6vw, 80px);
  font-weight: 600;
  letter-spacing: -0.04em; line-height: 1.02;
  margin: 0;
  color: var(--ezk-ink);
}
.ezl-sub {
  font-size: 19px; line-height: 1.55;
  color: var(--ezk-ink-2);
  max-width: 620px;
  margin: 0;
}
.ezl-chips {
  display: flex; flex-wrap: wrap; gap: 8px;
  margin-top: 4px;
}
.ezl-chip {
  display: inline-flex; align-items: center;
  font-size: 12px; letter-spacing: 0.04em;
  color: var(--ezk-ink-2);
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.75);
  border: 1px solid var(--ezk-line);
  border-radius: 999px;
}
.ezl-hero-cta-row {
  display: flex; gap: 12px; flex-wrap: wrap;
  margin-top: 4px;
}
.ezl-ticker {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 0;
  margin-top: 16px;
  padding: 20px 0;
  border-top: 1px solid var(--ezk-line);
  width: 100%;
}
.ezl-ticker-item {
  padding-right: 16px;
  border-right: 1px solid var(--ezk-line);
}
.ezl-ticker-item:last-child { border-right: 0; }
.ezl-ticker-v {
  font-size: 24px; font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--ezk-ink);
  font-variant-numeric: tabular-nums;
}
.ezl-ticker-k {
  margin-top: 2px;
  font-size: 11px; letter-spacing: 0.14em;
  color: var(--ezk-mute);
  text-transform: uppercase;
  font-weight: 600;
}
.ezl-ticker-d {
  margin-top: 6px;
  font-size: 11.5px; color: var(--ezk-blue);
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
}

/* PARTICLES */
.ezl-particles {
  position: absolute; inset: 0;
  pointer-events: none;
  z-index: 0;
}
.ezl-particle {
  position: absolute;
  border-radius: 999px;
  background: var(--ezk-blue-2);
  box-shadow: 0 0 6px rgba(96, 165, 250, 0.5);
  animation: ezlFloat 12s ease-in-out infinite;
  opacity: 0.4;
}
@keyframes ezlFloat {
  0% { transform: translateY(0) translateX(0); opacity: 0; }
  10% { opacity: 0.55; }
  50% { transform: translateY(-40px) translateX(20px); opacity: 0.4; }
  90% { opacity: 0.4; }
  100% { transform: translateY(-80px) translateX(-10px); opacity: 0; }
}

/* TILT */
.ezl-tilt-scene {
  perspective: 1400px;
  perspective-origin: 50% 50%;
  width: 100%;
  display: flex; align-items: center; justify-content: center;
  position: relative;
  z-index: 2;
}
.ezl-tilt-card {
  --tx: 6deg;
  --ty: -10deg;
  transform-style: preserve-3d;
  transform: rotateX(var(--tx)) rotateY(var(--ty));
  transition: transform .35s cubic-bezier(0.22, 0.61, 0.36, 1);
  will-change: transform;
}

/* MOCK CARD */
.ezl-mock {
  width: 440px;
  background: rgba(255, 255, 255, 0.97);
  border: 1px solid var(--ezk-line-strong);
  border-radius: 24px;
  padding: 26px;
  box-shadow:
    0 60px 110px -50px rgba(59, 130, 246, 0.55),
    0 30px 60px -30px rgba(59, 130, 246, 0.35),
    0 1px 0 rgba(255, 255, 255, 1) inset;
}
.ezl-mock-head {
  display: flex; align-items: center; justify-content: space-between;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--ezk-line);
}
.ezl-mock-pill {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 10.5px; letter-spacing: 0.20em; font-weight: 700;
  color: var(--ezk-blue);
  text-transform: uppercase;
  padding: 4px 10px;
  background: rgba(96, 165, 250, 0.14);
  border-radius: 999px;
}
.ezl-mock-pill-dot { width: 5px; height: 5px; border-radius: 999px; background: var(--ezk-blue-2); }
.ezl-mock-meta {
  font-size: 9px; letter-spacing: 0.18em;
  color: var(--ezk-mute);
  text-transform: uppercase;
  padding: 3px 8px;
  background: rgba(15, 23, 42, 0.04);
  border-radius: 6px;
}
.ezl-mock-project {
  margin-top: 14px;
  font-size: 10.5px; letter-spacing: 0.22em;
  color: var(--ezk-mute);
  text-transform: uppercase;
}
.ezl-mock-name {
  margin-top: 4px;
  font-size: 38px; font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--ezk-ink);
  display: flex; align-items: baseline; gap: 12px;
  flex-wrap: wrap;
}
.ezl-mock-name-sub {
  font-size: 12px; font-weight: 600;
  color: var(--ezk-blue);
  text-transform: uppercase;
  letter-spacing: 0.18em;
}
.ezl-mock-rows {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--ezk-line);
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 18px;
}
.ezl-mock-k {
  font-size: 9px; letter-spacing: 0.20em;
  color: var(--ezk-mute);
  text-transform: uppercase;
  font-weight: 600;
}
.ezl-mock-v {
  margin-top: 4px;
  font-size: 14px; font-weight: 600;
  color: var(--ezk-ink);
}
.ezl-mock-bar {
  margin-top: 18px;
  height: 6px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.06);
  overflow: hidden;
}
.ezl-mock-bar-fill {
  height: 100%;
  width: 80%;
  background: linear-gradient(90deg, var(--ezk-blue-deep) 0%, var(--ezk-blue-2) 100%);
  border-radius: 999px;
  animation: ezlBarFill 1.8s ease-out;
}
@keyframes ezlBarFill {
  from { width: 0%; }
  to { width: 80%; }
}
.ezl-mock-stages {
  margin-top: 10px;
  display: flex; justify-content: space-between;
  font-size: 9px; letter-spacing: 0.10em;
  color: var(--ezk-mute);
  text-transform: uppercase;
  font-weight: 600;
}
.ezl-mock-stages .on { color: var(--ezk-blue); }
.ezl-mock-stages .cur {
  color: var(--ezk-blue-deep);
  position: relative;
}
.ezl-mock-stages .cur::after {
  content: '';
  position: absolute; bottom: -4px; left: 50%;
  transform: translateX(-50%);
  width: 4px; height: 4px; border-radius: 999px;
  background: var(--ezk-blue-2);
}
.ezl-mock-cta {
  margin-top: 18px;
  padding: 13px 16px;
  text-align: center;
  background: linear-gradient(135deg, var(--ezk-blue-deep) 0%, var(--ezk-blue) 100%);
  color: #fff;
  border-radius: 12px;
  font-size: 13.5px; font-weight: 700;
  letter-spacing: 0.02em;
}
.ezl-mock-foot {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--ezk-line);
  font-size: 10px; letter-spacing: 0.14em;
  color: var(--ezk-mute);
  text-transform: uppercase;
  text-align: center;
}

/* SECTIONS */
.ezl-section {
  position: relative;
  padding: 80px 0;
}
.ezl-section-eyebrow { margin-bottom: 18px; }
.ezl-h2 {
  font-size: clamp(34px, 4.4vw, 56px);
  font-weight: 600;
  letter-spacing: -0.034em; line-height: 1.08;
  margin: 0 0 14px;
  color: var(--ezk-ink);
}
.ezl-section-sub {
  font-size: 17px; line-height: 1.6;
  color: var(--ezk-ink-2);
  max-width: 760px;
  margin: 0 0 36px;
}

/* VS GRID */
.ezl-vs-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 18px;
}
.ezl-vs-side {
  padding: 28px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--ezk-line);
}
.ezl-vs-with {
  background:
    radial-gradient(ellipse 80% 100% at 100% 0%, rgba(96, 165, 250, 0.18), transparent 70%),
    rgba(255, 255, 255, 0.96);
  border-color: var(--ezk-line-strong);
  box-shadow: 0 22px 50px -28px rgba(59, 130, 246, 0.30);
}
.ezl-vs-eyebrow {
  font-size: 11px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--ezk-mute);
  text-transform: uppercase;
  margin-bottom: 18px;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
}
.ezl-vs-eyebrow.accent { color: var(--ezk-blue); }
.ezl-vs-stat-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 18px;
}
.ezl-vs-stat {}
.ezl-vs-stat-v {
  font-size: 38px; font-weight: 800; letter-spacing: -0.03em;
  color: var(--ezk-ink);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.ezl-vs-stat-accent .ezl-vs-stat-v {
  background: linear-gradient(135deg, var(--ezk-blue-deep) 0%, var(--ezk-blue) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.ezl-vs-stat-l {
  margin-top: 6px;
  font-size: 12.5px; color: var(--ezk-mute);
  line-height: 1.5;
}

/* STAGES */
.ezl-stages {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 18px;
  perspective: 1400px;
}
.ezl-stage {
  position: relative;
  padding: 26px;
  background:
    radial-gradient(ellipse 80% 60% at 0% 0%, rgba(96, 165, 250, 0.12), transparent 65%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 251, 255, 0.98) 100%);
  border: 1px solid var(--ezk-line-strong);
  border-radius: 22px;
  box-shadow: 0 22px 60px -32px rgba(59, 130, 246, 0.28);
  transition: transform .35s cubic-bezier(0.22, 0.61, 0.36, 1),
              box-shadow .35s cubic-bezier(0.22, 0.61, 0.36, 1);
  overflow: hidden;
}
.ezl-stage:hover {
  transform: translateY(-6px) rotateX(2deg);
  box-shadow: 0 36px 80px -32px rgba(59, 130, 246, 0.40);
}
.ezl-stage-glow {
  position: absolute; inset: 0;
  background: radial-gradient(circle at 50% 110%, rgba(96, 165, 250, 0.18), transparent 60%);
  opacity: 0;
  transition: opacity .35s ease;
  pointer-events: none;
}
.ezl-stage:hover .ezl-stage-glow { opacity: 1; }
.ezl-stage > * { position: relative; z-index: 1; }
.ezl-stage-n {
  display: inline-block;
  padding: 3px 8px;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10px; letter-spacing: 0.20em; font-weight: 700;
  color: var(--ezk-blue);
  background: rgba(96, 165, 250, 0.10);
  border: 1px solid rgba(59, 130, 246, 0.20);
  border-radius: 6px;
}
.ezl-stage-h {
  margin: 14px 0 6px;
  font-size: 22px; font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--ezk-ink);
}
.ezl-stage-b {
  margin: 0 0 14px;
  font-size: 13.5px; line-height: 1.55;
  color: var(--ezk-ink-2);
}
.ezl-stage-items {
  list-style: none; padding: 0; margin: 0 0 14px;
  display: flex; flex-direction: column; gap: 6px;
}
.ezl-stage-items li {
  display: inline-flex; align-items: center; gap: 10px;
  font-size: 13px; color: var(--ezk-ink-2);
}
.ezl-stage-mark {
  display: inline-flex; align-items: center; justify-content: center;
  width: 18px; height: 18px;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--ezk-blue) 0%, var(--ezk-blue-2) 100%);
  color: #fff;
  flex-shrink: 0;
}
.ezl-stage-time {
  display: inline-block;
  padding: 4px 10px;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 11px; color: var(--ezk-mute);
  background: rgba(15, 23, 42, 0.04);
  border-radius: 999px;
}

/* PILLARS — same shape as MedPay sales deck, sky-blue */
.ezl-pillars {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 18px;
  perspective: 1400px;
}
.ezl-pillar {
  position: relative;
  background:
    radial-gradient(ellipse 80% 60% at 0% 0%, rgba(96, 165, 250, 0.10), transparent 65%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.97) 0%, rgba(248, 251, 255, 0.97) 100%);
  border: 1px solid var(--ezk-line-strong);
  border-radius: 22px;
  padding: 26px;
  box-shadow:
    0 22px 60px -32px rgba(59, 130, 246, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  transition: transform .35s cubic-bezier(0.22, 0.61, 0.36, 1),
              box-shadow .35s cubic-bezier(0.22, 0.61, 0.36, 1);
  overflow: hidden;
}
.ezl-pillar:hover {
  transform: translateY(-6px) rotateX(2deg);
  box-shadow:
    0 36px 80px -32px rgba(59, 130, 246, 0.40),
    inset 0 1px 0 rgba(255, 255, 255, 1);
}
.ezl-pillar-glow {
  position: absolute; inset: 0;
  background: radial-gradient(circle at 50% 110%, rgba(96, 165, 250, 0.20), transparent 60%);
  opacity: 0;
  transition: opacity .35s ease;
  pointer-events: none;
}
.ezl-pillar:hover .ezl-pillar-glow { opacity: 1; }
.ezl-pillar > * { position: relative; z-index: 1; }
.ezl-pillar-n {
  display: inline-block;
  padding: 3px 8px;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10px; letter-spacing: 0.20em; font-weight: 700;
  color: var(--ezk-blue);
  background: rgba(96, 165, 250, 0.10);
  border: 1px solid rgba(59, 130, 246, 0.20);
  border-radius: 6px;
}
.ezl-pillar-metric {
  margin-top: 12px;
  font-size: 40px; font-weight: 700;
  letter-spacing: -0.038em;
  line-height: 1;
  background: linear-gradient(135deg, var(--ezk-blue-deep) 0%, var(--ezk-blue) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  font-variant-numeric: tabular-nums;
}
.ezl-pillar-h {
  margin-top: 10px;
  font-size: 20px; font-weight: 600;
  letter-spacing: -0.018em;
  color: var(--ezk-ink);
}
.ezl-pillar-b {
  margin-top: 6px;
  font-size: 13.5px; color: var(--ezk-ink-2); line-height: 1.55;
}
.ezl-pillar-tags {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px dashed var(--ezk-line);
  display: flex; flex-wrap: wrap;
  gap: 6px;
}
.ezl-pillar-tag {
  font-size: 10.5px; letter-spacing: 0.04em;
  font-weight: 600;
  color: var(--ezk-blue);
  background: rgba(96, 165, 250, 0.08);
  border: 1px solid rgba(59, 130, 246, 0.16);
  padding: 4px 8px;
  border-radius: 6px;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
}

/* PRICING ROW */
.ezl-pricing-row {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.ezl-pricing-card {
  padding: 28px;
  background: #fff;
  border: 1px solid var(--ezk-line);
  border-radius: 22px;
  display: flex; flex-direction: column; gap: 12px;
  box-shadow: 0 18px 50px -28px rgba(59, 130, 246, 0.22);
}
.ezl-pricing-card-cta {
  background:
    radial-gradient(ellipse 70% 100% at 0% 0%, rgba(96, 165, 250, 0.20), transparent 65%),
    linear-gradient(135deg, var(--ezk-blue-deep) 0%, #1E40AF 100%);
  color: #fff;
  border-color: rgba(96, 165, 250, 0.34);
}
.ezl-pricing-card-cta .ezl-pricing-tag {
  color: var(--ezk-blue-2);
}
.ezl-pricing-card-cta .ezl-pricing-v {
  background: linear-gradient(135deg, #fff 0%, var(--ezk-blue-2) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  font-size: 28px;
}
.ezl-pricing-tag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px; letter-spacing: 0.22em; font-weight: 700;
  color: var(--ezk-blue); text-transform: uppercase;
}
.ezl-pricing-tag.accent { color: var(--ezk-blue-2); }
.ezl-pricing-v {
  font-size: 42px; font-weight: 700;
  letter-spacing: -0.035em; line-height: 1;
  background: linear-gradient(135deg, var(--ezk-blue-deep) 0%, var(--ezk-blue) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  font-variant-numeric: tabular-nums;
}
.ezl-pricing-b {
  font-size: 13.5px; line-height: 1.5; color: var(--ezk-ink-2);
  margin-top: auto;
}
.ezl-pricing-card-cta .ezl-pricing-b { color: rgba(255, 255, 255, 0.75); }

/* FAQ */
.ezl-faq {
  display: flex; flex-direction: column; gap: 8px;
  margin-top: 8px;
}
.ezl-faq-item {
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--ezk-line);
  border-radius: 14px;
  overflow: hidden;
  transition: border-color .15s ease;
}
.ezl-faq-item.is-open { border-color: var(--ezk-line-strong); }
.ezl-faq-q {
  width: 100%;
  padding: 18px 22px;
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px;
  background: transparent;
  border: 0;
  cursor: pointer;
  font-size: 16px; font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--ezk-ink);
  text-align: left;
}
.ezl-faq-chev {
  font-size: 22px; font-weight: 400;
  color: var(--ezk-blue);
  line-height: 1;
}
.ezl-faq-a {
  padding: 0 22px 18px;
  font-size: 14px; line-height: 1.6;
  color: var(--ezk-ink-2);
}

/* FINAL CTA */
.ezl-section-cta { padding: 80px 0 100px; }
.ezl-cta-card {
  padding: 48px;
  background:
    radial-gradient(ellipse 60% 100% at 0% 0%, rgba(96, 165, 250, 0.20), transparent 65%),
    linear-gradient(135deg, var(--ezk-blue-deep) 0%, #1E40AF 100%);
  border-radius: 28px;
  color: #fff;
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 32px;
  align-items: center;
  box-shadow:
    0 40px 80px -40px rgba(59, 130, 246, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.10);
}
.ezl-cta-tag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px; letter-spacing: 0.22em; font-weight: 700;
  color: var(--ezk-blue-2);
  text-transform: uppercase;
  margin-bottom: 12px;
}
.ezl-cta-h {
  margin: 0 0 14px;
  font-size: clamp(28px, 3vw, 36px);
  font-weight: 600;
  letter-spacing: -0.022em;
  line-height: 1.15;
  color: #fff;
}
.ezl-cta-b {
  margin: 0;
  font-size: 14.5px; line-height: 1.6;
  color: rgba(255, 255, 255, 0.78);
  max-width: 480px;
}
.ezl-cta-actions {
  display: flex; flex-direction: column; gap: 10px;
  align-items: stretch;
}
.ezl-cta-actions .ezl-btn-ghost {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.18);
  color: #fff;
  justify-content: center;
}
.ezl-cta-actions .ezl-btn-ghost:hover {
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.3);
}
.ezl-cta-actions .ezl-btn-primary { justify-content: center; }

/* FOOTER */
.ezl-footer {
  position: relative; z-index: 1;
  padding: 36px 0;
  border-top: 1px solid var(--ezk-line);
  background: rgba(255, 255, 255, 0.7);
}
.ezl-footer-inner {
  display: flex; align-items: center; justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
}
.ezl-footer-brand {
  display: inline-flex; align-items: center; gap: 10px;
  font-size: 13.5px; color: var(--ezk-ink-2);
  font-weight: 500;
}
.ezl-footer-links {
  display: inline-flex; gap: 22px;
  font-size: 13px; color: var(--ezk-ink-2);
}
.ezl-footer-links a:hover { color: var(--ezk-blue); }
.ezl-footer-meta {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 11px; letter-spacing: 0.08em;
  color: var(--ezk-mute);
  text-align: right;
  flex-basis: 100%;
}

/* RESPONSIVE */
@media (max-width: 980px) {
  .ezl-hero-inner { grid-template-columns: 1fr; gap: 36px; }
  .ezl-hero-r { min-height: 360px; }
  .ezl-mock { width: 100%; max-width: 440px; }
  .ezl-ticker { grid-template-columns: 1fr 1fr; }
  .ezl-ticker-item:nth-child(2) { border-right: 0; }
  .ezl-vs-grid { grid-template-columns: 1fr; }
  .ezl-vs-stat-grid { grid-template-columns: 1fr 1fr; }
  .ezl-stages { grid-template-columns: 1fr; }
  .ezl-pillars { grid-template-columns: 1fr; }
  .ezl-pricing-row { grid-template-columns: 1fr; }
  .ezl-cta-card { grid-template-columns: 1fr; padding: 32px; }
  .ezl-nav-links { display: none; }
  .ezl-footer-inner { flex-direction: column; align-items: flex-start; }
  .ezl-footer-meta { text-align: left; }
}

/* ========================== DEEP-DIVE SECTIONS ============================ */

/* Alternating section bg — dark navy panel for HELIX deep-dives */
.ezl-section-dark {
  background:
    radial-gradient(ellipse 60% 50% at 15% 10%, rgba(96, 165, 250, 0.18) 0%, transparent 60%),
    radial-gradient(ellipse 50% 60% at 85% 90%, rgba(59, 130, 246, 0.16) 0%, transparent 55%),
    linear-gradient(180deg, #0F172A 0%, #0A0F1F 100%);
  margin-top: 64px;
  margin-bottom: 32px;
  color: #EEF2F8;
  border-top: 1px solid rgba(96, 165, 250, 0.18);
  border-bottom: 1px solid rgba(96, 165, 250, 0.18);
}
.ezl-section-dark .ezl-h2 { color: #fff; }
.ezl-section-dark .ezl-grad-blue {
  background: linear-gradient(120deg, var(--ezk-blue-2) 0%, #93C5FD 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.ezl-section-dark .ezl-grad-blue-deep {
  background: linear-gradient(120deg, #C7D2FE 0%, #fff 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.ezl-section-dark .ezl-section-sub { color: rgba(238, 242, 248, 0.74); }
.ezl-section-dark .ezl-section-eyebrow {
  background: rgba(96, 165, 250, 0.14);
  border-color: rgba(96, 165, 250, 0.34);
  color: var(--ezk-blue-2);
}

/* DEEP GRID — 2-col layout for smart-form deep-dive */
.ezl-deep-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 56px;
  align-items: center;
}
.ezl-deep-left { display: flex; flex-direction: column; gap: 18px; }
.ezl-deep-right { position: relative; min-height: 480px; display: flex; align-items: center; justify-content: center; }

.ezl-deep-bullets {
  list-style: none; padding: 0; margin: 8px 0 0;
  display: flex; flex-direction: column;
  gap: 14px;
}
.ezl-deep-bullets li {
  padding: 18px 20px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(96, 165, 250, 0.22);
  border-radius: 14px;
  display: flex; flex-direction: column; gap: 4px;
  transition: transform .25s ease, border-color .25s ease, background .25s ease;
}
.ezl-deep-bullets li:hover {
  transform: translateX(4px);
  background: rgba(96, 165, 250, 0.08);
  border-color: rgba(96, 165, 250, 0.38);
}
.ezl-deep-bullet-tag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10px; letter-spacing: 0.22em; font-weight: 700;
  color: var(--ezk-blue-2);
  text-transform: uppercase;
}
.ezl-deep-bullet-h {
  font-size: 16px; font-weight: 600;
  letter-spacing: -0.014em;
  color: #fff;
}
.ezl-deep-bullet-b {
  margin-top: 4px;
  font-size: 13.5px; line-height: 1.55;
  color: rgba(238, 242, 248, 0.74);
}

/* MORPHING FORM MOCK — 3D-tilted form with conditional fields */
.ezl-form-mock {
  position: relative; z-index: 2;
  width: 420px;
}
.ezl-form-bezel {
  background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
  padding: 14px;
  border-radius: 22px;
  box-shadow:
    0 60px 110px -50px rgba(59, 130, 246, 0.55),
    0 30px 60px -30px rgba(59, 130, 246, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.10);
}
.ezl-form-screen {
  background: #fff;
  border-radius: 14px;
  padding: 24px;
}
.ezl-form-header {
  display: flex; justify-content: space-between; align-items: center;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--ezk-line);
}
.ezl-form-brand {
  font-size: 10.5px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--ezk-blue);
  text-transform: uppercase;
}
.ezl-form-meta {
  font-size: 9px; letter-spacing: 0.16em;
  color: var(--ezk-mute);
  text-transform: uppercase;
  padding: 3px 8px;
  background: rgba(15, 23, 42, 0.04);
  border-radius: 6px;
}
.ezl-form-title {
  margin-top: 16px;
  font-size: 22px; font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--ezk-ink);
}
.ezl-form-sub {
  margin-top: 4px;
  font-size: 12.5px;
  color: var(--ezk-mute);
}
.ezl-form-fields {
  margin-top: 16px;
  display: flex; flex-direction: column;
  gap: 8px;
}
.ezl-form-field {
  display: flex; flex-direction: column;
  gap: 4px;
  padding: 11px 14px;
  background: rgba(59, 130, 246, 0.04);
  border: 1px solid var(--ezk-line);
  border-radius: 10px;
  opacity: 0;
  animation: ezlFieldIn 0.5s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
}
.ezl-form-field.is-conditional {
  background: rgba(96, 165, 250, 0.10);
  border-color: rgba(96, 165, 250, 0.34);
  box-shadow: 0 4px 14px -6px rgba(59, 130, 246, 0.30);
}
@keyframes ezlFieldIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.ezl-form-field-k {
  display: flex; align-items: center; gap: 8px;
  font-size: 10px; letter-spacing: 0.16em; font-weight: 700;
  color: var(--ezk-mute);
  text-transform: uppercase;
}
.ezl-form-field-flag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 8.5px; letter-spacing: 0.14em; font-weight: 700;
  color: var(--ezk-blue);
  padding: 2px 6px;
  background: rgba(59, 130, 246, 0.10);
  border-radius: 4px;
  text-transform: uppercase;
}
.ezl-form-field-v {
  font-size: 13.5px; font-weight: 600;
  color: var(--ezk-ink);
  font-variant-numeric: tabular-nums;
}
.ezl-form-submit {
  margin-top: 18px;
  padding: 13px;
  text-align: center;
  background: linear-gradient(135deg, var(--ezk-blue-deep) 0%, var(--ezk-blue) 100%);
  color: #fff;
  border-radius: 10px;
  font-size: 13.5px; font-weight: 700;
}
.ezl-form-foot {
  margin-top: 12px;
  display: flex; align-items: center; gap: 8px;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10px; letter-spacing: 0.04em;
  color: var(--ezk-mute);
}
.ezl-form-foot-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--ezk-blue);
  box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
  animation: ezlPulse 1.6s ease-in-out infinite;
}

/* SIGNALS GRID — 3 financial-signal cards */
.ezl-signals-grid {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 28px;
  perspective: 1400px;
  align-items: stretch;
}
.ezl-signal {
  position: relative;
  padding: 26px 24px 24px;
  background:
    radial-gradient(ellipse 80% 60% at 0% 0%, rgba(96, 165, 250, 0.10), transparent 65%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 251, 255, 0.98) 100%);
  border: 1px solid var(--ezk-line-strong);
  border-radius: 20px;
  box-shadow: 0 22px 60px -32px rgba(59, 130, 246, 0.28);
  transition: transform .35s cubic-bezier(0.22, 0.61, 0.36, 1),
              box-shadow .35s cubic-bezier(0.22, 0.61, 0.36, 1);
  overflow: hidden;
  display: flex; flex-direction: column;
  gap: 6px;
}
.ezl-signal-glow {
  position: absolute; inset: 0;
  background: radial-gradient(circle at 50% 110%, rgba(96, 165, 250, 0.20), transparent 60%);
  opacity: 0;
  transition: opacity .35s ease;
  pointer-events: none;
}
.ezl-signal:hover {
  transform: translateY(-4px) rotateX(2deg);
  box-shadow: 0 36px 80px -32px rgba(59, 130, 246, 0.40);
}
.ezl-signal:hover .ezl-signal-glow { opacity: 1; }
.ezl-signal > * { position: relative; z-index: 1; }
.ezl-signal-tag {
  display: inline-block;
  padding: 3px 8px;
  width: fit-content;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10px; letter-spacing: 0.20em; font-weight: 700;
  color: var(--ezk-blue);
  background: rgba(96, 165, 250, 0.10);
  border: 1px solid rgba(59, 130, 246, 0.20);
  border-radius: 6px;
}
.ezl-signal-h {
  margin-top: 8px;
  font-size: 20px; font-weight: 600;
  letter-spacing: -0.018em;
  color: var(--ezk-ink);
}
.ezl-signal-metric {
  margin-top: 6px;
  font-size: 32px; font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 1;
  background: linear-gradient(135deg, var(--ezk-blue-deep) 0%, var(--ezk-blue) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  font-variant-numeric: tabular-nums;
}
.ezl-signal-b {
  margin: 6px 0 0;
  font-size: 13px; line-height: 1.55;
  color: var(--ezk-ink-2);
}
.ezl-signal-list {
  list-style: none; padding: 0; margin: 14px 0 0;
  display: flex; flex-direction: column;
  gap: 6px;
}
.ezl-signal-list li {
  display: grid; grid-template-columns: 18px 1fr;
  gap: 10px; align-items: start;
  font-size: 12.5px; line-height: 1.5;
  color: var(--ezk-ink-2);
}
.ezl-signal-check {
  display: inline-flex; align-items: center; justify-content: center;
  width: 16px; height: 16px;
  border-radius: 999px;
  background: rgba(96, 165, 250, 0.18);
  color: var(--ezk-blue);
  font-size: 10px; font-weight: 700;
  margin-top: 1px;
}
.ezl-signal-foot {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed var(--ezk-line);
  display: flex; flex-direction: column; gap: 2px;
}
.ezl-signal-foot-k {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 9.5px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--ezk-mute);
  text-transform: uppercase;
}
.ezl-signal-foot-v {
  font-size: 11.5px;
  color: var(--ezk-blue);
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
}

/* COMPOSITE TIER STACK */
.ezl-signals-composite {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 36px;
  align-items: center;
  padding: 32px;
  background:
    radial-gradient(ellipse 70% 100% at 0% 0%, rgba(96, 165, 250, 0.16), transparent 65%),
    linear-gradient(135deg, var(--ezk-blue-deep) 0%, #1E40AF 100%);
  border-radius: 24px;
  color: #fff;
  box-shadow:
    0 30px 70px -30px rgba(59, 130, 246, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.10);
}
.ezl-signals-composite-tag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px; letter-spacing: 0.22em; font-weight: 700;
  color: var(--ezk-blue-2);
  text-transform: uppercase;
  margin-bottom: 10px;
}
.ezl-signals-composite-h {
  margin: 0 0 12px;
  font-size: 24px; font-weight: 600;
  letter-spacing: -0.022em;
  color: #fff;
}
.ezl-signals-composite-b {
  margin: 0;
  font-size: 14px; line-height: 1.6;
  color: rgba(255, 255, 255, 0.78);
  max-width: 460px;
}
.ezl-tier-stack {
  display: flex; flex-direction: column;
  gap: 8px;
}
.ezl-tier-row {
  display: grid; grid-template-columns: 40px 110px 1fr;
  gap: 14px; align-items: center;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
}
.ezl-tier-letter {
  display: inline-flex; align-items: center; justify-content: center;
  width: 36px; height: 36px;
  border-radius: 8px;
  font-size: 18px; font-weight: 800;
  letter-spacing: -0.02em;
  color: #fff;
}
.ezl-tier-a .ezl-tier-letter { background: linear-gradient(135deg, #60A5FA 0%, #3B82F6 100%); }
.ezl-tier-b .ezl-tier-letter { background: linear-gradient(135deg, #93C5FD 0%, #60A5FA 100%); }
.ezl-tier-c .ezl-tier-letter { background: linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%); }
.ezl-tier-d .ezl-tier-letter { background: linear-gradient(135deg, #64748B 0%, #475569 100%); }
.ezl-tier-name {
  font-size: 13px; font-weight: 700;
  letter-spacing: 0.02em;
  color: #fff;
}
.ezl-tier-rule {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 11.5px;
  color: rgba(255, 255, 255, 0.74);
}

/* MULTI-HOP ROUTING TREE */
.ezl-tree-scene {
  position: relative;
  margin-top: 8px;
  padding: 16px;
  background: rgba(15, 23, 42, 0.50);
  border: 1px solid rgba(96, 165, 250, 0.24);
  border-radius: 22px;
  overflow: hidden;
}
.ezl-tree-plate {
  position: absolute; inset: 0;
  background:
    radial-gradient(ellipse 60% 60% at 50% 0%, rgba(96, 165, 250, 0.22), transparent 60%),
    radial-gradient(ellipse 50% 50% at 50% 100%, rgba(59, 130, 246, 0.18), transparent 55%);
  pointer-events: none;
}
.ezl-tree-svg {
  position: relative; z-index: 1;
  width: 100%;
  height: auto;
  display: block;
  transform: perspective(1800px) rotateX(6deg);
  transform-origin: 50% 50%;
}
.ezl-tree-edges path {
  fill: none;
  stroke: rgba(96, 165, 250, 0.45);
  stroke-width: 1.8;
  stroke-dasharray: 5 5;
  animation: ezlEdgeDash 8s linear infinite;
}
@keyframes ezlEdgeDash {
  from { stroke-dashoffset: 0; }
  to { stroke-dashoffset: -100; }
}
.ezl-tree-node {
  fill: rgba(15, 23, 42, 0.92);
  stroke: rgba(96, 165, 250, 0.40);
  stroke-width: 1.4;
}
.ezl-tree-node-root {
  fill: url(#) #1E3A8A;
  fill: #1E3A8A;
  stroke: rgba(96, 165, 250, 0.65);
}
.ezl-tree-node-gate {
  fill: rgba(30, 41, 59, 0.96);
  stroke: rgba(96, 165, 250, 0.50);
}
.ezl-tree-node-term {
  fill: rgba(15, 23, 42, 0.92);
  stroke: rgba(96, 165, 250, 0.34);
}
.ezl-tree-node-traced {
  stroke: rgba(96, 165, 250, 1);
  stroke-width: 2.2;
  filter: drop-shadow(0 0 12px rgba(96, 165, 250, 0.6));
}
.ezl-tree-node-tag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 7px;
  letter-spacing: 0.16em;
  font-weight: 700;
  fill: rgba(96, 165, 250, 0.95);
  text-anchor: middle;
  text-transform: uppercase;
}
.ezl-tree-node-h {
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: -0.01em;
  fill: #fff;
  text-anchor: middle;
}
.ezl-tree-buyer {
  fill: #A78BFA;
  filter: drop-shadow(0 0 6px #A78BFA);
}

.ezl-tree-legend {
  position: relative; z-index: 2;
  margin-top: 16px;
  display: flex; flex-wrap: wrap; gap: 24px;
  font-size: 12px;
  color: rgba(238, 242, 248, 0.78);
}
.ezl-tree-legend > div {
  display: inline-flex; align-items: center; gap: 8px;
}
.ezl-tree-legend-dot {
  width: 10px; height: 10px; border-radius: 999px;
}
.ezl-tree-legend-dot-buyer { background: #A78BFA; box-shadow: 0 0 8px #A78BFA; }
.ezl-tree-legend-dot-edge { background: var(--ezk-blue-2); box-shadow: 0 0 8px rgba(96, 165, 250, 0.6); }

.ezl-routing-callouts {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-top: 24px;
}
.ezl-routing-callout {
  padding: 18px 20px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(96, 165, 250, 0.22);
  border-radius: 14px;
}
.ezl-routing-callout-h {
  font-size: 15px; font-weight: 600;
  letter-spacing: -0.012em;
  color: #fff;
  margin-bottom: 6px;
}
.ezl-routing-callout-b {
  font-size: 13px; line-height: 1.55;
  color: rgba(238, 242, 248, 0.74);
}

/* ROUTING PATTERN CARDS */
.ezl-patterns-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  grid-auto-rows: 1fr;
  gap: 16px;
  align-items: stretch;
}
.ezl-pattern {
  padding: 24px;
  background:
    radial-gradient(ellipse 70% 60% at 0% 0%, rgba(96, 165, 250, 0.10), transparent 65%),
    rgba(255, 255, 255, 0.96);
  border: 1px solid var(--ezk-line-strong);
  border-radius: 20px;
  box-shadow: 0 22px 50px -28px rgba(59, 130, 246, 0.22);
  transition: transform .25s ease, box-shadow .25s ease;
  display: flex; flex-direction: column;
}
.ezl-pattern:hover {
  transform: translateY(-3px);
  box-shadow: 0 32px 70px -28px rgba(59, 130, 246, 0.35);
}
.ezl-pattern-tag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px; letter-spacing: 0.22em; font-weight: 700;
  color: var(--ezk-blue);
  text-transform: uppercase;
}
.ezl-pattern-h {
  margin: 6px 0 6px;
  font-size: 20px; font-weight: 600;
  letter-spacing: -0.018em;
  color: var(--ezk-ink);
}
.ezl-pattern-b {
  margin: 0 0 14px;
  font-size: 13.5px; line-height: 1.55;
  color: var(--ezk-ink-2);
}
.ezl-pattern-hops {
  list-style: none; padding: 12px; margin: 0;
  display: flex; flex-direction: column;
  gap: 8px;
  background: rgba(59, 130, 246, 0.04);
  border: 1px solid var(--ezk-line);
  border-radius: 12px;
  flex: 1;
}
.ezl-pattern-hops li {
  display: grid; grid-template-columns: 30px 1fr;
  gap: 10px; align-items: start;
}
.ezl-pattern-hop-n {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 11px; font-weight: 700;
  color: var(--ezk-blue);
  background: rgba(59, 130, 246, 0.10);
  border-radius: 5px;
  padding: 3px 0;
  text-align: center;
}
.ezl-pattern-hop-text { display: flex; flex-direction: column; gap: 2px; }
.ezl-pattern-hop-h {
  font-size: 13px; font-weight: 600;
  color: var(--ezk-ink);
}
.ezl-pattern-hop-b {
  font-size: 12px; line-height: 1.4;
  color: var(--ezk-mute);
}
.ezl-pattern-outcome {
  margin-top: 14px;
  padding: 14px 16px;
  background: linear-gradient(135deg, var(--ezk-blue-deep) 0%, var(--ezk-blue) 100%);
  border-radius: 12px;
  color: #fff;
  display: flex; flex-direction: column; gap: 4px;
}
.ezl-pattern-outcome-tag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10px; letter-spacing: 0.22em; font-weight: 700;
  color: var(--ezk-blue-2);
  text-transform: uppercase;
}
.ezl-pattern-outcome-v {
  font-size: 13.5px; font-weight: 600;
  letter-spacing: -0.01em;
}

/* PERSONA JOURNEYS */
.ezl-personas-grid {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  align-items: stretch;
}
.ezl-persona {
  padding: 24px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid var(--ezk-line-strong);
  border-radius: 20px;
  box-shadow: 0 22px 50px -28px rgba(59, 130, 246, 0.22);
  display: flex; flex-direction: column;
  transition: transform .25s ease, box-shadow .25s ease;
}
.ezl-persona:hover {
  transform: translateY(-3px);
  box-shadow: 0 32px 70px -28px rgba(59, 130, 246, 0.35);
}
.ezl-persona-head {
  display: grid; grid-template-columns: 44px 1fr auto;
  gap: 12px; align-items: center;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--ezk-line);
}
.ezl-persona-avatar {
  display: inline-flex; align-items: center; justify-content: center;
  width: 44px; height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--ezk-blue) 0%, var(--ezk-blue-2) 100%);
  color: #fff;
  font-size: 16px; font-weight: 800;
  letter-spacing: -0.02em;
}
.ezl-persona-a .ezl-persona-avatar { background: linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%); }
.ezl-persona-b .ezl-persona-avatar { background: linear-gradient(135deg, #93C5FD 0%, #60A5FA 100%); }
.ezl-persona-c .ezl-persona-avatar { background: linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%); }
.ezl-persona-name {
  font-size: 15px; font-weight: 700;
  letter-spacing: -0.014em;
  color: var(--ezk-ink);
}
.ezl-persona-source {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 11px;
  color: var(--ezk-mute);
}
.ezl-persona-tier-pill {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px; letter-spacing: 0.20em; font-weight: 700;
  color: var(--ezk-blue);
  background: rgba(59, 130, 246, 0.10);
  border: 1px solid rgba(59, 130, 246, 0.25);
  padding: 4px 10px;
  border-radius: 999px;
  text-transform: uppercase;
}
.ezl-persona-c .ezl-persona-tier-pill {
  color: #6D28D9;
  background: rgba(167, 139, 250, 0.14);
  border-color: rgba(167, 139, 250, 0.35);
}
.ezl-persona-stats {
  display: grid; grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
  margin: 16px 0;
  padding: 12px;
  background: rgba(59, 130, 246, 0.04);
  border-radius: 10px;
}
.ezl-persona-stat { display: flex; flex-direction: column; gap: 2px; align-items: center; }
.ezl-persona-stat-k {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 9.5px; letter-spacing: 0.16em; font-weight: 700;
  color: var(--ezk-mute);
  text-transform: uppercase;
}
.ezl-persona-stat-v {
  font-size: 16px; font-weight: 700;
  letter-spacing: -0.012em;
  color: var(--ezk-ink);
  font-variant-numeric: tabular-nums;
}

/* PERSONA SIGNALS GRID — 4-up financial signals row */
.ezl-persona-signals {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  margin: 14px 0 12px;
  background: var(--ezk-line);
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--ezk-line);
}
.ezl-persona-signal {
  background: rgba(255, 255, 255, 0.96);
  padding: 10px 4px;
  display: flex; flex-direction: column; gap: 3px; align-items: center;
  text-align: center;
}
.ezl-persona-signal-k {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 8px; letter-spacing: 0.12em; font-weight: 700;
  color: var(--ezk-mute);
  text-transform: uppercase;
}
.ezl-persona-signal-v {
  font-size: 14px; font-weight: 800;
  letter-spacing: -0.014em;
  font-variant-numeric: tabular-nums;
  background: linear-gradient(135deg, var(--ezk-blue-deep) 0%, var(--ezk-blue) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}

/* PERSONA FUNDING ROWS (consumer + merchant) + BMPO + decline */
.ezl-persona-funding {
  padding: 12px 14px;
  background: rgba(59, 130, 246, 0.04);
  border: 1px solid var(--ezk-line);
  border-radius: 10px;
  margin-bottom: 14px;
  display: flex; flex-direction: column; gap: 6px;
}
.ezl-persona-funding-row {
  display: flex; justify-content: space-between; align-items: center;
}
.ezl-persona-funding-l {
  display: inline-flex; align-items: center; gap: 8px;
}
.ezl-persona-funding-check {
  display: inline-flex; align-items: center; justify-content: center;
  width: 16px; height: 16px;
  border-radius: 999px;
  font-size: 10px; font-weight: 700;
}
.ezl-persona-funding-check.is-approved {
  background: rgba(96, 165, 250, 0.22);
  color: var(--ezk-blue);
}
.ezl-persona-funding-check.is-declined {
  background: rgba(167, 139, 250, 0.22);
  color: #6D28D9;
}
.ezl-persona-funding-label {
  font-size: 12.5px; font-weight: 600;
  color: var(--ezk-ink);
}
.ezl-persona-funding-r { display: inline-flex; align-items: center; gap: 8px; }
.ezl-persona-funding-amt {
  font-size: 13.5px; font-weight: 700;
  color: var(--ezk-ink);
  font-variant-numeric: tabular-nums;
}
.ezl-persona-funding-flag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 8.5px; letter-spacing: 0.12em; font-weight: 700;
  padding: 2px 6px;
  border-radius: 5px;
  text-transform: uppercase;
}
.ezl-persona-funding-flag.is-approved {
  background: rgba(96, 165, 250, 0.16);
  color: var(--ezk-blue);
  border: 1px solid rgba(59, 130, 246, 0.28);
}
.ezl-persona-funding-flag.is-declined {
  background: rgba(167, 139, 250, 0.16);
  color: #6D28D9;
  border: 1px solid rgba(167, 139, 250, 0.34);
}
.ezl-persona-bmpo {
  display: flex; justify-content: space-between; align-items: center;
  margin-left: 24px;
  padding: 4px 10px;
  background: rgba(59, 130, 246, 0.06);
  border-left: 2px solid rgba(96, 165, 250, 0.45);
  border-radius: 0 5px 5px 0;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px;
}
.ezl-persona-bmpo-k {
  color: var(--ezk-mute);
  font-weight: 700;
  letter-spacing: 0.06em;
}
.ezl-persona-bmpo-v {
  color: var(--ezk-blue);
  font-weight: 700;
}
.ezl-persona-decline {
  display: flex; justify-content: space-between; align-items: flex-start;
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px dashed var(--ezk-line);
  gap: 10px;
}
.ezl-persona-decline-k {
  flex-shrink: 0;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 9px; letter-spacing: 0.16em; font-weight: 700;
  color: var(--ezk-mute);
  text-transform: uppercase;
}
.ezl-persona-decline-v {
  font-size: 11.5px; line-height: 1.4;
  color: var(--ezk-ink-2);
  font-weight: 600;
  text-align: right;
}
.ezl-persona-path {
  list-style: none; padding: 0; margin: 0 0 14px;
  display: flex; flex-direction: column;
  gap: 0;
  position: relative;
  flex: 1;
}
.ezl-persona-path li {
  position: relative;
  padding: 10px 0 10px 24px;
  border-left: 2px dashed rgba(96, 165, 250, 0.40);
  margin-left: 5px;
}
.ezl-persona-path li:last-child {
  border-left-color: transparent;
}
.ezl-persona-path-dot {
  position: absolute;
  left: -6px; top: 12px;
  width: 10px; height: 10px;
  border-radius: 999px;
  background: var(--ezk-blue);
  box-shadow: 0 0 0 3px #fff, 0 0 0 4px rgba(59, 130, 246, 0.25);
}
.ezl-persona-path li.is-terminal .ezl-persona-path-dot {
  background: #A78BFA;
  box-shadow: 0 0 0 3px #fff, 0 0 0 4px rgba(167, 139, 250, 0.35);
}
.ezl-persona-path-h {
  display: block;
  font-size: 13px; font-weight: 600;
  color: var(--ezk-ink);
  margin-bottom: 2px;
}
.ezl-persona-path-b {
  display: block;
  font-size: 11.5px; line-height: 1.5;
  color: var(--ezk-mute);
}
.ezl-persona-outcome {
  margin-top: auto;
  padding: 12px 14px;
  background: linear-gradient(135deg, var(--ezk-blue-deep) 0%, var(--ezk-blue) 100%);
  border-radius: 10px;
  color: #fff;
  display: flex; flex-direction: column; gap: 2px;
}
.ezl-persona-c .ezl-persona-outcome {
  background: linear-gradient(135deg, #5B21B6 0%, #6D28D9 100%);
}
.ezl-persona-outcome-tag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 9.5px; letter-spacing: 0.22em; font-weight: 700;
  color: rgba(255, 255, 255, 0.75);
  text-transform: uppercase;
}
.ezl-persona-outcome-v {
  font-size: 12.5px; line-height: 1.45;
}

@media (max-width: 980px) {
  .ezl-deep-grid { grid-template-columns: 1fr; gap: 32px; }
  .ezl-deep-right { min-height: 360px; }
  .ezl-form-mock { width: 100%; max-width: 420px; }
  .ezl-signals-grid { grid-template-columns: 1fr; }
  .ezl-signals-composite { grid-template-columns: 1fr; }
  .ezl-routing-callouts { grid-template-columns: 1fr; }
  .ezl-patterns-grid { grid-template-columns: 1fr; }
  .ezl-personas-grid { grid-template-columns: 1fr; }
}

/* ========================== PRE-QUAL RESULT MOCK ========================== */
/* The hero "3D" card on the landing page. Replaces the older, sparser
 * Calendar-landed mock with the full pre-qual payload that lands in
 * the admin console the second a buyer hits submit:
 *   credit score · available credit · DTI · annual income ·
 *   consumer-direct funding + BMPO + pre-approved flag ·
 *   merchant-direct funding + BMPO + pre-approved flag ·
 *   decline reason · calendar route.
 */
.ezl-result {
  position: relative;
  width: 100%;
  max-width: 480px;
  background:
    radial-gradient(ellipse 80% 60% at 0% 0%, rgba(96, 165, 250, 0.10), transparent 65%),
    rgba(255, 255, 255, 0.98);
  border: 1px solid var(--ezk-line-strong);
  border-radius: 26px;
  padding: 24px;
  box-shadow:
    0 60px 110px -50px rgba(59, 130, 246, 0.55),
    0 30px 60px -30px rgba(59, 130, 246, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 1);
  overflow: hidden;
}
.ezl-result::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(96, 165, 250, 0.55), transparent);
}

/* HEAD */
.ezl-result-head {
  display: flex; justify-content: space-between; align-items: center;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--ezk-line);
}
.ezl-result-pill {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 10.5px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--ezk-blue);
  text-transform: uppercase;
  padding: 5px 11px;
  background: rgba(96, 165, 250, 0.14);
  border-radius: 999px;
}
.ezl-result-pill-dot {
  width: 5px; height: 5px; border-radius: 999px;
  background: var(--ezk-blue-2);
  box-shadow: 0 0 0 0 rgba(96, 165, 250, 0.55);
  animation: ezlPulse 1.6s ease-in-out infinite;
}
.ezl-result-meta {
  font-size: 9px; letter-spacing: 0.18em;
  color: var(--ezk-mute);
  text-transform: uppercase;
  padding: 3px 8px;
  background: rgba(15, 23, 42, 0.04);
  border-radius: 6px;
}

/* BUYER ROW */
.ezl-result-buyer {
  display: flex; justify-content: space-between; align-items: center;
  margin-top: 16px;
}
.ezl-result-buyer-tag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 9px; letter-spacing: 0.20em; font-weight: 700;
  color: var(--ezk-mute);
  text-transform: uppercase;
}
.ezl-result-buyer-name {
  margin-top: 4px;
  font-size: 28px; font-weight: 800;
  letter-spacing: -0.026em;
  color: var(--ezk-ink);
  font-variant-numeric: tabular-nums;
}
.ezl-result-tier-badge {
  display: inline-flex; flex-direction: column; align-items: center;
  padding: 8px 14px;
  background: linear-gradient(135deg, var(--ezk-blue-deep) 0%, var(--ezk-blue) 100%);
  border-radius: 14px;
  color: #fff;
  box-shadow: 0 8px 24px -8px rgba(59, 130, 246, 0.55);
}
.ezl-result-tier-badge.is-tier-c {
  background: linear-gradient(135deg, var(--ezk-purple-deep, #5B21B6) 0%, var(--ezk-purple, #8B5CF6) 100%);
  box-shadow: 0 8px 24px -8px rgba(139, 92, 246, 0.55);
}
.ezl-result-tier-letter {
  font-size: 22px; font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1;
}
.ezl-result-tier-name {
  margin-top: 2px;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 8.5px; letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.78);
}

/* SIGNALS GRID — 4 columns */
.ezl-result-signals {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  margin-top: 16px;
  background: var(--ezk-line);
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--ezk-line);
}
.ezl-result-signal {
  background: rgba(255, 255, 255, 0.96);
  padding: 12px 8px;
  display: flex; flex-direction: column; gap: 4px;
  align-items: center;
  text-align: center;
}
.ezl-result-signal-k {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 8.5px; letter-spacing: 0.12em; font-weight: 700;
  color: var(--ezk-mute);
  text-transform: uppercase;
}
.ezl-result-signal-v {
  font-size: 18px; font-weight: 800;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  background: linear-gradient(135deg, var(--ezk-blue-deep) 0%, var(--ezk-blue) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}

/* FUNDING ESTIMATES */
.ezl-result-funding-head {
  margin-top: 18px;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 9.5px; letter-spacing: 0.20em; font-weight: 700;
  color: var(--ezk-mute);
  text-transform: uppercase;
}
.ezl-result-funding-row {
  display: flex; justify-content: space-between; align-items: center;
  margin-top: 10px;
}
.ezl-result-funding-row-l {
  display: inline-flex; align-items: center; gap: 10px;
}
.ezl-result-funding-check {
  display: inline-flex; align-items: center; justify-content: center;
  width: 18px; height: 18px;
  border-radius: 999px;
  font-size: 11px; font-weight: 700;
}
.ezl-result-funding-check.is-approved {
  background: rgba(96, 165, 250, 0.20);
  color: var(--ezk-blue);
}
.ezl-result-funding-check.is-declined {
  background: rgba(167, 139, 250, 0.22);
  color: #6D28D9;
}
.ezl-result-funding-label {
  font-size: 14px; font-weight: 600;
  color: var(--ezk-ink);
}
.ezl-result-funding-row-r {
  display: inline-flex; align-items: center; gap: 10px;
}
.ezl-result-funding-amt {
  font-size: 16px; font-weight: 700;
  letter-spacing: -0.018em;
  color: var(--ezk-ink);
  font-variant-numeric: tabular-nums;
}
.ezl-result-funding-flag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 9px; letter-spacing: 0.14em; font-weight: 700;
  padding: 3px 7px;
  border-radius: 5px;
  text-transform: uppercase;
  min-width: 84px;
  text-align: center;
}
.ezl-result-funding-row-r {
  min-width: 0;
}
.ezl-result-funding-amt {
  min-width: 64px;
  text-align: right;
}
.ezl-result-funding-flag.is-approved {
  background: rgba(96, 165, 250, 0.16);
  color: var(--ezk-blue);
  border: 1px solid rgba(59, 130, 246, 0.28);
}
.ezl-result-funding-flag.is-declined {
  background: rgba(167, 139, 250, 0.16);
  color: #6D28D9;
  border: 1px solid rgba(167, 139, 250, 0.34);
}

.ezl-result-bmpo {
  display: flex; justify-content: space-between; align-items: center;
  margin-left: 28px;
  margin-top: 4px;
  padding: 6px 12px;
  background: rgba(59, 130, 246, 0.04);
  border-left: 2px solid rgba(96, 165, 250, 0.45);
  border-radius: 0 6px 6px 0;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 11px;
}
.ezl-result-bmpo-k {
  color: var(--ezk-mute);
  font-weight: 700;
  letter-spacing: 0.06em;
}
.ezl-result-bmpo-v {
  color: var(--ezk-blue);
  font-weight: 700;
  letter-spacing: 0.01em;
}
.ezl-result-bmpo.is-empty .ezl-result-bmpo-v { color: var(--ezk-mute); font-weight: 400; }

/* DECLINE REASON */
.ezl-result-decline {
  display: flex; justify-content: space-between; align-items: center;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed var(--ezk-line);
  gap: 14px;
}
.ezl-result-decline-k {
  flex-shrink: 0;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 9.5px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--ezk-mute);
  text-transform: uppercase;
}
.ezl-result-decline-v {
  font-size: 12.5px;
  color: var(--ezk-ink-2);
  font-weight: 600;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

/* FOOTER */
.ezl-result-footer {
  margin-top: 16px;
  padding: 13px 16px;
  text-align: center;
  background: linear-gradient(135deg, var(--ezk-blue-deep) 0%, var(--ezk-blue) 100%);
  color: #fff;
  border-radius: 12px;
  font-size: 13px; font-weight: 700;
  letter-spacing: 0.01em;
  box-shadow: 0 12px 28px -12px rgba(59, 130, 246, 0.55);
}

/* ========================== DARK-SECTION CARD VARIANTS ==================== */
/* When signal / pattern / persona cards live inside ezl-section-dark, swap
 * their white surfaces for glassy navy. Keeps the routing-tree quality
 * standard across the entire deep-dive narrative. */

/* SIGNAL CARDS · DARK */
.ezl-section-dark .ezl-signal {
  background:
    radial-gradient(ellipse 80% 60% at 0% 0%, rgba(96, 165, 250, 0.16), transparent 65%),
    linear-gradient(180deg, rgba(30, 40, 64, 0.55) 0%, rgba(16, 22, 36, 0.55) 100%);
  border: 1px solid rgba(96, 165, 250, 0.24);
  backdrop-filter: blur(14px);
  box-shadow:
    0 22px 60px -32px rgba(0, 0, 0, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}
.ezl-section-dark .ezl-signal:hover {
  border-color: rgba(96, 165, 250, 0.45);
  box-shadow:
    0 36px 80px -32px rgba(96, 165, 250, 0.30),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}
.ezl-section-dark .ezl-signal-h { color: #fff; }
.ezl-section-dark .ezl-signal-b { color: rgba(238, 242, 248, 0.74); }
.ezl-section-dark .ezl-signal-list li { color: rgba(238, 242, 248, 0.78); }
.ezl-section-dark .ezl-signal-tag {
  background: rgba(96, 165, 250, 0.14);
  color: var(--ezk-blue-2);
  border: 1px solid rgba(96, 165, 250, 0.28);
}
.ezl-section-dark .ezl-signal-foot {
  border-top: 1px dashed rgba(96, 165, 250, 0.20);
}
.ezl-section-dark .ezl-signal-foot-k { color: rgba(238, 242, 248, 0.55); }
.ezl-section-dark .ezl-signal-foot-v { color: var(--ezk-blue-2); }
.ezl-section-dark .ezl-signal-metric {
  background: linear-gradient(135deg, #fff 0%, var(--ezk-blue-2) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}

/* COMPOSITE TIER PANEL · DARK section — already on a navy gradient, but
 * tighten the embedded glass + border so it sits inside a dark section
 * without a doubled-up background. */
.ezl-section-dark .ezl-signals-composite {
  border: 1px solid rgba(96, 165, 250, 0.34);
  box-shadow:
    0 36px 80px -32px rgba(0, 0, 0, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.10);
}

/* PATTERN CARDS · DARK */
.ezl-section-dark .ezl-pattern {
  background:
    radial-gradient(ellipse 80% 60% at 0% 0%, rgba(96, 165, 250, 0.14), transparent 65%),
    linear-gradient(180deg, rgba(30, 40, 64, 0.55) 0%, rgba(16, 22, 36, 0.55) 100%);
  border: 1px solid rgba(96, 165, 250, 0.24);
  backdrop-filter: blur(14px);
  box-shadow:
    0 22px 60px -32px rgba(0, 0, 0, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}
.ezl-section-dark .ezl-pattern:hover {
  border-color: rgba(96, 165, 250, 0.45);
  box-shadow:
    0 36px 80px -32px rgba(96, 165, 250, 0.30),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}
.ezl-section-dark .ezl-pattern-h { color: #fff; }
.ezl-section-dark .ezl-pattern-b { color: rgba(238, 242, 248, 0.74); }
.ezl-section-dark .ezl-pattern-tag {
  color: var(--ezk-blue-2);
}
.ezl-section-dark .ezl-pattern-hops {
  background: rgba(96, 165, 250, 0.06);
  border: 1px solid rgba(96, 165, 250, 0.18);
}
.ezl-section-dark .ezl-pattern-hop-h { color: #fff; }
.ezl-section-dark .ezl-pattern-hop-b { color: rgba(238, 242, 248, 0.62); }
.ezl-section-dark .ezl-pattern-hop-n {
  background: rgba(96, 165, 250, 0.18);
  color: var(--ezk-blue-2);
}
.ezl-section-dark .ezl-pattern-outcome {
  border: 1px solid rgba(96, 165, 250, 0.40);
  box-shadow: 0 18px 40px -16px rgba(59, 130, 246, 0.55);
}

/* PERSONA CARDS · DARK */
.ezl-section-dark .ezl-persona {
  background:
    radial-gradient(ellipse 80% 60% at 0% 0%, rgba(96, 165, 250, 0.14), transparent 65%),
    linear-gradient(180deg, rgba(30, 40, 64, 0.55) 0%, rgba(16, 22, 36, 0.55) 100%);
  border: 1px solid rgba(96, 165, 250, 0.24);
  backdrop-filter: blur(14px);
  box-shadow:
    0 22px 60px -32px rgba(0, 0, 0, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}
.ezl-section-dark .ezl-persona:hover {
  border-color: rgba(96, 165, 250, 0.45);
  box-shadow:
    0 36px 80px -32px rgba(96, 165, 250, 0.30),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}
.ezl-section-dark .ezl-persona-head {
  border-bottom: 1px solid rgba(96, 165, 250, 0.18);
}
.ezl-section-dark .ezl-persona-name { color: #fff; }
.ezl-section-dark .ezl-persona-source { color: rgba(238, 242, 248, 0.55); }
.ezl-section-dark .ezl-persona-stats {
  background: rgba(96, 165, 250, 0.06);
  border: 1px solid rgba(96, 165, 250, 0.16);
}
.ezl-section-dark .ezl-persona-stat-k { color: rgba(238, 242, 248, 0.55); }
.ezl-section-dark .ezl-persona-stat-v { color: #fff; }
.ezl-section-dark .ezl-persona-signals {
  background: rgba(96, 165, 250, 0.18);
  border-color: rgba(96, 165, 250, 0.20);
}
.ezl-section-dark .ezl-persona-signal {
  background: rgba(15, 23, 42, 0.55);
}
.ezl-section-dark .ezl-persona-signal-k { color: rgba(238, 242, 248, 0.55); }
.ezl-section-dark .ezl-persona-signal-v {
  background: linear-gradient(135deg, #fff 0%, var(--ezk-blue-2) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.ezl-section-dark .ezl-persona-funding {
  background: rgba(96, 165, 250, 0.06);
  border: 1px solid rgba(96, 165, 250, 0.20);
}
.ezl-section-dark .ezl-persona-funding-label { color: #fff; }
.ezl-section-dark .ezl-persona-funding-amt { color: #fff; }
.ezl-section-dark .ezl-persona-funding-check.is-approved {
  background: rgba(96, 165, 250, 0.28);
}
.ezl-section-dark .ezl-persona-funding-check.is-declined {
  background: rgba(167, 139, 250, 0.28);
  color: #C7D2FE;
}
.ezl-section-dark .ezl-persona-funding-flag.is-approved {
  background: rgba(96, 165, 250, 0.22);
  border-color: rgba(96, 165, 250, 0.40);
  color: var(--ezk-blue-2);
}
.ezl-section-dark .ezl-persona-funding-flag.is-declined {
  background: rgba(167, 139, 250, 0.22);
  border-color: rgba(167, 139, 250, 0.40);
  color: #C7D2FE;
}
.ezl-section-dark .ezl-persona-bmpo {
  background: rgba(96, 165, 250, 0.10);
  border-left-color: rgba(96, 165, 250, 0.55);
}
.ezl-section-dark .ezl-persona-bmpo-k { color: rgba(238, 242, 248, 0.55); }
.ezl-section-dark .ezl-persona-bmpo-v { color: var(--ezk-blue-2); }
.ezl-section-dark .ezl-persona-decline {
  border-top: 1px dashed rgba(96, 165, 250, 0.20);
}
.ezl-section-dark .ezl-persona-decline-k { color: rgba(238, 242, 248, 0.55); }
.ezl-section-dark .ezl-persona-decline-v { color: rgba(238, 242, 248, 0.85); }
.ezl-section-dark .ezl-persona-path li {
  border-left-color: rgba(96, 165, 250, 0.35);
}
.ezl-section-dark .ezl-persona-path-h { color: #fff; }
.ezl-section-dark .ezl-persona-path-b { color: rgba(238, 242, 248, 0.55); }
.ezl-section-dark .ezl-persona-path-dot {
  box-shadow: 0 0 0 3px #0F172A, 0 0 0 4px rgba(96, 165, 250, 0.45);
}
.ezl-section-dark .ezl-persona-path li.is-terminal .ezl-persona-path-dot {
  box-shadow: 0 0 0 3px #0F172A, 0 0 0 4px rgba(167, 139, 250, 0.55);
}
.ezl-section-dark .ezl-persona-tier-pill {
  background: rgba(96, 165, 250, 0.14);
  border-color: rgba(96, 165, 250, 0.28);
}
.ezl-section-dark .ezl-persona-c .ezl-persona-tier-pill {
  background: rgba(167, 139, 250, 0.14);
  border-color: rgba(167, 139, 250, 0.34);
  color: var(--ezk-blue-2);
}
.ezl-section-dark .ezl-persona-outcome {
  border: 1px solid rgba(96, 165, 250, 0.34);
  box-shadow: 0 18px 40px -16px rgba(59, 130, 246, 0.55);
}
.ezl-section-dark .ezl-persona-c .ezl-persona-outcome {
  border-color: rgba(167, 139, 250, 0.40);
  box-shadow: 0 18px 40px -16px rgba(139, 92, 246, 0.55);
}

/* SECTION-BOTTOM CALLOUTS — reusable strip matching the routing-section
 * pattern. Used at the bottom of patterns + personas sections so each
 * dark deep-dive surface closes with a 3-card synthesis. */
.ezl-section-callouts {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-top: 32px;
}
.ezl-section-callout {
  padding: 18px 20px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(96, 165, 250, 0.22);
  border-radius: 14px;
  backdrop-filter: blur(8px);
}
.ezl-section-callout-h {
  font-size: 15px; font-weight: 600;
  letter-spacing: -0.012em;
  color: #fff;
  margin-bottom: 6px;
}
.ezl-section-callout-b {
  font-size: 13px; line-height: 1.55;
  color: rgba(238, 242, 248, 0.74);
}

@media (max-width: 980px) {
  .ezl-section-callouts { grid-template-columns: 1fr; }
}
`;
