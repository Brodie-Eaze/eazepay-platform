'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

/* ============================================================================
   TradePay · Sales Presentation v2
   Upgraded from the v1 static deck:
   - Animated gradient mesh + floating particles (ambient motion)
   - 3D-tilted offer card mockup with mouse-parallax and CSS perspective
   - Animated counters that count up on slide entry (IntersectionObserver)
   - Animated lender marketplace visualization (chips fire in parallel)
   - Interactive economics calculator (rep can drag the funnel live)
   - Scroll-snap slide navigation, keyboard arrows, dots + counter
   - Per-slide scroll-triggered reveals
   ========================================================================== */

interface Slide {
  n: string;
  title: string;
  build: () => JSX.Element;
}

/* Raw slide pool — declared in the order they were originally built.
 * The exported SLIDES array (further down) re-orders these via
 * NARRATIVE_ORDER + appends new slides for the final sales narrative
 * arc: Problem → Solution journey (with Smart Routing + Smartphone) →
 * Transformation → Verticals (Roofing, HVAC, Solar/Remodel/Exterior) →
 * Trust → Pricing → Onboarding → Big finale CTA. */
const SLIDES_RAW: Slide[] = [
  /* 01 — WHAT IS MEDPAY (high-level product overview, comes right
     after the brand title slide) */
  {
    n: '01',
    title: 'What is TradePay',
    build: () => (
      <div className="sld-stack sld-grid-hero">
        <div className="sld-hero-left">
          <Reveal>
            <div className="sld-eyebrow">
              <span className="sld-eyebrow-dot" />
              What is TradePay
            </div>
          </Reveal>
          <Reveal delay={120}>
            <h1 className="sld-h1">
              <span className="grad-teal-deep">TradePay is a</span>{' '}
              <span className="grad-teal">homeowner-financing platform</span>
              <br />
              <span className="grad-teal-deep">built for home-improvement work.</span>
            </h1>
          </Reveal>
          <Reveal delay={240}>
            <p className="sld-sub">
              We help roofing crews, HVAC businesses, solar installers, remodel generals, and
              exterior contractors approve more homeowners at the doorstep estimate. Soft-pull
              pre-qualification, a real-time multi-lender marketplace, and merchant-direct funding
              in 48 to 72 hours. One signup, one platform.
            </p>
          </Reveal>
          <Reveal delay={360}>
            <div className="sld-chips">
              <span className="sld-chip">FCRA soft pull · 0 impact</span>
              <span className="sld-chip">Lender marketplace · parallel quoting</span>
              <span className="sld-chip">Merchant-direct payout</span>
            </div>
          </Reveal>
          <Reveal delay={480}>
            <div className="sld-hero-stat-row">
              <HeroStat n={12400} suffix="+" k="Homeowners funded" />
              <HeroStat n={240} prefix="$" suffix="M+" k="Funded to date" />
              <HeroStat n={48} suffix="-72hr" k="Merchant-direct" />
            </div>
          </Reveal>
        </div>
        <div className="sld-hero-right">
          <ParticleField count={28} />
          <TiltCard>
            <OfferCardMock />
          </TiltCard>
        </div>
      </div>
    ),
  },

  /* 02 — THE PROBLEM */
  {
    n: '02',
    title: 'The cost of doing nothing',
    build: () => (
      <div className="sld-stack">
        <Reveal>
          <div className="sld-eyebrow">
            <span className="sld-eyebrow-dot" />
            The cost of doing nothing
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h2 className="sld-h2">
            Every homeowner who says <em>&ldquo;I&apos;ll get another quote&rdquo;</em>{' '}
            <span className="grad-teal-deep">never books the job.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <p className="sld-sub">
            A mid-size contractor loses an estimated{' '}
            <strong>
              $<AnimatedCounter to={1.6} decimals={1} />M a year
            </strong>{' '}
            on doorstep estimates that walk. The objection isn&apos;t price. It&apos;s cash flow.
            Homeowners don&apos;t carry $18,000 for a re-roof.
          </p>
        </Reveal>
        <Reveal delay={360}>
          <div className="sld-stat-row">
            <CountStat to={22} suffix="%" k="Industry same-day close at the estimate" />
            <CountStat to={1.6} decimals={1} prefix="$" suffix="M" k="Job acceptance lost / yr" />
            <CountStat to={62} suffix="%" k="Estimates never financed" />
            <CountStat label="3–6 wks" k="Estimate → install" />
          </div>
        </Reveal>
        <Reveal delay={480}>
          <div className="sld-section-title">Where the $1.6M actually goes</div>
        </Reveal>
        <Reveal delay={560}>
          <MoneyBreakdown />
        </Reveal>
      </div>
    ),
  },

  /* 03 — WHY NOW */
  {
    n: '03',
    title: 'Why now',
    build: () => (
      <div className="sld-stack">
        <Reveal>
          <div className="sld-eyebrow">
            <span className="sld-eyebrow-dot" />
            Why now
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h2 className="sld-h2">
            <span className="grad-teal">Financing at the point of sale</span>{' '}
            <span className="grad-teal-deep">is now the homeowner expectation.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <p className="sld-sub">
            GreenSky, Sunlight, and Service Finance proved the model. But single-lender programs cap
            out at one approval algorithm — and Home Depot installer financing already beats you on
            the deferred-interest pitch. When their model declines, your homeowner walks. TradePay
            solves the ceiling.
          </p>
        </Reveal>
        <Reveal delay={360}>
          <div className="sld-vs-2col">
            <div className="sld-vs-side sld-vs-quo">
              <div className="sld-vs-eyebrow">Single-lender programs</div>
              <ul>
                <li>
                  <span className="sld-vs-icon sld-vs-x">×</span> One approval algorithm
                </li>
                <li>
                  <span className="sld-vs-icon sld-vs-x">×</span> Caps at $50k, declines mid-prime
                </li>
                <li>
                  <span className="sld-vs-icon sld-vs-x">×</span> Deferred-interest clawback risk
                </li>
                <li>
                  <span className="sld-vs-icon sld-vs-x">×</span> Decline = homeowner gets another
                  quote
                </li>
              </ul>
            </div>
            <div className="sld-vs-side sld-vs-med">
              <div className="sld-vs-eyebrow accent">TradePay marketplace</div>
              <ul>
                <li>
                  <span className="sld-vs-icon sld-vs-check">✓</span> Every lender in parallel
                </li>
                <li>
                  <span className="sld-vs-icon sld-vs-check">✓</span> $3k to $100k ticket coverage
                </li>
                <li>
                  <span className="sld-vs-icon sld-vs-check">✓</span> No clawback on routine
                  defaults
                </li>
                <li>
                  <span className="sld-vs-icon sld-vs-check">✓</span> Cheapest monthly payment wins
                </li>
              </ul>
            </div>
          </div>
        </Reveal>
      </div>
    ),
  },

  /* 04 — WHAT MEDPAY IS */
  {
    n: '04',
    title: 'What TradePay is',
    build: () => (
      <div className="sld-stack">
        <Reveal>
          <div className="sld-eyebrow">
            <span className="sld-eyebrow-dot" />
            The pitch
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h2 className="sld-h2">
            <span className="grad-teal-deep">Soft-pull pre-qual at the doorstep.</span>
            <br />
            <span className="grad-teal">Lender marketplace.</span>{' '}
            <span className="grad-teal-deep">Funds in 48 to 72 hours.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <p className="sld-sub">
            Three things matter to a contractor at the doorstep estimate. TradePay nails all three.
          </p>
        </Reveal>
        <Reveal delay={360}>
          <div className="sld-pillars">
            <Pillar
              n="01"
              head="Doorstep speed"
              metric="< 10s"
              body="Estimator runs the soft pull on the iPad in the driveway. Homeowner sees a real fundability tier before the estimator unpacks the laser measure. Zero credit impact, full FCRA compliance."
              tags={['Soft pull', 'FCRA', '0 hard-pull']}
            />
            <Pillar
              n="02"
              head="Lender coverage"
              metric="$3k – $100k"
              body="One soft pull queries every trades lender in parallel — GreenSky, Sunlight, Service Finance, Synchrony, EnerBank, Mosaic. Homeowner sees the cheapest monthly payment. Decline rate is the floor of the marketplace, not a single carrier."
              tags={['Parallel quoting', 'Cheapest mo. wins', 'Prime → subprime']}
            />
            <Pillar
              n="03"
              head="Cash flow"
              metric="48–72 hr"
              body="Lender disburses straight to your business account — no rebate hold, no payment-processor escrow. No clawback on routine defaults. The lender holds the credit risk; you just install the job."
              tags={['Merchant-direct', 'No clawback', 'Lender holds risk']}
            />
          </div>
        </Reveal>
      </div>
    ),
  },

  /* 05 — STAGE 1: PRE-QUAL */
  {
    n: '05',
    title: 'Stage 1 — Pre-qual',
    build: () => (
      <div className="sld-stack sld-grid-hero">
        <div className="sld-hero-left">
          <Reveal>
            <div className="sld-eyebrow">
              <span className="sld-eyebrow-dot" />
              How it works · 1 of 5 · Pre-qual
            </div>
          </Reveal>
          <Reveal delay={120}>
            <h2 className="sld-h2">
              <span className="grad-teal-deep">Soft-pull EZ Check.</span>{' '}
              <span className="grad-teal">Ten seconds. Zero impact.</span>
            </h2>
          </Reveal>
          <Reveal delay={240}>
            <p className="sld-sub">
              Estimator hands the homeowner the iPad in the driveway. Four fields, ten seconds — a
              real fundability tier comes back before the homeowner hands the screen back. No hard
              pull, so they can still walk away with zero credit consequence.
            </p>
          </Reveal>
          <Reveal delay={360}>
            <div className="sld-mini-stats">
              <MiniStat v={<AnimatedCounter to={10} prefix="< " suffix="s" />} k="Decision time" />
              <MiniStat v="0" k="Credit impact" />
              <MiniStat v="FCRA" k="Soft pull only" />
              <MiniStat v="4 fields" k="Driveway-friendly" />
            </div>
          </Reveal>
          <Reveal delay={480}>
            <p className="sld-takeaway">
              For the estimator: the homeowner already knows they qualify before you walk the roof.
              The next sentence is &ldquo;here&apos;s the scope of work,&rdquo; not &ldquo;let me
              check if you can afford it.&rdquo;
            </p>
          </Reveal>
        </div>
        <div className="sld-hero-right">
          <ParticleField count={14} />
          <IpadFormMock />
        </div>
      </div>
    ),
  },

  /* 06 — STAGE 2 (REMOVED in v8 — was PRISM agentic-intake slide.
     Kept as a no-op placeholder so NARRATIVE_ORDER indices into
     SLIDES_RAW above this point remain stable.) */
  {
    n: '06',
    title: 'Stage 2 — Reserved',
    build: () => <></>,
  },

  /* 07 — STAGE 3: MARKETPLACE */
  {
    n: '07',
    title: 'Stage 3 — Marketplace',
    build: () => (
      <div className="sld-stack">
        <Reveal>
          <div className="sld-eyebrow">
            <span className="sld-eyebrow-dot" />
            How it works · 3 of 5
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h2 className="sld-h2">
            <span className="grad-teal-deep">Six trades lenders.</span>{' '}
            <span className="grad-teal">One soft pull.</span>{' '}
            <span className="grad-teal-deep">Parallel quotes.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <p className="sld-sub">
            One application fires across GreenSky, Sunlight, Service Finance, Synchrony Home Design,
            EnerBank, and Mosaic at the same instant. Quotes return ranked by cheapest monthly
            payment to the homeowner.
          </p>
        </Reveal>
        <Reveal delay={360}>
          <MarketplaceViz />
        </Reveal>
      </div>
    ),
  },

  /* 08 — STAGE 4: OFFER */
  {
    n: '08',
    title: 'Stage 4 — Best offer wins',
    build: () => (
      <div className="sld-stack">
        <Reveal>
          <div className="sld-eyebrow">
            <span className="sld-eyebrow-dot" />
            How it works · 4 of 5 · The offer
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h2 className="sld-h2">
            <span className="grad-teal-deep">Best offer wins.</span>{' '}
            <span className="grad-teal">Homeowner signs in the same visit.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <p className="sld-sub">
            Three ranked offers on one screen. Sorted by total cost, not commission. The starred row
            is what your homeowner actually picks 80% of the time. One tap to accept. E-signature on
            the same screen. They are funded before they walk out the door.
          </p>
        </Reveal>
        <Reveal delay={360}>
          <OfferStack />
        </Reveal>
        <Reveal delay={480}>
          <div className="sld-mini-stats">
            <MiniStat v={<AnimatedCounter to={3} />} k="Offers shown" />
            <MiniStat v="One tap" k="To accept" />
            <MiniStat v="E-SIGN" k="Legally binding" />
            <MiniStat v="$0" k="Homeowner pays today" />
          </div>
        </Reveal>
      </div>
    ),
  },

  /* 09 — STAGE 5: FUNDED */
  {
    n: '09',
    title: 'Stage 5 — Merchant-direct',
    build: () => (
      <div className="sld-stack">
        <Reveal>
          <div className="sld-eyebrow">
            <span className="sld-eyebrow-dot" />
            How it works · 5 of 5 · Disbursement
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h2 className="sld-h2">
            <span className="grad-teal-deep">Lender disburses</span>{' '}
            <span className="grad-teal">direct to your business account.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <p className="sld-sub">
            No marketplace intermediary holding the funds. No reseller skim. The lender wires the
            full amount straight to your business account within 48 to 72 hours of the loan
            settling. The lender holds the credit risk. No clawback on routine defaults.
          </p>
        </Reveal>
        <Reveal delay={360}>
          <BankWire />
        </Reveal>
        <Reveal delay={480}>
          <div className="sld-mini-stats">
            <MiniStat
              v={
                <span>
                  <AnimatedCounter to={48} />–<AnimatedCounter to={72} delay={300} />
                  hr
                </span>
              }
              k="Wire-to-account"
            />
            <MiniStat v="No" k="Clawback on default" />
            <MiniStat v="ACH" k="Disbursement rail" />
            <MiniStat v="Daily" k="Reconciliation report" />
          </div>
        </Reveal>
      </div>
    ),
  },

  /* 10 — WITHOUT / WITH MEDPAY */
  {
    n: '10',
    title: 'Without vs With TradePay',
    build: () => (
      <div className="sld-stack">
        <Reveal>
          <div className="sld-eyebrow">
            <span className="sld-eyebrow-dot" />
            The change
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h2 className="sld-h2">
            <span className="grad-teal">
              <AnimatedCounter to={22} suffix="%" /> doorstep closes
            </span>{' '}
            <span className="grad-teal-deep">
              becomes <AnimatedCounter to={65} suffix="%+" delay={400} /> signed in the driveway.
            </span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <BarRace />
        </Reveal>
      </div>
    ),
  },

  /* 11 — PATIENT EXPERIENCE */
  {
    n: '11',
    title: 'What the homeowner sees',
    build: () => (
      <div className="sld-stack">
        <Reveal>
          <div className="sld-eyebrow">
            <span className="sld-eyebrow-dot" />
            The homeowner experience
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h2 className="sld-h2">
            <span className="grad-teal-deep">Four taps.</span>{' '}
            <span className="grad-teal">Walks out approved and funded.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <p className="sld-sub">
            The entire homeowner journey happens in one session, on a single screen, in under three
            minutes.
          </p>
        </Reveal>
        <Reveal delay={360}>
          <Storyboard />
        </Reveal>
      </div>
    ),
  },

  /* 12 — ECONOMICS · INTERACTIVE */
  {
    n: '12',
    title: 'Your economics',
    build: () => <EconomicsSlide />,
  },

  /* 13 — CASE STUDIES */
  {
    n: '13',
    title: 'Case studies',
    build: () => (
      <div className="sld-stack">
        <Reveal>
          <div className="sld-eyebrow">
            <span className="sld-eyebrow-dot" />
            Case studies
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h2 className="sld-h2">
            <span className="grad-teal">Contractors that turned</span>{' '}
            <span className="grad-teal-deep">walked estimates</span>{' '}
            <span className="grad-teal">into signed jobs.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <div className="sld-cases-grid">
            <CaseCard
              tag="Roofing · FL"
              quote="Home Depot installers were beating us on the deferred-interest pitch every week. Plugged in TradePay and our close rate on $20k+ re-roofs jumped. Same crew, same prices."
              outcomes={[
                { v: '2.1×', l: 'Doorstep close uplift' },
                { v: '$184k', l: 'Recovered / 90 days' },
              ]}
              name="Carter Holloway"
              role="Owner · Holloway Roofing"
            />
            <CaseCard
              tag="HVAC · NV"
              quote="The agentic form is the thing. Homeowners used to bounce on income questions. Now they finish the apply flow before our estimator even leaves the driveway."
              outcomes={[
                { v: '−41%', l: 'Form drop-off' },
                { v: '+38%', l: 'Booked installs / lead' },
              ]}
              name="Marco Reyes"
              role="Owner · Iron Horse HVAC"
            />
          </div>
        </Reveal>
      </div>
    ),
  },

  /* 14 — HOW WE'RE DIFFERENT */
  {
    n: '14',
    title: 'How we are different',
    build: () => (
      <div className="sld-stack">
        <Reveal>
          <div className="sld-eyebrow">
            <span className="sld-eyebrow-dot" />
            The difference
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h2 className="sld-h2">
            <span className="grad-teal-deep">Marketplace beats</span>{' '}
            <span className="grad-teal">single-lender programs.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <VsTable />
        </Reveal>
      </div>
    ),
  },

  /* 15 — SECURITY + COMPLIANCE */
  {
    n: '15',
    title: 'Security + compliance',
    build: () => (
      <div className="sld-stack">
        <Reveal>
          <div className="sld-eyebrow">
            <span className="sld-eyebrow-dot" />
            Security + compliance
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h2 className="sld-h2">
            <span className="grad-teal-deep">Bank-grade by default.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <p className="sld-sub">
            We carry the regulatory weight so your business doesn&apos;t have to.
          </p>
        </Reveal>
        <Reveal delay={360}>
          <div className="sld-trust-grid">
            <TrustItem
              head="FCRA"
              body="Soft-pull pre-qual fully compliant. Homeowner consent captured + audited."
            />
            <TrustItem
              head="ECOA · Reg B"
              body="Equal credit, adverse-action notices, fair-lending monitoring on every decision."
            />
            <TrustItem
              head="TILA"
              body="APR, finance charge, payment schedule disclosed at the offer screen."
            />
            <TrustItem head="NMLS" body="Licensed loan originator. State-by-state coverage." />
            <TrustItem
              head="SOC 2 · Type II"
              body="In-progress · annual audit by an independent firm."
            />
            <TrustItem
              head="No clawback"
              body="The lender carries the credit risk for routine defaults. Not your business."
            />
          </div>
        </Reveal>
      </div>
    ),
  },

  /* 16 — PRICING */
  {
    n: '16',
    title: 'Pricing',
    build: () => (
      <div className="sld-stack">
        <Reveal>
          <div className="sld-eyebrow">
            <span className="sld-eyebrow-dot" />
            Pricing
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h2 className="sld-h2">
            <span className="grad-teal-deep">Three line items.</span>{' '}
            <span className="grad-teal">No surprises.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <div className="sld-pricing-stack">
            <div className="sld-pricing-tier sld-pricing-tier-hero">
              <div className="sld-pricing-tier-l">
                <div className="sld-pricing-tier-tag">01 · PLATFORM SETUP</div>
                <div className="sld-pricing-tier-h">One-time platform fee</div>
                <div className="sld-pricing-tier-b">
                  Full configuration, agent training, marketplace activation, partner-portal
                  provisioning. Paid once.
                </div>
              </div>
              <div className="sld-pricing-tier-r">
                <div className="sld-pricing-tier-v">$10,000</div>
                <div className="sld-pricing-tier-when">USD · paid on signing</div>
              </div>
            </div>
            <div className="sld-pricing-tier">
              <div className="sld-pricing-tier-l">
                <div className="sld-pricing-tier-tag">02 · USAGE</div>
                <div className="sld-pricing-tier-h">Per lead through the smart form</div>
                <div className="sld-pricing-tier-b">
                  Every lead that runs through HELIX intake and the ORACLE soft-pull is billed at
                  flat rate. No charge for traffic that never reaches the form.
                </div>
              </div>
              <div className="sld-pricing-tier-r">
                <div className="sld-pricing-tier-v">$3</div>
                <div className="sld-pricing-tier-when">per lead · billed monthly</div>
              </div>
            </div>
            <div className="sld-pricing-tier">
              <div className="sld-pricing-tier-l">
                <div className="sld-pricing-tier-tag">03 · ORIGINATION</div>
                <div className="sld-pricing-tier-h">% of loan amount settled</div>
                <div className="sld-pricing-tier-b">
                  We invoice 4% of the funded loan amount at the end of each month, based on loans
                  that actually settled. No funded loan → no fee.
                </div>
              </div>
              <div className="sld-pricing-tier-r">
                <div className="sld-pricing-tier-v">4%</div>
                <div className="sld-pricing-tier-when">of settled loan · monthly invoice</div>
              </div>
            </div>
          </div>
        </Reveal>
        <Reveal delay={360}>
          <div className="sld-pricing-foot">
            <div className="sld-pricing-foot-row">
              <span className="sld-pricing-foot-k">No monthly platform fee</span>
              <span className="sld-pricing-foot-v">$0</span>
            </div>
            <div className="sld-pricing-foot-row">
              <span className="sld-pricing-foot-k">No per-application fee</span>
              <span className="sld-pricing-foot-v">$0</span>
            </div>
            <div className="sld-pricing-foot-row">
              <span className="sld-pricing-foot-k">Time to live</span>
              <span className="sld-pricing-foot-v">Up to 5 business days</span>
            </div>
            <div className="sld-pricing-foot-row">
              <span className="sld-pricing-foot-k">Contract</span>
              <span className="sld-pricing-foot-v">Buy once · run forever</span>
            </div>
          </div>
        </Reveal>
      </div>
    ),
  },

  /* 17 — ONBOARDING */
  {
    n: '17',
    title: 'Onboarding',
    build: () => (
      <div className="sld-stack">
        <Reveal>
          <div className="sld-eyebrow">
            <span className="sld-eyebrow-dot" />
            Onboarding
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h2 className="sld-h2">
            <span className="grad-teal-deep">Up to 5 business days.</span>{' '}
            <span className="grad-teal">From signed agreement to live.</span>
          </h2>
        </Reveal>
        <Reveal delay={200}>
          <p className="sld-sub">
            Once you sign and the $10,000 platform fee clears, our team configures the account,
            integrates your pixel, trains your staff, and validates the first end-to-end soft pull.
            Up to 5 business days. After that you&apos;re running real traffic and financing real
            homeowners.
          </p>
        </Reveal>
        <Reveal delay={300}>
          <OnboardingTimeline />
        </Reveal>
        <Reveal delay={360}>
          <div className="sld-section-title">What you need to bring</div>
        </Reveal>
        <Reveal delay={420}>
          <div className="sld-checklist">
            <Check k="EIN + business address" />
            <Check k="Owner name, DOB, last 4 SSN, ownership %" />
            <Check k="Business bank account (routing + account)" />
            <Check k="Driver's license + business license (uploaded)" />
            <Check k="Any web browser, any device (no hardware to install)" />
            <Check k="One signature on the agreement (e-sign)" />
          </div>
        </Reveal>
      </div>
    ),
  },

  /* 18 — NEXT STEPS */
  {
    n: '18',
    title: 'Next steps',
    build: () => (
      <div className="sld-stack">
        <Reveal>
          <div className="sld-eyebrow">
            <span className="sld-eyebrow-dot" />
            Next steps
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h2 className="sld-h2 sld-h2-big">
            <span className="grad-teal-deep">Let&apos;s have you</span>{' '}
            <span className="grad-teal">signed and live this week.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <p
            className="sld-sub"
            style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto' }}
          >
            Two paths from here. Pick whichever fits how your business operates.
          </p>
        </Reveal>
        <Reveal delay={360}>
          <div className="sld-cta-grid">
            <a href="/tradepay/checkout" className="sld-cta sld-cta-primary">
              <div className="sld-cta-eyebrow">Start onboarding now</div>
              <div className="sld-cta-h">Sign up</div>
              <div className="sld-cta-b">
                5-minute business signup. KYB clears in 60 seconds. First live homeowner application
                within hours.
              </div>
            </a>
            <a href="/help" className="sld-cta sld-cta-secondary">
              <div className="sld-cta-eyebrow">Schedule a walkthrough</div>
              <div className="sld-cta-h">Book 30 min</div>
              <div className="sld-cta-b">
                We&apos;ll walk your team through a live homeowner flow on a test account. No
                commitment. Bring your hardest objection.
              </div>
            </a>
          </div>
        </Reveal>
        <Reveal delay={480}>
          <div className="sld-section-title">What happens after you sign</div>
        </Reveal>
        <Reveal delay={540}>
          <RoadmapStrip />
        </Reveal>
        <p className="sld-disclaimer">
          TradePay is a multi-lender marketplace. Lender names shown are illustrative unless
          explicitly disclosed as partners. All funded homeowners are subject to lender approval.
          Loan terms, APR, and disbursement vary by lender and homeowner profile. Not a guarantee of
          approval.
        </p>
      </div>
    ),
  },

  /* 19 — SMART ROUTING (HELIX) */
  {
    n: '19',
    title: 'Smart routing — HELIX',
    build: () => (
      <div className="sld-stack">
        <Reveal>
          <div className="sld-eyebrow">
            <span className="sld-eyebrow-dot" />
            How it works · Smart routing
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h2 className="sld-h2">
            <span className="grad-teal-deep">Route every lead</span>{' '}
            <span className="grad-teal">by their actual financial profile.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <p className="sld-sub">
            HELIX runs the lead through your funnel in stages. First it pulls the financial
            qualification from ORACLE. Then it routes &mdash; can be one stage, can be three. Credit
            score, then income, then available credit. High-ticket leads land on a calendar slot
            pre-approved. Low-ticket leads land on a guide, an e-book, or a starter offer. Your
            calendar fills with qualified buyers. Your reps stop wasting time on people who
            can&apos;t pay.
          </p>
        </Reveal>
        <Reveal delay={360}>
          <SmartRoutingViz />
        </Reveal>
      </div>
    ),
  },

  /* 20 — SMARTPHONE CONTINUITY */
  {
    n: '20',
    title: 'Continues on smartphone',
    build: () => (
      <div className="sld-stack sld-grid-hero">
        <div className="sld-hero-left">
          <Reveal>
            <div className="sld-eyebrow">
              <span className="sld-eyebrow-dot" />
              Smartphone continuity
            </div>
          </Reveal>
          <Reveal delay={120}>
            <h2 className="sld-h2">
              <span className="grad-teal-deep">If they don&apos;t sign in-session,</span>{' '}
              <span className="grad-teal">they sign on their phone.</span>
            </h2>
          </Reveal>
          <Reveal delay={240}>
            <p className="sld-sub">
              Some homeowners want to think. Some want to talk to a spouse. Some need 10 minutes.
              TradePay texts a secure link to the same approved offer. They tap accept from the
              couch. You still book the case.
            </p>
          </Reveal>
          <Reveal delay={360}>
            <div className="sld-mini-stats">
              <MiniStat v="SMS + email" k="Secure handoff" />
              <MiniStat v="48hr" k="Offer hold window" />
              <MiniStat v="Same offer" k="No re-quote" />
              <MiniStat v="In-app" k="E-sign continues" />
            </div>
          </Reveal>
          <Reveal delay={480}>
            <p className="sld-takeaway">
              For the estimator: the homeowner who used to walk away to "get another quote" now
              signs from the couch. With smartphone continuity, 31% complete the application within
              48 hours of the estimator leaving the driveway.
            </p>
          </Reveal>
        </div>
        <div className="sld-hero-right">
          <ParticleField count={14} />
          <SmartphoneMock />
        </div>
      </div>
    ),
  },

  /* 21 — VERTICAL: ROOFING */
  {
    n: '21',
    title: 'Vertical — Roofing',
    build: () => (
      <VerticalSlide
        eyebrow="Verticals · Roofing"
        headline={
          <>
            <span className="grad-teal-deep">For full re-roof crews,</span>{' '}
            <span className="grad-teal">storm-damage restorers, and gutter/fascia generals.</span>
          </>
        }
        intro="Roofing is TradePay's anchor vertical. Full re-roofs, storm-damage rebuilds, gutters, fascia — the doorstep estimates where the homeowner hears $18k for a re-roof and decides whether to greenlight before the next storm rolls in."
        ticketRange="$8,000 – $80,000"
        ticketLabel="Asphalt re-roof to full storm-damage rebuild + gutters"
        highlight={{ v: '22% → 65%+', k: 'Doorstep close uplift' }}
        pains={[
          "Homeowner gets the estimate and says 'I'll get another quote' — never funds",
          'Single-lender programs (GreenSky alone) decline near-prime homeowners',
          'Home Depot Roof Pros beats you on the deferred-interest pitch',
          'Insurance-funded repairs cover patches, not full re-roofs',
        ]}
        outcomes={[
          { v: '2.1×', k: 'Doorstep close uplift' },
          { v: '$184k', k: 'Recovered / 90 days · mid-size crew' },
          { v: '−41%', k: 'Form drop-off vs. legacy program' },
        ]}
        quote="We were losing a job a week to financing. First month on TradePay, doorstep close went from a third to two-thirds. Homeowners sign on the spot, fully approved."
        attribution="Carter Holloway"
        attributionRole="Owner · Holloway Roofing · Tampa FL"
      />
    ),
  },

  /* 22 — VERTICAL: HVAC */
  {
    n: '22',
    title: 'Vertical — HVAC',
    build: () => (
      <VerticalSlide
        eyebrow="Verticals · HVAC + mechanical"
        headline={
          <>
            <span className="grad-teal-deep">Full-system swaps approved at the truck.</span>{' '}
            <span className="grad-teal">Heat-pump financing without the dealer-fee hit.</span>
          </>
        }
        intro="HVAC sells big mechanical packages: full-system swaps, heat-pump conversions, ductwork rebuilds. The math only works if the homeowner greenlights at the truck. TradePay turns the no-fund truck-roll into a same-day signed install."
        ticketRange="$6,000 – $40,000"
        ticketLabel="Single split-system to whole-home heat-pump conversion"
        highlight={{ v: '+38%', k: 'Booked-install uplift / estimate' }}
        pains={[
          'Cash-pay homeowner balks at $14k for a full swap',
          'In-house payment plans tie up your A/R · chase delinquencies',
          'Home Depot Pro Installer financing beats you on deferred 0% APR',
          'Promo 0% APR plans look great until you eat the dealer-fee clawback',
        ]}
        outcomes={[
          { v: '+38%', k: 'Booked installs / lead' },
          { v: '−41%', k: 'Form drop-off · HELIX smart intake' },
          { v: '2.3×', k: 'System tier (vs. patch repair)' },
        ]}
        quote="The agentic form is the thing. Homeowners used to bounce on the income question. Now they finish the apply flow before our estimator even unloads the meter."
        attribution="Marco Reyes"
        attributionRole="Owner · Iron Horse HVAC · Las Vegas NV"
      />
    ),
  },

  /* 23 — VERTICAL: SOLAR · REMODEL · EXTERIOR */
  {
    n: '23',
    title: 'Vertical — Solar · Remodel · Exterior',
    build: () => (
      <VerticalSlide
        eyebrow="Verticals · Solar · Remodel · Exterior"
        headline={
          <>
            <span className="grad-teal-deep">Three more verticals.</span>{' '}
            <span className="grad-teal">Same platform. Same flow.</span>
          </>
        }
        intro="Solar + battery installs, kitchen / bath / ADU remodels, and exterior work (windows, siding, decking, fencing). Same soft pull, same marketplace, same merchant-direct payout — just the job stories change."
        ticketRange="$5,000 – $100,000"
        ticketLabel="Window swap to full PV + battery install"
        highlight={{ v: '2.4×', k: 'Job acceptance (avg.)' }}
        pains={[
          'Solar: $35k upfront blocks otherwise-qualified buyers · Sunlight cap declines',
          'Remodel: scope creep + change orders mean the financing has to flex',
          'Exterior: windows + siding sit in the "let me get another quote" trap',
          'All three: single-lender financing caps out at prime credit',
        ]}
        outcomes={[
          { v: '2.4×', k: 'PV-install acceptance · solar' },
          { v: '+58%', k: 'Kitchen-remodel scope · remodel' },
          { v: '+33%', k: 'Window-package upsell · exterior' },
        ]}
        quote="Solar margins live and die at the doorstep close. TradePay closed that gap. Same-day approval, lender wires us direct, panels go up the next week."
        attribution="Hannah Voss"
        attributionRole="Founder · Voss Solar + Battery · Phoenix AZ"
      />
    ),
  },

  /* 24 — BIG FINALE CTA */
  {
    n: '24',
    title: 'Get started',
    build: () => <BigFinaleCTA />,
  },

  /* 25 — BRAND TITLE (presentation cover slide — appears FIRST in
     the narrative order, ahead of "What is TradePay"). */
  {
    n: '25',
    title: 'TradePay',
    build: () => (
      <div className="sld-stack sld-cover">
        <ParticleField count={42} />
        <Reveal>
          <div className="sld-cover-eyebrow">
            <span className="sld-eyebrow-dot" />A presentation by EazePay
          </div>
        </Reveal>
        <Reveal delay={120}>
          <div className="sld-cover-mark">
            {/* TradePay logo — pitched roof + chimney, signalling
                home-improvement / trades verticals (roofing, HVAC,
                solar, remodel, exterior). */}
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M3 12 L12 4 L21 12"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M5 11 V20 H19 V11"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect
                x="10"
                y="14"
                width="4"
                height="6"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M16 6 V8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </div>
        </Reveal>
        <Reveal delay={240}>
          <div className="sld-cover-wordmark">
            <span className="grad-teal-deep">Trade</span>
            <span className="grad-teal">Pay</span>
          </div>
        </Reveal>
        <Reveal delay={360}>
          <div className="sld-cover-tagline">Outcomes when it matters most.</div>
          <div className="sld-cover-subtagline">
            A lender you can depend on. A platform you can depend on as a business owner.
          </div>
        </Reveal>
        <Reveal delay={480}>
          <div className="sld-cover-meta">
            <div className="sld-cover-meta-row">
              <span className="sld-cover-meta-k">For</span>
              <span className="sld-cover-meta-v">Roofing · HVAC · Solar · Remodel · Exterior</span>
            </div>
            <div className="sld-cover-meta-row">
              <span className="sld-cover-meta-k">Presented by</span>
              <span className="sld-cover-meta-v">EazePay · NMLS #2456701</span>
            </div>
          </div>
        </Reveal>
        <Reveal delay={600}>
          <div className="sld-cover-hint">
            <span className="sld-cover-hint-arrow">↓</span>
            <span>Scroll to begin · 30 slides · ~15 min</span>
          </div>
        </Reveal>
      </div>
    ),
  },

  /* 26 — WELCOME + AGENDA (rep-led intro after the cover slide) */
  {
    n: '26',
    title: 'Welcome',
    build: () => <WelcomeAgenda />,
  },

  /* 27 — WHO IS IT FOR (5 verticals + use-case grid) */
  {
    n: '27',
    title: 'Who is TradePay for',
    build: () => <WhoIsItFor />,
  },

  /* 28 — THE 7 AGENTS OVERVIEW */
  {
    n: '28',
    title: 'Seven agents · one platform',
    build: () => <SixAgents />,
  },

  /* 29 — ECHO PIXEL ATTRIBUTION (deep dive) */
  {
    n: '29',
    title: 'ECHO · Pixel attribution',
    build: () => <EchoPixel />,
  },

  /* 30 — THE COMPOUND EFFECT (12-month projection) */
  {
    n: '30',
    title: 'The compound effect',
    build: () => <CompoundEffect />,
  },

  /* 31 — FULL VALUE STACK (what's included, side-by-side with cost) */
  {
    n: '31',
    title: 'Full value stack',
    build: () => <ValueStack />,
  },

  /* 32 — TRUSTED BY 1,000+ PRACTICES (enterprise social proof) */
  {
    n: '32',
    title: 'Trusted by 1,000+ contractors',
    build: () => <TrustedBy />,
  },
];

/** Narrative ordering of SLIDES_RAW into the final 30-slide rep-led
 *  sales deck. Indices are 0-based into SLIDES_RAW. */
const NARRATIVE_ORDER = [
  // OPENING — set the stage
  24, // 01 · Cover · brand title
  25, // 02 · Welcome + agenda
  0, //  03 · What is TradePay
  26, // 04 · Who is it for
  31, // 05 · Trusted by 1,000+ contractors (NEW v7)

  // ACT 1 — Problem
  1, //  06 · The cost of doing nothing
  2, //  07 · Why now

  // ACT 2 — Solution (high level + agents + journey)
  3, //  · The 3 pillars
  27, // · Six agents · one platform
  10, // · Homeowner journey overview (4-panel storyboard)
  4, //  · Stage 1: Soft-pull pre-qual
  18, // · Stage 2: HELIX smart forms + multi-stage routing
  6, //  · Stage 3: Lender marketplace
  7, //  · Stage 4: Best offer wins
  19, // · Stage 5: Smartphone continuity
  8, //  · Stage 6: Merchant-direct funding
  28, // · ECHO pixel attribution

  // ACT 3 — Transformation
  9, //  18 · Without/With
  11, // 19 · Economics calc (interactive)
  29, // 20 · The compound effect (NEW · 12-month projection)

  // ACT 4 — Verticals
  20, // 21 · Vertical: Roofing
  21, // 22 · Vertical: HVAC
  22, // 23 · Vertical: Solar · Remodel · Exterior

  // ACT 5 — Trust + decide
  13, // 25 · Vs competitors

  // ACT 6 — The ask
  30, // 27 · Full value stack (NEW)
  15, // 28 · Pricing
  16, // 29 · Onboarding

  // ACT 7 — Close
  23, // 30 · Big finale CTA
];
const SLIDES: Slide[] = NARRATIVE_ORDER.map((i, idx) => ({
  ...SLIDES_RAW[i]!,
  // Renumber the visible counter so the deck reads 01 / 23 in order
  n: String(idx + 1).padStart(2, '0'),
}));

/* ============================ helper components =========================== */

/** Scroll-reveal wrapper — fades + translates upward when the element
 *  intersects the slide's scroll-snap viewport. Stagger via `delay`. */
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
    const stackRoot = document.querySelector('.sld-stack-root');
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setVisible(true);
        }
      },
      { root: stackRoot, threshold: 0.2 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`sld-reveal ${visible ? 'is-visible' : ''}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/** Number counter that animates 0 → `to` over `duration` when its
 *  containing slide enters the viewport. */
function AnimatedCounter({
  to,
  prefix = '',
  suffix = '',
  decimals = 0,
  duration = 1400,
  delay = 0,
}: {
  to: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  delay?: number;
}): JSX.Element {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const stackRoot = document.querySelector('.sld-stack-root');
    let cancelled = false;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !cancelled) {
            const start = performance.now();
            const tick = (now: number) => {
              const elapsed = now - start - delay;
              if (elapsed < 0) {
                if (!cancelled) requestAnimationFrame(tick);
                return;
              }
              const t = Math.min(elapsed / duration, 1);
              const eased = 1 - Math.pow(1 - t, 3);
              if (!cancelled) {
                setVal(to * eased);
                if (t < 1) requestAnimationFrame(tick);
              }
            };
            requestAnimationFrame(tick);
            obs.disconnect();
          }
        }
      },
      { root: stackRoot, threshold: 0.4 },
    );
    obs.observe(el);
    return () => {
      cancelled = true;
      obs.disconnect();
    };
  }, [to, duration, delay]);
  const formatted = decimals ? val.toFixed(decimals) : Math.round(val).toLocaleString('en-US');
  return (
    <span ref={ref} className="sld-count">
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

function HeroStat({
  n,
  prefix = '',
  suffix = '',
  k,
}: {
  n: number;
  prefix?: string;
  suffix?: string;
  k: string;
}): JSX.Element {
  return (
    <div className="sld-hero-stat">
      <div className="sld-hero-stat-v">
        <AnimatedCounter to={n} prefix={prefix} suffix={suffix} />
      </div>
      <div className="sld-hero-stat-k">{k}</div>
    </div>
  );
}

function CountStat({
  to,
  label,
  prefix = '',
  suffix = '',
  decimals = 0,
  k,
}: {
  to?: number;
  label?: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  k: string;
}): JSX.Element {
  return (
    <div className="sld-stat">
      <div className="sld-stat-v">
        {label ? (
          label
        ) : (
          <AnimatedCounter to={to ?? 0} prefix={prefix} suffix={suffix} decimals={decimals} />
        )}
      </div>
      <div className="sld-stat-k">{k}</div>
    </div>
  );
}

function Pillar({
  n,
  head,
  metric,
  body,
  tags,
}: {
  n: string;
  head: string;
  metric?: string;
  body: string;
  tags?: string[];
}): JSX.Element {
  return (
    <div className="sld-pillar">
      <div className="sld-pillar-glow" aria-hidden />
      <div className="sld-pillar-n">{n}</div>
      {metric ? <div className="sld-pillar-metric">{metric}</div> : null}
      <div className="sld-pillar-h">{head}</div>
      <div className="sld-pillar-b">{body}</div>
      {tags && tags.length ? (
        <div className="sld-pillar-tags">
          {tags.map((t, i) => (
            <span key={i} className="sld-pillar-tag">
              {t}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StageRow({
  metric,
  label,
  body,
}: {
  metric: React.ReactNode;
  label: string;
  body: string;
}): JSX.Element {
  return (
    <div className="sld-stage-row">
      <div className="sld-stage-metric">
        <div className="sld-stage-metric-v">{metric}</div>
        <div className="sld-stage-metric-l">{label}</div>
      </div>
      <p className="sld-stage-body">{body}</p>
    </div>
  );
}

function CaseCard({
  tag,
  quote,
  outcomes,
  name,
  role,
}: {
  tag: string;
  quote: string;
  outcomes: Array<{ v: string; l: string }>;
  name: string;
  role: string;
}): JSX.Element {
  return (
    <div className="sld-case">
      <div className="sld-case-tag">{tag}</div>
      <blockquote className="sld-case-quote">&ldquo;{quote}&rdquo;</blockquote>
      <div className="sld-case-outcomes">
        {outcomes.map((o, i) => (
          <div key={i}>
            <div className="sld-case-v">{o.v}</div>
            <div className="sld-case-l">{o.l}</div>
          </div>
        ))}
      </div>
      <div className="sld-case-attrib">
        <div className="sld-case-avatar">
          {name
            .split(' ')
            .map((s) => s[0])
            .join('')
            .slice(0, 2)}
        </div>
        <div>
          <div className="sld-case-name">{name}</div>
          <div className="sld-case-role">{role}</div>
        </div>
      </div>
    </div>
  );
}

function TrustItem({ head, body }: { head: string; body: string }): JSX.Element {
  return (
    <div className="sld-trust-item">
      <div className="sld-trust-head">{head}</div>
      <div className="sld-trust-body">{body}</div>
    </div>
  );
}

function Step({ n, h, b }: { n: string; h: string; b: string }): JSX.Element {
  return (
    <li>
      <span className="sld-step-n">{n}</span>
      <div>
        <div className="sld-step-h">{h}</div>
        <div className="sld-step-b">{b}</div>
      </div>
    </li>
  );
}

/** 3D-tilted card with mouse-parallax. Uses CSS perspective on the
 *  parent + transform3d on the child. Mouse position drives the tilt
 *  via inline CSS custom properties. */
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
      card.style.setProperty('--tx', `${-y * 12}deg`);
      card.style.setProperty('--ty', `${x * 16}deg`);
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
    <div className="sld-tilt-scene" ref={sceneRef}>
      <div className="sld-tilt-card" ref={cardRef}>
        {children}
      </div>
    </div>
  );
}

/** Mock offer card — visual replica of what a homeowner sees. */
function OfferCardMock(): JSX.Element {
  return (
    <div className="sld-mock">
      <div className="sld-mock-head">
        <span className="sld-mock-pill">
          <span className="sld-mock-pill-dot" /> TradePay · approved
        </span>
        <span className="sld-mock-meta">Illustrative</span>
      </div>
      <div className="sld-mock-project">Full re-roof · approved</div>
      <div className="sld-mock-amount">
        $12,000
        <span className="sld-mock-amount-sub">approved</span>
      </div>
      <div className="sld-mock-rows">
        <div>
          <div className="sld-mock-k">Est. monthly</div>
          <div className="sld-mock-v">$250 / mo · 48 mo</div>
        </div>
        <div>
          <div className="sld-mock-k">Term</div>
          <div className="sld-mock-v">48 months</div>
        </div>
      </div>
      <div className="sld-mock-bar">
        <div className="sld-mock-bar-fill" />
      </div>
      <div className="sld-mock-stages">
        <span className="on">Pre-qual</span>
        <span className="on">Quote</span>
        <span className="on">Offer</span>
        <span className="cur">Accept</span>
        <span>Payout</span>
      </div>
      <div className="sld-mock-cta">Accept approval →</div>
      <div className="sld-mock-foot">FCRA soft pull · funds in 48–72hr · merchant-direct</div>
    </div>
  );
}

/** Floating particle field for the hero. Pure CSS animation, randomized
 *  start positions + durations. */
function ParticleField({ count = 24 }: { count?: number }): JSX.Element {
  const particles = Array.from({ length: count }).map((_, i) => {
    const seed = i * 9301 + 49297;
    const left = (seed % 100) + Math.random() * 0.5;
    const top = ((seed * 2) % 100) + Math.random() * 0.5;
    const dur = 8 + ((seed % 7) + Math.random() * 4);
    const delay = (seed % 5) + Math.random();
    const size = 2 + (seed % 4);
    return { i, left, top, dur, delay, size };
  });
  return (
    <div className="sld-particles" aria-hidden>
      {particles.map((p) => (
        <span
          key={p.i}
          className="sld-particle"
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

/** Animated lender marketplace — 8 chips fire in parallel from a
 *  central dot, return with offers, sort by price. Used on slide 7. */
function MarketplaceViz(): JSX.Element {
  // Each row represents a lender quoting in parallel from the same
  // single submission. APRs/terms intentionally illustrative.
  const QUOTES = [
    { lender: 'GreenSky', apr: '8.99%', mo: '$372', term: '84', winner: true },
    { lender: 'Sunlight Financial', apr: '9.49%', mo: '$386', term: '84' },
    { lender: 'Service Finance', apr: '10.99%', mo: '$417', term: '84' },
    { lender: 'Synchrony Home', apr: '12.99%', mo: '$465', term: '60' },
    { lender: 'EnerBank', apr: '13.99%', mo: '$487', term: '60' },
    { lender: 'Mosaic', apr: '15.99%', mo: '$534', term: '60' },
  ];
  return (
    <div className="sld-mp">
      {/* LEFT: one application */}
      <div className="sld-mp-app">
        <div className="sld-mp-app-eyebrow">ONE APPLICATION</div>
        <div className="sld-mp-app-card">
          <div className="sld-mp-app-row">
            <span className="sld-mp-app-k">Ticket</span>
            <span className="sld-mp-app-v">$18,000</span>
          </div>
          <div className="sld-mp-app-row">
            <span className="sld-mp-app-k">Term</span>
            <span className="sld-mp-app-v">60 mo</span>
          </div>
          <div className="sld-mp-app-row">
            <span className="sld-mp-app-k">Credit</span>
            <span className="sld-mp-app-v">724</span>
          </div>
          <div className="sld-mp-app-row">
            <span className="sld-mp-app-k">Soft pull</span>
            <span className="sld-mp-app-v">FCRA · 0 impact</span>
          </div>
        </div>
        <div className="sld-mp-app-sig">
          <span className="sld-mp-app-sig-dot" />
          Submitted in parallel to every lender
        </div>
      </div>

      {/* CENTER: parallel quoting bus */}
      <div className="sld-mp-bus" aria-hidden>
        <svg viewBox="0 0 100 240" preserveAspectRatio="none">
          {QUOTES.map((_, i) => (
            <path
              key={i}
              d={`M 0 120 C 50 120, 50 ${20 + i * 36}, 100 ${20 + i * 36}`}
              stroke={i === 0 ? 'rgba(234, 88, 12, 0.55)' : 'rgba(234, 88, 12, 0.25)'}
              strokeWidth={i === 0 ? '2' : '1.4'}
              strokeDasharray="4 4"
              fill="none"
            />
          ))}
        </svg>
      </div>

      {/* RIGHT: ranked lender quotes — cheapest first, winner starred */}
      <div className="sld-mp-quotes">
        <div className="sld-mp-quotes-eyebrow">
          <span className="sld-mp-quotes-pulse" />
          PARALLEL QUOTES · CHEAPEST FIRST
        </div>
        {QUOTES.map((q, i) => (
          <div
            key={q.lender}
            className={`sld-mp-quote ${q.winner ? 'is-winner' : ''}`}
            style={{ animationDelay: `${i * 0.08}s` }}
          >
            <span className="sld-mp-quote-rank">{String(i + 1).padStart(2, '0')}</span>
            <div className="sld-mp-quote-body">
              <span className="sld-mp-quote-lender">{q.lender}</span>
              <span className="sld-mp-quote-meta">
                {q.apr} APR · {q.term} mo
              </span>
            </div>
            <span className="sld-mp-quote-mo">{q.mo}/mo</span>
            {q.winner && (
              <span className="sld-mp-quote-star" aria-hidden>
                ★
              </span>
            )}
          </div>
        ))}
        <div className="sld-mp-quotes-foot">
          <span className="sld-mp-quotes-foot-k">Best offer wins</span>
          <span className="sld-mp-quotes-foot-v">$372/mo · 84 mo · GreenSky</span>
        </div>
      </div>
    </div>
  );
}

/** Animated bar race for slide 10 — Without/With comparison */
function BarRace(): JSX.Element {
  return (
    <div className="sld-bar-race">
      <div className="sld-bar-row">
        <div className="sld-bar-label">Without TradePay (22% doorstep close)</div>
        <div className="sld-bar-track">
          <div className="sld-bar-fill without" style={{ width: '22%' }}>
            <span>22%</span>
          </div>
        </div>
      </div>
      <div className="sld-bar-row">
        <div className="sld-bar-label">With TradePay (65%+ doorstep close · illustrative)</div>
        <div className="sld-bar-track">
          <div className="sld-bar-fill with" style={{ width: '65%' }}>
            <span>65%+</span>
          </div>
        </div>
      </div>
      <div className="sld-bar-delta">
        <span className="sld-bar-delta-tag">Delta</span>
        <span className="sld-bar-delta-val">+43 pts doorstep close rate</span>
        <span className="sld-bar-delta-sub">Cash-only baseline · illustrative</span>
      </div>
    </div>
  );
}

/** Animated "vs competitors" table — checkmarks pulse in on reveal */
function VsTable(): JSX.Element {
  const rows = [
    {
      k: 'Lender coverage',
      single: 'One lender · their underwriting only',
      med: 'GreenSky + Sunlight + Service Finance + Synchrony + EnerBank + Mosaic in parallel',
    },
    {
      k: 'Decline = homeowner walks',
      single: 'Yes — they get another quote',
      med: 'No — marketplace routes to next eligible lender',
    },
    {
      k: 'Ticket range',
      single: 'Capped by one lender (often $50k)',
      med: '$3k to $100k · prime to subprime',
    },
    {
      k: 'Clawback on routine defaults',
      single: 'Promo-plan clawback risk',
      med: 'No clawback on standard plans',
    },
    {
      k: 'Doorstep close',
      single: 'Apply on phone post-visit',
      med: 'Soft pull + approval at the driveway',
    },
    {
      k: 'Agent layer',
      single: 'None',
      med: 'Six autonomous agents · ORACLE/HELIX/NEXUS/FLUX/ECHO/VEGA',
    },
    {
      k: 'Pixel attribution',
      single: 'On form-fill (junk signal)',
      med: 'ECHO fires on funded job (real signal)',
    },
    {
      k: 'Vs Home Depot installer financing',
      single: 'Beats you on the deferred-interest pitch',
      med: 'Match deferred plans · own the homeowner relationship',
    },
  ];
  return (
    <table className="sld-vs-table">
      <thead>
        <tr>
          <th></th>
          <th>Single-lender (GreenSky alone, Sunlight alone, Synchrony alone)</th>
          <th className="accent">TradePay marketplace</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td>{r.k}</td>
            <td>
              <span className="sld-vs-mark x">×</span>
              {r.single}
            </td>
            <td className="accent">
              <span className="sld-vs-mark check">✓</span>
              {r.med}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Compact 4-up stats row for stage slides. */
function MiniStat({ v, k }: { v: React.ReactNode; k: string }): JSX.Element {
  return (
    <div className="sld-mini-stat">
      <div className="sld-mini-stat-v">{v}</div>
      <div className="sld-mini-stat-k">{k}</div>
    </div>
  );
}

/** Checklist row used on slide 17 (onboarding requirements). */
function Check({ k }: { k: string }): JSX.Element {
  return (
    <div className="sld-check">
      <span className="sld-check-icon">✓</span>
      <span>{k}</span>
    </div>
  );
}

/** iPad mockup with auto-typing soft-pull form. Used on Stage 1
 *  to show what the homeowner sees. */
function IpadFormMock(): JSX.Element {
  return (
    <div className="sld-ipad">
      <div className="sld-ipad-bezel">
        <div className="sld-ipad-screen">
          <div className="sld-ipad-header">
            <span className="sld-ipad-brand">TradePay · Soft-pull pre-qual</span>
            <span className="sld-ipad-meta">FCRA · 0 impact</span>
          </div>
          <div className="sld-ipad-title">Quick pre-qual</div>
          <div className="sld-ipad-sub">Takes 10 seconds. Your score is unchanged.</div>
          <div className="sld-ipad-form">
            {[
              { k: 'Last 4 of SSN', v: '••••' },
              { k: 'Date of birth', v: '11 / 03 / 1982' },
              { k: 'Annual household income', v: '$124,000' },
              { k: 'Service address', v: '4218 Pinebrook Way, Tampa FL' },
            ].map((f, i) => (
              <div key={i} className="sld-ipad-field" style={{ animationDelay: `${i * 0.4}s` }}>
                <div className="sld-ipad-field-k">{f.k}</div>
                <div className="sld-ipad-field-v">{f.v}</div>
              </div>
            ))}
          </div>
          <div className="sld-ipad-btn">Check my rate →</div>
          <div className="sld-ipad-foot">FCRA-compliant · Soft pull only · You can walk away</div>
        </div>
      </div>
    </div>
  );
}

/** Three ranked offers (Stage 4). Cheapest first, star on winner. */
function OfferStack(): JSX.Element {
  const offers = [
    { lender: 'GreenSky', monthly: '$372', term: '84 mo', tag: 'Lowest monthly', star: true },
    { lender: 'Sunlight Financial', monthly: '$386', term: '84 mo', tag: '2nd cheapest' },
    { lender: 'Service Finance', monthly: '$417', term: '84 mo', tag: '3rd' },
  ];
  return (
    <div className="sld-offer-stack">
      {offers.map((o, i) => (
        <div key={i} className={`sld-offer-row ${o.star ? 'is-winner' : ''}`}>
          <div className="sld-offer-lender">
            {o.star ? (
              <span className="sld-offer-star">★</span>
            ) : (
              <span className="sld-offer-bullet" />
            )}
            <span>{o.lender}</span>
            <span className="sld-offer-tag">{o.tag}</span>
          </div>
          <div className="sld-offer-monthly">
            {o.monthly}
            <span> / mo</span>
          </div>
          <div className="sld-offer-term">{o.term}</div>
        </div>
      ))}
      <div className="sld-offer-foot">
        Ranked lowest-total-cost first · homeowner picks · e-signs in 30s
      </div>
    </div>
  );
}

/** Bank-wire animation for Stage 5 — money flows lender → TradePay → business. */
function BankWire(): JSX.Element {
  return (
    <div className="sld-wire">
      <div className="sld-wire-node">
        <div className="sld-wire-icon">L</div>
        <div className="sld-wire-label">Lender</div>
        <div className="sld-wire-sub">Cross River, Lead, etc.</div>
      </div>
      <div className="sld-wire-flow">
        <div className="sld-wire-amount">$24,000</div>
        <div className="sld-wire-line">
          <span className="sld-wire-pulse" />
        </div>
        <div className="sld-wire-time">48 – 72 hr</div>
      </div>
      <div className="sld-wire-node sld-wire-node-end">
        <div className="sld-wire-icon">$</div>
        <div className="sld-wire-label">Your business account</div>
        <div className="sld-wire-sub">Merchant-direct · no intermediary</div>
      </div>
    </div>
  );
}

/** 4-panel homeowner storyboard for slide 11. */
function Storyboard(): JSX.Element {
  const panels: Array<{
    n: string;
    t: string;
    b: string;
    meta: string;
    glyph: JSX.Element;
  }> = [
    {
      n: '01',
      t: 'Enter info',
      b: 'Estimator hands the iPad in the driveway. SSN-4, DOB, income, address. Done in a minute.',
      meta: 'In the driveway',
      glyph: (
        <svg viewBox="0 0 32 32" aria-hidden>
          <rect
            x="6"
            y="4"
            width="20"
            height="24"
            rx="3"
            stroke="currentColor"
            strokeWidth="1.6"
            fill="none"
          />
          <line x1="9" y1="11" x2="20" y2="11" stroke="currentColor" strokeWidth="1.6" />
          <line x1="9" y1="16" x2="23" y2="16" stroke="currentColor" strokeWidth="1.6" />
          <line x1="9" y1="21" x2="17" y2="21" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      ),
    },
    {
      n: '02',
      t: 'Soft pull',
      b: 'Soft pull across GreenSky, Sunlight, Service Finance, Synchrony, EnerBank, Mosaic. FCRA-compliant.',
      meta: '< 10 sec',
      glyph: (
        <svg viewBox="0 0 32 32" aria-hidden>
          <circle cx="16" cy="16" r="10" stroke="currentColor" strokeWidth="1.6" fill="none" />
          <path
            d="M16 6 A10 10 0 0 1 26 16"
            stroke="currentColor"
            strokeWidth="2.4"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M16 11 L16 16 L20 19"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      ),
    },
    {
      n: '03',
      t: 'See offers',
      b: 'Three ranked offers on one screen. Cheapest monthly payment first. Recommended starred.',
      meta: '3 offers',
      glyph: (
        <svg viewBox="0 0 32 32" aria-hidden>
          <rect
            x="5"
            y="7"
            width="22"
            height="5"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.4"
            fill="currentColor"
            fillOpacity="0.16"
          />
          <rect
            x="5"
            y="14"
            width="22"
            height="5"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.4"
            fill="none"
          />
          <rect
            x="5"
            y="21"
            width="22"
            height="5"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.4"
            fill="none"
          />
          <polygon
            points="24,9.5 24.5,8.4 25,9.5 26.2,9.5 25.2,10.3 25.6,11.5 24.5,10.8 23.4,11.5 23.8,10.3 22.8,9.5"
            fill="currentColor"
          />
        </svg>
      ),
    },
    {
      n: '04',
      t: 'Tap to fund',
      b: 'Homeowner e-signs in the driveway. Funds wire merchant-direct in 48-72 hours. Job goes in the schedule.',
      meta: '48–72 hr',
      glyph: (
        <svg viewBox="0 0 32 32" aria-hidden>
          <path
            d="M6 16 L13 23 L26 9"
            stroke="currentColor"
            strokeWidth="2.4"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
  ];
  return (
    <div className="sld-storyboard">
      <div className="sld-storyboard-track" aria-hidden />
      {panels.map((p, i) => (
        <div key={i} className="sld-story-panel" style={{ animationDelay: `${i * 0.12}s` }}>
          <div className="sld-story-n">{p.n}</div>
          <div className="sld-story-glyph">{p.glyph}</div>
          <div className="sld-story-t">{p.t}</div>
          <div className="sld-story-b">{p.b}</div>
          <div className="sld-story-meta">{p.meta}</div>
        </div>
      ))}
    </div>
  );
}

/** Money-flow breakdown — where the $1.4M goes. Slide 2 supplement. */
function MoneyBreakdown(): JSX.Element {
  // Quiet orange-only breakdown of where the $1.6M leaks for a trades business.
  const rows = [
    {
      k: 'Lost job acceptance',
      sub: '~28 walked estimates/yr · $42k avg ticket · 90%',
      v: '$1,058,400',
      pct: '66.2%',
    },
    {
      k: 'Wasted truck-roll hours',
      sub: '~9 unfit estimates/wk · 2.5 hr drive + estimate · $180/hr × 52',
      v: '$421,200',
      pct: '26.3%',
    },
    {
      k: 'Fuel + estimator opportunity cost',
      sub: 'fuel @ $0.65/mi × 380 mi/wk × 52 + lost callouts',
      v: '$120,400',
      pct: '7.5%',
    },
  ];
  return (
    <div className="sld-money">
      {rows.map((r, i) => (
        <div key={i} className="sld-money-row">
          <div className="sld-money-row-l">
            <div className="sld-money-row-k">{r.k}</div>
            <div className="sld-money-row-sub">{r.sub}</div>
          </div>
          <div className="sld-money-row-r">
            <div className="sld-money-row-pct">{r.pct}</div>
            <div className="sld-money-row-v">{r.v}</div>
          </div>
        </div>
      ))}
      <div className="sld-money-row sld-money-row-total">
        <div className="sld-money-row-l">
          <div className="sld-money-row-k">Total annual leakage</div>
          <div className="sld-money-row-sub">illustrative · mid-size roofing or HVAC crew</div>
        </div>
        <div className="sld-money-row-r">
          <div className="sld-money-row-v sld-money-row-v-total">$1.60M</div>
        </div>
      </div>
    </div>
  );
}

/** Sample invoice mock for slide 16. */
function SampleInvoice(): JSX.Element {
  return (
    <div className="sld-invoice">
      <div className="sld-invoice-head">
        <div>
          <div className="sld-invoice-from">TradePay · A vertical of EazePay</div>
          <div className="sld-invoice-meta">NMLS #2456701 · EIN 88-1234567</div>
        </div>
        <div className="sld-invoice-no">
          <div className="sld-invoice-no-k">Receipt</div>
          <div className="sld-invoice-no-v">RCP-2026-001</div>
        </div>
      </div>
      <div className="sld-invoice-period">Day 0 · Setup · Holloway Roofing Co.</div>
      <table className="sld-invoice-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Qty</th>
            <th>Unit</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>TradePay platform · one-time setup</td>
            <td>1</td>
            <td>$10,000</td>
            <td>$10,000.00</td>
          </tr>
          <tr>
            <td>Smart-form lead pass-through · sample month</td>
            <td>420</td>
            <td>$3.00</td>
            <td>$1,260.00</td>
          </tr>
          <tr>
            <td>Origination · 4% of settled loans · sample month</td>
            <td>$184,400</td>
            <td>4%</td>
            <td>$7,376.00</td>
          </tr>
          <tr>
            <td>Monthly platform fee</td>
            <td>—</td>
            <td>—</td>
            <td>$0.00</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>
              <strong>Month 1 total · sample</strong>
            </td>
            <td>
              <strong>$18,636.00</strong>
            </td>
          </tr>
        </tfoot>
      </table>
      <div className="sld-invoice-foot">
        $10,000 setup is one-time. After that you only pay $3 per smart-form lead and 4% of loans
        that actually settled.
      </div>
    </div>
  );
}

/** Onboarding timeline — day 1 → day 7 milestones. Slide 17 supplement. */
function OnboardingTimeline(): JSX.Element {
  const ms = [
    {
      d: 'Day 0',
      t: 'Agreement signed · $10k paid',
      b: 'KYB clears in 60s · CSM assigned · kickoff scheduled',
    },
    {
      d: 'Day 1',
      t: 'Account configured',
      b: 'Pixel + CAPI integrated · bank account verified · funnels mapped',
    },
    {
      d: 'Day 2-3',
      t: 'Smart-form + routing built',
      b: 'HELIX smart form deployed · routes published · ORACLE wired to bureaus',
    },
    {
      d: 'Day 4-5',
      t: 'Live · first real traffic',
      b: 'Team trained on the partner portal · first funded homeowner in days',
    },
  ];
  return (
    <div className="sld-timeline">
      <div className="sld-timeline-line" />
      {ms.map((m, i) => (
        <div key={i} className="sld-timeline-node">
          <div className="sld-timeline-dot" />
          <div className="sld-timeline-day">{m.d}</div>
          <div className="sld-timeline-t">{m.t}</div>
          <div className="sld-timeline-b">{m.b}</div>
        </div>
      ))}
    </div>
  );
}

/** 30-day roadmap for slide 18. */
function RoadmapStrip(): JSX.Element {
  const ms = [
    { w: 'This week', t: 'Sign agreement + KYB', icon: '✎' },
    { w: 'Week 1', t: 'Bank verify + staff training', icon: '⚙' },
    { w: 'Week 2', t: 'First live homeowner applications', icon: '✦' },
    { w: 'Day 30', t: 'First TradePay invoice (only if you fund)', icon: '◷' },
  ];
  return (
    <div className="sld-roadmap">
      {ms.map((m, i) => (
        <div key={i} className="sld-roadmap-step">
          <div className="sld-roadmap-icon">{m.icon}</div>
          <div className="sld-roadmap-w">{m.w}</div>
          <div className="sld-roadmap-t">{m.t}</div>
          {i < ms.length - 1 && <div className="sld-roadmap-arrow">→</div>}
        </div>
      ))}
    </div>
  );
}

/** Smart-routing (HELIX) visualization — homeowner avatar at left, HELIX
 *  agent middle, three reps on the right with capacity badges. */
function SmartRoutingViz(): JSX.Element {
  return (
    <div className="sld-funnel">
      {/* Tier stack — three linear stages, all the same width, no tilt */}
      <div className="sld-funnel-stages">
        <div className="sld-funnel-stage">
          <span className="sld-funnel-stage-tag">01 · INBOUND</span>
          <span className="sld-funnel-stage-h">All leads</span>
          <span className="sld-funnel-stage-b">Ads · site · referrals · campaigns</span>
        </div>
        <div className="sld-funnel-connector" aria-hidden />
        <div className="sld-funnel-stage">
          <span className="sld-funnel-stage-tag">02 · HELIX INTAKE</span>
          <span className="sld-funnel-stage-h">Smart form reshapes on partial answers</span>
          <span className="sld-funnel-stage-b">
            Procedure · ticket · contact — order rewritten by intent
          </span>
        </div>
        <div className="sld-funnel-connector" aria-hidden />
        <div className="sld-funnel-stage">
          <span className="sld-funnel-stage-tag">03 · ORACLE QUALIFY</span>
          <span className="sld-funnel-stage-h">Financial qualification on every lead</span>
          <div className="sld-funnel-pills">
            <span className="sld-funnel-pill">Credit</span>
            <span className="sld-funnel-pill">Available</span>
            <span className="sld-funnel-pill">Income</span>
            <span className="sld-funnel-pill">DTI</span>
            <span className="sld-funnel-pill">Pre-approval $</span>
          </div>
        </div>
      </div>

      {/* Router pill — quietly indicates the split */}
      <div className="sld-funnel-router">
        <span className="sld-funnel-router-dot" />
        HELIX router · multi-stage
      </div>

      {/* Two-column branches — equal weight, flat, no 3D tilt */}
      <div className="sld-funnel-branches">
        <div className="sld-funnel-branch sld-funnel-branch-high">
          <div className="sld-funnel-branch-head">
            <span className="sld-funnel-branch-tag">FULL-JOB LANE</span>
            <span className="sld-funnel-branch-crit">≥ 680 · ≥ $10k ticket · DTI &lt; 45%</span>
          </div>
          <ol className="sld-funnel-branch-steps">
            <li>
              <span className="sld-funnel-step-n">01</span>
              <span className="sld-funnel-step-h">Filter by homeowner credit</span>
            </li>
            <li>
              <span className="sld-funnel-step-n">02</span>
              <span className="sld-funnel-step-h">Filter by ticket fit</span>
            </li>
            <li>
              <span className="sld-funnel-step-n">03</span>
              <span className="sld-funnel-step-h">Filter by available credit</span>
            </li>
          </ol>
          <div className="sld-funnel-branch-outcome">Estimator dispatched · job pre-approved</div>
        </div>

        <div className="sld-funnel-branch sld-funnel-branch-low">
          <div className="sld-funnel-branch-head">
            <span className="sld-funnel-branch-tag">REPAIR / NURTURE LANE</span>
            <span className="sld-funnel-branch-crit">Below floor · partial-scope warm</span>
          </div>
          <ol className="sld-funnel-branch-steps">
            <li>
              <span className="sld-funnel-step-n">01</span>
              <span className="sld-funnel-step-h">Offer repair / maintenance scope</span>
            </li>
            <li>
              <span className="sld-funnel-step-n">02</span>
              <span className="sld-funnel-step-h">Storm-damage rebate / financing guide</span>
            </li>
            <li>
              <span className="sld-funnel-step-n">03</span>
              <span className="sld-funnel-step-h">Re-pull in 90 days · score recovery</span>
            </li>
          </ol>
          <div className="sld-funnel-branch-outcome sld-funnel-branch-outcome-low">
            Routed back to full-job lane
          </div>
        </div>
      </div>
    </div>
  );
}

/** Smartphone mockup — used to show the homeowner continuing the flow
 *  later on their phone. */
function SmartphoneMock(): JSX.Element {
  return (
    <div className="sld-phone">
      <div className="sld-phone-bezel">
        <div className="sld-phone-notch" />
        <div className="sld-phone-screen">
          <div className="sld-phone-status">9:41 · ●●●●○</div>
          <div className="sld-phone-card">
            <div className="sld-phone-card-eyebrow">
              <span className="sld-phone-card-dot" /> TradePay · approved
            </div>
            <div className="sld-phone-card-amount">$12,000</div>
            <div className="sld-phone-card-meta">Full re-roof · approved</div>
            <div className="sld-phone-card-row">
              <span>Est. monthly</span>
              <strong>$250 / mo</strong>
            </div>
            <div className="sld-phone-card-row">
              <span>Term</span>
              <strong>48 mo</strong>
            </div>
            <div className="sld-phone-card-cta">Accept approval</div>
            <div className="sld-phone-card-foot">FCRA soft pull · 0 impact · e-sign in app</div>
          </div>
          <div className="sld-phone-tip">Picked up where you left off at the estimate.</div>
        </div>
      </div>
    </div>
  );
}

/** Vertical-specific slide — reusable for Roofing, HVAC, Solar/Remodel/Exterior.
 *  Each vertical gets its own pain-points, ticket range, headline stat,
 *  outcomes, and pull-quote. */
function VerticalSlide({
  eyebrow,
  headline,
  intro,
  ticketRange,
  ticketLabel,
  highlight,
  pains,
  outcomes,
  quote,
  attribution,
  attributionRole,
}: {
  eyebrow: string;
  headline: React.ReactNode;
  intro: string;
  ticketRange: string;
  ticketLabel: string;
  highlight: { v: string; k: string };
  pains: string[];
  outcomes: Array<{ v: string; k: string }>;
  quote: string;
  attribution: string;
  attributionRole: string;
}): JSX.Element {
  return (
    <div className="sld-stack">
      <Reveal>
        <div className="sld-eyebrow">
          <span className="sld-eyebrow-dot" />
          {eyebrow}
        </div>
      </Reveal>
      <Reveal delay={120}>
        <h2 className="sld-h2">{headline}</h2>
      </Reveal>
      <Reveal delay={240}>
        <p className="sld-sub">{intro}</p>
      </Reveal>
      <Reveal delay={360}>
        <div className="sld-vert-grid">
          <div className="sld-vert-panel">
            <div className="sld-vert-eyebrow">Where it hurts today</div>
            <ul className="sld-vert-pains">
              {pains.map((p, i) => (
                <li key={i}>
                  <span className="sld-vert-x">×</span> {p}
                </li>
              ))}
            </ul>
          </div>
          <div className="sld-vert-panel sld-vert-panel-side">
            <div className="sld-vert-side-row">
              <div className="sld-vert-side-k">Ticket range</div>
              <div className="sld-vert-side-v">{ticketRange}</div>
              <div className="sld-vert-side-sub">{ticketLabel}</div>
            </div>
            <div className="sld-vert-side-row accent">
              <div className="sld-vert-side-k">{highlight.k}</div>
              <div className="sld-vert-side-v">{highlight.v}</div>
            </div>
          </div>
        </div>
      </Reveal>
      <Reveal delay={480}>
        <div className="sld-vert-outcomes">
          {outcomes.map((o, i) => (
            <div key={i} className="sld-vert-outcome">
              <div className="sld-vert-outcome-v">{o.v}</div>
              <div className="sld-vert-outcome-k">{o.k}</div>
            </div>
          ))}
        </div>
      </Reveal>
      <Reveal delay={600}>
        <div className="sld-vert-quote">
          <blockquote>&ldquo;{quote}&rdquo;</blockquote>
          <div className="sld-vert-quote-attr">
            <span className="sld-vert-quote-name">{attribution}</span>
            <span className="sld-vert-quote-role">{attributionRole}</span>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

/** Welcome + agenda — the rep's "hello, here's what we'll cover" slide.
 *  Sits right after the brand cover. Two-column: agenda on the left,
 *  presenter card on the right. */
function WelcomeAgenda(): JSX.Element {
  const agenda = [
    { n: '01', t: 'What is TradePay', s: 'The product in one sentence' },
    { n: '02', t: 'Who it’s for', s: 'Your vertical, your homeowner profile' },
    { n: '03', t: 'The problem', s: 'Why your case acceptance is leaking' },
    { n: '04', t: 'The solution', s: 'How the platform actually works' },
    { n: '05', t: 'The transformation', s: 'What 12 months of TradePay looks like' },
    { n: '06', t: 'The ask', s: 'What it costs, how to start' },
  ];
  return (
    <div className="sld-stack sld-grid-hero">
      <div className="sld-hero-left">
        <Reveal>
          <div className="sld-eyebrow">
            <span className="sld-eyebrow-dot" />
            Today&apos;s walkthrough
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h1 className="sld-h1">
            <span className="grad-teal-deep">Here&apos;s what we&apos;ll cover</span>{' '}
            <span className="grad-teal">in the next 15 minutes.</span>
          </h1>
        </Reveal>
        <Reveal delay={240}>
          <p className="sld-sub">
            Six chapters. By the end you&apos;ll know exactly what TradePay is, how it works, who
            it&apos;s for, what it costs, and the path from today to your first funded homeowner.
          </p>
        </Reveal>
      </div>
      <div className="sld-hero-right">
        <Reveal delay={360}>
          <div className="sld-agenda">
            {agenda.map((a, i) => (
              <div key={i} className="sld-agenda-row">
                <span className="sld-agenda-n">{a.n}</span>
                <div>
                  <div className="sld-agenda-t">{a.t}</div>
                  <div className="sld-agenda-s">{a.s}</div>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </div>
  );
}

/** Who is it for — 5 vertical cards (text-only, professional) + "not for" footer. */
function WhoIsItFor(): JSX.Element {
  const verticals = [
    {
      code: 'V01',
      name: 'Roofing',
      ticket: '$8k – $80k',
      who: 'Full re-roofs, storm-damage rebuilds, gutters, fascia',
    },
    {
      code: 'V02',
      name: 'HVAC',
      ticket: '$6k – $40k',
      who: 'Full-system swaps, heat pumps, ductwork, mini-splits',
    },
    {
      code: 'V03',
      name: 'Solar',
      ticket: '$15k – $100k',
      who: 'PV install + battery storage, EV chargers, panel upgrades',
    },
    {
      code: 'V04',
      name: 'Remodel',
      ticket: '$10k – $80k',
      who: 'Kitchen, bath, basement, ADU, whole-home renovations',
    },
    {
      code: 'V05',
      name: 'Exterior',
      ticket: '$5k – $50k',
      who: 'Windows, siding, decking, fencing, hardscape',
    },
  ];
  return (
    <div className="sld-stack">
      <Reveal>
        <div className="sld-eyebrow">
          <span className="sld-eyebrow-dot" />
          Who it&apos;s for
        </div>
      </Reveal>
      <Reveal delay={120}>
        <h2 className="sld-h2">
          <span className="grad-teal-deep">Built for high-ticket</span>{' '}
          <span className="grad-teal">home-improvement work.</span>
        </h2>
      </Reveal>
      <Reveal delay={240}>
        <p className="sld-sub">
          Anywhere a homeowner sits down, hears a number, and has to decide on the spot &mdash;
          that&apos;s our sweet spot. Five verticals today. Same platform, same flow, same
          merchant-direct payout. Just the case stories change.
        </p>
      </Reveal>
      <Reveal delay={360}>
        <div className="sld-who-grid">
          {verticals.map((v, i) => (
            <div key={i} className="sld-who-card">
              <div className="sld-who-code">{v.code}</div>
              <div className="sld-who-name">{v.name}</div>
              <div className="sld-who-ticket">{v.ticket}</div>
              <div className="sld-who-who">{v.who}</div>
            </div>
          ))}
        </div>
      </Reveal>
      <Reveal delay={480}>
        <div className="sld-notfor">
          <span className="sld-notfor-k">Not for</span>
          <span className="sld-notfor-v">
            Low-ticket retail · single-visit walk-ins · cash-only contractors · sub-$500 tickets. We
            don&apos;t replace a credit-card terminal &mdash; we replace the cash-flow objection
            that walks every high-ticket doorstep estimate.
          </span>
        </div>
      </Reveal>
    </div>
  );
}

/** Six autonomous agents · one platform. 3+3 grid of agents with
 *  role, what-they-watch, and output. */
function SixAgents(): JSX.Element {
  // Each agent gets a unique geometric SVG glyph + a "version · LIVE"
  // tag so the grid reads like an ops console, not a static brochure.
  const agents: Array<{
    code: string;
    role: string;
    watches: string;
    output: string;
    version: string;
    glyph: JSX.Element;
  }> = [
    {
      code: 'ORACLE',
      role: 'Homeowner qualification',
      watches: 'Reporting-bureau soft pull on every estimate',
      output: 'Credit · DTI · available credit · income · pre-approval $',
      version: 'v4.2',
      glyph: (
        <svg viewBox="0 0 40 40" aria-hidden>
          <circle cx="20" cy="20" r="14" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="20" cy="20" r="7" fill="currentColor" opacity="0.18" />
          <circle cx="20" cy="20" r="2.5" fill="currentColor" />
          <path
            d="M20 6 L20 14 M20 26 L20 34 M6 20 L14 20 M26 20 L34 20"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </svg>
      ),
    },
    {
      code: 'HELIX',
      role: 'Smart intake + ticket routing',
      watches: 'Form behaviour + ticket size + zip code',
      output: 'Routes full-job leads to estimator · maintenance leads to nurture',
      version: 'v3.8',
      glyph: (
        <svg viewBox="0 0 40 40" aria-hidden>
          <path
            d="M10 6 Q20 14 30 6 Q20 14 10 22 Q20 30 30 22 Q20 30 10 38"
            stroke="currentColor"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
          />
          <circle cx="10" cy="6" r="1.6" fill="currentColor" />
          <circle cx="30" cy="6" r="1.6" fill="currentColor" />
          <circle cx="10" cy="22" r="1.6" fill="currentColor" />
          <circle cx="30" cy="22" r="1.6" fill="currentColor" />
          <circle cx="10" cy="38" r="1.6" fill="currentColor" />
          <circle cx="30" cy="38" r="1.6" fill="currentColor" />
        </svg>
      ),
    },
    {
      code: 'NEXUS',
      role: 'Trades lender marketplace',
      watches: 'GreenSky · Sunlight · Service Finance · Synchrony · EnerBank · Mosaic',
      output: 'Ranked parallel quotes · cheapest monthly wins',
      version: 'v6.1',
      glyph: (
        <svg viewBox="0 0 40 40" aria-hidden>
          <circle cx="20" cy="20" r="3" fill="currentColor" />
          {[0, 60, 120, 180, 240, 300].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            const x2 = 20 + Math.cos(rad) * 12;
            const y2 = 20 + Math.sin(rad) * 12;
            return (
              <g key={deg}>
                <line x1="20" y1="20" x2={x2} y2={y2} stroke="currentColor" strokeWidth="1.4" />
                <circle cx={x2} cy={y2} r="2.2" fill="currentColor" opacity="0.7" />
              </g>
            );
          })}
        </svg>
      ),
    },
    {
      code: 'FLUX',
      role: 'Adaptive lender ordering',
      watches: 'Approval rates · stip pull-throughs · dealer fee · clawback risk',
      output: 'Optimal lender sequence per homeowner profile',
      version: 'v2.5',
      glyph: (
        <svg viewBox="0 0 40 40" aria-hidden>
          <path
            d="M8 12 L20 12 L24 20 L20 28 L8 28"
            stroke="currentColor"
            strokeWidth="1.6"
            fill="none"
            strokeLinejoin="round"
          />
          <path
            d="M16 8 L28 8 L32 16 L28 24 L16 24"
            stroke="currentColor"
            strokeWidth="1.6"
            fill="none"
            strokeLinejoin="round"
            opacity="0.5"
          />
          <circle cx="32" cy="32" r="2.5" fill="currentColor" />
        </svg>
      ),
    },
    {
      code: 'ECHO',
      role: 'Pixel + ad attribution',
      watches: 'Funded-install signal · CAPI server-side',
      output: 'Re-trains Meta + Google + TikTok on real installs',
      version: 'v5.0',
      glyph: (
        <svg viewBox="0 0 40 40" aria-hidden>
          <circle cx="20" cy="20" r="3" fill="currentColor" />
          <circle
            cx="20"
            cy="20"
            r="8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            opacity="0.7"
          />
          <circle
            cx="20"
            cy="20"
            r="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            opacity="0.40"
          />
          <circle
            cx="20"
            cy="20"
            r="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            opacity="0.20"
          />
        </svg>
      ),
    },
    {
      code: 'VEGA',
      role: 'Compliance audit',
      watches: 'Every consent + disclosure',
      output: 'FCRA / ECOA / TILA trail',
      version: 'v1.9',
      glyph: (
        <svg viewBox="0 0 40 40" aria-hidden>
          <path
            d="M20 4 L34 10 L34 22 Q34 30 20 36 Q6 30 6 22 L6 10 Z"
            stroke="currentColor"
            strokeWidth="1.6"
            fill="none"
          />
          <path
            d="M14 20 L18 24 L26 16"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
  ];
  return (
    <div className="sld-stack">
      <Reveal>
        <div className="sld-eyebrow">
          <span className="sld-eyebrow-dot" />
          The agentic layer
        </div>
      </Reveal>
      <Reveal delay={120}>
        <h2 className="sld-h2">
          <span className="grad-teal-deep">Six autonomous agents.</span>{' '}
          <span className="grad-teal">One platform.</span>
        </h2>
      </Reveal>
      <Reveal delay={240}>
        <p className="sld-sub">
          TradePay is a stack of six specialised agents working in parallel on every lead session
          &mdash; financial qualification, smart forms + routing, lender selection, lender quoting,
          pixel attribution, and compliance audit. Every agent is named, observable, and logged.
        </p>
      </Reveal>
      <Reveal delay={360}>
        <div className="sld-agents-grid">
          {agents.map((a, i) => (
            <div key={i} className="sld-agent-card" style={{ animationDelay: `${i * 0.08}s` }}>
              <div className="sld-agent-glow" aria-hidden />
              <div className="sld-agent-head">
                <div className="sld-agent-glyph">{a.glyph}</div>
                <div className="sld-agent-head-r">
                  <div className="sld-agent-code">{a.code}</div>
                  <div className="sld-agent-version">
                    <span className="sld-agent-version-dot" />
                    {a.version} · LIVE
                  </div>
                </div>
              </div>
              <div className="sld-agent-role">{a.role}</div>
              <div className="sld-agent-meta">
                <div>
                  <div className="sld-agent-k">Watches</div>
                  <div className="sld-agent-v">{a.watches}</div>
                </div>
                <div>
                  <div className="sld-agent-k">Output</div>
                  <div className="sld-agent-v">{a.output}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Reveal>
    </div>
  );
}

/** ECHO pixel attribution — deep dive on the "fire on funded job"
 *  feedback loop. */
function EchoPixel(): JSX.Element {
  return (
    <div className="sld-stack">
      <Reveal>
        <div className="sld-eyebrow">
          <span className="sld-eyebrow-dot" />
          ECHO · Pixel attribution
        </div>
      </Reveal>
      <Reveal delay={120}>
        <h2 className="sld-h2">
          <span className="grad-teal-deep">Stop training your pixel</span>{' '}
          <span className="grad-teal">on form fillers.</span>
        </h2>
      </Reveal>
      <Reveal delay={240}>
        <p className="sld-sub">
          Today, your Meta and Google ad pixels fire on a Page View, a Lead, or a Form Submit. Most
          of those leads never fund. Your algorithm optimises for garbage and your CPA drifts up
          month over month. ECHO breaks the loop.
        </p>
      </Reveal>
      <Reveal delay={360}>
        <div className="sld-echo-flow">
          {[
            { n: '01', label: 'Page view', sub: 'Cold click' },
            { n: '02', label: 'Lead', sub: 'Form opened' },
            { n: '03', label: 'Pre-qual', sub: 'Soft-pull tier' },
            { n: '04', label: 'Approved', sub: 'Offer accepted' },
            { n: '05', label: 'Funded', sub: 'Cash settles' },
          ].map((s, i) => (
            <div key={i} className={`sld-echo-node ${i === 4 ? 'is-fund' : ''}`}>
              <div className="sld-echo-n">{s.n}</div>
              <div className="sld-echo-label">{s.label}</div>
              <div className="sld-echo-sub">{s.sub}</div>
            </div>
          ))}
        </div>
      </Reveal>
      <Reveal delay={480}>
        <div className="sld-echo-3d">
          <div className="sld-echo-3d-stage">
            <span className="sld-echo-3d-tag">STAGE 05 · FIRES</span>
            <span className="sld-echo-3d-h">Funded homeowner</span>
            <span className="sld-echo-3d-sub">ECHO holds the pixel until cash settles</span>
          </div>
          <div className="sld-echo-3d-stream" aria-hidden>
            <svg viewBox="0 0 400 140" preserveAspectRatio="none">
              <defs>
                <linearGradient id="echoBeam" x1="0" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(251, 146, 60, 0.0)" />
                  <stop offset="50%" stopColor="rgba(251, 146, 60, 0.55)" />
                  <stop offset="100%" stopColor="rgba(251, 146, 60, 0.0)" />
                </linearGradient>
              </defs>
              <path
                d="M 0 130 Q 100 60, 200 70 T 400 10"
                stroke="url(#echoBeam)"
                strokeWidth="2.5"
                fill="none"
                strokeDasharray="6 6"
                strokeLinecap="round"
              />
              <circle cx="200" cy="70" r="3" fill="var(--mp-teal-2)" opacity="0.7" />
              <circle cx="100" cy="100" r="2" fill="var(--mp-teal)" opacity="0.4" />
              <circle cx="300" cy="32" r="2.5" fill="var(--mp-teal-2)" opacity="0.85" />
            </svg>
          </div>
          <div className="sld-echo-3d-platforms" aria-hidden>
            <div className="sld-echo-3d-platform sld-echo-3d-platform-meta">
              <span className="sld-echo-3d-platform-k">META</span>
              <span className="sld-echo-3d-platform-sig">conversion received</span>
              <span className="sld-echo-3d-platform-dot" />
            </div>
            <div className="sld-echo-3d-platform sld-echo-3d-platform-google">
              <span className="sld-echo-3d-platform-k">GOOGLE</span>
              <span className="sld-echo-3d-platform-sig">conversion received</span>
              <span className="sld-echo-3d-platform-dot" />
            </div>
            <div className="sld-echo-3d-platform sld-echo-3d-platform-tiktok">
              <span className="sld-echo-3d-platform-k">TIKTOK</span>
              <span className="sld-echo-3d-platform-sig">conversion received</span>
              <span className="sld-echo-3d-platform-dot" />
            </div>
          </div>
          <div className="sld-echo-3d-caption">
            ECHO holds the pixel until stage 05 fires. The weighted conversion that returns to Meta,
            Google, and TikTok is a real funded homeowner — not a form-fill. Your algorithm retrains
            on the right buyer profile.
          </div>
        </div>
      </Reveal>
    </div>
  );
}

/** Compound effect — 12-month growth chart showing what cumulative
 *  TradePay revenue + lead-quality improvement looks like. */
function CompoundEffect(): JSX.Element {
  // 12 monthly points · trades-scale cumulative recovered revenue ($ thousands)
  // Mid-size contractor: ~$120k extra recovered in M01, ramping with pixel retrain.
  const months = [
    { m: 'M01', rev: 120, cpa: 0 },
    { m: 'M02', rev: 252, cpa: -4 },
    { m: 'M03', rev: 396, cpa: -9 },
    { m: 'M04', rev: 552, cpa: -14 },
    { m: 'M05', rev: 720, cpa: -19 },
    { m: 'M06', rev: 900, cpa: -25 },
    { m: 'M07', rev: 1092, cpa: -29 },
    { m: 'M08', rev: 1296, cpa: -32 },
    { m: 'M09', rev: 1512, cpa: -34 },
    { m: 'M10', rev: 1740, cpa: -36 },
    { m: 'M11', rev: 1980, cpa: -37 },
    { m: 'M12', rev: 2232, cpa: -38 },
  ];
  const maxRev = Math.max(...months.map((m) => m.rev));
  return (
    <div className="sld-stack">
      <Reveal>
        <div className="sld-eyebrow">
          <span className="sld-eyebrow-dot" />
          The compound effect
        </div>
      </Reveal>
      <Reveal delay={120}>
        <h2 className="sld-h2">
          <span className="grad-teal">Better data in</span>{' '}
          <span className="grad-teal-deep">means cheaper, better leads out.</span>
        </h2>
      </Reveal>
      <Reveal delay={240}>
        <p className="sld-sub">
          TradePay does not just close more homeowners at today&apos;s estimate. It compounds. Each
          funded install re-trains your pixel. Meta and Google start sending you homeowners who
          actually buy, not tire-kickers. Better leads close at a higher rate. The cycle
          accelerates. Twelve months in, the truck schedule is unrecognisable.
        </p>
      </Reveal>
      <Reveal delay={360}>
        <div className="sld-comp-chart">
          <div className="sld-comp-bars">
            {months.map((m, i) => (
              <div key={i} className="sld-comp-col">
                <div
                  className="sld-comp-bar"
                  style={{ height: `${(m.rev / maxRev) * 100}%`, animationDelay: `${i * 0.06}s` }}
                  title={`+$${m.rev}k recovered · CPA ${m.cpa}%`}
                />
                <div className="sld-comp-m">{m.m}</div>
              </div>
            ))}
          </div>
          <div className="sld-comp-legend">
            <div>
              <div className="sld-comp-legend-k">Cumulative recovered revenue</div>
              <div className="sld-comp-legend-v">
                ~$2.2M by month 12 · mid-size contractor · illustrative
              </div>
            </div>
            <div>
              <div className="sld-comp-legend-k">CPA trajectory</div>
              <div className="sld-comp-legend-v">
                −38% by month 12 · driven by ECHO pixel retraining
              </div>
            </div>
          </div>
        </div>
      </Reveal>
      <Reveal delay={480}>
        <div className="sld-mini-stats">
          <MiniStat v="~$2.2M" k="Cum. recovered / yr" />
          <MiniStat v="−38%" k="CPA by month 12" />
          <MiniStat v="2.4×" k="Funded jobs / $1k ad spend" />
          <MiniStat v="+27%" k="Estimate-to-install rate (vs. M01)" />
        </div>
      </Reveal>
    </div>
  );
}

/** Full value stack — what you actually get with TradePay, side-by-side
 *  with "if you bought separately" cost. The most important slide for
 *  the close — anchors price perception. */
function ValueStack(): JSX.Element {
  const groups: Array<{ head: string; items: string[]; alt: string }> = [
    {
      head: 'Pre-qualification layer',
      items: [
        'Soft-pull fundability tier (FCRA-compliant)',
        'Last-4-SSN + DOB + income in-session',
        'HELIX smart-form intake (−41% drop-off)',
        'Real-time signal scoring · ORACLE',
      ],
      alt: '$2,400 / mo · standalone form + scoring vendor',
    },
    {
      head: 'Lender marketplace',
      items: [
        'Parallel quoting across the marketplace',
        'NEXUS lender selection · ranked total-cost',
        'FLUX adaptive routing by tier',
        'Ticket coverage from $1k to $50k',
      ],
      alt: '$1,800 / mo + 1.5% take-rate · single-lender programs',
    },
    {
      head: 'Smart routing + ops',
      items: [
        'HELIX best-fit estimator routing',
        'Capacity + geo + ticket-fit matching',
        'Smartphone continuity for off-site signing',
        'Merchant-direct ACH disbursement',
      ],
      alt: '$1,200 / mo · routing tool + payment processor',
    },
    {
      head: 'Pixel + attribution',
      items: [
        'ECHO funded-event pixel retraining',
        'Server-side CAPI to Meta + Google + TikTok',
        'Funnel-stage event ledger',
        'Per-channel ROAS attribution',
      ],
      alt: '$900 / mo · CAPI vendor + analytics',
    },
    {
      head: 'Reporting + support',
      items: [
        'Daily funded summary + monthly invoice',
        'Per-rep performance dashboards',
        'Live chat + dedicated CSM',
        'Free implementation + staff training',
      ],
      alt: '$600 / mo · BI tool + support seat',
    },
  ];
  return (
    <div className="sld-stack">
      <Reveal>
        <div className="sld-eyebrow">
          <span className="sld-eyebrow-dot" />
          Full value stack
        </div>
      </Reveal>
      <Reveal delay={120}>
        <h2 className="sld-h2">
          <span className="grad-teal-deep">Everything you get</span>{' '}
          <span className="grad-teal">in one platform.</span>
        </h2>
      </Reveal>
      <Reveal delay={240}>
        <p className="sld-sub">
          TradePay replaces a stack of six vendors that most contractors duct-tape together.
          Here&apos;s everything included &mdash; and what you&apos;d typically pay if you bought it
          piecemeal.
        </p>
      </Reveal>
      <Reveal delay={360}>
        <div className="sld-stack-grid">
          {groups.map((g, i) => (
            <div key={i} className="sld-stack-card">
              <div className="sld-stack-head">{g.head}</div>
              <ul className="sld-stack-items">
                {g.items.map((it, j) => (
                  <li key={j}>
                    <span className="sld-stack-check">✓</span> {it}
                  </li>
                ))}
              </ul>
              <div className="sld-stack-alt">
                <span className="sld-stack-alt-k">If bought separately</span>
                <span className="sld-stack-alt-v">{g.alt}</span>
              </div>
            </div>
          ))}
        </div>
      </Reveal>
      <Reveal delay={480}>
        <div className="sld-stack-total">
          <div className="sld-stack-total-row">
            <span className="sld-stack-total-k">Equivalent vendor stack</span>
            <span className="sld-stack-total-v">~$7,700 / month · ~$92,400 / yr</span>
          </div>
          <div className="sld-stack-total-row accent">
            <span className="sld-stack-total-k">TradePay</span>
            <span className="sld-stack-total-v">
              $10,000 one-time · $3 / lead · 4% of settled loans
            </span>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

/** Trusted by 1,000+ contractors — enterprise social proof slide.
 *  Goes right after "Who it's for" so the prospect knows TradePay
 *  isn't a side project before we walk into the problem. */
function TrustedBy(): JSX.Element {
  const tile = (label: string) => (
    <div className="sld-trust-tile">
      <div className="sld-trust-tile-dot" />
      <span>{label}</span>
    </div>
  );
  return (
    <div className="sld-stack">
      <Reveal>
        <div className="sld-eyebrow">
          <span className="sld-eyebrow-dot" />
          Enterprise trust
        </div>
      </Reveal>
      <Reveal delay={120}>
        <h2 className="sld-h2">
          <span className="grad-teal-deep">Over 1,000 contractors</span>{' '}
          <span className="grad-teal">already run on TradePay.</span>
        </h2>
      </Reveal>
      <Reveal delay={240}>
        <p className="sld-sub">
          We&apos;ve been in market with roofing crews, HVAC businesses, solar installers, remodel
          generals, and exterior contractors since launch. The platform is hardened, the lender
          panel is live, and the support team is staffed for scale.
        </p>
      </Reveal>
      <Reveal delay={360}>
        <div className="sld-trust-hero">
          <div className="sld-trust-hero-row">
            <div>
              <div className="sld-trust-hero-v">
                <AnimatedCounter to={1000} suffix="+" />
              </div>
              <div className="sld-trust-hero-k">Contractors live</div>
            </div>
            <div>
              <div className="sld-trust-hero-v">
                $<AnimatedCounter to={240} suffix="M+" />
              </div>
              <div className="sld-trust-hero-k">Funded to date</div>
            </div>
            <div>
              <div className="sld-trust-hero-v">
                <AnimatedCounter to={12400} suffix="+" />
              </div>
              <div className="sld-trust-hero-k">Homeowners financed</div>
            </div>
            <div>
              <div className="sld-trust-hero-v">5</div>
              <div className="sld-trust-hero-k">Verticals supported</div>
            </div>
          </div>
        </div>
      </Reveal>
      <Reveal delay={480}>
        <div className="sld-section-title">Where TradePay is running today</div>
      </Reveal>
      <Reveal delay={540}>
        <div className="sld-trust-tiles">
          {[
            'Roofing — 540+ crews',
            'HVAC — 230+ businesses',
            'Solar — 120+ installers',
            'Remodel — 80+ generals',
            'Exterior — 50+ contractors',
            'All 50 US states',
            'NMLS #2456701',
            'SOC 2 in progress',
          ].map((l, i) => (
            <span key={i}>{tile(l)}</span>
          ))}
        </div>
      </Reveal>
    </div>
  );
}

/** Big finale CTA — cinematic close slide. Particles, oversized
 *  headline, two large CTAs, trust line. */
function BigFinaleCTA(): JSX.Element {
  return (
    <div className="sld-stack sld-finale">
      <ParticleField count={36} />
      <Reveal>
        <div className="sld-eyebrow">
          <span className="sld-eyebrow-dot" />
          Let&apos;s go
        </div>
      </Reveal>
      <Reveal delay={120}>
        <h2 className="sld-h2 sld-h2-mega">
          <span className="grad-teal-deep">Homeowners walk in</span>
          <br />
          <span className="grad-teal">curious.</span>{' '}
          <span className="grad-teal-deep">They walk out funded.</span>
        </h2>
      </Reveal>
      <Reveal delay={240}>
        <p className="sld-sub sld-finale-sub">
          $10,000 to set up. $3 per smart-form lead. 4% of loans that actually settle. Live in up to
          five business days. 1,000+ contractors already running on TradePay.
        </p>
      </Reveal>
      <Reveal delay={360}>
        <div className="sld-finale-ctas sld-finale-ctas-single">
          <a href="/tradepay/checkout" className="sld-finale-primary">
            <span className="sld-finale-primary-h">Get started · $10,000</span>
            <span className="sld-finale-primary-sub">
              Sign today · KYB clears in 60s · live in 5 days
            </span>
            <span className="sld-finale-primary-arrow" aria-hidden>
              →
            </span>
          </a>
        </div>
      </Reveal>
      <Reveal delay={480}>
        <div className="sld-finale-trust">
          NMLS&nbsp;#2456701 · FCRA · ECOA · TILA · 1,000+ contractors · $10k setup · $3 / lead · 4%
          settled
        </div>
      </Reveal>
    </div>
  );
}

/** Interactive economics slide — 5 sliders covering the full funnel,
 *  with the actual math shown as a formula below each output. */
function EconomicsSlide(): JSX.Element {
  // Defaults tuned for a mid-size contractor: 120 estimates/month, ~50%
  // homeowner-qualifies, $18k average ticket (HVAC swap / kitchen reno).
  // Close rates: 22% baseline doorstep close without financing, 65% with
  // TradePay. 80% of approved offers actually fund (some homeowners
  // back out, some lenders pull stips at funding).
  const [leads, setLeads] = useState(120);
  const [qualPct, setQualPct] = useState(50);
  const [ticket, setTicket] = useState(18000);
  const [closeWithout, setCloseWithout] = useState(22);
  const [closeWith, setCloseWith] = useState(65);
  const [fundPct, setFundPct] = useState(80);

  const qualified = Math.round(leads * (qualPct / 100));
  const fundedWith = Math.round(qualified * (closeWith / 100) * (fundPct / 100));
  const fundedWithout = Math.round(qualified * (closeWithout / 100));
  const revWith = fundedWith * 12 * ticket;
  const revWithout = fundedWithout * 12 * ticket;
  const delta = Math.max(0, revWith - revWithout);

  const fmt = (n: number) => {
    if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2) + 'M';
    if (n >= 1_000) return '$' + (n / 1_000).toFixed(0) + 'k';
    return '$' + n.toLocaleString('en-US');
  };

  return (
    <div className="sld-stack">
      <Reveal>
        <div className="sld-eyebrow">
          <span className="sld-eyebrow-dot" />
          Your economics
        </div>
      </Reveal>
      <Reveal delay={120}>
        <h2 className="sld-h2">
          <span className="grad-teal">Drag the funnel.</span>{' '}
          <span className="grad-teal-deep">Watch the math.</span>
        </h2>
      </Reveal>
      <Reveal delay={240}>
        <div className="sld-econ-live">
          <div className="sld-econ-inputs">
            <div className="sld-econ-input">
              <label>
                Inbound leads / month <span className="sld-econ-input-v">{leads}</span>
              </label>
              <input
                type="range"
                min={50}
                max={500}
                step={10}
                value={leads}
                onChange={(e) => setLeads(Number(e.target.value))}
              />
            </div>
            <div className="sld-econ-input">
              <label>
                Qualified % <span className="sld-econ-input-v">{qualPct}%</span>
              </label>
              <input
                type="range"
                min={20}
                max={80}
                step={1}
                value={qualPct}
                onChange={(e) => setQualPct(Number(e.target.value))}
              />
            </div>
            <div className="sld-econ-input">
              <label>
                Avg ticket{' '}
                <span className="sld-econ-input-v">${ticket.toLocaleString('en-US')}</span>
              </label>
              <input
                type="range"
                min={5000}
                max={80000}
                step={500}
                value={ticket}
                onChange={(e) => setTicket(Number(e.target.value))}
              />
            </div>
            <div className="sld-econ-input">
              <label>
                Close % · without TradePay <span className="sld-econ-input-v">{closeWithout}%</span>
              </label>
              <input
                type="range"
                min={10}
                max={35}
                step={1}
                value={closeWithout}
                onChange={(e) => setCloseWithout(Number(e.target.value))}
              />
            </div>
            <div className="sld-econ-input">
              <label>
                Close % · with TradePay <span className="sld-econ-input-v">{closeWith}%</span>
              </label>
              <input
                type="range"
                min={40}
                max={90}
                step={1}
                value={closeWith}
                onChange={(e) => setCloseWith(Number(e.target.value))}
              />
            </div>
            <div className="sld-econ-input">
              <label>
                Funded % · lender approval <span className="sld-econ-input-v">{fundPct}%</span>
              </label>
              <input
                type="range"
                min={50}
                max={95}
                step={1}
                value={fundPct}
                onChange={(e) => setFundPct(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="sld-econ-outputs">
            <div className="sld-econ-card">
              <div className="sld-econ-eyebrow">Without TradePay</div>
              <div className="sld-econ-num">{fmt(revWithout)}</div>
              <div className="sld-econ-sub">Recovered revenue / yr</div>
              <div className="sld-econ-sub-sm">
                {fundedWithout.toLocaleString('en-US')} funded homeowners / mo
              </div>
              <div className="sld-econ-math">
                {leads} leads × {qualPct}% qualified × {closeWithout}% close = {fundedWithout}/mo
                <br />
                {fundedWithout} × ${ticket.toLocaleString('en-US')} × 12 ={' '}
                <strong>{fmt(revWithout)}</strong>
              </div>
            </div>
            <div className="sld-econ-card with">
              <div className="sld-econ-eyebrow accent">With TradePay</div>
              <div className="sld-econ-num accent">{fmt(revWith)}</div>
              <div className="sld-econ-sub">Recovered revenue / yr</div>
              <div className="sld-econ-sub-sm">
                {fundedWith.toLocaleString('en-US')} funded homeowners / mo
              </div>
              <div className="sld-econ-math accent">
                {leads} × {qualPct}% × {closeWith}% × {fundPct}% funded = {fundedWith}/mo
                <br />
                {fundedWith} × ${ticket.toLocaleString('en-US')} × 12 ={' '}
                <strong>{fmt(revWith)}</strong>
              </div>
            </div>
          </div>
          <div className="sld-econ-delta">
            <span className="sld-econ-delta-tag">Delta</span>
            <span className="sld-econ-delta-val">+ {fmt(delta)} / year</span>
            <span className="sld-econ-delta-sub">illustrative · varies by business</span>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

/* ================================ main page ============================== */

export default function TradePaySalesDeck(): JSX.Element {
  const [idx, setIdx] = useState(0);

  const goTo = useCallback((i: number) => {
    const clamped = Math.max(0, Math.min(SLIDES.length - 1, i));
    setIdx(clamped);
    const el = document.getElementById(`slide-${clamped}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    const stackRoot = document.querySelector('.sld-stack-root');
    if (!stackRoot) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const n = Number((e.target as HTMLElement).dataset.idx ?? 0);
            setIdx(n);
          }
        });
      },
      { root: stackRoot, threshold: 0.55 },
    );
    SLIDES.forEach((_, i) => {
      const el = document.getElementById(`slide-${i}`);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        goTo(idx + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goTo(idx - 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        goTo(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        goTo(SLIDES.length - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [idx, goTo]);

  return (
    <div className="sld-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="sld-mesh" aria-hidden />

      <div className="sld-chrome">
        <div className="sld-brand">TradePay · Sales deck</div>
        <div className="sld-counter">
          <span className="sld-counter-cur">{String(idx + 1).padStart(2, '0')}</span>
          <span className="sld-counter-sep"> / </span>
          <span className="sld-counter-tot">{String(SLIDES.length).padStart(2, '0')}</span>
        </div>
      </div>

      <div className="sld-nav">
        <button
          type="button"
          className="sld-nav-btn"
          onClick={() => goTo(idx - 1)}
          disabled={idx === 0}
          aria-label="Previous slide"
        >
          ←
        </button>
        <div className="sld-dots">
          {SLIDES.map((s, i) => (
            <button
              key={i}
              type="button"
              className={`sld-dot ${i === idx ? 'is-active' : ''}`}
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}: ${s.title}`}
              title={`${s.n} · ${s.title}`}
            />
          ))}
        </div>
        <button
          type="button"
          className="sld-nav-btn"
          onClick={() => goTo(idx + 1)}
          disabled={idx === SLIDES.length - 1}
          aria-label="Next slide"
        >
          →
        </button>
      </div>

      <main className="sld-stack-root">
        {SLIDES.map((s, i) => (
          <section
            key={i}
            id={`slide-${i}`}
            data-idx={i}
            className="sld-slide"
            aria-label={`Slide ${i + 1}: ${s.title}`}
          >
            <div className="sld-slide-n">{s.n}</div>
            {s.build()}
          </section>
        ))}
      </main>
    </div>
  );
}

/* =================================== CSS ================================= */

const CSS = `
.sld-root {
  /* TradePay palette — orange primary, slate ink, paper background */
  --mp-teal: #EA580C;
  --mp-teal-2: #FB923C;
  --mp-teal-light: #FFF7ED;
  --mp-deep: #431407;
  --mp-ink: #0F172A;
  --mp-ink-2: #1E293B;
  --mp-mute: #64748B;
  --mp-line: rgba(234, 88, 12, 0.12);
  --mp-line-strong: rgba(234, 88, 12, 0.22);

  position: relative;
  background: linear-gradient(180deg, #FFF7ED 0%, #FFFFFF 30%, #FAFAF9 65%, #FFFFFF 100%);
  color: var(--mp-ink);
  font-family: inherit;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
  overflow-x: hidden;
}
.sld-root * { box-sizing: border-box; }
.sld-root a { color: inherit; text-decoration: none; }
.sld-root button { font-family: inherit; cursor: pointer; }

/* ===== Animated gradient mesh background — fixed, behind everything ===== */
.sld-mesh {
  position: fixed; inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse 60% 40% at 15% 20%, rgba(251, 146, 60, 0.16) 0%, transparent 60%),
    radial-gradient(ellipse 50% 60% at 85% 30%, rgba(234, 88, 12, 0.12) 0%, transparent 55%),
    radial-gradient(ellipse 70% 50% at 50% 90%, rgba(251, 146, 60, 0.10) 0%, transparent 55%);
  animation: sldMeshDrift 24s ease-in-out infinite;
}
@keyframes sldMeshDrift {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(-30px, 20px) scale(1.05); }
  66% { transform: translate(20px, -10px) scale(0.98); }
}

/* ===== Gradient text utilities ===== */
.sld-root .grad-teal {
  background: linear-gradient(120deg, var(--mp-teal) 0%, var(--mp-teal-2) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.sld-root .grad-teal-deep {
  background: linear-gradient(120deg, var(--mp-deep) 0%, var(--mp-teal) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}

/* ===== Slide structure ===== */
.sld-stack-root {
  position: relative;
  z-index: 1;
  scroll-snap-type: y mandatory;
  height: 100vh;
  overflow-y: scroll;
}
.sld-slide {
  scroll-snap-align: start;
  scroll-snap-stop: always;
  /* Each slide is exactly one viewport tall and scrolls internally if
     content overflows. Keeps the scroll-snap parent's snap-points clean
     and makes every slide feel like a discrete presentation frame. */
  height: 100vh;
  min-height: 640px;
  overflow-y: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 80px 64px;
  position: relative;
}
.sld-slide-n {
  position: absolute;
  top: 28px; left: 32px;
  font-size: 11px; letter-spacing: 0.22em;
  font-weight: 700; color: var(--mp-mute);
  text-transform: uppercase;
}
.sld-stack {
  max-width: 1180px;
  width: 100%;
  display: flex; flex-direction: column;
  gap: 24px;
}
.sld-grid-hero {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  gap: 56px;
  align-items: center;
  max-width: 1280px;
}
.sld-hero-left { display: flex; flex-direction: column; gap: 24px; }
.sld-hero-right { position: relative; min-height: 480px; }

/* ===== Reveal ===== */
.sld-reveal {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.7s cubic-bezier(0.22, 0.61, 0.36, 1),
              transform 0.7s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.sld-reveal.is-visible {
  opacity: 1;
  transform: translateY(0);
}

/* ===== Eyebrow pill ===== */
.sld-eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 11px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--mp-teal);
  text-transform: uppercase;
  padding: 6px 14px;
  background: rgba(251, 146, 60, 0.10);
  border: 1px solid var(--mp-line);
  border-radius: 999px;
  align-self: flex-start;
}
.sld-eyebrow-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--mp-teal-2);
  box-shadow: 0 0 0 0 rgba(251, 146, 60, 0.5);
  animation: sldPulse 1.6s ease-in-out infinite;
}
@keyframes sldPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(251, 146, 60, 0.5); }
  50% { box-shadow: 0 0 0 8px rgba(251, 146, 60, 0); }
}

/* ===== Headlines — lighter editorial weight (was 800), more
   refined tracking, kept punchy via the gradient text fills. ===== */
.sld-h1 {
  font-size: 80px; font-weight: 600;
  letter-spacing: -0.04em; line-height: 1.02;
  margin: 0;
}
.sld-h2 {
  font-size: 56px; font-weight: 600;
  letter-spacing: -0.034em; line-height: 1.08;
  margin: 0;
}
.sld-h2-big { font-size: 64px; }
.sld-h2 em {
  font-weight: 400;
  font-style: italic;
  color: var(--mp-ink-2);
}
.sld-sub {
  font-size: 19px; line-height: 1.55;
  color: var(--mp-ink-2);
  max-width: 800px;
  margin: 0;
}
.sld-sub strong { color: var(--mp-teal); font-weight: 700; }
.sld-count { font-variant-numeric: tabular-nums; }

/* ===== Trust chips row ===== */
.sld-chips {
  display: flex; flex-wrap: wrap; gap: 8px;
  margin-top: 12px;
}
.sld-chip {
  display: inline-flex; align-items: center;
  font-size: 12px; letter-spacing: 0.04em;
  color: var(--mp-ink-2);
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.75);
  border: 1px solid var(--mp-line);
  border-radius: 999px;
}

/* ===== Hero stat row ===== */
.sld-hero-stat-row {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-top: 16px;
  padding: 20px 0;
  border-top: 1px solid var(--mp-line);
}
.sld-hero-stat {}
.sld-hero-stat-v {
  font-size: 30px; font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--mp-ink);
}
.sld-hero-stat-k {
  margin-top: 4px;
  font-size: 11px; letter-spacing: 0.14em;
  color: var(--mp-mute);
  text-transform: uppercase;
  font-weight: 600;
}

/* ===== Stat row (slide 02 etc.) ===== */
.sld-stat-row {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: var(--mp-line);
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--mp-line);
  margin-top: 8px;
}
.sld-stat {
  background: rgba(255, 255, 255, 0.85);
  padding: 22px 24px;
}
.sld-stat-v {
  font-size: 36px; font-weight: 800; letter-spacing: -0.025em;
  color: var(--mp-ink);
  line-height: 1;
}
.sld-stat-k {
  margin-top: 6px;
  font-size: 12px; color: var(--mp-mute); line-height: 1.4;
}

/* ===== Vs 2-col ===== */
.sld-vs-2col {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 18px;
}
.sld-vs-side {
  padding: 28px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid var(--mp-line);
}
.sld-vs-med {
  background:
    radial-gradient(ellipse 80% 100% at 100% 0%, rgba(251, 146, 60, 0.16), transparent 70%),
    rgba(255, 255, 255, 0.95);
  border-color: var(--mp-line-strong);
  box-shadow: 0 22px 50px -28px rgba(234, 88, 12, 0.30);
}
.sld-vs-eyebrow {
  font-size: 11px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--mp-mute);
  text-transform: uppercase;
  margin-bottom: 18px;
}
.sld-vs-eyebrow.accent { color: var(--mp-teal); }
.sld-vs-side ul { list-style: none; padding: 0; margin: 0; }
.sld-vs-side li {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 0;
  border-bottom: 1px dashed var(--mp-line);
  font-size: 15px; color: var(--mp-ink-2);
}
.sld-vs-side li:last-child { border-bottom: none; }
.sld-vs-icon {
  width: 22px; height: 22px; border-radius: 999px;
  display: inline-flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 12px;
}
.sld-vs-x {
  background: rgba(200, 75, 75, 0.10);
  color: rgb(170, 60, 60);
}
.sld-vs-check {
  background: rgba(251, 146, 60, 0.18);
  color: var(--mp-teal);
}

/* ===== Pillars 3-up · slide 1 ===== */
.sld-pillars {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 18px;
  margin-top: 8px;
  perspective: 1400px;
}
.sld-pillar {
  position: relative;
  background:
    radial-gradient(ellipse 80% 60% at 0% 0%, rgba(251, 146, 60, 0.10), transparent 65%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.97) 0%, rgba(248, 253, 252, 0.97) 100%);
  border: 1px solid var(--mp-line-strong);
  border-radius: 22px;
  padding: 26px 26px 22px;
  box-shadow:
    0 22px 60px -32px rgba(234, 88, 12, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  transition: transform 0.35s cubic-bezier(0.22, 0.61, 0.36, 1),
              box-shadow 0.35s cubic-bezier(0.22, 0.61, 0.36, 1);
  overflow: hidden;
  display: flex; flex-direction: column;
  gap: 4px;
}
.sld-pillar-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 110%, rgba(251, 146, 60, 0.20), transparent 60%);
  opacity: 0;
  transition: opacity 0.35s ease;
  pointer-events: none;
}
.sld-pillar:hover {
  transform: translateY(-6px) rotateX(2deg);
  box-shadow:
    0 36px 80px -32px rgba(234, 88, 12, 0.40),
    inset 0 1px 0 rgba(255, 255, 255, 1);
}
.sld-pillar:hover .sld-pillar-glow { opacity: 1; }
.sld-pillar > * { position: relative; z-index: 1; }
.sld-pillar-n {
  display: inline-block;
  width: fit-content;
  padding: 3px 8px;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10px; letter-spacing: 0.20em; font-weight: 700;
  color: var(--mp-teal);
  background: rgba(251, 146, 60, 0.10);
  border: 1px solid rgba(234, 88, 12, 0.20);
  border-radius: 6px;
}
.sld-pillar-metric {
  margin-top: 12px;
  font-size: 40px; font-weight: 700;
  letter-spacing: -0.038em;
  line-height: 1;
  background: linear-gradient(135deg, var(--mp-deep) 0%, var(--mp-teal) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  font-variant-numeric: tabular-nums;
}
.sld-pillar-h {
  margin-top: 10px;
  font-size: 20px; font-weight: 600;
  letter-spacing: -0.018em;
  color: var(--mp-ink);
}
.sld-pillar-b {
  margin-top: 6px;
  font-size: 13.5px; color: var(--mp-ink-2); line-height: 1.55;
}
.sld-pillar-tags {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px dashed var(--mp-line);
  display: flex; flex-wrap: wrap;
  gap: 6px;
}
.sld-pillar-tag {
  font-size: 10.5px; letter-spacing: 0.04em;
  font-weight: 600;
  color: var(--mp-teal);
  background: rgba(251, 146, 60, 0.08);
  border: 1px solid rgba(234, 88, 12, 0.16);
  padding: 4px 8px;
  border-radius: 6px;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
}

/* ===== Stage row (slides 05–09) ===== */
.sld-stage-row {
  display: grid; grid-template-columns: 320px 1fr;
  gap: 48px; align-items: center;
  margin-top: 16px;
  padding: 44px 48px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--mp-line-strong);
  border-radius: 28px;
  box-shadow: 0 30px 80px -32px rgba(234, 88, 12, 0.30);
  position: relative; overflow: hidden;
}
.sld-stage-row::before {
  content: '';
  position: absolute; top: -40%; right: -10%;
  width: 360px; height: 360px;
  background: radial-gradient(circle, rgba(251, 146, 60, 0.18), transparent 65%);
  pointer-events: none;
}
.sld-stage-metric {
  border-right: 1px solid var(--mp-line);
  padding-right: 36px;
  position: relative;
}
.sld-stage-metric-v {
  font-size: 64px; font-weight: 800;
  letter-spacing: -0.035em;
  background: linear-gradient(135deg, var(--mp-deep) 0%, var(--mp-teal) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  line-height: 1;
}
.sld-stage-metric-l {
  margin-top: 10px;
  font-size: 11px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--mp-mute);
  text-transform: uppercase;
}
.sld-stage-body {
  font-size: 17px; color: var(--mp-ink-2); line-height: 1.6;
  margin: 0;
  position: relative;
}

/* ===== Tilt scene + card ===== */
.sld-tilt-scene {
  perspective: 1400px;
  perspective-origin: 50% 50%;
  width: 100%;
  height: 100%;
  display: flex; align-items: center; justify-content: center;
  position: relative;
  z-index: 2;
}
.sld-tilt-card {
  --tx: 6deg;
  --ty: -10deg;
  transform-style: preserve-3d;
  transform: rotateX(var(--tx)) rotateY(var(--ty));
  transition: transform .35s cubic-bezier(0.22, 0.61, 0.36, 1);
  will-change: transform;
}

/* ===== Mock offer card ===== */
.sld-mock {
  width: 440px;
  background: rgba(255, 255, 255, 0.97);
  border: 1px solid var(--mp-line-strong);
  border-radius: 24px;
  padding: 26px;
  box-shadow:
    0 60px 110px -50px rgba(234, 88, 12, 0.55),
    0 30px 60px -30px rgba(234, 88, 12, 0.35),
    0 1px 0 rgba(255, 255, 255, 1) inset;
}
.sld-mock-head {
  display: flex; align-items: center; justify-content: space-between;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--mp-line);
}
.sld-mock-pill {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 10.5px; letter-spacing: 0.20em; font-weight: 700;
  color: var(--mp-teal);
  text-transform: uppercase;
  padding: 4px 10px;
  background: rgba(251, 146, 60, 0.12);
  border-radius: 999px;
}
.sld-mock-pill-dot {
  width: 5px; height: 5px; border-radius: 999px;
  background: var(--mp-teal-2);
}
.sld-mock-meta {
  font-size: 9px; letter-spacing: 0.18em;
  color: var(--mp-mute);
  text-transform: uppercase;
  padding: 3px 8px;
  background: rgba(15, 23, 42, 0.04);
  border-radius: 6px;
}
.sld-mock-project {
  margin-top: 14px;
  font-size: 10.5px; letter-spacing: 0.22em;
  color: var(--mp-mute);
  text-transform: uppercase;
}
.sld-mock-amount {
  margin-top: 4px;
  font-size: 44px; font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--mp-ink);
  font-variant-numeric: tabular-nums;
  display: flex; align-items: baseline; gap: 12px;
}
.sld-mock-amount-sub {
  font-size: 12px; font-weight: 600;
  color: var(--mp-teal);
  text-transform: uppercase;
  letter-spacing: 0.18em;
}
.sld-mock-rows {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--mp-line);
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 18px;
}
.sld-mock-k {
  font-size: 9px; letter-spacing: 0.20em;
  color: var(--mp-mute);
  text-transform: uppercase;
  font-weight: 600;
}
.sld-mock-v {
  margin-top: 4px;
  font-size: 14px; font-weight: 600;
  color: var(--mp-ink);
}
.sld-mock-bar {
  margin-top: 18px;
  height: 6px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.06);
  overflow: hidden;
}
.sld-mock-bar-fill {
  height: 100%;
  width: 78%;
  background: linear-gradient(90deg, var(--mp-deep) 0%, var(--mp-teal-2) 100%);
  border-radius: 999px;
  animation: sldBarFill 1.8s ease-out;
}
@keyframes sldBarFill {
  from { width: 0%; }
  to { width: 78%; }
}
.sld-mock-stages {
  margin-top: 10px;
  display: flex; justify-content: space-between;
  font-size: 9px; letter-spacing: 0.10em;
  color: var(--mp-mute);
  text-transform: uppercase;
  font-weight: 600;
}
.sld-mock-stages .on { color: var(--mp-teal); }
.sld-mock-stages .cur {
  color: var(--mp-deep);
  position: relative;
}
.sld-mock-stages .cur::after {
  content: '';
  position: absolute; bottom: -4px; left: 50%;
  transform: translateX(-50%);
  width: 4px; height: 4px; border-radius: 999px;
  background: var(--mp-teal-2);
}
.sld-mock-cta {
  margin-top: 18px;
  padding: 13px 16px;
  text-align: center;
  background: linear-gradient(135deg, var(--mp-deep) 0%, var(--mp-teal) 100%);
  color: #fff;
  border-radius: 12px;
  font-size: 13.5px; font-weight: 700;
  letter-spacing: 0.02em;
}
.sld-mock-foot {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--mp-line);
  font-size: 10px; letter-spacing: 0.14em;
  color: var(--mp-mute);
  text-transform: uppercase;
  text-align: center;
}

/* ===== Particles ===== */
.sld-particles {
  position: absolute; inset: 0;
  pointer-events: none;
  z-index: 0;
}
.sld-particle {
  position: absolute;
  border-radius: 999px;
  background: var(--mp-teal-2);
  box-shadow: 0 0 6px rgba(251, 146, 60, 0.5);
  animation: sldFloat 12s ease-in-out infinite;
  opacity: 0.4;
}
@keyframes sldFloat {
  0% { transform: translateY(0) translateX(0); opacity: 0; }
  10% { opacity: 0.55; }
  50% { transform: translateY(-40px) translateX(20px); opacity: 0.4; }
  90% { opacity: 0.4; }
  100% { transform: translateY(-80px) translateX(-10px); opacity: 0; }
}

/* ===== Marketplace viz (slide 07) — one app → parallel quotes =====
 * LEFT: the single application submitted by the homeowner.
 * CENTER: dashed lines fan out (parallel submission).
 * RIGHT: ranked lender quotes streaming back, cheapest first.
 * Winner gets a teal star + glowing card. */
.sld-mp {
  display: grid;
  grid-template-columns: 260px 100px 1fr;
  gap: 16px;
  align-items: center;
  margin-top: 8px;
}
.sld-mp-app {
  display: flex; flex-direction: column;
  gap: 8px;
}
.sld-mp-app-eyebrow {
  font-size: 10.5px; letter-spacing: 0.22em; font-weight: 700;
  color: var(--mp-teal);
  text-transform: uppercase;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
}
.sld-mp-app-card {
  padding: 16px;
  background:
    radial-gradient(ellipse 80% 100% at 0% 0%, rgba(251, 146, 60, 0.10), transparent 70%),
    rgba(255, 255, 255, 0.96);
  border: 1px solid var(--mp-line-strong);
  border-radius: 14px;
  box-shadow:
    0 22px 50px -28px rgba(234, 88, 12, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.95);
  display: flex; flex-direction: column; gap: 8px;
}
.sld-mp-app-row {
  display: flex; align-items: baseline; justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px dashed var(--mp-line);
  font-size: 12.5px;
}
.sld-mp-app-row:last-child { border-bottom: none; }
.sld-mp-app-k { color: var(--mp-mute); }
.sld-mp-app-v {
  font-weight: 600;
  color: var(--mp-ink);
  font-variant-numeric: tabular-nums;
}
.sld-mp-app-sig {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 11px;
  color: var(--mp-mute);
}
.sld-mp-app-sig-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--mp-teal-2);
  animation: sldPulse 1.5s ease-in-out infinite;
}
.sld-mp-bus {
  position: relative;
  height: 240px;
}
.sld-mp-bus svg {
  width: 100%; height: 100%;
}
.sld-mp-quotes {
  display: flex; flex-direction: column;
  gap: 6px;
  padding: 14px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--mp-line);
  border-radius: 16px;
  box-shadow: 0 22px 50px -28px rgba(234, 88, 12, 0.25);
}
.sld-mp-quotes-eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 10.5px; letter-spacing: 0.20em; font-weight: 700;
  color: var(--mp-teal);
  text-transform: uppercase;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  margin-bottom: 4px;
}
.sld-mp-quotes-pulse {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--mp-teal-2);
  animation: sldPulse 1.4s ease-in-out infinite;
}
.sld-mp-quote {
  position: relative;
  display: grid;
  grid-template-columns: 36px 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid var(--mp-line);
  border-radius: 10px;
  opacity: 0;
  animation: sldQuoteIn .5s ease forwards;
  font-variant-numeric: tabular-nums;
}
@keyframes sldQuoteIn {
  from { opacity: 0; transform: translateX(8px); }
  to { opacity: 1; transform: translateX(0); }
}
.sld-mp-quote.is-winner {
  background:
    radial-gradient(ellipse 80% 120% at 100% 50%, rgba(251, 146, 60, 0.28), transparent 70%),
    linear-gradient(135deg, var(--mp-deep) 0%, #7C2D12 100%);
  border-color: rgba(251, 146, 60, 0.45);
  color: #fff;
  box-shadow:
    0 18px 36px -20px rgba(234, 88, 12, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.10);
}
.sld-mp-quote-rank {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 11px; font-weight: 700;
  color: var(--mp-teal);
}
.sld-mp-quote.is-winner .sld-mp-quote-rank { color: var(--mp-teal-2); }
.sld-mp-quote-body {
  display: flex; flex-direction: column; gap: 1px;
}
.sld-mp-quote-lender {
  font-size: 13px; font-weight: 600;
  color: var(--mp-ink);
  letter-spacing: -0.01em;
}
.sld-mp-quote.is-winner .sld-mp-quote-lender { color: #fff; }
.sld-mp-quote-meta {
  font-size: 11px;
  color: var(--mp-mute);
}
.sld-mp-quote.is-winner .sld-mp-quote-meta { color: rgba(255, 255, 255, 0.70); }
.sld-mp-quote-mo {
  font-size: 14px; font-weight: 700;
  color: var(--mp-ink);
  letter-spacing: -0.015em;
}
.sld-mp-quote.is-winner .sld-mp-quote-mo { color: #fff; }
.sld-mp-quote-star {
  position: absolute;
  top: 50%; right: -8px;
  transform: translateY(-50%);
  width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, var(--mp-teal-2) 0%, var(--mp-teal) 100%);
  color: #431407;
  border-radius: 999px;
  font-size: 12px;
  box-shadow: 0 6px 14px -4px rgba(234, 88, 12, 0.55);
}
.sld-mp-quotes-foot {
  margin-top: 6px;
  padding-top: 10px;
  border-top: 1px dashed var(--mp-line);
  display: flex; justify-content: space-between; align-items: baseline;
  font-size: 12px;
}
.sld-mp-quotes-foot-k {
  color: var(--mp-mute);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 10.5px; font-weight: 700;
}
.sld-mp-quotes-foot-v {
  color: var(--mp-deep);
  font-weight: 700;
}

/* ===== Bar race (slide 10) ===== */
.sld-bar-race {
  display: flex; flex-direction: column; gap: 24px;
  margin-top: 8px;
}
.sld-bar-row {
  display: grid; grid-template-columns: 320px 1fr;
  gap: 24px; align-items: center;
}
.sld-bar-label {
  font-size: 14px; font-weight: 600;
  color: var(--mp-ink-2);
}
.sld-bar-track {
  height: 36px;
  background: rgba(15, 23, 42, 0.06);
  border-radius: 999px;
  overflow: hidden;
  position: relative;
}
.sld-bar-fill {
  height: 100%;
  display: flex; align-items: center; justify-content: flex-end;
  padding-right: 18px;
  border-radius: 999px;
  color: #fff;
  font-size: 14px; font-weight: 800;
  letter-spacing: -0.01em;
  animation: sldBarGrow 1.6s cubic-bezier(0.22, 0.61, 0.36, 1);
}
@keyframes sldBarGrow {
  from { transform: scaleX(0); transform-origin: left; }
  to { transform: scaleX(1); }
}
.sld-bar-fill.without {
  background: linear-gradient(90deg, #475569 0%, #64748B 100%);
}
.sld-bar-fill.with {
  background: linear-gradient(90deg, var(--mp-deep) 0%, var(--mp-teal-2) 100%);
}
.sld-bar-delta {
  padding: 18px 22px;
  border-radius: 14px;
  background:
    linear-gradient(90deg, rgba(251, 146, 60, 0.18) 0%, rgba(251, 146, 60, 0.06) 100%);
  border: 1px solid rgba(251, 146, 60, 0.35);
  display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap;
}
.sld-bar-delta-tag {
  font-size: 10px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--mp-teal);
  text-transform: uppercase;
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(251, 146, 60, 0.22);
}
.sld-bar-delta-val {
  font-size: 22px; font-weight: 800;
  color: var(--mp-ink);
  letter-spacing: -0.02em;
}
.sld-bar-delta-sub {
  font-size: 12px; color: var(--mp-mute);
  margin-left: auto;
}

/* ===== Interactive economics (slide 12) ===== */
.sld-econ-live {
  display: flex; flex-direction: column; gap: 18px;
  margin-top: 8px;
}
.sld-econ-inputs {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.sld-econ-input {
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid var(--mp-line);
  border-radius: 12px;
}
.sld-econ-input label {
  display: flex; justify-content: space-between; align-items: baseline;
  font-size: 11.5px; font-weight: 600;
  color: var(--mp-mute);
  letter-spacing: 0.03em;
  margin-bottom: 10px;
}
.sld-econ-input-v {
  font-size: 16px; font-weight: 700;
  color: var(--mp-teal);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.012em;
}
.sld-econ-input input[type="range"] {
  -webkit-appearance: none; appearance: none;
  width: 100%; height: 6px;
  background: linear-gradient(90deg, var(--mp-teal) 0%, var(--mp-teal-2) 100%);
  border-radius: 999px;
  outline: none; cursor: pointer;
}
.sld-econ-input input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 22px; height: 22px;
  background: #fff;
  border: 3px solid var(--mp-teal);
  border-radius: 999px;
  box-shadow: 0 6px 16px -4px rgba(234, 88, 12, 0.45);
  cursor: grab;
}
.sld-econ-input input[type="range"]::-webkit-slider-thumb:active {
  cursor: grabbing;
  transform: scale(1.1);
}
.sld-econ-outputs {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.sld-econ-card {
  padding: 26px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--mp-line);
}
.sld-econ-card.with {
  background:
    radial-gradient(ellipse 80% 100% at 100% 0%, rgba(251, 146, 60, 0.18), transparent 70%),
    rgba(255, 255, 255, 0.95);
  border-color: var(--mp-line-strong);
}
.sld-econ-eyebrow {
  font-size: 11px; letter-spacing: 0.16em; font-weight: 700;
  color: var(--mp-mute);
  text-transform: uppercase;
}
.sld-econ-eyebrow.accent { color: var(--mp-teal); }
.sld-econ-num {
  margin-top: 12px;
  font-size: 48px; font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--mp-ink);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.sld-econ-num.accent {
  background: linear-gradient(135deg, var(--mp-deep) 0%, var(--mp-teal-2) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.sld-econ-sub {
  margin-top: 8px;
  font-size: 13px; color: var(--mp-ink-2);
}
.sld-econ-sub-sm {
  margin-top: 2px;
  font-size: 12px; color: var(--mp-mute);
}
.sld-econ-math {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed var(--mp-line);
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 11.5px; line-height: 1.55;
  color: var(--mp-mute);
  font-variant-numeric: tabular-nums;
}
.sld-econ-math strong {
  color: var(--mp-ink);
  font-weight: 700;
}
.sld-econ-math.accent strong {
  color: var(--mp-teal);
}
.sld-econ-delta {
  padding: 18px 22px;
  border-radius: 14px;
  background:
    linear-gradient(90deg, rgba(251, 146, 60, 0.18) 0%, rgba(251, 146, 60, 0.06) 100%);
  border: 1px solid rgba(251, 146, 60, 0.35);
  display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap;
}
.sld-econ-delta-tag {
  font-size: 10px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--mp-teal);
  text-transform: uppercase;
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(251, 146, 60, 0.22);
}
.sld-econ-delta-val {
  font-size: 22px; font-weight: 800;
  color: var(--mp-ink);
  letter-spacing: -0.02em;
}
.sld-econ-delta-sub {
  font-size: 12px; color: var(--mp-mute);
  margin-left: auto;
}

/* ===== Case studies ===== */
.sld-cases-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 18px;
  margin-top: 8px;
}
.sld-case {
  padding: 28px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--mp-line);
  border-radius: 20px;
  display: flex; flex-direction: column; gap: 16px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.sld-case:hover {
  transform: translateY(-3px);
  box-shadow: 0 24px 50px -28px rgba(234, 88, 12, 0.30);
}
.sld-case-tag {
  font-size: 10.5px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--mp-teal);
  text-transform: uppercase;
}
.sld-case-quote {
  font-size: 18px; line-height: 1.5;
  color: var(--mp-ink);
  margin: 0;
  font-style: italic;
}
.sld-case-outcomes {
  display: grid; grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  padding-top: 16px;
  border-top: 1px dashed var(--mp-line);
}
.sld-case-v {
  font-size: 26px; font-weight: 800; letter-spacing: -0.025em;
  color: var(--mp-teal);
  font-variant-numeric: tabular-nums;
}
.sld-case-l {
  font-size: 11px; letter-spacing: 0.16em;
  color: var(--mp-mute);
  text-transform: uppercase;
  margin-top: 4px;
}
.sld-case-attrib {
  display: flex; align-items: center; gap: 12px;
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid var(--mp-line);
}
.sld-case-avatar {
  width: 40px; height: 40px;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--mp-deep), var(--mp-teal));
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 700; letter-spacing: 0.05em;
}
.sld-case-name { font-size: 13px; font-weight: 600; color: var(--mp-ink); }
.sld-case-role { font-size: 11px; color: var(--mp-mute); }

/* ===== Vs table (slide 14) ===== */
.sld-vs-table {
  width: 100%;
  margin-top: 12px;
  border-collapse: separate;
  border-spacing: 0;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--mp-line-strong);
  border-radius: 20px;
  overflow: hidden;
}
.sld-vs-table th, .sld-vs-table td {
  text-align: left;
  padding: 16px 22px;
  font-size: 14px;
  border-bottom: 1px solid var(--mp-line);
  vertical-align: top;
}
.sld-vs-table th {
  font-size: 11px; letter-spacing: 0.16em; font-weight: 700;
  text-transform: uppercase;
  color: var(--mp-mute);
  background: rgba(236, 255, 254, 0.5);
}
.sld-vs-table th.accent, .sld-vs-table td.accent {
  color: var(--mp-teal);
  font-weight: 600;
}
.sld-vs-table tr:last-child td { border-bottom: none; }
.sld-vs-table tbody td:first-child {
  color: var(--mp-mute);
  font-weight: 600;
  font-size: 13px;
}
.sld-vs-mark {
  display: inline-flex; align-items: center; justify-content: center;
  width: 18px; height: 18px; border-radius: 999px;
  margin-right: 10px;
  font-size: 11px; font-weight: 700;
}
.sld-vs-mark.x {
  background: rgba(200, 75, 75, 0.10);
  color: rgb(170, 60, 60);
}
.sld-vs-mark.check {
  background: rgba(251, 146, 60, 0.18);
  color: var(--mp-teal);
}

/* ===== Trust grid ===== */
.sld-trust-grid {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-top: 8px;
}
.sld-trust-item {
  padding: 22px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--mp-line);
  border-radius: 16px;
}
.sld-trust-head {
  font-size: 16px; font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--mp-teal);
  text-transform: uppercase;
}
.sld-trust-body {
  margin-top: 8px;
  font-size: 13px; color: var(--mp-ink-2); line-height: 1.55;
}

/* ===== Pricing card ===== */
.sld-price-card {
  margin-top: 12px;
  max-width: 720px;
  margin-left: auto; margin-right: auto;
  padding: 8px 24px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--mp-line-strong);
  border-radius: 20px;
  box-shadow: 0 22px 50px -28px rgba(234, 88, 12, 0.22);
}
.sld-price-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 18px 0;
  border-bottom: 1px dashed var(--mp-line);
}
.sld-price-row:last-child { border-bottom: none; }
.sld-price-k {
  font-size: 13px; color: var(--mp-mute);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-weight: 600;
}
.sld-price-v { font-size: 18px; font-weight: 700; color: var(--mp-ink); }

/* ===== Onboarding steps ===== */
.sld-steps {
  list-style: none; padding: 0; margin: 12px 0 0 0;
  display: flex; flex-direction: column;
}
.sld-steps li {
  display: grid; grid-template-columns: 80px 1fr;
  gap: 24px; align-items: center;
  padding: 20px 24px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid var(--mp-line);
  border-bottom: none;
}
.sld-steps li:first-child {
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
}
.sld-steps li:last-child {
  border-bottom: 1px solid var(--mp-line);
  border-bottom-left-radius: 16px;
  border-bottom-right-radius: 16px;
}
.sld-step-n {
  font-size: 28px; font-weight: 800;
  letter-spacing: -0.025em;
  background: linear-gradient(135deg, var(--mp-deep), var(--mp-teal));
  -webkit-background-clip: text; background-clip: text; color: transparent;
  font-variant-numeric: tabular-nums;
}
.sld-step-h { font-size: 17px; font-weight: 700; color: var(--mp-ink); }
.sld-step-b {
  margin-top: 4px;
  font-size: 13.5px; color: var(--mp-ink-2); line-height: 1.55;
}

/* ===== CTA grid (slide 18) ===== */
.sld-cta-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 8px;
}
.sld-cta {
  display: flex; flex-direction: column;
  padding: 28px;
  border-radius: 20px;
  border: 1px solid var(--mp-line-strong);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.sld-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 24px 50px -28px rgba(234, 88, 12, 0.30);
}
.sld-cta-primary {
  background: linear-gradient(180deg, var(--mp-deep) 0%, #7C2D12 100%);
  color: #fff;
  border-color: transparent;
}
.sld-cta-secondary {
  background: rgba(255, 255, 255, 0.95);
  color: var(--mp-ink);
}
.sld-cta-eyebrow {
  font-size: 10.5px; letter-spacing: 0.20em; font-weight: 700;
  text-transform: uppercase;
  color: var(--mp-teal-2);
}
.sld-cta-secondary .sld-cta-eyebrow { color: var(--mp-teal); }
.sld-cta-h {
  margin-top: 8px;
  font-size: 28px; font-weight: 800;
  letter-spacing: -0.025em;
}
.sld-cta-b {
  margin-top: 12px;
  font-size: 13.5px; line-height: 1.55;
  opacity: 0.85;
}
.sld-disclaimer {
  margin-top: 24px;
  max-width: 800px;
  margin-left: auto; margin-right: auto;
  font-size: 10.5px; line-height: 1.55;
  color: var(--mp-mute);
  text-align: center;
}

/* ===== Chrome (top counter + brand) ===== */
.sld-chrome {
  position: fixed;
  top: 20px; right: 24px;
  z-index: 20;
  display: flex; align-items: center; gap: 14px;
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid var(--mp-line);
  border-radius: 999px;
  backdrop-filter: blur(8px);
}
.sld-brand {
  font-size: 11px; letter-spacing: 0.16em; font-weight: 700;
  color: var(--mp-teal);
  text-transform: uppercase;
}
.sld-counter {
  font-size: 13px; font-weight: 700;
  color: var(--mp-ink);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
}
.sld-counter-sep, .sld-counter-tot { color: var(--mp-mute); }

/* ===== Bottom nav (prev/next + dots) ===== */
.sld-nav {
  position: fixed;
  bottom: 20px; left: 50%; transform: translateX(-50%);
  z-index: 20;
  display: flex; align-items: center; gap: 14px;
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid var(--mp-line);
  border-radius: 999px;
  backdrop-filter: blur(8px);
  box-shadow: 0 12px 30px -12px rgba(234, 88, 12, 0.20);
}
.sld-nav-btn {
  width: 36px; height: 36px;
  border-radius: 999px;
  border: 1px solid var(--mp-line);
  background: rgba(255, 255, 255, 0.9);
  font-size: 18px;
  color: var(--mp-ink);
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s ease;
}
.sld-nav-btn:hover:not(:disabled) {
  background: var(--mp-teal);
  color: #fff;
  border-color: var(--mp-teal);
}
.sld-nav-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.sld-dots {
  display: flex; align-items: center; gap: 6px;
}
.sld-dot {
  width: 8px; height: 8px;
  border-radius: 999px;
  background: var(--mp-line-strong);
  border: none;
  padding: 0;
  transition: all 0.15s ease;
}
.sld-dot.is-active {
  background: var(--mp-teal);
  width: 24px;
}
.sld-dot:hover { background: var(--mp-teal-2); }

/* ===== New v3 components ===== */

/* Section title — used to break up dense slides */
.sld-section-title {
  font-size: 12px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--mp-teal);
  text-transform: uppercase;
  margin-top: 8px;
}

/* Sub-row of 3-4 mini stats for stage slides */
.sld-mini-stats {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-top: 8px;
}
.sld-mini-stat {
  padding: 14px 18px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid var(--mp-line);
  border-radius: 12px;
}
.sld-mini-stat-v {
  font-size: 22px; font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--mp-ink);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.sld-mini-stat-k {
  margin-top: 6px;
  font-size: 10px; letter-spacing: 0.14em; font-weight: 700;
  color: var(--mp-mute);
  text-transform: uppercase;
}

/* Takeaway line for rep talk-track */
.sld-takeaway {
  margin: 0;
  padding: 14px 18px;
  background: rgba(251, 146, 60, 0.06);
  border: 1px solid rgba(251, 146, 60, 0.18);
  border-radius: 10px;
  font-size: 13px; line-height: 1.6;
  color: var(--mp-ink-2);
}
.sld-takeaway strong { color: var(--mp-teal); }

/* iPad mockup */
.sld-ipad {
  position: relative; z-index: 2;
  display: flex; align-items: center; justify-content: center;
  perspective: 1400px;
}
.sld-ipad-bezel {
  width: 380px;
  background: linear-gradient(180deg, #1a1f24 0%, #0d1115 100%);
  border-radius: 28px;
  padding: 14px;
  box-shadow:
    0 60px 110px -50px rgba(234, 88, 12, 0.40),
    0 30px 60px -30px rgba(234, 88, 12, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  transform: rotateX(6deg) rotateY(-8deg);
  transform-style: preserve-3d;
}
.sld-ipad-screen {
  background: #fff;
  border-radius: 16px;
  padding: 22px;
  display: flex; flex-direction: column; gap: 14px;
}
.sld-ipad-header {
  display: flex; justify-content: space-between; align-items: center;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--mp-line);
}
.sld-ipad-brand {
  font-size: 10.5px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--mp-teal);
  text-transform: uppercase;
}
.sld-ipad-meta {
  font-size: 9px; letter-spacing: 0.14em; font-weight: 600;
  color: var(--mp-mute);
  text-transform: uppercase;
  padding: 3px 8px;
  background: rgba(15,23,42,0.04);
  border-radius: 6px;
}
.sld-ipad-title {
  font-size: 22px; font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--mp-ink);
}
.sld-ipad-sub {
  font-size: 12px; color: var(--mp-mute);
  margin-top: -8px;
}
.sld-ipad-form {
  display: flex; flex-direction: column; gap: 8px;
}
.sld-ipad-field {
  padding: 10px 14px;
  background: rgba(15,23,42,0.04);
  border: 1px solid var(--mp-line);
  border-radius: 10px;
  opacity: 0;
  animation: sldIpadFieldIn .6s ease forwards;
}
@keyframes sldIpadFieldIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.sld-ipad-field-k {
  font-size: 9px; letter-spacing: 0.16em; font-weight: 700;
  color: var(--mp-mute);
  text-transform: uppercase;
}
.sld-ipad-field-v {
  margin-top: 4px;
  font-size: 13px; font-weight: 600;
  color: var(--mp-ink);
  font-variant-numeric: tabular-nums;
}
.sld-ipad-btn {
  padding: 12px 18px;
  text-align: center;
  background: linear-gradient(135deg, var(--mp-deep) 0%, var(--mp-teal) 100%);
  color: #fff;
  border-radius: 10px;
  font-size: 13px; font-weight: 700;
  letter-spacing: 0.02em;
}
.sld-ipad-foot {
  font-size: 9.5px; letter-spacing: 0.14em;
  color: var(--mp-mute);
  text-transform: uppercase;
  text-align: center;
  font-weight: 600;
}

/* Offer stack — slide 8 */
.sld-offer-stack {
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid var(--mp-line-strong);
  border-radius: 18px;
  padding: 8px 22px;
  margin-top: 8px;
  box-shadow: 0 22px 50px -28px rgba(234, 88, 12, 0.30);
}
.sld-offer-row {
  display: grid; grid-template-columns: 2fr 1fr 0.6fr;
  gap: 16px; align-items: center;
  padding: 16px 0;
  border-bottom: 1px dashed var(--mp-line);
  font-variant-numeric: tabular-nums;
}
.sld-offer-row:last-of-type { border-bottom: none; }
.sld-offer-row.is-winner {
  background: linear-gradient(90deg, rgba(251, 146, 60, 0.08), transparent);
  margin: 0 -22px; padding: 16px 22px;
}
.sld-offer-lender {
  display: flex; align-items: center; gap: 10px;
  font-size: 15px; font-weight: 600;
  color: var(--mp-ink);
}
.sld-offer-star { color: var(--mp-teal-2); font-size: 18px; }
.sld-offer-bullet {
  width: 8px; height: 8px; border-radius: 999px;
  background: rgba(15, 23, 42, 0.18);
  display: inline-block;
}
.sld-offer-tag {
  font-size: 9.5px; letter-spacing: 0.14em; font-weight: 700;
  color: var(--mp-mute);
  text-transform: uppercase;
  padding: 3px 8px;
  background: rgba(15,23,42,0.04);
  border-radius: 6px;
  margin-left: 4px;
}
.sld-offer-row.is-winner .sld-offer-tag {
  background: rgba(251, 146, 60, 0.18);
  color: var(--mp-teal);
}
.sld-offer-monthly {
  font-size: 20px; font-weight: 800;
  text-align: right;
  letter-spacing: -0.02em;
  color: var(--mp-ink);
}
.sld-offer-monthly span { font-size: 12px; font-weight: 500; color: var(--mp-mute); }
.sld-offer-term {
  font-size: 13px; font-weight: 600;
  text-align: right;
  color: var(--mp-ink-2);
}
.sld-offer-foot {
  padding: 14px 0 6px;
  font-size: 10.5px; letter-spacing: 0.14em;
  color: var(--mp-mute);
  text-transform: uppercase;
  text-align: center;
  font-weight: 600;
}

/* Bank wire — slide 9 */
.sld-wire {
  display: grid; grid-template-columns: 220px 1fr 220px;
  gap: 24px; align-items: center;
  margin-top: 8px;
  padding: 36px 28px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--mp-line-strong);
  border-radius: 22px;
}
.sld-wire-node {
  text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
}
.sld-wire-icon {
  width: 56px; height: 56px;
  border-radius: 16px;
  background: linear-gradient(135deg, var(--mp-deep) 0%, var(--mp-teal) 100%);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; font-weight: 800;
  box-shadow: 0 14px 30px -14px rgba(234, 88, 12, 0.45);
}
.sld-wire-node-end .sld-wire-icon {
  background: linear-gradient(135deg, var(--mp-teal) 0%, var(--mp-teal-2) 100%);
}
.sld-wire-label {
  font-size: 13px; font-weight: 700;
  color: var(--mp-ink);
}
.sld-wire-sub {
  font-size: 11px; color: var(--mp-mute);
}
.sld-wire-flow {
  text-align: center;
  display: flex; flex-direction: column; gap: 8px; align-items: center;
}
.sld-wire-amount {
  font-size: 28px; font-weight: 800;
  letter-spacing: -0.025em;
  background: linear-gradient(135deg, var(--mp-deep) 0%, var(--mp-teal-2) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.sld-wire-line {
  position: relative;
  width: 100%; height: 4px;
  background: linear-gradient(90deg, var(--mp-deep), var(--mp-teal), var(--mp-teal-2));
  border-radius: 999px;
  overflow: hidden;
}
.sld-wire-pulse {
  position: absolute; top: -3px; left: 0;
  width: 30px; height: 10px;
  background: radial-gradient(ellipse, rgba(255,255,255,0.9), transparent 70%);
  border-radius: 999px;
  animation: sldWirePulse 2.4s ease-in-out infinite;
}
@keyframes sldWirePulse {
  from { left: -30px; }
  to { left: 100%; }
}
.sld-wire-time {
  font-size: 11px; letter-spacing: 0.16em; font-weight: 700;
  color: var(--mp-teal);
  text-transform: uppercase;
}

/* Storyboard — slide 11 · 4-panel homeowner journey with glyphs + track */
.sld-storyboard {
  position: relative;
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-top: 8px;
  padding-top: 8px;
  perspective: 1600px;
}
.sld-storyboard-track {
  position: absolute;
  top: 60px;
  left: 14%; right: 14%;
  height: 2px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(234, 88, 12, 0.20) 8%,
    rgba(234, 88, 12, 0.40) 50%,
    rgba(234, 88, 12, 0.20) 92%,
    transparent 100%
  );
  pointer-events: none;
  z-index: 0;
}
.sld-storyboard-track::before,
.sld-storyboard-track::after {
  content: '';
  position: absolute;
  top: 50%; transform: translateY(-50%);
  width: 8px; height: 8px;
  border-radius: 999px;
  background: var(--mp-teal-2);
  box-shadow: 0 0 0 4px rgba(251, 146, 60, 0.20);
}
.sld-storyboard-track::before { left: -4px; }
.sld-storyboard-track::after { right: -4px; }
.sld-story-panel {
  position: relative;
  padding: 22px 20px 20px;
  background:
    radial-gradient(ellipse 80% 50% at 0% 0%, rgba(251, 146, 60, 0.08), transparent 65%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 253, 252, 0.98) 100%);
  border: 1px solid var(--mp-line);
  border-radius: 18px;
  display: flex; flex-direction: column;
  gap: 8px;
  z-index: 1;
  overflow: hidden;
  box-shadow: 0 18px 40px -28px rgba(234, 88, 12, 0.22);
  opacity: 0;
  transform: translateY(8px);
  animation: sldStoryIn .5s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
  transition: transform .35s cubic-bezier(0.22, 0.61, 0.36, 1),
              box-shadow .35s cubic-bezier(0.22, 0.61, 0.36, 1),
              border-color .35s ease;
  transform-style: preserve-3d;
}
@keyframes sldStoryIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
.sld-story-panel:hover {
  transform: translateY(-6px) rotateX(2deg);
  box-shadow:
    0 32px 70px -32px rgba(234, 88, 12, 0.38),
    inset 0 1px 0 rgba(255, 255, 255, 0.95);
  border-color: rgba(234, 88, 12, 0.30);
}
.sld-story-n {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px; letter-spacing: 0.20em; font-weight: 700;
  color: var(--mp-teal);
  padding: 3px 7px;
  background: rgba(251, 146, 60, 0.10);
  border: 1px solid rgba(234, 88, 12, 0.20);
  border-radius: 6px;
  width: fit-content;
}
.sld-story-glyph {
  margin-top: 4px;
  width: 44px; height: 44px;
  padding: 8px;
  border-radius: 12px;
  background:
    radial-gradient(circle at 30% 30%, rgba(251, 146, 60, 0.30), transparent 70%),
    linear-gradient(135deg, var(--mp-deep) 0%, #7C2D12 100%);
  color: var(--mp-teal-2);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 10px 24px -10px rgba(234, 88, 12, 0.55);
}
.sld-story-glyph svg { width: 100%; height: 100%; }
.sld-story-t {
  font-size: 18px; font-weight: 600;
  letter-spacing: -0.018em;
  color: var(--mp-ink);
}
.sld-story-b {
  font-size: 12.5px; color: var(--mp-ink-2);
  line-height: 1.5;
}
.sld-story-meta {
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px dashed var(--mp-line);
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 11px; font-weight: 600;
  color: var(--mp-teal);
  letter-spacing: 0.04em;
}

/* Money breakdown — slide 2 · clean teal-only ledger table */
.sld-money {
  display: flex; flex-direction: column;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid var(--mp-line);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 18px 40px -28px rgba(234, 88, 12, 0.20);
}
.sld-money-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 24px;
  padding: 18px 24px;
  border-bottom: 1px dashed var(--mp-line);
}
.sld-money-row:last-child { border-bottom: none; }
.sld-money-row-l {
  display: flex; flex-direction: column; gap: 4px;
}
.sld-money-row-k {
  font-size: 14.5px; font-weight: 600;
  color: var(--mp-ink);
  letter-spacing: -0.012em;
}
.sld-money-row-sub {
  font-size: 12px;
  color: var(--mp-mute);
  line-height: 1.4;
}
.sld-money-row-r {
  display: flex; align-items: baseline; gap: 16px;
}
.sld-money-row-pct {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 12px; font-weight: 600;
  color: var(--mp-mute);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}
.sld-money-row-v {
  font-size: 18px; font-weight: 600;
  color: var(--mp-ink);
  letter-spacing: -0.018em;
  font-variant-numeric: tabular-nums;
}
.sld-money-row-total {
  background:
    radial-gradient(ellipse 60% 100% at 100% 50%, rgba(251, 146, 60, 0.12), transparent 70%),
    rgba(248, 253, 252, 0.98);
  border-top: 1px solid var(--mp-line-strong);
}
.sld-money-row-total .sld-money-row-k {
  font-size: 11px; letter-spacing: 0.22em; font-weight: 700;
  color: var(--mp-teal);
  text-transform: uppercase;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
}
.sld-money-row-v-total {
  font-size: 26px; font-weight: 700;
  letter-spacing: -0.03em;
  background: linear-gradient(135deg, var(--mp-deep) 0%, var(--mp-teal) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}

/* Pricing v14 — three-line-item stack */
.sld-pricing-stack {
  display: flex; flex-direction: column;
  gap: 12px;
  margin-top: 8px;
}
.sld-pricing-tier {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 32px;
  align-items: center;
  padding: 22px 26px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid var(--mp-line);
  border-radius: 16px;
  box-shadow: 0 16px 40px -28px rgba(234, 88, 12, 0.22);
  transition: transform .25s ease, box-shadow .25s ease;
}
.sld-pricing-tier:hover {
  transform: translateY(-2px);
  box-shadow: 0 24px 50px -28px rgba(234, 88, 12, 0.32);
  border-color: rgba(234, 88, 12, 0.22);
}
.sld-pricing-tier-hero {
  background:
    radial-gradient(ellipse 70% 100% at 0% 0%, rgba(251, 146, 60, 0.16), transparent 65%),
    linear-gradient(135deg, var(--mp-deep) 0%, #7C2D12 100%);
  color: #fff;
  border-color: rgba(251, 146, 60, 0.30);
  box-shadow:
    0 28px 60px -28px rgba(234, 88, 12, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.10);
}
.sld-pricing-tier-hero .sld-pricing-tier-tag { color: var(--mp-teal-2); }
.sld-pricing-tier-hero .sld-pricing-tier-h { color: #fff; }
.sld-pricing-tier-hero .sld-pricing-tier-b { color: rgba(255, 255, 255, 0.72); }
.sld-pricing-tier-hero .sld-pricing-tier-when { color: rgba(255, 255, 255, 0.60); }
.sld-pricing-tier-hero .sld-pricing-tier-v {
  background: linear-gradient(135deg, #fff 0%, var(--mp-teal-2) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.sld-pricing-tier-l {
  display: flex; flex-direction: column; gap: 4px;
}
.sld-pricing-tier-tag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px; font-weight: 700;
  letter-spacing: 0.22em;
  color: var(--mp-teal);
  text-transform: uppercase;
}
.sld-pricing-tier-h {
  font-size: 18px; font-weight: 600;
  letter-spacing: -0.018em;
  color: var(--mp-ink);
}
.sld-pricing-tier-b {
  font-size: 13px;
  color: var(--mp-mute);
  line-height: 1.5;
}
.sld-pricing-tier-r {
  display: flex; flex-direction: column; align-items: flex-end; gap: 4px;
}
.sld-pricing-tier-v {
  font-size: 42px; font-weight: 700;
  letter-spacing: -0.038em;
  line-height: 1;
  color: var(--mp-ink);
  font-variant-numeric: tabular-nums;
}
.sld-pricing-tier:not(.sld-pricing-tier-hero) .sld-pricing-tier-v {
  background: linear-gradient(135deg, var(--mp-deep) 0%, var(--mp-teal) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.sld-pricing-tier-when {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px;
  color: var(--mp-mute);
  letter-spacing: 0.04em;
}
.sld-pricing-foot {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-top: 16px;
}
.sld-pricing-foot-row {
  display: flex; flex-direction: column; gap: 4px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid var(--mp-line);
  border-radius: 10px;
}
.sld-pricing-foot-k {
  font-size: 10.5px; letter-spacing: 0.12em; font-weight: 700;
  color: var(--mp-mute);
  text-transform: uppercase;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
}
.sld-pricing-foot-v {
  font-size: 16px; font-weight: 600;
  color: var(--mp-ink);
  letter-spacing: -0.012em;
}

/* Pricing 2-col grid + sample invoice */
.sld-price-grid {
  display: grid; grid-template-columns: 1fr 1.05fr;
  gap: 18px;
  align-items: stretch;
  margin-top: 12px;
}
.sld-price-grid.sld-price-grid-single {
  grid-template-columns: 1fr;
  max-width: 760px;
  margin-left: auto;
  margin-right: auto;
}
.sld-price-card { margin: 0 !important; padding: 8px 22px !important; }
.sld-invoice {
  padding: 24px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid var(--mp-line-strong);
  border-radius: 18px;
  box-shadow: 0 22px 50px -28px rgba(234, 88, 12, 0.25);
  font-size: 13px;
}
.sld-invoice-head {
  display: flex; justify-content: space-between; align-items: flex-start;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--mp-line);
}
.sld-invoice-from { font-weight: 700; color: var(--mp-ink); }
.sld-invoice-meta { font-size: 11px; color: var(--mp-mute); margin-top: 2px; }
.sld-invoice-no { text-align: right; }
.sld-invoice-no-k {
  font-size: 9px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--mp-mute);
  text-transform: uppercase;
}
.sld-invoice-no-v {
  font-size: 14px; font-weight: 700;
  color: var(--mp-ink);
  font-variant-numeric: tabular-nums;
}
.sld-invoice-period {
  font-size: 11px; letter-spacing: 0.16em;
  color: var(--mp-teal);
  text-transform: uppercase;
  font-weight: 700;
  margin-top: 14px;
  margin-bottom: 12px;
}
.sld-invoice-table {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}
.sld-invoice-table th,
.sld-invoice-table td {
  text-align: left;
  padding: 9px 8px;
  font-size: 12px;
  border-bottom: 1px dashed var(--mp-line);
}
.sld-invoice-table th {
  font-size: 9.5px; letter-spacing: 0.14em; font-weight: 700;
  color: var(--mp-mute);
  text-transform: uppercase;
}
.sld-invoice-table td:nth-child(2),
.sld-invoice-table td:nth-child(3),
.sld-invoice-table td:nth-child(4),
.sld-invoice-table th:nth-child(2),
.sld-invoice-table th:nth-child(3),
.sld-invoice-table th:nth-child(4) {
  text-align: right;
}
.sld-invoice-table tfoot td {
  border-bottom: none;
  border-top: 1px solid var(--mp-line-strong);
  padding-top: 12px;
  color: var(--mp-teal);
}
.sld-invoice-foot {
  margin-top: 12px;
  font-size: 10.5px; color: var(--mp-mute);
  text-align: center;
  letter-spacing: 0.04em;
}

/* Onboarding timeline — slide 17 */
.sld-timeline {
  position: relative;
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-top: 8px;
  padding: 30px 12px 0;
}
.sld-timeline-line {
  position: absolute;
  top: 38px; left: 6%; right: 6%;
  height: 2px;
  background: linear-gradient(90deg, var(--mp-deep), var(--mp-teal-2));
  border-radius: 999px;
  z-index: 0;
}
.sld-timeline-node {
  position: relative;
  display: flex; flex-direction: column; align-items: center;
  text-align: center;
  z-index: 1;
}
.sld-timeline-dot {
  width: 16px; height: 16px;
  border-radius: 999px;
  background: var(--mp-teal-2);
  border: 3px solid #fff;
  box-shadow: 0 0 0 4px rgba(251, 146, 60, 0.2);
  margin-bottom: 14px;
}
.sld-timeline-day {
  font-size: 11px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--mp-teal);
  text-transform: uppercase;
  margin-bottom: 4px;
}
.sld-timeline-t {
  font-size: 16px; font-weight: 700;
  color: var(--mp-ink);
  margin-bottom: 6px;
}
.sld-timeline-b {
  font-size: 12.5px; color: var(--mp-ink-2);
  line-height: 1.5;
  max-width: 220px;
}

/* Onboarding checklist */
.sld-checklist {
  display: grid; grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-top: 8px;
}
.sld-check {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid var(--mp-line);
  border-radius: 10px;
  font-size: 13px; color: var(--mp-ink-2);
}
.sld-check-icon {
  width: 20px; height: 20px;
  border-radius: 999px;
  background: rgba(251, 146, 60, 0.18);
  color: var(--mp-teal);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700;
}

/* Roadmap strip — slide 18 */
.sld-roadmap {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-top: 8px;
  align-items: stretch;
}
.sld-roadmap-step {
  position: relative;
  padding: 22px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--mp-line);
  border-radius: 16px;
  display: flex; flex-direction: column; gap: 8px;
}
.sld-roadmap-icon {
  width: 36px; height: 36px;
  border-radius: 12px;
  background: rgba(251, 146, 60, 0.14);
  color: var(--mp-teal);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 16px; font-weight: 700;
}
.sld-roadmap-w {
  font-size: 10.5px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--mp-teal);
  text-transform: uppercase;
}
.sld-roadmap-t {
  font-size: 14px; font-weight: 600;
  color: var(--mp-ink);
  line-height: 1.4;
}
.sld-roadmap-arrow {
  position: absolute;
  top: 50%; right: -10px;
  transform: translateY(-50%);
  font-size: 18px;
  color: var(--mp-line-strong);
  background: transparent;
}

/* ===== Welcome + agenda ===== */
.sld-agenda {
  display: flex; flex-direction: column;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--mp-line-strong);
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 22px 50px -28px rgba(234, 88, 12, 0.28);
}
.sld-agenda-row {
  display: grid; grid-template-columns: 56px 1fr;
  align-items: center; gap: 16px;
  padding: 16px 22px;
  border-bottom: 1px dashed var(--mp-line);
  transition: background .15s ease;
}
.sld-agenda-row:last-child { border-bottom: none; }
.sld-agenda-row:hover { background: rgba(251, 146, 60, 0.04); }
.sld-agenda-n {
  font-size: 22px; font-weight: 800;
  letter-spacing: -0.025em;
  background: linear-gradient(135deg, var(--mp-deep), var(--mp-teal));
  -webkit-background-clip: text; background-clip: text; color: transparent;
  font-variant-numeric: tabular-nums;
}
.sld-agenda-t {
  font-size: 16px; font-weight: 700;
  color: var(--mp-ink);
  letter-spacing: -0.01em;
}
.sld-agenda-s {
  font-size: 12px; color: var(--mp-mute);
  margin-top: 2px;
}

/* ===== Who is it for ===== */
.sld-who-grid {
  display: grid; grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  margin-top: 8px;
}
.sld-who-card {
  padding: 20px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--mp-line);
  border-radius: 16px;
  text-align: left;
  transition: transform .2s ease, box-shadow .2s ease;
}
.sld-who-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 22px 50px -28px rgba(234, 88, 12, 0.30);
}
.sld-who-code {
  display: inline-block;
  padding: 4px 8px;
  margin-bottom: 14px;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10px; letter-spacing: 0.16em; font-weight: 700;
  color: var(--mp-teal);
  background: rgba(234, 88, 12, 0.08);
  border: 1px solid rgba(234, 88, 12, 0.18);
  border-radius: 6px;
  font-variant-numeric: tabular-nums;
}
.sld-who-name {
  font-size: 18px; font-weight: 700;
  letter-spacing: -0.022em;
  color: var(--mp-ink);
}
.sld-who-ticket {
  margin-top: 4px;
  font-size: 11px; letter-spacing: 0.12em; font-weight: 700;
  color: var(--mp-teal);
  text-transform: uppercase;
  font-variant-numeric: tabular-nums;
}
.sld-who-who {
  margin-top: 10px;
  font-size: 12px; line-height: 1.5;
  color: var(--mp-ink-2);
}
.sld-notfor {
  margin-top: 8px;
  padding: 16px 20px;
  background: rgba(15, 23, 42, 0.04);
  border: 1px dashed var(--mp-line-strong);
  border-radius: 12px;
  display: grid; grid-template-columns: 100px 1fr;
  gap: 16px;
  align-items: baseline;
}
.sld-notfor-k {
  font-size: 11px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--mp-mute);
  text-transform: uppercase;
}
.sld-notfor-v {
  font-size: 13px; color: var(--mp-ink-2); line-height: 1.5;
}

/* ===== Six agents grid · 3x2 ops-console feel ===== */
.sld-agents-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  perspective: 1600px;
}
.sld-agent-card {
  position: relative;
  padding: 16px 18px 14px;
  background:
    radial-gradient(ellipse 80% 50% at 0% 0%, rgba(251, 146, 60, 0.10), transparent 65%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.97) 0%, rgba(248, 253, 252, 0.97) 100%);
  border: 1px solid var(--mp-line);
  border-radius: 14px;
  display: flex; flex-direction: column; gap: 10px;
  transition: transform .35s cubic-bezier(0.22, 0.61, 0.36, 1),
              box-shadow .35s cubic-bezier(0.22, 0.61, 0.36, 1),
              border-color .35s ease;
  overflow: hidden;
  opacity: 0;
  animation: sldAgentIn .5s ease forwards;
  transform-style: preserve-3d;
  box-shadow: 0 16px 38px -28px rgba(234, 88, 12, 0.20);
}
@keyframes sldAgentIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.sld-agent-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 100% 0%, rgba(251, 146, 60, 0.20), transparent 60%);
  opacity: 0;
  transition: opacity .35s ease;
  pointer-events: none;
}
.sld-agent-card:hover {
  transform: translateY(-4px) rotateX(2deg);
  box-shadow:
    0 30px 60px -28px rgba(234, 88, 12, 0.38),
    inset 0 1px 0 rgba(255, 255, 255, 0.95);
  border-color: rgba(234, 88, 12, 0.30);
}
.sld-agent-card:hover .sld-agent-glow { opacity: 1; }
.sld-agent-card > * { position: relative; z-index: 1; }
.sld-agent-head {
  display: flex; align-items: center; gap: 12px;
}
.sld-agent-glyph {
  flex-shrink: 0;
  width: 40px; height: 40px;
  padding: 6px;
  border-radius: 10px;
  background:
    radial-gradient(ellipse 80% 80% at 50% 50%, rgba(251, 146, 60, 0.18), transparent 70%),
    rgba(251, 146, 60, 0.06);
  border: 1px solid rgba(234, 88, 12, 0.18);
  color: var(--mp-teal);
  display: flex; align-items: center; justify-content: center;
}
.sld-agent-glyph svg { width: 100%; height: 100%; }
.sld-agent-head-r {
  display: flex; flex-direction: column; gap: 2px;
}
.sld-agent-code {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 13px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--mp-teal);
  text-transform: uppercase;
}
.sld-agent-version {
  display: inline-flex; align-items: center; gap: 6px;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 9.5px; letter-spacing: 0.10em;
  color: var(--mp-mute);
  font-weight: 600;
}
.sld-agent-version-dot {
  width: 5px; height: 5px;
  border-radius: 999px;
  background: #2DC470;
  box-shadow: 0 0 0 0 rgba(45, 196, 112, 0.5);
  animation: sldLivePulse 1.6s ease-in-out infinite;
}
@keyframes sldLivePulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(45, 196, 112, 0.55); }
  50% { box-shadow: 0 0 0 5px rgba(45, 196, 112, 0); }
}
.sld-agent-role {
  font-size: 14px; font-weight: 600;
  color: var(--mp-ink);
  letter-spacing: -0.01em;
}
.sld-agent-meta {
  display: flex; flex-direction: column; gap: 6px;
  padding-top: 8px;
  border-top: 1px dashed var(--mp-line);
}
.sld-agent-k {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 9px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--mp-mute);
  text-transform: uppercase;
}
.sld-agent-v {
  font-size: 12px;
  color: var(--mp-ink-2);
  line-height: 1.45;
}

/* ===== ECHO pixel attribution ===== */
.sld-echo-flow {
  display: grid; grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  margin-top: 8px;
  position: relative;
}
.sld-echo-node {
  padding: 18px 20px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid var(--mp-line);
  border-radius: 14px;
  position: relative;
  text-align: center;
  opacity: 0.85;
}
.sld-echo-node.is-fund {
  background:
    radial-gradient(ellipse 80% 100% at 50% 100%, rgba(251, 146, 60, 0.20), transparent 70%),
    rgba(255, 255, 255, 0.95);
  border-color: var(--mp-line-strong);
  box-shadow: 0 22px 50px -28px rgba(234, 88, 12, 0.35);
  opacity: 1;
}
.sld-echo-node + .sld-echo-node::before {
  content: '→';
  position: absolute;
  left: -14px; top: 50%; transform: translateY(-50%);
  color: var(--mp-line-strong);
  font-size: 14px; font-weight: 700;
}
.sld-echo-n {
  font-size: 10px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--mp-mute);
  text-transform: uppercase;
}
.sld-echo-node.is-fund .sld-echo-n { color: var(--mp-teal); }
.sld-echo-label {
  margin-top: 6px;
  font-size: 15px; font-weight: 800;
  letter-spacing: -0.015em;
  color: var(--mp-ink);
}
.sld-echo-sub {
  margin-top: 2px;
  font-size: 11px; color: var(--mp-mute);
}
/* ECHO 3D feedback loop — funded stage signals back to ad platforms */
.sld-echo-3d {
  position: relative;
  margin-top: 16px;
  padding: 32px 28px 24px;
  border-radius: 20px;
  background:
    radial-gradient(ellipse 70% 100% at 0% 100%, rgba(251, 146, 60, 0.16), transparent 65%),
    radial-gradient(ellipse 60% 80% at 100% 0%, rgba(234, 88, 12, 0.12), transparent 65%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(244, 252, 250, 0.98) 100%);
  border: 1px solid var(--mp-line-strong);
  overflow: hidden;
  box-shadow: 0 28px 60px -32px rgba(234, 88, 12, 0.30);
  display: grid;
  grid-template-columns: 240px 1fr 260px;
  grid-template-rows: auto auto;
  column-gap: 16px;
  row-gap: 18px;
  align-items: center;
  perspective: 1400px;
}
.sld-echo-3d-stage {
  grid-column: 1; grid-row: 1;
  display: flex; flex-direction: column; gap: 6px;
  padding: 18px 20px;
  background:
    radial-gradient(ellipse 80% 100% at 0% 50%, rgba(251, 146, 60, 0.32), transparent 70%),
    linear-gradient(135deg, var(--mp-deep) 0%, #7C2D12 100%);
  color: #fff;
  border-radius: 14px;
  box-shadow:
    0 22px 50px -22px rgba(234, 88, 12, 0.55),
    0 0 0 1px rgba(251, 146, 60, 0.32);
  transform: rotateY(8deg) translateZ(20px);
  transform-style: preserve-3d;
}
.sld-echo-3d-tag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10px; letter-spacing: 0.22em; font-weight: 700;
  color: var(--mp-teal-2);
  text-transform: uppercase;
}
.sld-echo-3d-h {
  font-size: 20px; font-weight: 600;
  letter-spacing: -0.018em;
  color: #fff;
}
.sld-echo-3d-sub {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.45;
}
.sld-echo-3d-stream {
  grid-column: 2; grid-row: 1;
  position: relative;
  height: 140px;
}
.sld-echo-3d-stream svg {
  width: 100%; height: 100%;
}
.sld-echo-3d-platforms {
  grid-column: 3; grid-row: 1;
  display: flex; flex-direction: column;
  gap: 8px;
  transform-style: preserve-3d;
}
.sld-echo-3d-platform {
  position: relative;
  display: grid;
  grid-template-columns: 70px 1fr 12px;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid var(--mp-line-strong);
  box-shadow: 0 10px 22px -12px rgba(234, 88, 12, 0.30);
  transition: transform .3s ease, box-shadow .3s ease;
}
.sld-echo-3d-platform-meta { transform: rotateY(-8deg) translateZ(28px); }
.sld-echo-3d-platform-google { transform: rotateY(-8deg) translateZ(14px); }
.sld-echo-3d-platform-tiktok { transform: rotateY(-8deg) translateZ(0); }
.sld-echo-3d-platform-k {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 11px; font-weight: 700;
  color: var(--mp-teal);
  letter-spacing: 0.10em;
}
.sld-echo-3d-platform-sig {
  font-size: 11px;
  color: var(--mp-mute);
}
.sld-echo-3d-platform-dot {
  width: 8px; height: 8px;
  border-radius: 999px;
  background: var(--mp-teal-2);
  box-shadow: 0 0 0 0 rgba(251, 146, 60, 0.55);
  animation: sldLivePulse 1.8s ease-in-out infinite;
}
.sld-echo-3d-caption {
  grid-column: 1 / -1;
  grid-row: 2;
  padding-top: 16px;
  border-top: 1px dashed var(--mp-line);
  font-size: 13px; line-height: 1.55;
  color: var(--mp-ink-2);
  text-align: center;
}

/* ===== Compound effect 12-month bar chart ===== */
.sld-comp-chart {
  display: flex; flex-direction: column; gap: 18px;
  padding: 24px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--mp-line-strong);
  border-radius: 18px;
  margin-top: 8px;
}
.sld-comp-bars {
  display: grid; grid-template-columns: repeat(12, 1fr);
  gap: 8px;
  height: 200px;
  align-items: flex-end;
}
.sld-comp-col {
  display: flex; flex-direction: column; gap: 6px; align-items: center;
  height: 100%;
}
.sld-comp-bar {
  width: 100%;
  background: linear-gradient(180deg, var(--mp-teal-2) 0%, var(--mp-deep) 100%);
  border-radius: 6px 6px 0 0;
  transform-origin: bottom;
  animation: sldCompBarGrow 1.2s cubic-bezier(0.22, 0.61, 0.36, 1);
  transition: opacity .15s ease;
}
.sld-comp-bar:hover { opacity: 0.85; }
@keyframes sldCompBarGrow {
  from { transform: scaleY(0); }
  to { transform: scaleY(1); }
}
.sld-comp-m {
  font-size: 9px; letter-spacing: 0.10em; font-weight: 700;
  color: var(--mp-mute);
  text-transform: uppercase;
  font-variant-numeric: tabular-nums;
}
.sld-comp-legend {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 16px;
  padding-top: 14px;
  border-top: 1px dashed var(--mp-line);
}
.sld-comp-legend-k {
  font-size: 10px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--mp-teal);
  text-transform: uppercase;
}
.sld-comp-legend-v {
  margin-top: 4px;
  font-size: 13px; color: var(--mp-ink-2); line-height: 1.5;
}

/* ===== Full value stack ===== */
.sld-stack-grid {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: 8px;
}
.sld-stack-card {
  padding: 20px 22px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--mp-line);
  border-radius: 16px;
  display: flex; flex-direction: column; gap: 12px;
}
.sld-stack-head {
  font-size: 13px; letter-spacing: 0.14em; font-weight: 800;
  color: var(--mp-teal);
  text-transform: uppercase;
  padding-bottom: 10px;
  border-bottom: 1px dashed var(--mp-line);
}
.sld-stack-items {
  list-style: none; padding: 0; margin: 0;
  display: flex; flex-direction: column; gap: 8px;
}
.sld-stack-items li {
  display: flex; align-items: flex-start; gap: 10px;
  font-size: 12.5px; line-height: 1.5;
  color: var(--mp-ink-2);
}
.sld-stack-check {
  width: 16px; height: 16px;
  border-radius: 999px;
  background: rgba(251, 146, 60, 0.18);
  color: var(--mp-teal);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700;
  flex-shrink: 0;
  margin-top: 2px;
}
.sld-stack-alt {
  margin-top: auto;
  padding: 10px 12px;
  background: rgba(15, 23, 42, 0.04);
  border-radius: 10px;
  display: flex; flex-direction: column; gap: 2px;
}
.sld-stack-alt-k {
  font-size: 9.5px; letter-spacing: 0.16em; font-weight: 700;
  color: var(--mp-mute);
  text-transform: uppercase;
}
.sld-stack-alt-v {
  font-size: 12px; font-weight: 600;
  color: var(--mp-ink);
}
.sld-stack-total {
  margin-top: 8px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid var(--mp-line-strong);
  border-radius: 16px;
  overflow: hidden;
}
.sld-stack-total-row {
  display: flex; justify-content: space-between; align-items: baseline;
  padding: 18px 24px;
  border-bottom: 1px dashed var(--mp-line);
}
.sld-stack-total-row:last-child { border-bottom: none; }
.sld-stack-total-row.accent {
  background:
    radial-gradient(ellipse 80% 100% at 100% 50%, rgba(251, 146, 60, 0.18), transparent 70%),
    rgba(255, 255, 255, 0.95);
}
.sld-stack-total-k {
  font-size: 13px; letter-spacing: 0.14em; font-weight: 700;
  color: var(--mp-mute);
  text-transform: uppercase;
}
.sld-stack-total-row.accent .sld-stack-total-k { color: var(--mp-teal); }
.sld-stack-total-v {
  font-size: 22px; font-weight: 800;
  color: var(--mp-ink);
  letter-spacing: -0.025em;
  font-variant-numeric: tabular-nums;
}
.sld-stack-total-row.accent .sld-stack-total-v {
  background: linear-gradient(135deg, var(--mp-deep) 0%, var(--mp-teal-2) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}

/* ===== Smart-routing funnel (slide 12 · HELIX + ORACLE) =====
 * Clean three-stage stack with a centered HELIX router pill,
 * then two flat side-by-side branches (no 3D tilt). HIGH-TICKET
 * is the winning path (deep teal outcome bar); LOW-TICKET is
 * the recapture lane (lighter outcome bar). */
.sld-funnel {
  display: flex; flex-direction: column;
  align-items: stretch;
  gap: 8px;
  margin-top: 8px;
  perspective: 1800px;
  perspective-origin: 50% 0%;
}
.sld-funnel-stages {
  display: flex; flex-direction: column;
  gap: 0;
  transform-style: preserve-3d;
}
.sld-funnel-stage {
  position: relative;
  display: flex; flex-direction: column; align-items: center;
  gap: 4px;
  padding: 14px 22px;
  text-align: center;
  background:
    radial-gradient(ellipse 60% 100% at 50% 0%, rgba(251, 146, 60, 0.12), transparent 70%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 253, 252, 0.98) 100%);
  border: 1px solid var(--mp-line-strong);
  border-radius: 14px;
  box-shadow:
    0 22px 50px -32px rgba(234, 88, 12, 0.40),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  transform-style: preserve-3d;
  transition: transform .25s ease, box-shadow .25s ease;
}
/* Subtle stacking — each stage sits slightly forward of the previous,
   reinforcing the flow direction without tilting anything. */
.sld-funnel-stage:nth-of-type(1) { transform: translateZ(0px); }
.sld-funnel-stage:nth-of-type(3) { transform: translateZ(8px); }
.sld-funnel-stage:nth-of-type(5) {
  transform: translateZ(16px);
  box-shadow:
    0 30px 60px -30px rgba(234, 88, 12, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.95);
}
.sld-funnel-connector {
  align-self: center;
  position: relative;
  width: 28px;
  height: 36px;
  margin: -2px 0;
  display: flex; align-items: center; justify-content: center;
}
.sld-funnel-connector::before {
  content: '';
  position: absolute;
  top: 0; bottom: 14px;
  left: 50%;
  width: 2px;
  margin-left: -1px;
  background: linear-gradient(180deg, rgba(251, 146, 60, 0.0), rgba(234, 88, 12, 0.55));
  border-radius: 999px;
}
.sld-funnel-connector::after {
  content: '';
  position: absolute;
  bottom: 4px;
  left: 50%;
  margin-left: -5px;
  width: 0; height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 8px solid var(--mp-teal);
  filter: drop-shadow(0 2px 4px rgba(234, 88, 12, 0.35));
}
.sld-funnel-stage-tag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10px; letter-spacing: 0.22em; font-weight: 700;
  color: var(--mp-teal);
  text-transform: uppercase;
}
.sld-funnel-stage-h {
  font-size: 15px; font-weight: 600;
  letter-spacing: -0.012em;
  color: var(--mp-ink);
}
.sld-funnel-stage-b {
  font-size: 12px;
  color: var(--mp-mute);
  line-height: 1.4;
}
.sld-funnel-pills {
  display: flex; flex-wrap: wrap; justify-content: center;
  gap: 5px;
  margin-top: 2px;
}
.sld-funnel-pill {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10px; font-weight: 600;
  color: var(--mp-teal);
  background: rgba(251, 146, 60, 0.10);
  border: 1px solid rgba(234, 88, 12, 0.18);
  padding: 2px 8px;
  border-radius: 999px;
  letter-spacing: 0.02em;
}
.sld-funnel-router {
  align-self: center;
  position: relative;
  display: inline-flex; align-items: center; gap: 8px;
  margin: 14px 0 22px;
  padding: 9px 20px;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 11px; letter-spacing: 0.18em; font-weight: 700;
  color: #fff;
  text-transform: uppercase;
  background:
    radial-gradient(ellipse 80% 100% at 0% 50%, rgba(251, 146, 60, 0.40), transparent 70%),
    linear-gradient(135deg, var(--mp-deep) 0%, #7C2D12 100%);
  border: 1px solid rgba(251, 146, 60, 0.45);
  border-radius: 999px;
  box-shadow:
    0 18px 36px -16px rgba(234, 88, 12, 0.55),
    0 0 0 1px rgba(255, 255, 255, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.12);
  white-space: nowrap;
  transform: translateZ(24px);
}
/* Diverging arms — SVG-free pure-CSS fork from router to the two branches */
.sld-funnel-router::before,
.sld-funnel-router::after {
  content: '';
  position: absolute;
  top: 100%;
  width: 2px;
  height: 22px;
  background: linear-gradient(180deg, rgba(234, 88, 12, 0.55), rgba(234, 88, 12, 0.10));
}
.sld-funnel-router::before {
  left: 30%;
  transform: rotate(-22deg);
  transform-origin: 50% 0%;
}
.sld-funnel-router::after {
  right: 30%;
  transform: rotate(22deg);
  transform-origin: 50% 0%;
}
.sld-funnel-router-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--mp-teal-2);
  animation: sldPulse 1.5s ease-in-out infinite;
}
.sld-funnel-branches {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 14px;
  transform-style: preserve-3d;
}
.sld-funnel-branch {
  display: flex; flex-direction: column;
  gap: 10px;
  padding: 18px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid var(--mp-line);
  border-radius: 16px;
  box-shadow:
    0 28px 56px -28px rgba(234, 88, 12, 0.32),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  transition: transform .35s cubic-bezier(0.22, 0.61, 0.36, 1),
              box-shadow .35s cubic-bezier(0.22, 0.61, 0.36, 1);
  transform: translateZ(8px);
}
.sld-funnel-branch:hover {
  transform: translateY(-4px) translateZ(16px);
  box-shadow:
    0 40px 72px -28px rgba(234, 88, 12, 0.44),
    inset 0 1px 0 rgba(255, 255, 255, 1);
}
.sld-funnel-branch-high {
  border-color: rgba(234, 88, 12, 0.30);
  background:
    radial-gradient(ellipse 80% 50% at 50% 0%, rgba(251, 146, 60, 0.14), transparent 70%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(240, 252, 250, 0.98) 100%);
  box-shadow:
    0 36px 68px -28px rgba(234, 88, 12, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 1);
  transform: translateZ(14px);
}
.sld-funnel-branch-head {
  display: flex; align-items: baseline; justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
  border-bottom: 1px dashed var(--mp-line);
}
.sld-funnel-branch-tag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px; letter-spacing: 0.20em; font-weight: 700;
  color: var(--mp-teal);
  text-transform: uppercase;
}
.sld-funnel-branch-low .sld-funnel-branch-tag { color: var(--mp-mute); }
.sld-funnel-branch-crit {
  font-size: 11px; color: var(--mp-mute);
  font-variant-numeric: tabular-nums;
}
.sld-funnel-branch-steps {
  list-style: none; padding: 0; margin: 0;
  display: flex; flex-direction: column; gap: 4px;
}
.sld-funnel-branch-steps li {
  display: grid; grid-template-columns: 28px 1fr;
  align-items: center;
  column-gap: 10px;
  padding: 8px 0;
  border-bottom: 1px dashed var(--mp-line);
}
.sld-funnel-branch-steps li:last-child { border-bottom: none; }
.sld-funnel-step-n {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 11px; font-weight: 700;
  color: var(--mp-teal);
  font-variant-numeric: tabular-nums;
}
.sld-funnel-branch-low .sld-funnel-step-n { color: var(--mp-mute); }
.sld-funnel-step-h {
  font-size: 13px; font-weight: 500;
  color: var(--mp-ink);
  letter-spacing: -0.01em;
}
.sld-funnel-branch-outcome {
  margin-top: 4px;
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 13px; font-weight: 600;
  letter-spacing: -0.01em;
  background:
    radial-gradient(ellipse 80% 100% at 0% 50%, rgba(251, 146, 60, 0.32), transparent 70%),
    linear-gradient(135deg, var(--mp-deep) 0%, #7C2D12 100%);
  color: #fff;
  text-align: center;
  box-shadow: 0 12px 28px -14px rgba(234, 88, 12, 0.50);
}
.sld-funnel-branch-outcome-low {
  background: rgba(15, 23, 42, 0.05);
  color: var(--mp-ink-2);
  box-shadow: none;
  border: 1px dashed var(--mp-line-strong);
}

/* ===== Trusted by 1,000+ contractors ===== */
.sld-trust-hero {
  padding: 28px 24px;
  background:
    radial-gradient(ellipse 80% 100% at 100% 50%, rgba(251, 146, 60, 0.18), transparent 70%),
    rgba(255, 255, 255, 0.95);
  border: 1px solid var(--mp-line-strong);
  border-radius: 18px;
  box-shadow: 0 22px 50px -28px rgba(234, 88, 12, 0.28);
}
.sld-trust-hero-row {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 18px;
}
.sld-trust-hero-row > div {
  text-align: center;
  padding: 8px 4px;
  border-right: 1px dashed var(--mp-line);
}
.sld-trust-hero-row > div:last-child { border-right: none; }
.sld-trust-hero-v {
  font-size: 44px; font-weight: 800;
  letter-spacing: -0.03em;
  background: linear-gradient(135deg, var(--mp-deep) 0%, var(--mp-teal-2) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.sld-trust-hero-k {
  margin-top: 6px;
  font-size: 11px; letter-spacing: 0.16em; font-weight: 700;
  color: var(--mp-mute);
  text-transform: uppercase;
}
.sld-trust-tiles {
  display: flex; flex-wrap: wrap; gap: 8px;
  margin-top: 6px;
}
.sld-trust-tile {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--mp-line);
  border-radius: 999px;
  font-size: 12.5px; font-weight: 600;
  color: var(--mp-ink-2);
}
.sld-trust-tile-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--mp-teal-2);
}

/* ===== Hero pricing card (slide · $10k one-time setup) ===== */
.sld-price-hero { padding: 0 !important; overflow: hidden; }
.sld-price-hero-row {
  display: grid; grid-template-columns: 320px 1fr;
  gap: 0;
}
.sld-price-hero-row > div:first-child {
  padding: 28px 32px;
  background:
    radial-gradient(ellipse 80% 100% at 0% 100%, rgba(251, 146, 60, 0.16), transparent 70%),
    linear-gradient(180deg, var(--mp-deep) 0%, #7C2D12 100%);
  color: #fff;
}
.sld-price-hero-eyebrow {
  font-size: 11px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--mp-teal-2);
  text-transform: uppercase;
}
.sld-price-hero-amount {
  margin-top: 8px;
  font-size: 64px; font-weight: 800;
  letter-spacing: -0.035em;
  background: linear-gradient(135deg, #fff 0%, var(--mp-teal-2) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.sld-price-hero-sub {
  margin-top: 4px;
  font-size: 13px; letter-spacing: 0.10em;
  color: rgba(255,255,255,0.65);
  text-transform: uppercase;
}
.sld-price-hero-includes {
  padding: 28px 32px;
  background: rgba(255, 255, 255, 0.95);
}
.sld-price-hero-includes-eyebrow {
  font-size: 11px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--mp-teal);
  text-transform: uppercase;
  margin-bottom: 12px;
}
.sld-price-hero-includes ul {
  list-style: none; padding: 0; margin: 0;
  display: flex; flex-direction: column; gap: 14px;
}
.sld-price-hero-includes li {
  position: relative;
  padding-left: 28px;
  line-height: 1.5;
  display: flex; flex-direction: column; gap: 2px;
}
.sld-price-hero-includes li::before {
  content: '';
  position: absolute;
  left: 0; top: 4px;
  width: 18px; height: 18px;
  border-radius: 999px;
  background:
    radial-gradient(circle at 30% 30%, rgba(251, 146, 60, 0.45), transparent 70%),
    linear-gradient(135deg, rgba(251, 146, 60, 0.18) 0%, rgba(234, 88, 12, 0.10) 100%);
  border: 1px solid rgba(234, 88, 12, 0.30);
}
.sld-price-hero-includes li::after {
  content: '';
  position: absolute;
  left: 5px; top: 8px;
  width: 8px; height: 4px;
  border-left: 1.6px solid var(--mp-teal);
  border-bottom: 1.6px solid var(--mp-teal);
  transform: rotate(-45deg);
}
.sld-price-li-h {
  font-size: 14px; font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--mp-ink);
}
.sld-price-li-b {
  font-size: 12.5px; font-weight: 400;
  color: var(--mp-mute);
  line-height: 1.45;
}
.sld-price-hero ~ .sld-price-grid,
.sld-price-hero .sld-price-grid {
  grid-template-columns: 1fr 1.05fr;
  border-top: 1px solid var(--mp-line);
}
.sld-price-hero .sld-price-grid.sld-price-grid-single {
  grid-template-columns: 1fr;
  max-width: none;
}
.sld-price-hero .sld-price-grid > div:first-child {
  padding: 22px 28px;
}

/* ===== Cover · brand title (first slide of the deck) ===== */
.sld-cover {
  align-items: center; text-align: center;
  max-width: 900px;
  gap: 18px;
  position: relative;
}
.sld-cover-eyebrow {
  display: inline-flex; align-items: center; gap: 10px;
  font-size: 11px; letter-spacing: 0.20em; font-weight: 700;
  color: var(--mp-teal);
  text-transform: uppercase;
  padding: 7px 16px;
  background: rgba(251, 146, 60, 0.10);
  border: 1px solid var(--mp-line);
  border-radius: 999px;
  align-self: center;
}
.sld-cover-mark {
  color: var(--mp-teal);
  display: inline-flex; align-items: center; justify-content: center;
  width: 110px; height: 110px;
  background: linear-gradient(135deg, rgba(251, 146, 60, 0.15) 0%, rgba(234, 88, 12, 0.10) 100%);
  border: 1px solid var(--mp-line-strong);
  border-radius: 28px;
  box-shadow:
    0 30px 60px -30px rgba(234, 88, 12, 0.40),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
}
.sld-cover-wordmark {
  font-size: 120px;
  font-weight: 800;
  letter-spacing: -0.045em;
  line-height: 1;
  margin-top: 6px;
}
.sld-cover-tagline {
  font-size: 28px;
  font-weight: 500;
  color: var(--mp-ink);
  margin-top: -4px;
  letter-spacing: -0.014em;
}
.sld-cover-subtagline {
  margin-top: 12px;
  max-width: 640px;
  margin-left: auto;
  margin-right: auto;
  font-size: 16px;
  line-height: 1.55;
  color: var(--mp-mute);
}
.sld-cover-meta {
  margin-top: 18px;
  padding: 18px 28px;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid var(--mp-line);
  border-radius: 14px;
  display: flex; flex-direction: column; gap: 8px;
  align-self: center;
}
.sld-cover-meta-row {
  display: flex; align-items: baseline; gap: 14px;
  font-size: 13px;
}
.sld-cover-meta-k {
  font-size: 10px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--mp-mute);
  text-transform: uppercase;
  min-width: 110px;
  text-align: right;
}
.sld-cover-meta-v {
  color: var(--mp-ink);
  font-weight: 600;
}
.sld-cover-hint {
  margin-top: 24px;
  display: inline-flex; align-items: center; gap: 10px;
  font-size: 11px; letter-spacing: 0.16em; font-weight: 700;
  color: var(--mp-mute);
  text-transform: uppercase;
  align-self: center;
}
.sld-cover-hint-arrow {
  display: inline-block;
  animation: sldCoverArrow 1.8s ease-in-out infinite;
  color: var(--mp-teal);
  font-size: 16px;
}
@keyframes sldCoverArrow {
  0%, 100% { transform: translateY(0); opacity: 0.7; }
  50% { transform: translateY(4px); opacity: 1; }
}

/* ===== Smart routing (HELIX) — slide 8 ===== */
.sld-sr {
  display: grid; grid-template-columns: 220px 200px 1fr;
  gap: 24px; align-items: center;
  margin-top: 8px;
  padding: 36px 28px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--mp-line-strong);
  border-radius: 22px;
}
.sld-sr-homeowner {
  display: flex; align-items: center; gap: 14px;
  padding: 18px 20px;
  background: linear-gradient(180deg, rgba(255,255,255,0.85), rgba(248,253,252,0.85));
  border: 1px solid var(--mp-line);
  border-radius: 14px;
}
.sld-sr-avatar {
  width: 44px; height: 44px;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--mp-deep), var(--mp-teal));
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 700; letter-spacing: 0.05em;
}
.sld-sr-meta { display: flex; flex-direction: column; gap: 2px; }
.sld-sr-label { font-size: 11px; letter-spacing: 0.16em; font-weight: 700; color: var(--mp-teal); text-transform: uppercase; }
.sld-sr-sub { font-size: 12px; color: var(--mp-mute); }
.sld-sr-arrow {
  position: relative;
  display: flex; flex-direction: column; gap: 8px; align-items: center;
}
.sld-sr-agent {
  font-size: 12px; letter-spacing: 0.16em; font-weight: 800;
  color: var(--mp-teal);
  text-transform: uppercase;
  padding: 6px 14px;
  background: rgba(251, 146, 60, 0.14);
  border: 1px solid rgba(251, 146, 60, 0.35);
  border-radius: 999px;
  display: inline-flex; align-items: center; gap: 8px;
}
.sld-sr-agent-dot {
  width: 6px; height: 6px; border-radius: 999px; background: var(--mp-teal-2);
  animation: sldPulse 1.5s ease-in-out infinite;
}
.sld-sr-agent-sub {
  font-size: 10px; letter-spacing: 0.14em; font-weight: 600;
  color: var(--mp-mute);
  text-transform: uppercase;
}
.sld-sr-arrow-line {
  position: relative;
  width: 80%; height: 3px;
  background: linear-gradient(90deg, transparent, var(--mp-teal), transparent);
  border-radius: 999px;
  overflow: hidden;
}
.sld-sr-arrow-pulse {
  position: absolute; top: -1px; left: 0;
  width: 24px; height: 5px;
  background: radial-gradient(ellipse, rgba(251, 146, 60, 0.95), transparent 70%);
  border-radius: 999px;
  animation: sldWirePulse 2s ease-in-out infinite;
}
.sld-sr-reps {
  display: flex; flex-direction: column; gap: 10px;
}
.sld-sr-rep {
  padding: 14px 18px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid var(--mp-line);
  border-radius: 12px;
  position: relative;
  opacity: 0.7;
  transition: opacity .25s ease, transform .25s ease, box-shadow .25s ease;
}
.sld-sr-rep.is-match {
  opacity: 1;
  background:
    radial-gradient(ellipse 80% 100% at 100% 0%, rgba(251, 146, 60, 0.16), transparent 70%),
    rgba(255, 255, 255, 0.95);
  border-color: var(--mp-line-strong);
  box-shadow: 0 18px 40px -22px rgba(234, 88, 12, 0.30);
  transform: translateX(6px);
}
.sld-sr-rep-name {
  font-size: 14px; font-weight: 700;
  color: var(--mp-ink);
  display: inline-flex; align-items: center; gap: 8px;
}
.sld-sr-rep-star { color: var(--mp-teal-2); font-size: 16px; }
.sld-sr-rep-tag { margin-top: 2px; font-size: 12px; color: var(--mp-ink-2); }
.sld-sr-rep-cap { margin-top: 4px; font-size: 10px; letter-spacing: 0.12em; color: var(--mp-mute); text-transform: uppercase; font-weight: 600; }
.sld-sr-rep-match {
  margin-top: 6px;
  font-size: 10px; letter-spacing: 0.14em; font-weight: 700;
  color: var(--mp-teal);
  text-transform: uppercase;
}

/* ===== Smartphone mockup — slide 11 ===== */
.sld-phone {
  display: flex; align-items: center; justify-content: center;
  perspective: 1400px;
  position: relative; z-index: 2;
}
.sld-phone-bezel {
  width: 280px;
  background: linear-gradient(180deg, #1a1f24 0%, #0d1115 100%);
  border-radius: 36px;
  padding: 12px;
  box-shadow:
    0 60px 110px -50px rgba(234, 88, 12, 0.45),
    0 30px 60px -30px rgba(234, 88, 12, 0.30),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  transform: rotateX(8deg) rotateY(-10deg);
  transform-style: preserve-3d;
  position: relative;
}
.sld-phone-notch {
  position: absolute; top: 14px; left: 50%; transform: translateX(-50%);
  width: 90px; height: 22px; border-radius: 12px;
  background: #0d1115;
  z-index: 2;
}
.sld-phone-screen {
  background: #fff;
  border-radius: 28px;
  padding: 32px 18px 18px;
  display: flex; flex-direction: column; gap: 14px;
  min-height: 480px;
}
.sld-phone-status {
  font-size: 10px; letter-spacing: 0.12em; font-weight: 700;
  color: var(--mp-mute);
}
.sld-phone-card {
  padding: 18px;
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid var(--mp-line-strong);
  border-radius: 16px;
  box-shadow: 0 14px 30px -16px rgba(234, 88, 12, 0.30);
  display: flex; flex-direction: column; gap: 10px;
}
.sld-phone-card-eyebrow {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 9.5px; letter-spacing: 0.20em; font-weight: 700;
  color: var(--mp-teal);
  text-transform: uppercase;
  padding: 4px 10px;
  background: rgba(251, 146, 60, 0.14);
  border-radius: 999px;
  align-self: flex-start;
}
.sld-phone-card-dot {
  width: 5px; height: 5px; border-radius: 999px;
  background: var(--mp-teal-2);
}
.sld-phone-card-amount {
  font-size: 36px; font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--mp-ink);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.sld-phone-card-meta {
  font-size: 11px; letter-spacing: 0.18em; font-weight: 600;
  color: var(--mp-mute);
  text-transform: uppercase;
}
.sld-phone-card-row {
  display: flex; justify-content: space-between; align-items: baseline;
  padding-top: 8px;
  border-top: 1px dashed var(--mp-line);
  font-size: 12px;
  color: var(--mp-ink-2);
}
.sld-phone-card-row strong {
  font-weight: 700;
  color: var(--mp-ink);
  font-variant-numeric: tabular-nums;
}
.sld-phone-card-cta {
  margin-top: 4px;
  padding: 12px 16px;
  background: linear-gradient(135deg, var(--mp-deep) 0%, var(--mp-teal) 100%);
  color: #fff;
  border-radius: 10px;
  font-size: 13px; font-weight: 700;
  text-align: center;
  letter-spacing: 0.02em;
}
.sld-phone-card-foot {
  font-size: 9px; letter-spacing: 0.10em;
  color: var(--mp-mute);
  text-align: center;
  font-weight: 600;
}
.sld-phone-tip {
  font-size: 11px; color: var(--mp-mute);
  text-align: center;
  font-style: italic;
}

/* ===== Vertical slides — slides 14-16 ===== */
.sld-vert-grid {
  display: grid; grid-template-columns: 1.4fr 1fr;
  gap: 14px;
  margin-top: 8px;
}
.sld-vert-panel {
  padding: 24px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--mp-line);
  border-radius: 16px;
}
.sld-vert-panel-side {
  display: flex; flex-direction: column; gap: 14px;
  padding: 0;
  background: transparent;
  border: none;
}
.sld-vert-side-row {
  padding: 18px 22px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--mp-line);
  border-radius: 14px;
}
.sld-vert-side-row.accent {
  background:
    radial-gradient(ellipse 80% 100% at 100% 0%, rgba(251, 146, 60, 0.16), transparent 70%),
    rgba(255, 255, 255, 0.95);
  border-color: var(--mp-line-strong);
}
.sld-vert-side-k {
  font-size: 10px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--mp-mute);
  text-transform: uppercase;
}
.sld-vert-side-row.accent .sld-vert-side-k { color: var(--mp-teal); }
.sld-vert-side-v {
  margin-top: 6px;
  font-size: 24px; font-weight: 800;
  color: var(--mp-ink);
  letter-spacing: -0.025em;
  font-variant-numeric: tabular-nums;
}
.sld-vert-side-sub {
  margin-top: 4px;
  font-size: 11px; color: var(--mp-mute);
}
.sld-vert-eyebrow {
  font-size: 10px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--mp-mute);
  text-transform: uppercase;
  margin-bottom: 12px;
}
.sld-vert-pains {
  list-style: none; padding: 0; margin: 0;
  display: flex; flex-direction: column; gap: 8px;
}
.sld-vert-pains li {
  display: flex; align-items: flex-start; gap: 10px;
  font-size: 13px; color: var(--mp-ink-2);
  line-height: 1.5;
}
.sld-vert-x {
  width: 18px; height: 18px;
  border-radius: 999px;
  background: rgba(200, 75, 75, 0.10);
  color: rgb(170, 60, 60);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700;
  flex-shrink: 0;
  margin-top: 1px;
}
.sld-vert-outcomes {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.sld-vert-outcome {
  padding: 18px 22px;
  background: linear-gradient(180deg, rgba(255,255,255,0.92), rgba(248,253,252,0.92));
  border: 1px solid var(--mp-line-strong);
  border-radius: 14px;
  text-align: center;
}
.sld-vert-outcome-v {
  font-size: 26px; font-weight: 800;
  letter-spacing: -0.025em;
  background: linear-gradient(135deg, var(--mp-deep) 0%, var(--mp-teal-2) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  font-variant-numeric: tabular-nums;
}
.sld-vert-outcome-k {
  margin-top: 4px;
  font-size: 11px; letter-spacing: 0.14em;
  color: var(--mp-mute);
  text-transform: uppercase;
  font-weight: 600;
}
.sld-vert-quote {
  padding: 24px 28px;
  background:
    radial-gradient(ellipse 80% 100% at 0% 50%, rgba(251, 146, 60, 0.12), transparent 70%),
    rgba(255, 255, 255, 0.95);
  border: 1px solid var(--mp-line-strong);
  border-radius: 16px;
  display: flex; flex-direction: column; gap: 12px;
  box-shadow: 0 18px 50px -28px rgba(234, 88, 12, 0.26);
}
.sld-vert-quote blockquote {
  margin: 0;
  font-size: 18px; line-height: 1.5;
  color: var(--mp-ink);
  font-style: italic;
}
.sld-vert-quote-attr {
  display: flex; gap: 8px; align-items: baseline;
  padding-top: 10px;
  border-top: 1px dashed var(--mp-line);
}
.sld-vert-quote-name {
  font-size: 13px; font-weight: 700;
  color: var(--mp-ink);
}
.sld-vert-quote-role {
  font-size: 12px; color: var(--mp-mute);
}

/* ===== Big finale CTA — last slide ===== */
.sld-finale {
  align-items: center; text-align: center;
  position: relative;
  max-width: 980px;
}
.sld-finale .sld-eyebrow { align-self: center; }
.sld-h2-mega {
  font-size: 72px;
  letter-spacing: -0.035em;
}
.sld-finale-sub {
  max-width: 680px;
  margin: 0 auto;
  font-size: 18px;
}
.sld-finale-ctas {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 16px;
  width: 100%;
  max-width: 760px;
  margin: 12px auto 0;
}
.sld-finale-ctas.sld-finale-ctas-single {
  grid-template-columns: minmax(420px, 560px);
  justify-content: center;
}
.sld-finale-primary {
  position: relative;
  display: flex; flex-direction: column; gap: 8px;
  padding: 32px 80px 32px 36px;
  border-radius: 22px;
  text-align: left;
  background: linear-gradient(135deg, #FFFFFF 0%, #FFF7ED 100%);
  color: var(--mp-deep);
  border: 1px solid rgba(234, 88, 12, 0.30);
  box-shadow:
    0 30px 60px -28px rgba(234, 88, 12, 0.45),
    0 10px 24px -16px rgba(234, 88, 12, 0.28);
  transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
}
.sld-finale-primary:hover {
  transform: translateY(-4px);
  box-shadow:
    0 50px 100px -36px rgba(234, 88, 12, 0.55),
    0 14px 32px -16px rgba(234, 88, 12, 0.35);
  border-color: rgba(234, 88, 12, 0.50);
}
.sld-finale-primary-h {
  font-size: 30px; font-weight: 700;
  letter-spacing: -0.024em;
  color: var(--mp-deep);
  background: linear-gradient(120deg, var(--mp-deep) 0%, var(--mp-teal) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.sld-finale-primary-sub {
  font-size: 13px; letter-spacing: 0.04em;
  color: var(--mp-mute);
  font-weight: 500;
}
.sld-finale-primary-arrow {
  position: absolute;
  right: 30px; top: 50%;
  transform: translateY(-50%);
  width: 44px; height: 44px;
  border-radius: 999px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, var(--mp-teal) 0%, var(--mp-teal-2) 100%);
  color: #fff;
  font-size: 20px;
  box-shadow: 0 8px 20px -8px rgba(234, 88, 12, 0.55);
  transition: transform .18s ease;
}
.sld-finale-primary:hover .sld-finale-primary-arrow {
  transform: translateY(-50%) translateX(4px);
}
.sld-finale-trust {
  margin-top: 18px;
  font-size: 11px; letter-spacing: 0.10em;
  color: var(--mp-mute);
  text-transform: uppercase;
  font-weight: 600;
}

/* ===== Responsive ===== */
@media (max-width: 1024px) {
  .sld-h1 { font-size: 52px; }
  .sld-h2 { font-size: 38px; }
  .sld-h2-big { font-size: 44px; }
  .sld-stat-row { grid-template-columns: repeat(2, 1fr); }
  .sld-vs-2col { grid-template-columns: 1fr; }
  .sld-pillars { grid-template-columns: 1fr; }
  .sld-stage-row { grid-template-columns: 1fr; }
  .sld-stage-metric { border-right: none; border-bottom: 1px solid var(--mp-line); padding-right: 0; padding-bottom: 16px; }
  .sld-grid-hero { grid-template-columns: 1fr; }
  .sld-mock { width: 100%; max-width: 440px; margin: 0 auto; }
  .sld-econ-inputs { grid-template-columns: 1fr; }
  .sld-econ-outputs { grid-template-columns: 1fr; }
  .sld-cases-grid { grid-template-columns: 1fr; }
  .sld-trust-grid { grid-template-columns: repeat(2, 1fr); }
  .sld-cta-grid { grid-template-columns: 1fr; }
  .sld-bar-row { grid-template-columns: 1fr; }
  .sld-cover-wordmark { font-size: 80px; }
  .sld-cover-tagline { font-size: 18px; }
  .sld-cover-meta-k { min-width: 80px; }
  .sld-agenda-row { grid-template-columns: 44px 1fr; padding: 12px 16px; }
  .sld-who-grid { grid-template-columns: repeat(2, 1fr); }
  .sld-notfor { grid-template-columns: 1fr; gap: 6px; }
  .sld-agents-grid { grid-template-columns: repeat(2, 1fr); }
  .sld-echo-flow { grid-template-columns: 1fr; gap: 8px; }
  .sld-echo-node + .sld-echo-node::before { display: none; }
  .sld-comp-bars { height: 140px; }
  .sld-comp-legend { grid-template-columns: 1fr; }
  .sld-stack-grid { grid-template-columns: 1fr; }
  .sld-funnel-branches { grid-template-columns: 1fr; }
  .sld-funnel-tier-2, .sld-funnel-tier-3 { width: 100%; }
  .sld-funnel-outcome { width: 100%; }
  .sld-mp { grid-template-columns: 1fr; }
  .sld-mp-bus { display: none; }
  .sld-trust-hero-row { grid-template-columns: repeat(2, 1fr); }
  .sld-trust-hero-row > div { border-right: none; border-bottom: 1px dashed var(--mp-line); padding-bottom: 16px; }
  .sld-price-hero-row { grid-template-columns: 1fr; }
  .sld-sr { grid-template-columns: 1fr; gap: 16px; }
  .sld-sr-arrow { padding: 12px 0; }
  .sld-vert-grid { grid-template-columns: 1fr; }
  .sld-vert-outcomes { grid-template-columns: 1fr; }
  .sld-finale-ctas { grid-template-columns: 1fr; }
  .sld-h2-mega { font-size: 52px; }
  .sld-phone-bezel { transform: rotateX(4deg) rotateY(-4deg); }
  .sld-mini-stats { grid-template-columns: repeat(2, 1fr); }
  .sld-prism { grid-template-columns: 1fr; }
  .sld-prism-arrow { padding: 6px; }
  .sld-storyboard { grid-template-columns: repeat(2, 1fr); }
  .sld-timeline { grid-template-columns: repeat(2, 1fr); }
  .sld-timeline-line { display: none; }
  .sld-roadmap { grid-template-columns: 1fr; }
  .sld-roadmap-arrow { display: none; }
  .sld-wire { grid-template-columns: 1fr; }
  .sld-checklist { grid-template-columns: 1fr; }
  .sld-price-grid { grid-template-columns: 1fr; }
  .sld-ipad-bezel { transform: rotateX(4deg) rotateY(-4deg); }
  .sld-slide { padding: 60px 32px; }
}
@media (max-width: 640px) {
  .sld-h1 { font-size: 36px; }
  .sld-h2 { font-size: 26px; }
  .sld-stat-row { grid-template-columns: 1fr; }
  .sld-trust-grid { grid-template-columns: 1fr; }
  .sld-brand { display: none; }
  .sld-mp { transform: none; }
}
`;
