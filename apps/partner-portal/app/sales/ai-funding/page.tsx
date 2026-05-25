'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

/* ============================================================================
   AI Funding · Sales Presentation v2
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
 * Transformation → Verticals (Healthcare, Construction/Solar/Home, Coaching/Pro) →
 * Trust → Pricing → Onboarding → Big finale CTA. */
const SLIDES_RAW: Slide[] = [
  /* 01 — WHAT IS AI FUNDING (high-level product overview, comes right
     after the brand title slide) */
  {
    n: '01',
    title: 'What is AI Funding',
    build: () => (
      <div className="sld-stack sld-grid-hero">
        <div className="sld-hero-left">
          <Reveal>
            <div className="sld-eyebrow">
              <span className="sld-eyebrow-dot" />
              What is AI Funding
            </div>
          </Reveal>
          <Reveal delay={120}>
            <h1 className="sld-h1">
              <span className="grad-blue-deep">Turn</span>{' '}
              <span className="grad-blue">pipelines</span>
              <br />
              <span className="grad-blue-deep">into payouts.</span>
            </h1>
          </Reveal>
          <Reveal delay={240}>
            <p className="sld-sub">
              5 AI agents installed into your existing sales process in 24 hours. They pre-qualify
              every lead, route only fundable buyers to your closers, and connect to a lender
              network for soft-pull approvals in hours and funding in days. No CRM rip-and-replace.
              Your front end stays intact.
            </p>
          </Reveal>
          <Reveal delay={360}>
            <div className="sld-chips">
              <span className="sld-chip">Soft pull · 0 credit impact</span>
              <span className="sld-chip">$5K – $100K funding</span>
              <span className="sld-chip">24-hour install · CRM stays as-is</span>
            </div>
          </Reveal>
          <Reveal delay={480}>
            <div className="sld-hero-stat-row">
              <HeroStat n={2000} suffix="+" k="US businesses served" />
              <HeroStat n={300} prefix="$" suffix="M" k="In sales generated" />
              <HeroStat n={24} suffix="hr" k="From signed to installed" />
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
            Every deal that ends with <em>&ldquo;we&apos;ll get back to you&rdquo;</em>{' '}
            <span className="grad-blue-deep">walks out unfunded.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <p className="sld-sub">
            A mid-size operator loses an estimated{' '}
            <strong>
              $<AnimatedCounter to={1.4} decimals={1} />M a year
            </strong>{' '}
            to financing friction. The objection isn&apos;t price. It&apos;s cash flow. Buyers
            don&apos;t carry $12,000.
          </p>
        </Reveal>
        <Reveal delay={360}>
          <div className="sld-stat-row">
            <CountStat to={38} suffix="%" k="Industry same-day close (no financing)" />
            <CountStat to={1.4} decimals={1} prefix="$" suffix="M" k="Revenue lost / yr" />
            <CountStat to={54} suffix="%" k="Inbound never pre-qualified" />
            <CountStat label="2–4 wks" k="Lead → deposit" />
          </div>
        </Reveal>
        <Reveal delay={480}>
          <div className="sld-section-title">Where the $1.4M actually goes</div>
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
            <span className="grad-blue">Financing at the point of sale</span>{' '}
            <span className="grad-blue-deep">is now the buyer expectation.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <p className="sld-sub">
            Cherry, Sunbit, and GreenSky proved the model. But single-lender programs cap out at one
            approval algorithm. When their model declines, your buyer walks. AI Funding solves the
            ceiling.
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
                  <span className="sld-vs-icon sld-vs-x">×</span> One ticket range
                </li>
                <li>
                  <span className="sld-vs-icon sld-vs-x">×</span> Decline = lost buyer
                </li>
              </ul>
            </div>
            <div className="sld-vs-side sld-vs-med">
              <div className="sld-vs-eyebrow accent">Multi-lender marketplace</div>
              <ul>
                <li>
                  <span className="sld-vs-icon sld-vs-check">✓</span> Every lender in parallel
                </li>
                <li>
                  <span className="sld-vs-icon sld-vs-check">✓</span> $3k to $50k coverage
                </li>
                <li>
                  <span className="sld-vs-icon sld-vs-check">✓</span> Cheapest offer wins
                </li>
              </ul>
            </div>
          </div>
        </Reveal>
      </div>
    ),
  },

  /* 04 — WHAT AI FUNDING IS */
  {
    n: '04',
    title: 'What AI Funding is',
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
            <span className="grad-blue-deep">Soft-pull pre-qual, in-session.</span>
            <br />
            <span className="grad-blue">Lender marketplace.</span>{' '}
            <span className="grad-blue-deep">Funds in 48 to 72 hours.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <p className="sld-sub">
            Three things matter to a business owner. AI Funding nails all three.
          </p>
        </Reveal>
        <Reveal delay={360}>
          <div className="sld-pillars">
            <Pillar
              n="01"
              head="Speed"
              metric="< 10s"
              body="Last 4 of SSN + DOB on any browser, on any device. Fundability tier returns instantly. Zero credit impact, full FCRA compliance."
              tags={['Soft pull', 'FCRA', '0 friction']}
            />
            <Pillar
              n="02"
              head="Coverage"
              metric="Every lender"
              body="One soft pull queries every lender in parallel. Buyer sees the cheapest qualifying offer. Decline rate is the floor of the marketplace, not the floor of a single lender."
              tags={['Parallel quoting', 'Best-price wins', 'Higher approvals']}
            />
            <Pillar
              n="03"
              head="Cash flow"
              metric="48–72 hr"
              body="Lender disburses to your business account merchant-direct. No clawback on routine defaults — the lender carries the credit risk, not you."
              tags={['Merchant-direct', 'No clawback', 'Lender holds risk']}
            />
          </div>
        </Reveal>
      </div>
    ),
  },

  /* 05 — AGENT 1: AI PRE-APPROVAL */
  {
    n: '05',
    title: 'Agent 1 · Pre-Approval',
    build: () => (
      <div className="sld-stack sld-grid-hero">
        <div className="sld-hero-left">
          <Reveal>
            <div className="sld-eyebrow">
              <span className="sld-eyebrow-dot" />
              The 5 AI agents · 1 of 5 · Pre-Approval
            </div>
          </Reveal>
          <Reveal delay={120}>
            <h2 className="sld-h2">
              <span className="grad-blue-deep">AI Pre-Approval Agent.</span>{' '}
              <span className="grad-blue">Buyability surfaced in seconds.</span>
            </h2>
          </Reveal>
          <Reveal delay={240}>
            <p className="sld-sub">
              Runs checks behind your existing intake form the second a lead drops their name, email
              and phone. A real buyability tier comes back before anyone books a call. Soft-pull
              only · zero credit impact · zero change to your front end.
            </p>
          </Reveal>
          <Reveal delay={360}>
            <div className="sld-mini-stats">
              <MiniStat v={<AnimatedCounter to={10} prefix="< " suffix="s" />} k="Decision time" />
              <MiniStat v="0" k="Credit impact" />
              <MiniStat v="3 fields" k="Friction" />
              <MiniStat v="100%" k="Of inbound leads" />
            </div>
          </Reveal>
          <Reveal delay={480}>
            <p className="sld-takeaway">
              For the rep: every lead that hits your calendar has already cleared the buyability
              gate. The next sentence is &ldquo;here&apos;s your plan&rdquo;, not &ldquo;let me
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

  /* 06 — AGENT 2: AI DATA */
  {
    n: '06',
    title: 'Agent 2 · Data',
    build: () => (
      <div className="sld-stack">
        <Reveal>
          <div className="sld-eyebrow">
            <span className="sld-eyebrow-dot" />
            The 5 AI agents · 2 of 5 · Data
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h2 className="sld-h2">
            <span className="grad-blue-deep">AI Data Agent.</span>{' '}
            <span className="grad-blue">Verified, enriched, streamed to your CRM.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <p className="sld-sub">
            Executes identity verification, enriches every record with credit band + income signal +
            available-credit headroom, standardises every field, and pushes the enriched profile
            into your CRM in real time. Your existing CRM stays as-is · no rip-and-replace.
          </p>
        </Reveal>
        <Reveal delay={360}>
          <div className="sld-mini-stats">
            <MiniStat v="Real-time" k="CRM sync" />
            <MiniStat v="Enriched" k="On every lead" />
            <MiniStat v="HubSpot · GHL · Salesforce" k="CRM compatible" />
            <MiniStat v="0" k="Manual data entry" />
          </div>
        </Reveal>
      </div>
    ),
  },

  /* 07 — AGENT 3: AI ROUTING */
  {
    n: '07',
    title: 'Agent 3 · Routing',
    build: () => (
      <div className="sld-stack">
        <Reveal>
          <div className="sld-eyebrow">
            <span className="sld-eyebrow-dot" />
            The 5 AI agents · 3 of 5 · Routing
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h2 className="sld-h2">
            <span className="grad-blue-deep">AI Routing Agent.</span>{' '}
            <span className="grad-blue">Fundable buyers to closers. Everyone else nurtured.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <p className="sld-sub">
            Scores and segments every lead the moment the Data Agent finishes. Fundable profiles
            route straight to a closer&apos;s calendar. Soft-on-paper leads route to a nurture
            track. Hard-decline leads are filtered out so your team never burns time on unqualified
            calls.
          </p>
        </Reveal>
        <Reveal delay={360}>
          <MarketplaceViz />
        </Reveal>
      </div>
    ),
  },

  /* 08 — AGENT 4: AI SALES */
  {
    n: '08',
    title: 'Agent 4 · Sales',
    build: () => (
      <div className="sld-stack">
        <Reveal>
          <div className="sld-eyebrow">
            <span className="sld-eyebrow-dot" />
            The 5 AI agents · 4 of 5 · Sales
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h2 className="sld-h2">
            <span className="grad-blue-deep">AI Sales Agent.</span>{' '}
            <span className="grad-blue">Your rep picks up already knowing the answer.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <p className="sld-sub">
            The instant a fundable lead books, your rep gets a brief inside their CRM: credit band,
            income signal, available credit, and the recommended offer path. No more &ldquo;can you
            afford this?&rdquo; conversations. Pricing certainty drives the close.
          </p>
        </Reveal>
        <Reveal delay={360}>
          <OfferStack />
        </Reveal>
        <Reveal delay={480}>
          <div className="sld-mini-stats">
            <MiniStat v={<AnimatedCounter to={3} />} k="Decision signals" />
            <MiniStat v="Pre-rep" k="Brief delivered" />
            <MiniStat v="In-CRM" k="No new tools" />
            <MiniStat v="↑ Close rate" k="Pricing certainty" />
          </div>
        </Reveal>
      </div>
    ),
  },

  /* 09 — AGENT 5: AI FUNDING */
  {
    n: '09',
    title: 'Agent 5 · Funding',
    build: () => (
      <div className="sld-stack">
        <Reveal>
          <div className="sld-eyebrow">
            <span className="sld-eyebrow-dot" />
            The 5 AI agents · 5 of 5 · Funding
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h2 className="sld-h2">
            <span className="grad-blue-deep">AI Funding Agent.</span>{' '}
            <span className="grad-blue">Lender network · approvals in hours · funded in days.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <p className="sld-sub">
            Matches the approved buyer to the right lender network and submits one canonical
            application. Approvals come back typically within hours. Funding follows in days. Payout
            status feeds back into your CRM automatically · no manual reconciliation, no chase
            calls.
          </p>
        </Reveal>
        <Reveal delay={360}>
          <BankWire />
        </Reveal>
        <Reveal delay={480}>
          <div className="sld-mini-stats">
            <MiniStat v="Hours" k="Approval window" />
            <MiniStat v="Days" k="Funding window" />
            <MiniStat v="$5K-$100K" k="Ticket range" />
            <MiniStat v="Auto" k="CRM payout sync" />
          </div>
        </Reveal>
      </div>
    ),
  },

  /* 10 — WITHOUT / WITH MEDPAY */
  {
    n: '10',
    title: 'Without vs With AI Funding',
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
            <span className="grad-blue">
              <AnimatedCounter to={38} suffix="%" /> closes
            </span>{' '}
            <span className="grad-blue-deep">
              becomes <AnimatedCounter to={70} suffix="%+" delay={400} /> same-day.
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
    title: 'What the buyer sees',
    build: () => (
      <div className="sld-stack">
        <Reveal>
          <div className="sld-eyebrow">
            <span className="sld-eyebrow-dot" />
            The buyer experience
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h2 className="sld-h2">
            <span className="grad-blue-deep">Four taps.</span>{' '}
            <span className="grad-blue">Walks out approved and funded.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <p className="sld-sub">
            The entire buyer journey happens in one session, on a single screen, in under three
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
            <span className="grad-blue">Operators that turned</span>{' '}
            <span className="grad-blue-deep">cash-pay walkaways</span>{' '}
            <span className="grad-blue">into funded buyers.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <div className="sld-cases-grid">
            <CaseCard
              tag="Healthcare · TX"
              quote="We were losing one case a week to financing. AI Funding killed that. The first month we ran it, our same-day close went from a third to two-thirds."
              outcomes={[
                { v: '2.1x', l: 'Same-day close uplift' },
                { v: '$184k', l: 'Recovered / 90 days' },
              ]}
              name="Dr. Helio Park"
              role="Owner · multi-chair clinic"
            />
            <CaseCard
              tag="Solar + roofing · AZ"
              quote="My estimators used to leave $40k jobs on the table because the homeowner couldn't get a bank loan approved before the next rep showed up. Now they walk out with a funded approval in their hand."
              outcomes={[
                { v: '+42%', l: 'In-home close rate' },
                { v: 'Hours', l: 'Approval window (vs. days)' },
              ]}
              name="Mark Coelho"
              role="Owner · 28-crew solar + roofing"
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
            <span className="grad-blue-deep">Marketplace beats</span>{' '}
            <span className="grad-blue">single-lender programs.</span>
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
            <span className="grad-blue-deep">Bank-grade by default.</span>
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
              body="Soft-pull pre-qual fully compliant. Buyer consent captured + audited."
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
            <span className="grad-blue-deep">Three line items.</span>{' '}
            <span className="grad-blue">No surprises.</span>
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
                  Every lead that runs through FORGE intake and the APEX soft-pull is billed at flat
                  rate. No charge for traffic that never reaches the form.
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
            <span className="grad-blue-deep">Up to 5 business days.</span>{' '}
            <span className="grad-blue">From signed agreement to live.</span>
          </h2>
        </Reveal>
        <Reveal delay={200}>
          <p className="sld-sub">
            Once you sign and the $10,000 platform fee clears, our team configures the account,
            integrates your pixel, trains your staff, and validates the first end-to-end soft pull.
            Up to 5 business days. After that you&apos;re running real traffic and financing real
            buyers.
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
            <span className="grad-blue-deep">Let&apos;s have you</span>{' '}
            <span className="grad-blue">signed and live this week.</span>
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
            <a href="/ai-funding/checkout" className="sld-cta sld-cta-primary">
              <div className="sld-cta-eyebrow">Start onboarding now</div>
              <div className="sld-cta-h">Sign up</div>
              <div className="sld-cta-b">
                5-minute business signup. KYB clears in 60 seconds. First live buyer application
                within hours.
              </div>
            </a>
            <a href="/help" className="sld-cta sld-cta-secondary">
              <div className="sld-cta-eyebrow">Schedule a walkthrough</div>
              <div className="sld-cta-h">Book 30 min</div>
              <div className="sld-cta-b">
                We&apos;ll walk your team through a live buyer flow on a test account. No
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
          AI Funding is a multi-lender marketplace. Lender names shown are illustrative unless
          explicitly disclosed as partners. All funded buyers are subject to lender approval. Loan
          terms, APR, and disbursement vary by lender and buyer profile. Not a guarantee of
          approval.
        </p>
      </div>
    ),
  },

  /* 19 — SMART ROUTING (NEXUS) */
  {
    n: '19',
    title: 'Smart routing — NEXUS',
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
            <span className="grad-blue-deep">Route every lead</span>{' '}
            <span className="grad-blue">by their actual financial profile.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <p className="sld-sub">
            FORGE structures the lead through your funnel in stages. First APEX returns a soft-pull
            pre-approval. Then NEXUS routes &mdash; can be one stage, can be three. Credit score,
            then income, then available credit. High-ticket buyers land on a calendar slot
            pre-approved. Low-ticket buyers land on a guide, an e-book, or a starter offer. Your
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
              <span className="grad-blue-deep">If they don&apos;t sign in-session,</span>{' '}
              <span className="grad-blue">they sign on their phone.</span>
            </h2>
          </Reveal>
          <Reveal delay={240}>
            <p className="sld-sub">
              Some buyers want to think. Some want to talk to a spouse. Some need 10 minutes. AI
              Funding texts a secure link to the same approved offer. They tap accept from the
              couch. You still book the deal.
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
              For the rep: the buyer who used to ghost after walking out now signs from the couch.
              With smartphone continuity, 31% complete the application within 48 hours of leaving
              the office.
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

  /* 21 — VERTICAL: HEALTHCARE + ELECTIVE CARE */
  {
    n: '21',
    title: 'Vertical — Healthcare + elective care',
    build: () => (
      <VerticalSlide
        eyebrow="Verticals · Healthcare + elective care"
        headline={
          <>
            <span className="grad-blue-deep">Dental, med spa, derm, vet,</span>{' '}
            <span className="grad-blue">vision, surgical · the high-ticket consults.</span>
          </>
        }
        intro="Healthcare is AI Funding's anchor vertical. Implants, ortho, full-mouth reconstruction, body contouring, LASIK, vet surgical — anywhere a buyer sits down and the ticket is $5k–$50k. The agents pre-qualify behind your existing intake so closers only see buyers who can actually fund."
        ticketRange="$3,000 – $50,000"
        ticketLabel="Single tooth implant to multi-modality package"
        highlight={{ v: '38% → 70%+', k: 'Same-day close uplift' }}
        pains={[
          "Treatment plans walk out unfunded — buyers can't carry $12k+",
          'Single-lender programs (Cherry / Sunbit / CareCredit) decline near-prime',
          'Hard-pull credit kills the second-opinion buyer',
          'Cash-pay assumption excludes 60% of inbound consults',
        ]}
        outcomes={[
          { v: '2.1×', k: 'Same-day close uplift' },
          { v: '$184k', k: 'Recovered / 90 days · mid-size practice' },
          { v: '−41%', k: 'Form drop-off vs. legacy program' },
        ]}
        quote="We were losing a case a week to financing. First month on AI Funding, same-day close went from a third to two-thirds. Buyers walk in already approved."
        attribution="Dr. Helio Park"
        attributionRole="Owner · implant practice · Austin TX"
      />
    ),
  },

  /* 22 — VERTICAL: HOME-SERVICES (construction · solar · roofing) */
  {
    n: '22',
    title: 'Vertical — Construction · Solar · Home services',
    build: () => (
      <VerticalSlide
        eyebrow="Verticals · Construction · solar · home services"
        headline={
          <>
            <span className="grad-blue-deep">Same-week installs.</span>{' '}
            <span className="grad-blue">Financing approved before the truck rolls.</span>
          </>
        }
        intro="Solar installers, roofers, HVAC, kitchen + bath remodel, pool builders. The agents pre-approve the homeowner during the in-home estimate so reps can close on the spot instead of waiting on a lender callback. Funding lands in days — your crew can schedule the install the same week."
        ticketRange="$8,000 – $80,000"
        ticketLabel="HVAC retrofit to whole-home solar"
        highlight={{ v: '+42%', k: 'In-home close rate' }}
        pains={[
          'In-home estimate hits the price — buyer says "let me think about it"',
          'Bank loans take days; the buyer signs with the competitor by then',
          'Cash-strapped homeowner = financing dependency = single-lender risk',
          'Crew + materials booked against a deal that never gets funded',
        ]}
        outcomes={[
          { v: '+42%', k: 'In-home close rate' },
          { v: 'Hours', k: 'Approval window (vs. days)' },
          { v: '2.4×', k: 'Average ticket vs. cash-only' },
        ]}
        quote="My estimators used to leave $40k jobs on the table because the homeowner couldn't get a bank loan approved before the next rep showed up. Now they walk out with a funded approval in their hand."
        attribution="Mark Coelho"
        attributionRole="Owner · 28-crew roofing + solar · Phoenix AZ"
      />
    ),
  },

  /* 23 — VERTICAL: COACHING · EDUCATION · PROFESSIONAL SERVICES */
  {
    n: '23',
    title: 'Vertical — Coaching · Education · Professional services',
    build: () => (
      <VerticalSlide
        eyebrow="Verticals · Coaching · education · pro services"
        headline={
          <>
            <span className="grad-blue-deep">High-ticket coaches, programs,</span>{' '}
            <span className="grad-blue">and pro-services firms.</span>
          </>
        }
        intro={`Online coaches, masterminds, trade schools, real-estate education, business consultants, immigration + legal services. Anywhere a sales call ends with a $5k–$50k price tag and a payment objection. The agents take the buyer from "interested" to "funded" before they hang up.`}
        ticketRange="$2,500 – $40,000"
        ticketLabel="Group coaching cohort to 1-on-1 mastermind"
        highlight={{ v: '+58%', k: 'Discovery → close conversion' }}
        pains={[
          'Coaches discount to $1,000 instead of selling the $10k offer',
          'Buyers ghost after the discovery call asking "let me check the bank"',
          'In-house payment plans = chasing delinquencies + lost LTV',
          'Stripe link gets opened, sits unfunded, never converted',
        ]}
        outcomes={[
          { v: '+58%', k: 'Discovery → close conversion' },
          { v: '+34%', k: 'Average ticket (pricing certainty)' },
          { v: '0', k: 'In-house plans to chase' },
        ]}
        quote="My closers used to soften the ask because they were scared of the payment conversation. Now the agent surfaces the credit band before the call. They open with confidence and the close rate moved 30 points."
        attribution="Casey Bell"
        attributionRole="Founder · 8-figure coaching program · Denver CO"
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
     the narrative order, ahead of "What is AI Funding"). */
  {
    n: '25',
    title: 'AI Funding',
    build: () => (
      <div className="sld-stack sld-cover">
        <ParticleField count={42} />
        <Reveal>
          <div className="sld-cover-eyebrow">
            <span className="sld-eyebrow-dot" />A presentation by EAZE AI
          </div>
        </Reveal>
        <Reveal delay={120}>
          <div className="sld-cover-mark">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect
                x="2"
                y="3"
                width="20"
                height="18"
                rx="4"
                stroke="currentColor"
                strokeWidth="1.4"
              />
              <path
                d="M7 12h10M12 7v10"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </Reveal>
        <Reveal delay={240}>
          <div className="sld-cover-wordmark">
            <span className="grad-blue-deep">AI</span>
            <span className="grad-blue"> Funding</span>
          </div>
        </Reveal>
        <Reveal delay={360}>
          <div className="sld-cover-tagline">Turn pipelines into payouts.</div>
          <div className="sld-cover-subtagline">
            5 AI agents installed into your existing sales process in 24 hours.
          </div>
        </Reveal>
        <Reveal delay={480}>
          <div className="sld-cover-meta">
            <div className="sld-cover-meta-row">
              <span className="sld-cover-meta-k">For</span>
              <span className="sld-cover-meta-v">
                Healthcare · Construction · Solar · Coaching · Pro-services
              </span>
            </div>
            <div className="sld-cover-meta-row">
              <span className="sld-cover-meta-k">Presented by</span>
              <span className="sld-cover-meta-v">EAZE AI · fund.eazeconsulting.com</span>
            </div>
          </div>
        </Reveal>
        <Reveal delay={600}>
          <div className="sld-cover-hint">
            <span className="sld-cover-hint-arrow">↓</span>
            <span>Scroll to begin · ~12 min</span>
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
    title: 'Who is AI Funding for',
    build: () => <WhoIsItFor />,
  },

  /* 28 — THE 5 AGENTS OVERVIEW */
  {
    n: '28',
    title: '5 AI agents · one platform',
    build: () => <SixAgents />,
  },

  /* 29 — BEACON PIXEL ATTRIBUTION (deep dive) */
  {
    n: '29',
    title: 'BEACON · Pixel attribution',
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
    title: 'Trusted by 2,000+ businesses',
    build: () => <TrustedBy />,
  },

  /* 33 — APEX RESULT CONSOLE (what the Pre-Approval Agent actually
     returns for every lead — concrete artefact to show buyers) */
  {
    n: '33',
    title: 'APEX · Pre-approval result',
    build: () => <ApexOutput />,
  },
];

/** Narrative ordering of SLIDES_RAW into the final 30-slide rep-led
 *  sales deck. Indices are 0-based into SLIDES_RAW. */
const NARRATIVE_ORDER = [
  // OPENING — set the stage
  24, // 01 · Cover · brand title
  25, // 02 · Welcome + agenda
  0, //  03 · What is AI Funding
  26, // 04 · Who is it for
  31, // 05 · Trusted by 2,000+ businesses (NEW v7)

  // ACT 1 — Problem
  1, //  06 · The cost of doing nothing
  2, //  07 · Why now

  // ACT 2 — Solution (high level + agents + journey)
  3, //  · The 3 pillars
  27, // · 5 agents · one platform
  10, // · Buyer journey overview (4-panel storyboard)
  4, //  · Stage 1: APEX soft-pull pre-approval
  32, // · Stage 1 · APEX result console (what comes back per lead)
  18, // · Stage 2: FORGE smart forms + NEXUS multi-stage routing
  6, //  · Stage 3: Lender marketplace
  7, //  · Stage 4: Best offer wins
  19, // · Stage 5: Smartphone continuity
  8, //  · Stage 6: VAULT merchant-direct funding
  28, // · Funded-event pixel attribution

  // ACT 3 — Transformation
  9, //  18 · Without/With
  11, // 19 · Economics calc (interactive)
  29, // 20 · The compound effect (NEW · 12-month projection)

  // ACT 4 — Verticals
  20, // 21 · Vertical: Healthcare + elective care
  21, // 22 · Vertical: Construction · Solar · Home services
  22, // 23 · Vertical: Coaching · Education · Pro services

  // ACT 5 — Trust + decide
  13, // 25 · Vs competitors

  // ACT 6 — The ask · sales-deck-only, no pricing/onboarding per brief
  30, // · Full value stack

  // ACT 7 — Close
  23, // · Big finale CTA
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

/** Mock offer card — visual replica of what a buyer sees. */
function OfferCardMock(): JSX.Element {
  return (
    <div className="sld-mock">
      <div className="sld-mock-head">
        <span className="sld-mock-pill">
          <span className="sld-mock-pill-dot" /> AI Funding · approved
        </span>
        <span className="sld-mock-meta">Illustrative</span>
      </div>
      <div className="sld-mock-project">$12k project · approved</div>
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
    { lender: 'BuildBank', apr: '14.9%', mo: '$436', term: '60', winner: true },
    { lender: 'CoreCredit', apr: '15.6%', mo: '$480', term: '60' },
    { lender: 'FinWise', apr: '16.4%', mo: '$510', term: '60' },
    { lender: 'PrimeArc', apr: '17.2%', mo: '$534', term: '60' },
    { lender: 'NorthLend', apr: '18.0%', mo: '$556', term: '60' },
    { lender: 'OakCapital', apr: '19.4%', mo: '$598', term: '60' },
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
              stroke={i === 0 ? 'rgba(59, 130, 246, 0.55)' : 'rgba(59, 130, 246, 0.25)'}
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
          <span className="sld-mp-quotes-foot-v">$436/mo · 60 mo · BuildBank</span>
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
        <div className="sld-bar-label">Without AI Funding (38% close)</div>
        <div className="sld-bar-track">
          <div className="sld-bar-fill without" style={{ width: '38%' }}>
            <span>38%</span>
          </div>
        </div>
      </div>
      <div className="sld-bar-row">
        <div className="sld-bar-label">With AI Funding (70%+ close · illustrative)</div>
        <div className="sld-bar-track">
          <div className="sld-bar-fill with" style={{ width: '70%' }}>
            <span>70%+</span>
          </div>
        </div>
      </div>
      <div className="sld-bar-delta">
        <span className="sld-bar-delta-tag">Delta</span>
        <span className="sld-bar-delta-val">+32 pts same-day close</span>
        <span className="sld-bar-delta-sub">In-session financing baseline · illustrative</span>
      </div>
    </div>
  );
}

/** Animated "vs competitors" table — checkmarks pulse in on reveal */
function VsTable(): JSX.Element {
  const rows = [
    {
      k: 'Decline = buyer walks',
      single: 'Yes',
      med: 'No · marketplace routes to next eligible lender',
    },
    {
      k: 'Ticket range',
      single: 'Capped by one lender',
      med: 'Marketplace coverage · $3k to $50k',
    },
    {
      k: 'Pre-qual in-session',
      single: 'Soft pull with that lender',
      med: 'Soft pull across the marketplace',
    },
    { k: 'Agent layer', single: 'None', med: '5 autonomous agents' },
    {
      k: 'Pixel attribution',
      single: 'On form-fill (junk signal)',
      med: 'BEACON fires on funded job (real signal)',
    },
  ];
  return (
    <table className="sld-vs-table">
      <thead>
        <tr>
          <th></th>
          <th>Single-lender (Cherry, Sunbit, GreenSky)</th>
          <th className="accent">AI Funding</th>
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
 *  to show what the buyer sees. */
function IpadFormMock(): JSX.Element {
  return (
    <div className="sld-ipad">
      <div className="sld-ipad-bezel">
        <div className="sld-ipad-screen">
          <div className="sld-ipad-header">
            <span className="sld-ipad-brand">AI Funding · Soft-pull pre-qual</span>
            <span className="sld-ipad-meta">FCRA · 0 impact</span>
          </div>
          <div className="sld-ipad-title">Quick pre-qual</div>
          <div className="sld-ipad-sub">Takes 10 seconds. Your score is unchanged.</div>
          <div className="sld-ipad-form">
            {[
              { k: 'Last 4 of SSN', v: '••••' },
              { k: 'Date of birth', v: '04 / 12 / 1985' },
              { k: 'Annual income', v: '$96,000' },
              { k: 'Home address', v: '1418 Maple Dr, Austin TX' },
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
    { lender: 'BuildBank', monthly: '$436', term: '60 mo', tag: 'Best total cost', star: true },
    { lender: 'CoreCredit', monthly: '$480', term: '60 mo', tag: '2nd cheapest' },
    { lender: 'FinWise', monthly: '$510', term: '60 mo', tag: '3rd' },
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
        Ranked lowest-total-cost first · buyer picks · e-signs in 30s
      </div>
    </div>
  );
}

/** Bank-wire animation for Stage 5 — money flows lender → AI Funding → operator. */
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

/** 4-panel buyer storyboard for slide 11. */
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
      b: 'Buyer taps in last 4 of SSN, DOB, income, address on any device.',
      meta: '30 sec',
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
      b: 'Marketplace returns fundability tier with zero credit impact. FCRA-compliant.',
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
      b: 'Three ranked offers on one screen. Cheapest first. Best total cost is starred.',
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
      b: 'Buyer e-signs in-session. Funds settle merchant-direct in 48-72 hours.',
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
  // Quiet teal-only breakdown of where the $1.41M leaks.
  const rows = [
    {
      k: 'Lost close rate',
      sub: '~24 declined deals/yr · $48k avg ticket · 95%',
      v: '$1,094,400',
      pct: '77.7%',
    },
    {
      k: 'Filler delivery hours',
      sub: '~7 unfit sales calls/wk · 1.5 hr · $400/hr · 52',
      v: '$218,400',
      pct: '15.5%',
    },
    {
      k: 'Truck-roll + estimator costs',
      sub: 'fuel + opportunity cost on no-fund visits',
      v: '$96,000',
      pct: '6.8%',
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
          <div className="sld-money-row-sub">illustrative · mid-size operator</div>
        </div>
        <div className="sld-money-row-r">
          <div className="sld-money-row-v sld-money-row-v-total">$1.41M</div>
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
          <div className="sld-invoice-from">AI Funding · A vertical of EazePay</div>
          <div className="sld-invoice-meta">NMLS #4755691 · EIN 88-1234567</div>
        </div>
        <div className="sld-invoice-no">
          <div className="sld-invoice-no-k">Receipt</div>
          <div className="sld-invoice-no-v">RCP-2026-001</div>
        </div>
      </div>
      <div className="sld-invoice-period">Day 0 · Setup · Sample Operator Co.</div>
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
            <td>AI Funding platform · one-time setup</td>
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
      b: 'FORGE smart form deployed · NEXUS routes published · APEX wired to bureaus',
    },
    {
      d: 'Day 4-5',
      t: 'Live · first real traffic',
      b: 'Team trained on the partner portal · first funded buyer in days',
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
    { w: 'Week 2', t: 'First live buyer applications', icon: '✦' },
    { w: 'Day 30', t: 'First AI Funding invoice (only if you fund)', icon: '◷' },
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

/** Smart-routing (NEXUS) visualization — buyer avatar at left, NEXUS
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
          <span className="sld-funnel-stage-tag">02 · FORGE INTAKE</span>
          <span className="sld-funnel-stage-h">Smart form reshapes on partial answers</span>
          <span className="sld-funnel-stage-b">
            Deal type · ticket · contact — order rewritten by intent
          </span>
        </div>
        <div className="sld-funnel-connector" aria-hidden />
        <div className="sld-funnel-stage">
          <span className="sld-funnel-stage-tag">03 · APEX PRE-APPROVAL</span>
          <span className="sld-funnel-stage-h">Soft-pull pre-approval on every lead</span>
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
        NEXUS router · multi-stage
      </div>

      {/* Two-column branches — equal weight, flat, no 3D tilt */}
      <div className="sld-funnel-branches">
        <div className="sld-funnel-branch sld-funnel-branch-high">
          <div className="sld-funnel-branch-head">
            <span className="sld-funnel-branch-tag">HIGH-TICKET</span>
            <span className="sld-funnel-branch-crit">≥ 680 · ≥ $5k · DTI &lt; 40%</span>
          </div>
          <ol className="sld-funnel-branch-steps">
            <li>
              <span className="sld-funnel-step-n">01</span>
              <span className="sld-funnel-step-h">Filter by credit score</span>
            </li>
            <li>
              <span className="sld-funnel-step-n">02</span>
              <span className="sld-funnel-step-h">Filter by income</span>
            </li>
            <li>
              <span className="sld-funnel-step-n">03</span>
              <span className="sld-funnel-step-h">Filter by available credit</span>
            </li>
          </ol>
          <div className="sld-funnel-branch-outcome">Booked on calendar · pre-approved</div>
        </div>

        <div className="sld-funnel-branch sld-funnel-branch-low">
          <div className="sld-funnel-branch-head">
            <span className="sld-funnel-branch-tag">LOW-TICKET</span>
            <span className="sld-funnel-branch-crit">Below floor · still warm</span>
          </div>
          <ol className="sld-funnel-branch-steps">
            <li>
              <span className="sld-funnel-step-n">01</span>
              <span className="sld-funnel-step-h">Free guide / e-book</span>
            </li>
            <li>
              <span className="sld-funnel-step-n">02</span>
              <span className="sld-funnel-step-h">Low-ticket starter offer</span>
            </li>
            <li>
              <span className="sld-funnel-step-n">03</span>
              <span className="sld-funnel-step-h">Nurture · re-pull in 90 days</span>
            </li>
          </ol>
          <div className="sld-funnel-branch-outcome sld-funnel-branch-outcome-low">
            Routed back to high-ticket
          </div>
        </div>
      </div>
    </div>
  );
}

/** APEX result console — concrete artefact slide. Shows exactly what
 *  the Pre-Approval Agent returns for every lead within ~10 seconds of
 *  soft-pull. Three columns: Financial profile · Verdicts · Funding
 *  estimates. Designed to look like a real product UI, not a
 *  brochure, because reps drop this slide on prospects who ask
 *  "okay, but what do I actually see?". */
function ApexOutput(): JSX.Element {
  const totalEstimate = 15700 + 10400 + 2000; // 28,100
  const fmt = (n: number) => `$${n.toLocaleString('en-US')}`;
  return (
    <div className="sld-stack">
      <Reveal>
        <div className="sld-eyebrow">
          <span className="sld-eyebrow-dot" />
          APEX · Pre-approval result
        </div>
      </Reveal>
      <Reveal delay={120}>
        <h2 className="sld-h2">
          <span className="grad-blue-deep">This is what comes back</span>{' '}
          <span className="grad-blue">for every single lead.</span>
        </h2>
      </Reveal>
      <Reveal delay={240}>
        <p className="sld-sub">
          Soft-pull · FCRA-compliant · zero credit impact. APEX returns a complete pre-approval
          profile in under 10 seconds and writes it into your CRM. Your reps walk into the call
          already knowing the credit band, the available headroom, the qualifying programs, and the
          funding ceiling per program.
        </p>
      </Reveal>
      <Reveal delay={360}>
        <div className="sld-apex">
          <div className="sld-apex-head">
            <div className="sld-apex-head-l">
              <span className="sld-apex-glyph" aria-hidden>
                <svg viewBox="0 0 24 24">
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                  <circle cx="12" cy="12" r="4" fill="currentColor" opacity="0.25" />
                  <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                </svg>
              </span>
              <div>
                <div className="sld-apex-title">APEX · Pre-approval result</div>
                <div className="sld-apex-buyer">
                  <span className="sld-apex-buyer-k">buyer_id</span>
                  <span className="sld-apex-buyer-v">ezc_8f7a2c</span>
                  <span className="sld-apex-buyer-sep">·</span>
                  <span className="sld-apex-buyer-k">latency</span>
                  <span className="sld-apex-buyer-v">8.3s</span>
                </div>
              </div>
            </div>
            <div className="sld-apex-status">
              <span className="sld-apex-status-dot" />
              APPROVED
            </div>
          </div>

          <div className="sld-apex-grid">
            <div className="sld-apex-col">
              <div className="sld-apex-col-h">Financial profile</div>
              <div className="sld-apex-row">
                <span className="sld-apex-k">Income</span>
                <span className="sld-apex-v">{fmt(54999)}</span>
              </div>
              <div className="sld-apex-row">
                <span className="sld-apex-k">Available credit</span>
                <span className="sld-apex-v">{fmt(34849)}</span>
              </div>
              <div className="sld-apex-row">
                <span className="sld-apex-k">Credit score</span>
                <span className="sld-apex-v sld-apex-v-strong">772</span>
              </div>
              <div className="sld-apex-row">
                <span className="sld-apex-k">DTI</span>
                <span className="sld-apex-v">1%</span>
              </div>
            </div>

            <div className="sld-apex-col">
              <div className="sld-apex-col-h">Pre-qualification</div>
              <div className="sld-apex-row">
                <span className="sld-apex-k">Merchant Direct</span>
                <span className="sld-apex-pill sld-apex-pill-yes">
                  <span className="sld-apex-pill-dot" /> Yes
                </span>
              </div>
              <div className="sld-apex-row">
                <span className="sld-apex-k">Consumer Direct</span>
                <span className="sld-apex-pill sld-apex-pill-yes">
                  <span className="sld-apex-pill-dot" /> Yes
                </span>
              </div>
              <div className="sld-apex-row">
                <span className="sld-apex-k">BNPL</span>
                <span className="sld-apex-pill sld-apex-pill-yes">
                  <span className="sld-apex-pill-dot" /> Yes
                </span>
              </div>
              <div className="sld-apex-row">
                <span className="sld-apex-k">Disqualify reason</span>
                <span className="sld-apex-v sld-apex-v-muted">N/A</span>
              </div>
            </div>

            <div className="sld-apex-col">
              <div className="sld-apex-col-h">Funding estimates</div>
              <div className="sld-apex-row">
                <span className="sld-apex-k">Merchant Direct</span>
                <span className="sld-apex-v sld-apex-v-money">{fmt(15700)}</span>
              </div>
              <div className="sld-apex-row">
                <span className="sld-apex-k">Consumer Direct</span>
                <span className="sld-apex-v sld-apex-v-money">{fmt(10400)}</span>
              </div>
              <div className="sld-apex-row">
                <span className="sld-apex-k">BNPL</span>
                <span className="sld-apex-v sld-apex-v-money">{fmt(2000)}</span>
              </div>
              <div className="sld-apex-row sld-apex-row-total">
                <span className="sld-apex-k">Total potential</span>
                <span className="sld-apex-v sld-apex-v-total">{fmt(totalEstimate)}</span>
              </div>
            </div>
          </div>

          <div className="sld-apex-foot">
            <span className="sld-apex-foot-dot" />
            Returned to FORGE in 8.3s · streamed to your CRM · logged for audit
          </div>
        </div>
      </Reveal>
      <Reveal delay={480}>
        <div className="sld-mini-stats">
          <MiniStat v="< 10s" k="Decision time" />
          <MiniStat v="0" k="Credit impact" />
          <MiniStat v="3 programs" k="Quoted in parallel" />
          <MiniStat v="100%" k="Of inbound leads" />
        </div>
      </Reveal>
      <Reveal delay={600}>
        <p className="sld-takeaway">
          For the rep: no more guessing. The screen above is in your CRM before the buyer hangs up
          the form. You open the call with the right program and the right number, not a discovery
          question.
        </p>
      </Reveal>
    </div>
  );
}

/** Smartphone mockup — used to show the buyer continuing the flow
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
              <span className="sld-phone-card-dot" /> AI Funding · approved
            </div>
            <div className="sld-phone-card-amount">$12,000</div>
            <div className="sld-phone-card-meta">$12k project · approved</div>
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
          <div className="sld-phone-tip">Picked up where you left off at the sales call.</div>
        </div>
      </div>
    </div>
  );
}

/** Vertical-specific slide — reusable for Dental, Med Spa, Derm/Vet/Vision.
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
    { n: '01', t: 'What is AI Funding', s: 'The product in one sentence' },
    { n: '02', t: 'Who it’s for', s: 'Your vertical, your buyer profile' },
    { n: '03', t: 'The problem', s: 'Why your close rate is leaking' },
    { n: '04', t: 'The solution', s: 'How the platform actually works' },
    { n: '05', t: 'The transformation', s: 'What 12 months of AI Funding looks like' },
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
            <span className="grad-blue-deep">Here&apos;s what we&apos;ll cover</span>{' '}
            <span className="grad-blue">in the next 45 minutes.</span>
          </h1>
        </Reveal>
        <Reveal delay={240}>
          <p className="sld-sub">
            Six chapters. By the end you&apos;ll know exactly what AI Funding is, how it works, who
            it&apos;s for, what it costs, and the path from today to your first funded buyer.
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
      name: 'Healthcare + elective',
      ticket: '$2k – $50k',
      who: 'Dental, med spa, derm, vet, vision, surgical',
    },
    {
      code: 'V02',
      name: 'Home services',
      ticket: '$3k – $30k',
      who: 'HVAC, roofing, restoration, pool, landscaping, plumbing',
    },
    {
      code: 'V03',
      name: 'Solar + clean energy',
      ticket: '$10k – $80k',
      who: 'Residential solar, batteries, EV chargers, home electrification',
    },
    {
      code: 'V04',
      name: 'Construction + remodel',
      ticket: '$5k – $100k',
      who: 'Kitchen + bath, additions, ADUs, custom builds, contractors',
    },
    {
      code: 'V05',
      name: 'Coaching + pro services',
      ticket: '$2k – $40k',
      who: 'Coaches, masterminds, trade schools, legal + immigration, consultants',
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
          <span className="grad-blue-deep">Built for high-ticket,</span>{' '}
          <span className="grad-blue">advisory-sale businesses.</span>
        </h2>
      </Reveal>
      <Reveal delay={240}>
        <p className="sld-sub">
          Anywhere a buyer sits down, hears a number, and has to decide on the spot &mdash;
          that&apos;s our sweet spot. Five verticals today. Same platform, same flow, same
          merchant-direct payout. Just the deal stories change.
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
            Low-ticket retail · single-visit walk-ins · sub-$500 tickets. We don&apos;t replace a
            credit-card terminal &mdash; we replace the cash-flow objection that walks out of every
            high-ticket sales conversation.
          </span>
        </div>
      </Reveal>
    </div>
  );
}

/** Five autonomous agents · one platform. Grid of agents with
 *  role, what-they-watch, and output. Compliance is an always-on
 *  overlay, not a slot in this grid — covered separately by the
 *  Security + compliance slide. */
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
      code: 'APEX',
      role: 'Pre-Approval Agent',
      watches: 'Soft-pull on every lead · FCRA-compliant',
      output: 'Credit · available credit · income · DTI · pre-approval $',
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
      code: 'FORGE',
      role: 'Data Agent',
      watches: 'Form behaviour + financial signals',
      output: 'Reshapes the form · structures the data · enriches every signal',
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
      role: 'Routing Agent',
      watches: 'Lender appetite + tier-fit + approval velocity',
      output: 'Routes the buyer to the right lender first time',
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
      code: 'CLOSE',
      role: 'Sales Agent',
      watches: 'Buyer hesitation · objections · drop-off triggers',
      output: 'Handles the payment conversation · books the call · revives ghosts',
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
      code: 'VAULT',
      role: 'Funding Agent',
      watches: 'Lender disbursement state · payout windows · ACH timing',
      output: 'Pushes funds merchant-direct · ledger entry per payout',
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
          <span className="grad-blue-deep">5 autonomous agents.</span>{' '}
          <span className="grad-blue">One platform.</span>
        </h2>
      </Reveal>
      <Reveal delay={240}>
        <p className="sld-sub">
          AI Funding is a stack of five specialised agents working in parallel on every buyer
          session &mdash; pre-approval, data + smart forms, lender routing, sales conversation, and
          merchant funding. Every agent is named, observable, and logged. Compliance audit (FCRA /
          ECOA / TILA) runs as an always-on overlay across the stack.
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

/** BEACON pixel attribution — deep dive on the "fire on funded job"
 *  feedback loop. */
function EchoPixel(): JSX.Element {
  return (
    <div className="sld-stack">
      <Reveal>
        <div className="sld-eyebrow">
          <span className="sld-eyebrow-dot" />
          BEACON · Pixel attribution
        </div>
      </Reveal>
      <Reveal delay={120}>
        <h2 className="sld-h2">
          <span className="grad-blue-deep">Stop training your pixel</span>{' '}
          <span className="grad-blue">on form fillers.</span>
        </h2>
      </Reveal>
      <Reveal delay={240}>
        <p className="sld-sub">
          Today, your Meta and Google ad pixels fire on a Page View, a Lead, or a Form Submit. Most
          of those leads never fund. Your algorithm optimises for garbage and your CPA drifts up
          month over month. BEACON breaks the loop.
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
            <span className="sld-echo-3d-h">Funded buyer</span>
            <span className="sld-echo-3d-sub">BEACON holds the pixel until cash settles</span>
          </div>
          <div className="sld-echo-3d-stream" aria-hidden>
            <svg viewBox="0 0 400 140" preserveAspectRatio="none">
              <defs>
                <linearGradient id="echoBeam" x1="0" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(139, 92, 246, 0.0)" />
                  <stop offset="50%" stopColor="rgba(139, 92, 246, 0.55)" />
                  <stop offset="100%" stopColor="rgba(139, 92, 246, 0.0)" />
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
              <circle cx="200" cy="70" r="3" fill="var(--af-blue-2)" opacity="0.7" />
              <circle cx="100" cy="100" r="2" fill="var(--af-blue)" opacity="0.4" />
              <circle cx="300" cy="32" r="2.5" fill="var(--af-blue-2)" opacity="0.85" />
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
            BEACON holds the pixel until stage 05 fires. The weighted conversion that returns to
            Meta, Google, and TikTok is a real funded buyer — not a form-fill. Your algorithm
            retrains on the right buyer profile.
          </div>
        </div>
      </Reveal>
    </div>
  );
}

/** Compound effect — 12-month growth chart showing what cumulative
 *  AI Funding revenue + lead-quality improvement looks like. */
function CompoundEffect(): JSX.Element {
  // 12 monthly points: revenue uplift (cumulative) + CPA reduction
  const months = [
    { m: 'M01', rev: 14, cpa: 0 },
    { m: 'M02', rev: 32, cpa: -4 },
    { m: 'M03', rev: 54, cpa: -9 },
    { m: 'M04', rev: 81, cpa: -14 },
    { m: 'M05', rev: 113, cpa: -19 },
    { m: 'M06', rev: 148, cpa: -25 },
    { m: 'M07', rev: 186, cpa: -29 },
    { m: 'M08', rev: 226, cpa: -32 },
    { m: 'M09', rev: 268, cpa: -34 },
    { m: 'M10', rev: 311, cpa: -36 },
    { m: 'M11', rev: 354, cpa: -37 },
    { m: 'M12', rev: 398, cpa: -38 },
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
          <span className="grad-blue">Better data in</span>{' '}
          <span className="grad-blue-deep">means cheaper, better leads out.</span>
        </h2>
      </Reveal>
      <Reveal delay={240}>
        <p className="sld-sub">
          AI Funding does not just close more buyers today. It compounds. Each funded buyer
          re-trains your pixel. The pixel sends better leads. Better leads close at a higher rate.
          The cycle accelerates. Twelve months in, the business is unrecognisable.
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
                ~$398k by month 12 · mid-size operator · illustrative
              </div>
            </div>
            <div>
              <div className="sld-comp-legend-k">CPA trajectory</div>
              <div className="sld-comp-legend-v">
                −38% by month 12 · driven by funded-event pixel retraining
              </div>
            </div>
          </div>
        </div>
      </Reveal>
      <Reveal delay={480}>
        <div className="sld-mini-stats">
          <MiniStat v="~$398k" k="Cum. recovered / yr" />
          <MiniStat v="−38%" k="CPA by month 12" />
          <MiniStat v="2.4×" k="Funded buyers / 1k spend" />
          <MiniStat v="+27%" k="Form completion (vs. M01)" />
        </div>
      </Reveal>
    </div>
  );
}

/** Full value stack — what you actually get with AI Funding, side-by-side
 *  with "if you bought separately" cost. The most important slide for
 *  the close — anchors price perception. */
function ValueStack(): JSX.Element {
  const groups: Array<{ head: string; items: string[]; alt: string }> = [
    {
      head: 'Pre-qualification layer',
      items: [
        'APEX soft-pull pre-approval (FCRA-compliant)',
        'Last-4-SSN + DOB + income in-session',
        'FORGE smart-form intake (−41% drop-off)',
        'Real-time signal scoring · pre-approval $',
      ],
      alt: '$2,400 / mo · standalone form + scoring vendor',
    },
    {
      head: 'Lender marketplace',
      items: [
        'Parallel quoting across the marketplace',
        'NEXUS routing · ranked total-cost',
        'Adaptive routing by credit + income tier',
        'Ticket coverage from $1k to $100k',
      ],
      alt: '$1,800 / mo + 1.5% take-rate · single-lender programs',
    },
    {
      head: 'Sales + ops layer',
      items: [
        'CLOSE Sales Agent handles the payment conversation',
        'Capacity + geo + ticket-fit matching',
        'Smartphone continuity for off-site signing',
        'VAULT merchant-direct ACH disbursement',
      ],
      alt: '$1,200 / mo · routing tool + payment processor',
    },
    {
      head: 'Pixel + attribution',
      items: [
        'Funded-event pixel retraining',
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
          <span className="grad-blue-deep">Everything you get</span>{' '}
          <span className="grad-blue">in one platform.</span>
        </h2>
      </Reveal>
      <Reveal delay={240}>
        <p className="sld-sub">
          AI Funding replaces a stack of six vendors that most operators duct-tape together.
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
            <span className="sld-stack-total-k">AI Funding</span>
            <span className="sld-stack-total-v">
              $10,000 one-time · $3 / lead · 4% of settled loans
            </span>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

/** Trusted by 2,000+ businesses — enterprise social proof slide.
 *  Goes right after "Who it's for" so the prospect knows AI Funding
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
          <span className="grad-blue-deep">Over 2,000 US businesses</span>{' '}
          <span className="grad-blue">already run on AI Funding.</span>
        </h2>
      </Reveal>
      <Reveal delay={240}>
        <p className="sld-sub">
          We&apos;ve been in market with healthcare practices, home-services crews, solar
          installers, construction contractors and coaching programs since launch. The platform is
          hardened, the lender panel is live, and the support team is staffed for scale.
        </p>
      </Reveal>
      <Reveal delay={360}>
        <div className="sld-trust-hero">
          <div className="sld-trust-hero-row">
            <div>
              <div className="sld-trust-hero-v">
                <AnimatedCounter to={2000} suffix="+" />
              </div>
              <div className="sld-trust-hero-k">Businesses live</div>
            </div>
            <div>
              <div className="sld-trust-hero-v">
                $<AnimatedCounter to={300} suffix="M+" />
              </div>
              <div className="sld-trust-hero-k">Sales funded to date</div>
            </div>
            <div>
              <div className="sld-trust-hero-v">
                <AnimatedCounter to={18600} suffix="+" />
              </div>
              <div className="sld-trust-hero-k">Buyers financed</div>
            </div>
            <div>
              <div className="sld-trust-hero-v">5</div>
              <div className="sld-trust-hero-k">Verticals supported</div>
            </div>
          </div>
        </div>
      </Reveal>
      <Reveal delay={480}>
        <div className="sld-section-title">Where AI Funding is running today</div>
      </Reveal>
      <Reveal delay={540}>
        <div className="sld-trust-tiles">
          {[
            'Healthcare — 720+ practices',
            'Home services — 480+ crews',
            'Solar + clean energy — 320+ installers',
            'Construction — 280+ contractors',
            'Coaching + pro services — 200+ programs',
            'All 50 US states',
            'NMLS #4755691',
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
          <span className="grad-blue-deep">Buyers walk in</span>
          <br />
          <span className="grad-blue">curious.</span>{' '}
          <span className="grad-blue-deep">They walk out funded.</span>
        </h2>
      </Reveal>
      <Reveal delay={240}>
        <p className="sld-sub sld-finale-sub">
          $10,000 to set up. $3 per smart-form lead. 4% of loans that actually settle. Live in up to
          five business days. 2,000+ businesses already running on AI Funding.
        </p>
      </Reveal>
      <Reveal delay={360}>
        <div className="sld-finale-ctas sld-finale-ctas-single">
          <a href="/ai-funding/checkout" className="sld-finale-primary">
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
          NMLS&nbsp;#4755691 · FCRA · ECOA · TILA · 2,000+ businesses · $10k setup · $3 / lead · 4%
          settled
        </div>
      </Reveal>
    </div>
  );
}

/** Interactive economics slide — 5 sliders covering the full funnel,
 *  with the actual math shown as a formula below each output. */
function EconomicsSlide(): JSX.Element {
  const [leads, setLeads] = useState(180);
  const [qualPct, setQualPct] = useState(50);
  const [ticket, setTicket] = useState(8000);
  // Close rates are tunable — defaults match a typical industry baseline
  // and a conservative AI Funding uplift.
  const [closeWithout, setCloseWithout] = useState(18);
  const [closeWith, setCloseWith] = useState(70);
  // What share of accepted offers actually fund (lender approval × buyer
  // accepts the offer). 100% on the without-AI Funding side because the existing
  // "close" rate already includes funding by definition there.
  const [fundPct, setFundPct] = useState(70);

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
          <span className="grad-blue">Drag the funnel.</span>{' '}
          <span className="grad-blue-deep">Watch the math.</span>
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
                min={3000}
                max={25000}
                step={500}
                value={ticket}
                onChange={(e) => setTicket(Number(e.target.value))}
              />
            </div>
            <div className="sld-econ-input">
              <label>
                Close % · without AI Funding{' '}
                <span className="sld-econ-input-v">{closeWithout}%</span>
              </label>
              <input
                type="range"
                min={5}
                max={40}
                step={1}
                value={closeWithout}
                onChange={(e) => setCloseWithout(Number(e.target.value))}
              />
            </div>
            <div className="sld-econ-input">
              <label>
                Close % · with AI Funding <span className="sld-econ-input-v">{closeWith}%</span>
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
              <div className="sld-econ-eyebrow">Without AI Funding</div>
              <div className="sld-econ-num">{fmt(revWithout)}</div>
              <div className="sld-econ-sub">Recovered revenue / yr</div>
              <div className="sld-econ-sub-sm">
                {fundedWithout.toLocaleString('en-US')} funded buyers / mo
              </div>
              <div className="sld-econ-math">
                {leads} leads × {qualPct}% qualified × {closeWithout}% close = {fundedWithout}/mo
                <br />
                {fundedWithout} × ${ticket.toLocaleString('en-US')} × 12 ={' '}
                <strong>{fmt(revWithout)}</strong>
              </div>
            </div>
            <div className="sld-econ-card with">
              <div className="sld-econ-eyebrow accent">With AI Funding</div>
              <div className="sld-econ-num accent">{fmt(revWith)}</div>
              <div className="sld-econ-sub">Recovered revenue / yr</div>
              <div className="sld-econ-sub-sm">
                {fundedWith.toLocaleString('en-US')} funded buyers / mo
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
            <span className="sld-econ-delta-sub">illustrative · varies by operator</span>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

/* ================================ main page ============================== */

export default function AIFundingSalesDeck(): JSX.Element {
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
        <div className="sld-brand">AI Funding · Sales deck</div>
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
  --af-blue: #3B82F6;
  --af-violet: #8B5CF6;
  --af-light: #EEF2FF;
  --af-deep: #0B1224;
  --af-ink: #0F172A;
  --af-ink-2: #1E293B;
  --af-mute: #475569;
  --af-line: rgba(59, 130, 246, 0.12);
  --af-line-strong: rgba(59, 130, 246, 0.22);

  position: relative;
  background: linear-gradient(180deg, #EEF2FF 0%, #FFFFFF 30%, #F5F3FF 65%, #FFFFFF 100%);
  color: var(--af-ink);
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
    radial-gradient(ellipse 60% 40% at 15% 20%, rgba(139, 92, 246, 0.16) 0%, transparent 60%),
    radial-gradient(ellipse 50% 60% at 85% 30%, rgba(59, 130, 246, 0.12) 0%, transparent 55%),
    radial-gradient(ellipse 70% 50% at 50% 90%, rgba(139, 92, 246, 0.10) 0%, transparent 55%);
  animation: sldMeshDrift 24s ease-in-out infinite;
}
@keyframes sldMeshDrift {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(-30px, 20px) scale(1.05); }
  66% { transform: translate(20px, -10px) scale(0.98); }
}

/* ===== Gradient text utilities ===== */
.sld-root .grad-blue {
  background: linear-gradient(120deg, var(--af-blue) 0%, var(--af-blue-2) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.sld-root .grad-blue-deep {
  background: linear-gradient(120deg, var(--af-deep) 0%, var(--af-blue) 100%);
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
  font-weight: 700; color: var(--af-mute);
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
  color: var(--af-blue);
  text-transform: uppercase;
  padding: 6px 14px;
  background: rgba(139, 92, 246, 0.10);
  border: 1px solid var(--af-line);
  border-radius: 999px;
  align-self: flex-start;
}
.sld-eyebrow-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--af-blue-2);
  box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.5);
  animation: sldPulse 1.6s ease-in-out infinite;
}
@keyframes sldPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.5); }
  50% { box-shadow: 0 0 0 8px rgba(139, 92, 246, 0); }
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
  color: var(--af-ink-2);
}
.sld-sub {
  font-size: 19px; line-height: 1.55;
  color: var(--af-ink-2);
  max-width: 800px;
  margin: 0;
}
.sld-sub strong { color: var(--af-blue); font-weight: 700; }
.sld-count { font-variant-numeric: tabular-nums; }

/* ===== Trust chips row ===== */
.sld-chips {
  display: flex; flex-wrap: wrap; gap: 8px;
  margin-top: 12px;
}
.sld-chip {
  display: inline-flex; align-items: center;
  font-size: 12px; letter-spacing: 0.04em;
  color: var(--af-ink-2);
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.75);
  border: 1px solid var(--af-line);
  border-radius: 999px;
}

/* ===== Hero stat row ===== */
.sld-hero-stat-row {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-top: 16px;
  padding: 20px 0;
  border-top: 1px solid var(--af-line);
}
.sld-hero-stat {}
.sld-hero-stat-v {
  font-size: 30px; font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--af-ink);
}
.sld-hero-stat-k {
  margin-top: 4px;
  font-size: 11px; letter-spacing: 0.14em;
  color: var(--af-mute);
  text-transform: uppercase;
  font-weight: 600;
}

/* ===== Stat row (slide 02 etc.) ===== */
.sld-stat-row {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: var(--af-line);
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--af-line);
  margin-top: 8px;
}
.sld-stat {
  background: rgba(255, 255, 255, 0.85);
  padding: 22px 24px;
}
.sld-stat-v {
  font-size: 36px; font-weight: 800; letter-spacing: -0.025em;
  color: var(--af-ink);
  line-height: 1;
}
.sld-stat-k {
  margin-top: 6px;
  font-size: 12px; color: var(--af-mute); line-height: 1.4;
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
  border: 1px solid var(--af-line);
}
.sld-vs-med {
  background:
    radial-gradient(ellipse 80% 100% at 100% 0%, rgba(139, 92, 246, 0.16), transparent 70%),
    rgba(255, 255, 255, 0.95);
  border-color: var(--af-line-strong);
  box-shadow: 0 22px 50px -28px rgba(59, 130, 246, 0.30);
}
.sld-vs-eyebrow {
  font-size: 11px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--af-mute);
  text-transform: uppercase;
  margin-bottom: 18px;
}
.sld-vs-eyebrow.accent { color: var(--af-blue); }
.sld-vs-side ul { list-style: none; padding: 0; margin: 0; }
.sld-vs-side li {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 0;
  border-bottom: 1px dashed var(--af-line);
  font-size: 15px; color: var(--af-ink-2);
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
  background: rgba(139, 92, 246, 0.18);
  color: var(--af-blue);
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
    radial-gradient(ellipse 80% 60% at 0% 0%, rgba(139, 92, 246, 0.10), transparent 65%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.97) 0%, rgba(248, 253, 252, 0.97) 100%);
  border: 1px solid var(--af-line-strong);
  border-radius: 22px;
  padding: 26px 26px 22px;
  box-shadow:
    0 22px 60px -32px rgba(59, 130, 246, 0.28),
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
  background: radial-gradient(circle at 50% 110%, rgba(139, 92, 246, 0.20), transparent 60%);
  opacity: 0;
  transition: opacity 0.35s ease;
  pointer-events: none;
}
.sld-pillar:hover {
  transform: translateY(-6px) rotateX(2deg);
  box-shadow:
    0 36px 80px -32px rgba(59, 130, 246, 0.40),
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
  color: var(--af-blue);
  background: rgba(139, 92, 246, 0.10);
  border: 1px solid rgba(59, 130, 246, 0.20);
  border-radius: 6px;
}
.sld-pillar-metric {
  margin-top: 12px;
  font-size: 40px; font-weight: 700;
  letter-spacing: -0.038em;
  line-height: 1;
  background: linear-gradient(135deg, var(--af-deep) 0%, var(--af-blue) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  font-variant-numeric: tabular-nums;
}
.sld-pillar-h {
  margin-top: 10px;
  font-size: 20px; font-weight: 600;
  letter-spacing: -0.018em;
  color: var(--af-ink);
}
.sld-pillar-b {
  margin-top: 6px;
  font-size: 13.5px; color: var(--af-ink-2); line-height: 1.55;
}
.sld-pillar-tags {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px dashed var(--af-line);
  display: flex; flex-wrap: wrap;
  gap: 6px;
}
.sld-pillar-tag {
  font-size: 10.5px; letter-spacing: 0.04em;
  font-weight: 600;
  color: var(--af-blue);
  background: rgba(139, 92, 246, 0.08);
  border: 1px solid rgba(59, 130, 246, 0.16);
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
  border: 1px solid var(--af-line-strong);
  border-radius: 28px;
  box-shadow: 0 30px 80px -32px rgba(59, 130, 246, 0.30);
  position: relative; overflow: hidden;
}
.sld-stage-row::before {
  content: '';
  position: absolute; top: -40%; right: -10%;
  width: 360px; height: 360px;
  background: radial-gradient(circle, rgba(139, 92, 246, 0.18), transparent 65%);
  pointer-events: none;
}
.sld-stage-metric {
  border-right: 1px solid var(--af-line);
  padding-right: 36px;
  position: relative;
}
.sld-stage-metric-v {
  font-size: 64px; font-weight: 800;
  letter-spacing: -0.035em;
  background: linear-gradient(135deg, var(--af-deep) 0%, var(--af-blue) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  line-height: 1;
}
.sld-stage-metric-l {
  margin-top: 10px;
  font-size: 11px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--af-mute);
  text-transform: uppercase;
}
.sld-stage-body {
  font-size: 17px; color: var(--af-ink-2); line-height: 1.6;
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
  border: 1px solid var(--af-line-strong);
  border-radius: 24px;
  padding: 26px;
  box-shadow:
    0 60px 110px -50px rgba(59, 130, 246, 0.55),
    0 30px 60px -30px rgba(59, 130, 246, 0.35),
    0 1px 0 rgba(255, 255, 255, 1) inset;
}
.sld-mock-head {
  display: flex; align-items: center; justify-content: space-between;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--af-line);
}
.sld-mock-pill {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 10.5px; letter-spacing: 0.20em; font-weight: 700;
  color: var(--af-blue);
  text-transform: uppercase;
  padding: 4px 10px;
  background: rgba(139, 92, 246, 0.12);
  border-radius: 999px;
}
.sld-mock-pill-dot {
  width: 5px; height: 5px; border-radius: 999px;
  background: var(--af-blue-2);
}
.sld-mock-meta {
  font-size: 9px; letter-spacing: 0.18em;
  color: var(--af-mute);
  text-transform: uppercase;
  padding: 3px 8px;
  background: rgba(15, 23, 42, 0.04);
  border-radius: 6px;
}
.sld-mock-project {
  margin-top: 14px;
  font-size: 10.5px; letter-spacing: 0.22em;
  color: var(--af-mute);
  text-transform: uppercase;
}
.sld-mock-amount {
  margin-top: 4px;
  font-size: 44px; font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--af-ink);
  font-variant-numeric: tabular-nums;
  display: flex; align-items: baseline; gap: 12px;
}
.sld-mock-amount-sub {
  font-size: 12px; font-weight: 600;
  color: var(--af-blue);
  text-transform: uppercase;
  letter-spacing: 0.18em;
}
.sld-mock-rows {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--af-line);
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 18px;
}
.sld-mock-k {
  font-size: 9px; letter-spacing: 0.20em;
  color: var(--af-mute);
  text-transform: uppercase;
  font-weight: 600;
}
.sld-mock-v {
  margin-top: 4px;
  font-size: 14px; font-weight: 600;
  color: var(--af-ink);
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
  background: linear-gradient(90deg, var(--af-deep) 0%, var(--af-blue-2) 100%);
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
  color: var(--af-mute);
  text-transform: uppercase;
  font-weight: 600;
}
.sld-mock-stages .on { color: var(--af-blue); }
.sld-mock-stages .cur {
  color: var(--af-deep);
  position: relative;
}
.sld-mock-stages .cur::after {
  content: '';
  position: absolute; bottom: -4px; left: 50%;
  transform: translateX(-50%);
  width: 4px; height: 4px; border-radius: 999px;
  background: var(--af-blue-2);
}
.sld-mock-cta {
  margin-top: 18px;
  padding: 13px 16px;
  text-align: center;
  background: linear-gradient(135deg, var(--af-deep) 0%, var(--af-blue) 100%);
  color: #fff;
  border-radius: 12px;
  font-size: 13.5px; font-weight: 700;
  letter-spacing: 0.02em;
}
.sld-mock-foot {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--af-line);
  font-size: 10px; letter-spacing: 0.14em;
  color: var(--af-mute);
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
  background: var(--af-blue-2);
  box-shadow: 0 0 6px rgba(139, 92, 246, 0.5);
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
 * LEFT: the single application submitted by the buyer.
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
  color: var(--af-blue);
  text-transform: uppercase;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
}
.sld-mp-app-card {
  padding: 16px;
  background:
    radial-gradient(ellipse 80% 100% at 0% 0%, rgba(139, 92, 246, 0.10), transparent 70%),
    rgba(255, 255, 255, 0.96);
  border: 1px solid var(--af-line-strong);
  border-radius: 14px;
  box-shadow:
    0 22px 50px -28px rgba(59, 130, 246, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.95);
  display: flex; flex-direction: column; gap: 8px;
}
.sld-mp-app-row {
  display: flex; align-items: baseline; justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px dashed var(--af-line);
  font-size: 12.5px;
}
.sld-mp-app-row:last-child { border-bottom: none; }
.sld-mp-app-k { color: var(--af-mute); }
.sld-mp-app-v {
  font-weight: 600;
  color: var(--af-ink);
  font-variant-numeric: tabular-nums;
}
.sld-mp-app-sig {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 11px;
  color: var(--af-mute);
}
.sld-mp-app-sig-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--af-blue-2);
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
  border: 1px solid var(--af-line);
  border-radius: 16px;
  box-shadow: 0 22px 50px -28px rgba(59, 130, 246, 0.25);
}
.sld-mp-quotes-eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 10.5px; letter-spacing: 0.20em; font-weight: 700;
  color: var(--af-blue);
  text-transform: uppercase;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  margin-bottom: 4px;
}
.sld-mp-quotes-pulse {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--af-blue-2);
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
  border: 1px solid var(--af-line);
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
    radial-gradient(ellipse 80% 120% at 100% 50%, rgba(139, 92, 246, 0.28), transparent 70%),
    linear-gradient(135deg, var(--af-deep) 0%, #1E3A8A 100%);
  border-color: rgba(139, 92, 246, 0.45);
  color: #fff;
  box-shadow:
    0 18px 36px -20px rgba(59, 130, 246, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.10);
}
.sld-mp-quote-rank {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 11px; font-weight: 700;
  color: var(--af-blue);
}
.sld-mp-quote.is-winner .sld-mp-quote-rank { color: var(--af-blue-2); }
.sld-mp-quote-body {
  display: flex; flex-direction: column; gap: 1px;
}
.sld-mp-quote-lender {
  font-size: 13px; font-weight: 600;
  color: var(--af-ink);
  letter-spacing: -0.01em;
}
.sld-mp-quote.is-winner .sld-mp-quote-lender { color: #fff; }
.sld-mp-quote-meta {
  font-size: 11px;
  color: var(--af-mute);
}
.sld-mp-quote.is-winner .sld-mp-quote-meta { color: rgba(255, 255, 255, 0.70); }
.sld-mp-quote-mo {
  font-size: 14px; font-weight: 700;
  color: var(--af-ink);
  letter-spacing: -0.015em;
}
.sld-mp-quote.is-winner .sld-mp-quote-mo { color: #fff; }
.sld-mp-quote-star {
  position: absolute;
  top: 50%; right: -8px;
  transform: translateY(-50%);
  width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, var(--af-blue-2) 0%, var(--af-blue) 100%);
  color: #0B1224;
  border-radius: 999px;
  font-size: 12px;
  box-shadow: 0 6px 14px -4px rgba(59, 130, 246, 0.55);
}
.sld-mp-quotes-foot {
  margin-top: 6px;
  padding-top: 10px;
  border-top: 1px dashed var(--af-line);
  display: flex; justify-content: space-between; align-items: baseline;
  font-size: 12px;
}
.sld-mp-quotes-foot-k {
  color: var(--af-mute);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 10.5px; font-weight: 700;
}
.sld-mp-quotes-foot-v {
  color: var(--af-deep);
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
  color: var(--af-ink-2);
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
  background: linear-gradient(90deg, var(--af-deep) 0%, var(--af-blue-2) 100%);
}
.sld-bar-delta {
  padding: 18px 22px;
  border-radius: 14px;
  background:
    linear-gradient(90deg, rgba(139, 92, 246, 0.18) 0%, rgba(139, 92, 246, 0.06) 100%);
  border: 1px solid rgba(139, 92, 246, 0.35);
  display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap;
}
.sld-bar-delta-tag {
  font-size: 10px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--af-blue);
  text-transform: uppercase;
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(139, 92, 246, 0.22);
}
.sld-bar-delta-val {
  font-size: 22px; font-weight: 800;
  color: var(--af-ink);
  letter-spacing: -0.02em;
}
.sld-bar-delta-sub {
  font-size: 12px; color: var(--af-mute);
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
  border: 1px solid var(--af-line);
  border-radius: 12px;
}
.sld-econ-input label {
  display: flex; justify-content: space-between; align-items: baseline;
  font-size: 11.5px; font-weight: 600;
  color: var(--af-mute);
  letter-spacing: 0.03em;
  margin-bottom: 10px;
}
.sld-econ-input-v {
  font-size: 16px; font-weight: 700;
  color: var(--af-blue);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.012em;
}
.sld-econ-input input[type="range"] {
  -webkit-appearance: none; appearance: none;
  width: 100%; height: 6px;
  background: linear-gradient(90deg, var(--af-blue) 0%, var(--af-blue-2) 100%);
  border-radius: 999px;
  outline: none; cursor: pointer;
}
.sld-econ-input input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 22px; height: 22px;
  background: #fff;
  border: 3px solid var(--af-blue);
  border-radius: 999px;
  box-shadow: 0 6px 16px -4px rgba(59, 130, 246, 0.45);
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
  border: 1px solid var(--af-line);
}
.sld-econ-card.with {
  background:
    radial-gradient(ellipse 80% 100% at 100% 0%, rgba(139, 92, 246, 0.18), transparent 70%),
    rgba(255, 255, 255, 0.95);
  border-color: var(--af-line-strong);
}
.sld-econ-eyebrow {
  font-size: 11px; letter-spacing: 0.16em; font-weight: 700;
  color: var(--af-mute);
  text-transform: uppercase;
}
.sld-econ-eyebrow.accent { color: var(--af-blue); }
.sld-econ-num {
  margin-top: 12px;
  font-size: 48px; font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--af-ink);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.sld-econ-num.accent {
  background: linear-gradient(135deg, var(--af-deep) 0%, var(--af-blue-2) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.sld-econ-sub {
  margin-top: 8px;
  font-size: 13px; color: var(--af-ink-2);
}
.sld-econ-sub-sm {
  margin-top: 2px;
  font-size: 12px; color: var(--af-mute);
}
.sld-econ-math {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed var(--af-line);
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 11.5px; line-height: 1.55;
  color: var(--af-mute);
  font-variant-numeric: tabular-nums;
}
.sld-econ-math strong {
  color: var(--af-ink);
  font-weight: 700;
}
.sld-econ-math.accent strong {
  color: var(--af-blue);
}
.sld-econ-delta {
  padding: 18px 22px;
  border-radius: 14px;
  background:
    linear-gradient(90deg, rgba(139, 92, 246, 0.18) 0%, rgba(139, 92, 246, 0.06) 100%);
  border: 1px solid rgba(139, 92, 246, 0.35);
  display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap;
}
.sld-econ-delta-tag {
  font-size: 10px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--af-blue);
  text-transform: uppercase;
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(139, 92, 246, 0.22);
}
.sld-econ-delta-val {
  font-size: 22px; font-weight: 800;
  color: var(--af-ink);
  letter-spacing: -0.02em;
}
.sld-econ-delta-sub {
  font-size: 12px; color: var(--af-mute);
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
  border: 1px solid var(--af-line);
  border-radius: 20px;
  display: flex; flex-direction: column; gap: 16px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.sld-case:hover {
  transform: translateY(-3px);
  box-shadow: 0 24px 50px -28px rgba(59, 130, 246, 0.30);
}
.sld-case-tag {
  font-size: 10.5px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--af-blue);
  text-transform: uppercase;
}
.sld-case-quote {
  font-size: 18px; line-height: 1.5;
  color: var(--af-ink);
  margin: 0;
  font-style: italic;
}
.sld-case-outcomes {
  display: grid; grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  padding-top: 16px;
  border-top: 1px dashed var(--af-line);
}
.sld-case-v {
  font-size: 26px; font-weight: 800; letter-spacing: -0.025em;
  color: var(--af-blue);
  font-variant-numeric: tabular-nums;
}
.sld-case-l {
  font-size: 11px; letter-spacing: 0.16em;
  color: var(--af-mute);
  text-transform: uppercase;
  margin-top: 4px;
}
.sld-case-attrib {
  display: flex; align-items: center; gap: 12px;
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid var(--af-line);
}
.sld-case-avatar {
  width: 40px; height: 40px;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--af-deep), var(--af-blue));
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 700; letter-spacing: 0.05em;
}
.sld-case-name { font-size: 13px; font-weight: 600; color: var(--af-ink); }
.sld-case-role { font-size: 11px; color: var(--af-mute); }

/* ===== Vs table (slide 14) ===== */
.sld-vs-table {
  width: 100%;
  margin-top: 12px;
  border-collapse: separate;
  border-spacing: 0;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--af-line-strong);
  border-radius: 20px;
  overflow: hidden;
}
.sld-vs-table th, .sld-vs-table td {
  text-align: left;
  padding: 16px 22px;
  font-size: 14px;
  border-bottom: 1px solid var(--af-line);
  vertical-align: top;
}
.sld-vs-table th {
  font-size: 11px; letter-spacing: 0.16em; font-weight: 700;
  text-transform: uppercase;
  color: var(--af-mute);
  background: rgba(236, 255, 254, 0.5);
}
.sld-vs-table th.accent, .sld-vs-table td.accent {
  color: var(--af-blue);
  font-weight: 600;
}
.sld-vs-table tr:last-child td { border-bottom: none; }
.sld-vs-table tbody td:first-child {
  color: var(--af-mute);
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
  background: rgba(139, 92, 246, 0.18);
  color: var(--af-blue);
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
  border: 1px solid var(--af-line);
  border-radius: 16px;
}
.sld-trust-head {
  font-size: 16px; font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--af-blue);
  text-transform: uppercase;
}
.sld-trust-body {
  margin-top: 8px;
  font-size: 13px; color: var(--af-ink-2); line-height: 1.55;
}

/* ===== Pricing card ===== */
.sld-price-card {
  margin-top: 12px;
  max-width: 720px;
  margin-left: auto; margin-right: auto;
  padding: 8px 24px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--af-line-strong);
  border-radius: 20px;
  box-shadow: 0 22px 50px -28px rgba(59, 130, 246, 0.22);
}
.sld-price-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 18px 0;
  border-bottom: 1px dashed var(--af-line);
}
.sld-price-row:last-child { border-bottom: none; }
.sld-price-k {
  font-size: 13px; color: var(--af-mute);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-weight: 600;
}
.sld-price-v { font-size: 18px; font-weight: 700; color: var(--af-ink); }

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
  border: 1px solid var(--af-line);
  border-bottom: none;
}
.sld-steps li:first-child {
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
}
.sld-steps li:last-child {
  border-bottom: 1px solid var(--af-line);
  border-bottom-left-radius: 16px;
  border-bottom-right-radius: 16px;
}
.sld-step-n {
  font-size: 28px; font-weight: 800;
  letter-spacing: -0.025em;
  background: linear-gradient(135deg, var(--af-deep), var(--af-blue));
  -webkit-background-clip: text; background-clip: text; color: transparent;
  font-variant-numeric: tabular-nums;
}
.sld-step-h { font-size: 17px; font-weight: 700; color: var(--af-ink); }
.sld-step-b {
  margin-top: 4px;
  font-size: 13.5px; color: var(--af-ink-2); line-height: 1.55;
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
  border: 1px solid var(--af-line-strong);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.sld-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 24px 50px -28px rgba(59, 130, 246, 0.30);
}
.sld-cta-primary {
  background: linear-gradient(180deg, var(--af-deep) 0%, #1E3A8A 100%);
  color: #fff;
  border-color: transparent;
}
.sld-cta-secondary {
  background: rgba(255, 255, 255, 0.95);
  color: var(--af-ink);
}
.sld-cta-eyebrow {
  font-size: 10.5px; letter-spacing: 0.20em; font-weight: 700;
  text-transform: uppercase;
  color: var(--af-blue-2);
}
.sld-cta-secondary .sld-cta-eyebrow { color: var(--af-blue); }
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
  color: var(--af-mute);
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
  border: 1px solid var(--af-line);
  border-radius: 999px;
  backdrop-filter: blur(8px);
}
.sld-brand {
  font-size: 11px; letter-spacing: 0.16em; font-weight: 700;
  color: var(--af-blue);
  text-transform: uppercase;
}
.sld-counter {
  font-size: 13px; font-weight: 700;
  color: var(--af-ink);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
}
.sld-counter-sep, .sld-counter-tot { color: var(--af-mute); }

/* ===== Bottom nav (prev/next + dots) ===== */
.sld-nav {
  position: fixed;
  bottom: 20px; left: 50%; transform: translateX(-50%);
  z-index: 20;
  display: flex; align-items: center; gap: 14px;
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid var(--af-line);
  border-radius: 999px;
  backdrop-filter: blur(8px);
  box-shadow: 0 12px 30px -12px rgba(59, 130, 246, 0.20);
}
.sld-nav-btn {
  width: 36px; height: 36px;
  border-radius: 999px;
  border: 1px solid var(--af-line);
  background: rgba(255, 255, 255, 0.9);
  font-size: 18px;
  color: var(--af-ink);
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s ease;
}
.sld-nav-btn:hover:not(:disabled) {
  background: var(--af-blue);
  color: #fff;
  border-color: var(--af-blue);
}
.sld-nav-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.sld-dots {
  display: flex; align-items: center; gap: 6px;
}
.sld-dot {
  width: 8px; height: 8px;
  border-radius: 999px;
  background: var(--af-line-strong);
  border: none;
  padding: 0;
  transition: all 0.15s ease;
}
.sld-dot.is-active {
  background: var(--af-blue);
  width: 24px;
}
.sld-dot:hover { background: var(--af-blue-2); }

/* ===== New v3 components ===== */

/* Section title — used to break up dense slides */
.sld-section-title {
  font-size: 12px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--af-blue);
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
  border: 1px solid var(--af-line);
  border-radius: 12px;
}
.sld-mini-stat-v {
  font-size: 22px; font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--af-ink);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.sld-mini-stat-k {
  margin-top: 6px;
  font-size: 10px; letter-spacing: 0.14em; font-weight: 700;
  color: var(--af-mute);
  text-transform: uppercase;
}

/* Takeaway line for rep talk-track */
.sld-takeaway {
  margin: 0;
  padding: 14px 18px;
  background: rgba(139, 92, 246, 0.06);
  border: 1px solid rgba(139, 92, 246, 0.18);
  border-radius: 10px;
  font-size: 13px; line-height: 1.6;
  color: var(--af-ink-2);
}
.sld-takeaway strong { color: var(--af-blue); }

/* iPad mockup */
.sld-ipad {
  position: relative; z-index: 2;
  display: flex; align-items: center; justify-content: center;
  perspective: 1400px;
}
.sld-ipad-bezel {
  width: 380px;
  background: linear-gradient(180deg, #1E293B 0%, #0F172A 100%);
  border-radius: 28px;
  padding: 14px;
  box-shadow:
    0 60px 110px -50px rgba(59, 130, 246, 0.40),
    0 30px 60px -30px rgba(59, 130, 246, 0.25),
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
  border-bottom: 1px solid var(--af-line);
}
.sld-ipad-brand {
  font-size: 10.5px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--af-blue);
  text-transform: uppercase;
}
.sld-ipad-meta {
  font-size: 9px; letter-spacing: 0.14em; font-weight: 600;
  color: var(--af-mute);
  text-transform: uppercase;
  padding: 3px 8px;
  background: rgba(15,23,42,0.04);
  border-radius: 6px;
}
.sld-ipad-title {
  font-size: 22px; font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--af-ink);
}
.sld-ipad-sub {
  font-size: 12px; color: var(--af-mute);
  margin-top: -8px;
}
.sld-ipad-form {
  display: flex; flex-direction: column; gap: 8px;
}
.sld-ipad-field {
  padding: 10px 14px;
  background: rgba(15,23,42,0.04);
  border: 1px solid var(--af-line);
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
  color: var(--af-mute);
  text-transform: uppercase;
}
.sld-ipad-field-v {
  margin-top: 4px;
  font-size: 13px; font-weight: 600;
  color: var(--af-ink);
  font-variant-numeric: tabular-nums;
}
.sld-ipad-btn {
  padding: 12px 18px;
  text-align: center;
  background: linear-gradient(135deg, var(--af-deep) 0%, var(--af-blue) 100%);
  color: #fff;
  border-radius: 10px;
  font-size: 13px; font-weight: 700;
  letter-spacing: 0.02em;
}
.sld-ipad-foot {
  font-size: 9.5px; letter-spacing: 0.14em;
  color: var(--af-mute);
  text-transform: uppercase;
  text-align: center;
  font-weight: 600;
}

/* Offer stack — slide 8 */
.sld-offer-stack {
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid var(--af-line-strong);
  border-radius: 18px;
  padding: 8px 22px;
  margin-top: 8px;
  box-shadow: 0 22px 50px -28px rgba(59, 130, 246, 0.30);
}
.sld-offer-row {
  display: grid; grid-template-columns: 2fr 1fr 0.6fr;
  gap: 16px; align-items: center;
  padding: 16px 0;
  border-bottom: 1px dashed var(--af-line);
  font-variant-numeric: tabular-nums;
}
.sld-offer-row:last-of-type { border-bottom: none; }
.sld-offer-row.is-winner {
  background: linear-gradient(90deg, rgba(139, 92, 246, 0.08), transparent);
  margin: 0 -22px; padding: 16px 22px;
}
.sld-offer-lender {
  display: flex; align-items: center; gap: 10px;
  font-size: 15px; font-weight: 600;
  color: var(--af-ink);
}
.sld-offer-star { color: var(--af-blue-2); font-size: 18px; }
.sld-offer-bullet {
  width: 8px; height: 8px; border-radius: 999px;
  background: rgba(15, 23, 42, 0.18);
  display: inline-block;
}
.sld-offer-tag {
  font-size: 9.5px; letter-spacing: 0.14em; font-weight: 700;
  color: var(--af-mute);
  text-transform: uppercase;
  padding: 3px 8px;
  background: rgba(15,23,42,0.04);
  border-radius: 6px;
  margin-left: 4px;
}
.sld-offer-row.is-winner .sld-offer-tag {
  background: rgba(139, 92, 246, 0.18);
  color: var(--af-blue);
}
.sld-offer-monthly {
  font-size: 20px; font-weight: 800;
  text-align: right;
  letter-spacing: -0.02em;
  color: var(--af-ink);
}
.sld-offer-monthly span { font-size: 12px; font-weight: 500; color: var(--af-mute); }
.sld-offer-term {
  font-size: 13px; font-weight: 600;
  text-align: right;
  color: var(--af-ink-2);
}
.sld-offer-foot {
  padding: 14px 0 6px;
  font-size: 10.5px; letter-spacing: 0.14em;
  color: var(--af-mute);
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
  border: 1px solid var(--af-line-strong);
  border-radius: 22px;
}
.sld-wire-node {
  text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
}
.sld-wire-icon {
  width: 56px; height: 56px;
  border-radius: 16px;
  background: linear-gradient(135deg, var(--af-deep) 0%, var(--af-blue) 100%);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; font-weight: 800;
  box-shadow: 0 14px 30px -14px rgba(59, 130, 246, 0.45);
}
.sld-wire-node-end .sld-wire-icon {
  background: linear-gradient(135deg, var(--af-blue) 0%, var(--af-blue-2) 100%);
}
.sld-wire-label {
  font-size: 13px; font-weight: 700;
  color: var(--af-ink);
}
.sld-wire-sub {
  font-size: 11px; color: var(--af-mute);
}
.sld-wire-flow {
  text-align: center;
  display: flex; flex-direction: column; gap: 8px; align-items: center;
}
.sld-wire-amount {
  font-size: 28px; font-weight: 800;
  letter-spacing: -0.025em;
  background: linear-gradient(135deg, var(--af-deep) 0%, var(--af-blue-2) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.sld-wire-line {
  position: relative;
  width: 100%; height: 4px;
  background: linear-gradient(90deg, var(--af-deep), var(--af-blue), var(--af-blue-2));
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
  color: var(--af-blue);
  text-transform: uppercase;
}

/* Storyboard — slide 11 · 4-panel buyer journey with glyphs + track */
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
    rgba(59, 130, 246, 0.20) 8%,
    rgba(59, 130, 246, 0.40) 50%,
    rgba(59, 130, 246, 0.20) 92%,
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
  background: var(--af-blue-2);
  box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.20);
}
.sld-storyboard-track::before { left: -4px; }
.sld-storyboard-track::after { right: -4px; }
.sld-story-panel {
  position: relative;
  padding: 22px 20px 20px;
  background:
    radial-gradient(ellipse 80% 50% at 0% 0%, rgba(139, 92, 246, 0.08), transparent 65%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 253, 252, 0.98) 100%);
  border: 1px solid var(--af-line);
  border-radius: 18px;
  display: flex; flex-direction: column;
  gap: 8px;
  z-index: 1;
  overflow: hidden;
  box-shadow: 0 18px 40px -28px rgba(59, 130, 246, 0.22);
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
    0 32px 70px -32px rgba(59, 130, 246, 0.38),
    inset 0 1px 0 rgba(255, 255, 255, 0.95);
  border-color: rgba(59, 130, 246, 0.30);
}
.sld-story-n {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px; letter-spacing: 0.20em; font-weight: 700;
  color: var(--af-blue);
  padding: 3px 7px;
  background: rgba(139, 92, 246, 0.10);
  border: 1px solid rgba(59, 130, 246, 0.20);
  border-radius: 6px;
  width: fit-content;
}
.sld-story-glyph {
  margin-top: 4px;
  width: 44px; height: 44px;
  padding: 8px;
  border-radius: 12px;
  background:
    radial-gradient(circle at 30% 30%, rgba(139, 92, 246, 0.30), transparent 70%),
    linear-gradient(135deg, var(--af-deep) 0%, #1E3A8A 100%);
  color: var(--af-blue-2);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 10px 24px -10px rgba(59, 130, 246, 0.55);
}
.sld-story-glyph svg { width: 100%; height: 100%; }
.sld-story-t {
  font-size: 18px; font-weight: 600;
  letter-spacing: -0.018em;
  color: var(--af-ink);
}
.sld-story-b {
  font-size: 12.5px; color: var(--af-ink-2);
  line-height: 1.5;
}
.sld-story-meta {
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px dashed var(--af-line);
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 11px; font-weight: 600;
  color: var(--af-blue);
  letter-spacing: 0.04em;
}

/* Money breakdown — slide 2 · clean teal-only ledger table */
.sld-money {
  display: flex; flex-direction: column;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid var(--af-line);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 18px 40px -28px rgba(59, 130, 246, 0.20);
}
.sld-money-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 24px;
  padding: 18px 24px;
  border-bottom: 1px dashed var(--af-line);
}
.sld-money-row:last-child { border-bottom: none; }
.sld-money-row-l {
  display: flex; flex-direction: column; gap: 4px;
}
.sld-money-row-k {
  font-size: 14.5px; font-weight: 600;
  color: var(--af-ink);
  letter-spacing: -0.012em;
}
.sld-money-row-sub {
  font-size: 12px;
  color: var(--af-mute);
  line-height: 1.4;
}
.sld-money-row-r {
  display: flex; align-items: baseline; gap: 16px;
}
.sld-money-row-pct {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 12px; font-weight: 600;
  color: var(--af-mute);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}
.sld-money-row-v {
  font-size: 18px; font-weight: 600;
  color: var(--af-ink);
  letter-spacing: -0.018em;
  font-variant-numeric: tabular-nums;
}
.sld-money-row-total {
  background:
    radial-gradient(ellipse 60% 100% at 100% 50%, rgba(139, 92, 246, 0.12), transparent 70%),
    rgba(248, 253, 252, 0.98);
  border-top: 1px solid var(--af-line-strong);
}
.sld-money-row-total .sld-money-row-k {
  font-size: 11px; letter-spacing: 0.22em; font-weight: 700;
  color: var(--af-blue);
  text-transform: uppercase;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
}
.sld-money-row-v-total {
  font-size: 26px; font-weight: 700;
  letter-spacing: -0.03em;
  background: linear-gradient(135deg, var(--af-deep) 0%, var(--af-blue) 100%);
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
  border: 1px solid var(--af-line);
  border-radius: 16px;
  box-shadow: 0 16px 40px -28px rgba(59, 130, 246, 0.22);
  transition: transform .25s ease, box-shadow .25s ease;
}
.sld-pricing-tier:hover {
  transform: translateY(-2px);
  box-shadow: 0 24px 50px -28px rgba(59, 130, 246, 0.32);
  border-color: rgba(59, 130, 246, 0.22);
}
.sld-pricing-tier-hero {
  background:
    radial-gradient(ellipse 70% 100% at 0% 0%, rgba(139, 92, 246, 0.16), transparent 65%),
    linear-gradient(135deg, var(--af-deep) 0%, #1E3A8A 100%);
  color: #fff;
  border-color: rgba(139, 92, 246, 0.30);
  box-shadow:
    0 28px 60px -28px rgba(59, 130, 246, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.10);
}
.sld-pricing-tier-hero .sld-pricing-tier-tag { color: var(--af-blue-2); }
.sld-pricing-tier-hero .sld-pricing-tier-h { color: #fff; }
.sld-pricing-tier-hero .sld-pricing-tier-b { color: rgba(255, 255, 255, 0.72); }
.sld-pricing-tier-hero .sld-pricing-tier-when { color: rgba(255, 255, 255, 0.60); }
.sld-pricing-tier-hero .sld-pricing-tier-v {
  background: linear-gradient(135deg, #fff 0%, var(--af-blue-2) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.sld-pricing-tier-l {
  display: flex; flex-direction: column; gap: 4px;
}
.sld-pricing-tier-tag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px; font-weight: 700;
  letter-spacing: 0.22em;
  color: var(--af-blue);
  text-transform: uppercase;
}
.sld-pricing-tier-h {
  font-size: 18px; font-weight: 600;
  letter-spacing: -0.018em;
  color: var(--af-ink);
}
.sld-pricing-tier-b {
  font-size: 13px;
  color: var(--af-mute);
  line-height: 1.5;
}
.sld-pricing-tier-r {
  display: flex; flex-direction: column; align-items: flex-end; gap: 4px;
}
.sld-pricing-tier-v {
  font-size: 42px; font-weight: 700;
  letter-spacing: -0.038em;
  line-height: 1;
  color: var(--af-ink);
  font-variant-numeric: tabular-nums;
}
.sld-pricing-tier:not(.sld-pricing-tier-hero) .sld-pricing-tier-v {
  background: linear-gradient(135deg, var(--af-deep) 0%, var(--af-blue) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.sld-pricing-tier-when {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px;
  color: var(--af-mute);
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
  border: 1px solid var(--af-line);
  border-radius: 10px;
}
.sld-pricing-foot-k {
  font-size: 10.5px; letter-spacing: 0.12em; font-weight: 700;
  color: var(--af-mute);
  text-transform: uppercase;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
}
.sld-pricing-foot-v {
  font-size: 16px; font-weight: 600;
  color: var(--af-ink);
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
  border: 1px solid var(--af-line-strong);
  border-radius: 18px;
  box-shadow: 0 22px 50px -28px rgba(59, 130, 246, 0.25);
  font-size: 13px;
}
.sld-invoice-head {
  display: flex; justify-content: space-between; align-items: flex-start;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--af-line);
}
.sld-invoice-from { font-weight: 700; color: var(--af-ink); }
.sld-invoice-meta { font-size: 11px; color: var(--af-mute); margin-top: 2px; }
.sld-invoice-no { text-align: right; }
.sld-invoice-no-k {
  font-size: 9px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--af-mute);
  text-transform: uppercase;
}
.sld-invoice-no-v {
  font-size: 14px; font-weight: 700;
  color: var(--af-ink);
  font-variant-numeric: tabular-nums;
}
.sld-invoice-period {
  font-size: 11px; letter-spacing: 0.16em;
  color: var(--af-blue);
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
  border-bottom: 1px dashed var(--af-line);
}
.sld-invoice-table th {
  font-size: 9.5px; letter-spacing: 0.14em; font-weight: 700;
  color: var(--af-mute);
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
  border-top: 1px solid var(--af-line-strong);
  padding-top: 12px;
  color: var(--af-blue);
}
.sld-invoice-foot {
  margin-top: 12px;
  font-size: 10.5px; color: var(--af-mute);
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
  background: linear-gradient(90deg, var(--af-deep), var(--af-blue-2));
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
  background: var(--af-blue-2);
  border: 3px solid #fff;
  box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.2);
  margin-bottom: 14px;
}
.sld-timeline-day {
  font-size: 11px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--af-blue);
  text-transform: uppercase;
  margin-bottom: 4px;
}
.sld-timeline-t {
  font-size: 16px; font-weight: 700;
  color: var(--af-ink);
  margin-bottom: 6px;
}
.sld-timeline-b {
  font-size: 12.5px; color: var(--af-ink-2);
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
  border: 1px solid var(--af-line);
  border-radius: 10px;
  font-size: 13px; color: var(--af-ink-2);
}
.sld-check-icon {
  width: 20px; height: 20px;
  border-radius: 999px;
  background: rgba(139, 92, 246, 0.18);
  color: var(--af-blue);
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
  border: 1px solid var(--af-line);
  border-radius: 16px;
  display: flex; flex-direction: column; gap: 8px;
}
.sld-roadmap-icon {
  width: 36px; height: 36px;
  border-radius: 12px;
  background: rgba(139, 92, 246, 0.14);
  color: var(--af-blue);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 16px; font-weight: 700;
}
.sld-roadmap-w {
  font-size: 10.5px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--af-blue);
  text-transform: uppercase;
}
.sld-roadmap-t {
  font-size: 14px; font-weight: 600;
  color: var(--af-ink);
  line-height: 1.4;
}
.sld-roadmap-arrow {
  position: absolute;
  top: 50%; right: -10px;
  transform: translateY(-50%);
  font-size: 18px;
  color: var(--af-line-strong);
  background: transparent;
}

/* ===== Welcome + agenda ===== */
.sld-agenda {
  display: flex; flex-direction: column;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--af-line-strong);
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 22px 50px -28px rgba(59, 130, 246, 0.28);
}
.sld-agenda-row {
  display: grid; grid-template-columns: 56px 1fr;
  align-items: center; gap: 16px;
  padding: 16px 22px;
  border-bottom: 1px dashed var(--af-line);
  transition: background .15s ease;
}
.sld-agenda-row:last-child { border-bottom: none; }
.sld-agenda-row:hover { background: rgba(139, 92, 246, 0.04); }
.sld-agenda-n {
  font-size: 22px; font-weight: 800;
  letter-spacing: -0.025em;
  background: linear-gradient(135deg, var(--af-deep), var(--af-blue));
  -webkit-background-clip: text; background-clip: text; color: transparent;
  font-variant-numeric: tabular-nums;
}
.sld-agenda-t {
  font-size: 16px; font-weight: 700;
  color: var(--af-ink);
  letter-spacing: -0.01em;
}
.sld-agenda-s {
  font-size: 12px; color: var(--af-mute);
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
  border: 1px solid var(--af-line);
  border-radius: 16px;
  text-align: left;
  transition: transform .2s ease, box-shadow .2s ease;
}
.sld-who-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 22px 50px -28px rgba(59, 130, 246, 0.30);
}
.sld-who-code {
  display: inline-block;
  padding: 4px 8px;
  margin-bottom: 14px;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10px; letter-spacing: 0.16em; font-weight: 700;
  color: var(--af-blue);
  background: rgba(59, 130, 246, 0.08);
  border: 1px solid rgba(59, 130, 246, 0.18);
  border-radius: 6px;
  font-variant-numeric: tabular-nums;
}
.sld-who-name {
  font-size: 18px; font-weight: 700;
  letter-spacing: -0.022em;
  color: var(--af-ink);
}
.sld-who-ticket {
  margin-top: 4px;
  font-size: 11px; letter-spacing: 0.12em; font-weight: 700;
  color: var(--af-blue);
  text-transform: uppercase;
  font-variant-numeric: tabular-nums;
}
.sld-who-who {
  margin-top: 10px;
  font-size: 12px; line-height: 1.5;
  color: var(--af-ink-2);
}
.sld-notfor {
  margin-top: 8px;
  padding: 16px 20px;
  background: rgba(15, 23, 42, 0.04);
  border: 1px dashed var(--af-line-strong);
  border-radius: 12px;
  display: grid; grid-template-columns: 100px 1fr;
  gap: 16px;
  align-items: baseline;
}
.sld-notfor-k {
  font-size: 11px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--af-mute);
  text-transform: uppercase;
}
.sld-notfor-v {
  font-size: 13px; color: var(--af-ink-2); line-height: 1.5;
}

/* ===== 5 agents grid · ops-console feel ===== */
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
    radial-gradient(ellipse 80% 50% at 0% 0%, rgba(139, 92, 246, 0.10), transparent 65%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.97) 0%, rgba(248, 253, 252, 0.97) 100%);
  border: 1px solid var(--af-line);
  border-radius: 14px;
  display: flex; flex-direction: column; gap: 10px;
  transition: transform .35s cubic-bezier(0.22, 0.61, 0.36, 1),
              box-shadow .35s cubic-bezier(0.22, 0.61, 0.36, 1),
              border-color .35s ease;
  overflow: hidden;
  opacity: 0;
  animation: sldAgentIn .5s ease forwards;
  transform-style: preserve-3d;
  box-shadow: 0 16px 38px -28px rgba(59, 130, 246, 0.20);
}
@keyframes sldAgentIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.sld-agent-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 100% 0%, rgba(139, 92, 246, 0.20), transparent 60%);
  opacity: 0;
  transition: opacity .35s ease;
  pointer-events: none;
}
.sld-agent-card:hover {
  transform: translateY(-4px) rotateX(2deg);
  box-shadow:
    0 30px 60px -28px rgba(59, 130, 246, 0.38),
    inset 0 1px 0 rgba(255, 255, 255, 0.95);
  border-color: rgba(59, 130, 246, 0.30);
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
    radial-gradient(ellipse 80% 80% at 50% 50%, rgba(139, 92, 246, 0.18), transparent 70%),
    rgba(139, 92, 246, 0.06);
  border: 1px solid rgba(59, 130, 246, 0.18);
  color: var(--af-blue);
  display: flex; align-items: center; justify-content: center;
}
.sld-agent-glyph svg { width: 100%; height: 100%; }
.sld-agent-head-r {
  display: flex; flex-direction: column; gap: 2px;
}
.sld-agent-code {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 13px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--af-blue);
  text-transform: uppercase;
}
.sld-agent-version {
  display: inline-flex; align-items: center; gap: 6px;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 9.5px; letter-spacing: 0.10em;
  color: var(--af-mute);
  font-weight: 600;
}
.sld-agent-version-dot {
  width: 5px; height: 5px;
  border-radius: 999px;
  background: #10B981;
  box-shadow: 0 0 0 0 rgba(45, 196, 112, 0.5);
  animation: sldLivePulse 1.6s ease-in-out infinite;
}
@keyframes sldLivePulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(45, 196, 112, 0.55); }
  50% { box-shadow: 0 0 0 5px rgba(45, 196, 112, 0); }
}
.sld-agent-role {
  font-size: 14px; font-weight: 600;
  color: var(--af-ink);
  letter-spacing: -0.01em;
}
.sld-agent-meta {
  display: flex; flex-direction: column; gap: 6px;
  padding-top: 8px;
  border-top: 1px dashed var(--af-line);
}
.sld-agent-k {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 9px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--af-mute);
  text-transform: uppercase;
}
.sld-agent-v {
  font-size: 12px;
  color: var(--af-ink-2);
  line-height: 1.45;
}

/* ===== BEACON pixel attribution (sld-echo-* class names retained) ===== */
.sld-echo-flow {
  display: grid; grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  margin-top: 8px;
  position: relative;
}
.sld-echo-node {
  padding: 18px 20px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid var(--af-line);
  border-radius: 14px;
  position: relative;
  text-align: center;
  opacity: 0.85;
}
.sld-echo-node.is-fund {
  background:
    radial-gradient(ellipse 80% 100% at 50% 100%, rgba(139, 92, 246, 0.20), transparent 70%),
    rgba(255, 255, 255, 0.95);
  border-color: var(--af-line-strong);
  box-shadow: 0 22px 50px -28px rgba(59, 130, 246, 0.35);
  opacity: 1;
}
.sld-echo-node + .sld-echo-node::before {
  content: '→';
  position: absolute;
  left: -14px; top: 50%; transform: translateY(-50%);
  color: var(--af-line-strong);
  font-size: 14px; font-weight: 700;
}
.sld-echo-n {
  font-size: 10px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--af-mute);
  text-transform: uppercase;
}
.sld-echo-node.is-fund .sld-echo-n { color: var(--af-blue); }
.sld-echo-label {
  margin-top: 6px;
  font-size: 15px; font-weight: 800;
  letter-spacing: -0.015em;
  color: var(--af-ink);
}
.sld-echo-sub {
  margin-top: 2px;
  font-size: 11px; color: var(--af-mute);
}
/* BEACON 3D feedback loop — funded stage signals back to ad platforms */
.sld-echo-3d {
  position: relative;
  margin-top: 16px;
  padding: 32px 28px 24px;
  border-radius: 20px;
  background:
    radial-gradient(ellipse 70% 100% at 0% 100%, rgba(139, 92, 246, 0.16), transparent 65%),
    radial-gradient(ellipse 60% 80% at 100% 0%, rgba(59, 130, 246, 0.12), transparent 65%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(244, 252, 250, 0.98) 100%);
  border: 1px solid var(--af-line-strong);
  overflow: hidden;
  box-shadow: 0 28px 60px -32px rgba(59, 130, 246, 0.30);
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
    radial-gradient(ellipse 80% 100% at 0% 50%, rgba(139, 92, 246, 0.32), transparent 70%),
    linear-gradient(135deg, var(--af-deep) 0%, #1E3A8A 100%);
  color: #fff;
  border-radius: 14px;
  box-shadow:
    0 22px 50px -22px rgba(59, 130, 246, 0.55),
    0 0 0 1px rgba(139, 92, 246, 0.32);
  transform: rotateY(8deg) translateZ(20px);
  transform-style: preserve-3d;
}
.sld-echo-3d-tag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10px; letter-spacing: 0.22em; font-weight: 700;
  color: var(--af-blue-2);
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
  border: 1px solid var(--af-line-strong);
  box-shadow: 0 10px 22px -12px rgba(59, 130, 246, 0.30);
  transition: transform .3s ease, box-shadow .3s ease;
}
.sld-echo-3d-platform-meta { transform: rotateY(-8deg) translateZ(28px); }
.sld-echo-3d-platform-google { transform: rotateY(-8deg) translateZ(14px); }
.sld-echo-3d-platform-tiktok { transform: rotateY(-8deg) translateZ(0); }
.sld-echo-3d-platform-k {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 11px; font-weight: 700;
  color: var(--af-blue);
  letter-spacing: 0.10em;
}
.sld-echo-3d-platform-sig {
  font-size: 11px;
  color: var(--af-mute);
}
.sld-echo-3d-platform-dot {
  width: 8px; height: 8px;
  border-radius: 999px;
  background: var(--af-blue-2);
  box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.55);
  animation: sldLivePulse 1.8s ease-in-out infinite;
}
.sld-echo-3d-caption {
  grid-column: 1 / -1;
  grid-row: 2;
  padding-top: 16px;
  border-top: 1px dashed var(--af-line);
  font-size: 13px; line-height: 1.55;
  color: var(--af-ink-2);
  text-align: center;
}

/* ===== Compound effect 12-month bar chart ===== */
.sld-comp-chart {
  display: flex; flex-direction: column; gap: 18px;
  padding: 24px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--af-line-strong);
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
  background: linear-gradient(180deg, var(--af-blue-2) 0%, var(--af-deep) 100%);
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
  color: var(--af-mute);
  text-transform: uppercase;
  font-variant-numeric: tabular-nums;
}
.sld-comp-legend {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 16px;
  padding-top: 14px;
  border-top: 1px dashed var(--af-line);
}
.sld-comp-legend-k {
  font-size: 10px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--af-blue);
  text-transform: uppercase;
}
.sld-comp-legend-v {
  margin-top: 4px;
  font-size: 13px; color: var(--af-ink-2); line-height: 1.5;
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
  border: 1px solid var(--af-line);
  border-radius: 16px;
  display: flex; flex-direction: column; gap: 12px;
}
.sld-stack-head {
  font-size: 13px; letter-spacing: 0.14em; font-weight: 800;
  color: var(--af-blue);
  text-transform: uppercase;
  padding-bottom: 10px;
  border-bottom: 1px dashed var(--af-line);
}
.sld-stack-items {
  list-style: none; padding: 0; margin: 0;
  display: flex; flex-direction: column; gap: 8px;
}
.sld-stack-items li {
  display: flex; align-items: flex-start; gap: 10px;
  font-size: 12.5px; line-height: 1.5;
  color: var(--af-ink-2);
}
.sld-stack-check {
  width: 16px; height: 16px;
  border-radius: 999px;
  background: rgba(139, 92, 246, 0.18);
  color: var(--af-blue);
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
  color: var(--af-mute);
  text-transform: uppercase;
}
.sld-stack-alt-v {
  font-size: 12px; font-weight: 600;
  color: var(--af-ink);
}
.sld-stack-total {
  margin-top: 8px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid var(--af-line-strong);
  border-radius: 16px;
  overflow: hidden;
}
.sld-stack-total-row {
  display: flex; justify-content: space-between; align-items: baseline;
  padding: 18px 24px;
  border-bottom: 1px dashed var(--af-line);
}
.sld-stack-total-row:last-child { border-bottom: none; }
.sld-stack-total-row.accent {
  background:
    radial-gradient(ellipse 80% 100% at 100% 50%, rgba(139, 92, 246, 0.18), transparent 70%),
    rgba(255, 255, 255, 0.95);
}
.sld-stack-total-k {
  font-size: 13px; letter-spacing: 0.14em; font-weight: 700;
  color: var(--af-mute);
  text-transform: uppercase;
}
.sld-stack-total-row.accent .sld-stack-total-k { color: var(--af-blue); }
.sld-stack-total-v {
  font-size: 22px; font-weight: 800;
  color: var(--af-ink);
  letter-spacing: -0.025em;
  font-variant-numeric: tabular-nums;
}
.sld-stack-total-row.accent .sld-stack-total-v {
  background: linear-gradient(135deg, var(--af-deep) 0%, var(--af-blue-2) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}

/* ===== Smart-routing funnel (slide 12 · FORGE + APEX) =====
 * Clean three-stage stack with a centered NEXUS router pill,
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
    radial-gradient(ellipse 60% 100% at 50% 0%, rgba(139, 92, 246, 0.12), transparent 70%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 253, 252, 0.98) 100%);
  border: 1px solid var(--af-line-strong);
  border-radius: 14px;
  box-shadow:
    0 22px 50px -32px rgba(59, 130, 246, 0.40),
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
    0 30px 60px -30px rgba(59, 130, 246, 0.45),
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
  background: linear-gradient(180deg, rgba(139, 92, 246, 0.0), rgba(59, 130, 246, 0.55));
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
  border-top: 8px solid var(--af-blue);
  filter: drop-shadow(0 2px 4px rgba(59, 130, 246, 0.35));
}
.sld-funnel-stage-tag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10px; letter-spacing: 0.22em; font-weight: 700;
  color: var(--af-blue);
  text-transform: uppercase;
}
.sld-funnel-stage-h {
  font-size: 15px; font-weight: 600;
  letter-spacing: -0.012em;
  color: var(--af-ink);
}
.sld-funnel-stage-b {
  font-size: 12px;
  color: var(--af-mute);
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
  color: var(--af-blue);
  background: rgba(139, 92, 246, 0.10);
  border: 1px solid rgba(59, 130, 246, 0.18);
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
    radial-gradient(ellipse 80% 100% at 0% 50%, rgba(139, 92, 246, 0.40), transparent 70%),
    linear-gradient(135deg, var(--af-deep) 0%, #1E3A8A 100%);
  border: 1px solid rgba(139, 92, 246, 0.45);
  border-radius: 999px;
  box-shadow:
    0 18px 36px -16px rgba(59, 130, 246, 0.55),
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
  background: linear-gradient(180deg, rgba(59, 130, 246, 0.55), rgba(59, 130, 246, 0.10));
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
  background: var(--af-blue-2);
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
  border: 1px solid var(--af-line);
  border-radius: 16px;
  box-shadow:
    0 28px 56px -28px rgba(59, 130, 246, 0.32),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  transition: transform .35s cubic-bezier(0.22, 0.61, 0.36, 1),
              box-shadow .35s cubic-bezier(0.22, 0.61, 0.36, 1);
  transform: translateZ(8px);
}
.sld-funnel-branch:hover {
  transform: translateY(-4px) translateZ(16px);
  box-shadow:
    0 40px 72px -28px rgba(59, 130, 246, 0.44),
    inset 0 1px 0 rgba(255, 255, 255, 1);
}
.sld-funnel-branch-high {
  border-color: rgba(59, 130, 246, 0.30);
  background:
    radial-gradient(ellipse 80% 50% at 50% 0%, rgba(139, 92, 246, 0.14), transparent 70%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(240, 252, 250, 0.98) 100%);
  box-shadow:
    0 36px 68px -28px rgba(59, 130, 246, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 1);
  transform: translateZ(14px);
}
.sld-funnel-branch-head {
  display: flex; align-items: baseline; justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
  border-bottom: 1px dashed var(--af-line);
}
.sld-funnel-branch-tag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px; letter-spacing: 0.20em; font-weight: 700;
  color: var(--af-blue);
  text-transform: uppercase;
}
.sld-funnel-branch-low .sld-funnel-branch-tag { color: var(--af-mute); }
.sld-funnel-branch-crit {
  font-size: 11px; color: var(--af-mute);
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
  border-bottom: 1px dashed var(--af-line);
}
.sld-funnel-branch-steps li:last-child { border-bottom: none; }
.sld-funnel-step-n {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 11px; font-weight: 700;
  color: var(--af-blue);
  font-variant-numeric: tabular-nums;
}
.sld-funnel-branch-low .sld-funnel-step-n { color: var(--af-mute); }
.sld-funnel-step-h {
  font-size: 13px; font-weight: 500;
  color: var(--af-ink);
  letter-spacing: -0.01em;
}
.sld-funnel-branch-outcome {
  margin-top: 4px;
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 13px; font-weight: 600;
  letter-spacing: -0.01em;
  background:
    radial-gradient(ellipse 80% 100% at 0% 50%, rgba(139, 92, 246, 0.32), transparent 70%),
    linear-gradient(135deg, var(--af-deep) 0%, #1E3A8A 100%);
  color: #fff;
  text-align: center;
  box-shadow: 0 12px 28px -14px rgba(59, 130, 246, 0.50);
}
.sld-funnel-branch-outcome-low {
  background: rgba(15, 23, 42, 0.05);
  color: var(--af-ink-2);
  box-shadow: none;
  border: 1px dashed var(--af-line-strong);
}

/* ===== Trusted by 2,000+ businesses ===== */
.sld-trust-hero {
  padding: 28px 24px;
  background:
    radial-gradient(ellipse 80% 100% at 100% 50%, rgba(139, 92, 246, 0.18), transparent 70%),
    rgba(255, 255, 255, 0.95);
  border: 1px solid var(--af-line-strong);
  border-radius: 18px;
  box-shadow: 0 22px 50px -28px rgba(59, 130, 246, 0.28);
}
.sld-trust-hero-row {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 18px;
}
.sld-trust-hero-row > div {
  text-align: center;
  padding: 8px 4px;
  border-right: 1px dashed var(--af-line);
}
.sld-trust-hero-row > div:last-child { border-right: none; }
.sld-trust-hero-v {
  font-size: 44px; font-weight: 800;
  letter-spacing: -0.03em;
  background: linear-gradient(135deg, var(--af-deep) 0%, var(--af-blue-2) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.sld-trust-hero-k {
  margin-top: 6px;
  font-size: 11px; letter-spacing: 0.16em; font-weight: 700;
  color: var(--af-mute);
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
  border: 1px solid var(--af-line);
  border-radius: 999px;
  font-size: 12.5px; font-weight: 600;
  color: var(--af-ink-2);
}
.sld-trust-tile-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--af-blue-2);
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
    radial-gradient(ellipse 80% 100% at 0% 100%, rgba(139, 92, 246, 0.16), transparent 70%),
    linear-gradient(180deg, var(--af-deep) 0%, #1E3A8A 100%);
  color: #fff;
}
.sld-price-hero-eyebrow {
  font-size: 11px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--af-blue-2);
  text-transform: uppercase;
}
.sld-price-hero-amount {
  margin-top: 8px;
  font-size: 64px; font-weight: 800;
  letter-spacing: -0.035em;
  background: linear-gradient(135deg, #fff 0%, var(--af-blue-2) 100%);
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
  color: var(--af-blue);
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
    radial-gradient(circle at 30% 30%, rgba(139, 92, 246, 0.45), transparent 70%),
    linear-gradient(135deg, rgba(139, 92, 246, 0.18) 0%, rgba(59, 130, 246, 0.10) 100%);
  border: 1px solid rgba(59, 130, 246, 0.30);
}
.sld-price-hero-includes li::after {
  content: '';
  position: absolute;
  left: 5px; top: 8px;
  width: 8px; height: 4px;
  border-left: 1.6px solid var(--af-blue);
  border-bottom: 1.6px solid var(--af-blue);
  transform: rotate(-45deg);
}
.sld-price-li-h {
  font-size: 14px; font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--af-ink);
}
.sld-price-li-b {
  font-size: 12.5px; font-weight: 400;
  color: var(--af-mute);
  line-height: 1.45;
}
.sld-price-hero ~ .sld-price-grid,
.sld-price-hero .sld-price-grid {
  grid-template-columns: 1fr 1.05fr;
  border-top: 1px solid var(--af-line);
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
  color: var(--af-blue);
  text-transform: uppercase;
  padding: 7px 16px;
  background: rgba(139, 92, 246, 0.10);
  border: 1px solid var(--af-line);
  border-radius: 999px;
  align-self: center;
}
.sld-cover-mark {
  color: var(--af-blue);
  display: inline-flex; align-items: center; justify-content: center;
  width: 110px; height: 110px;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(59, 130, 246, 0.10) 100%);
  border: 1px solid var(--af-line-strong);
  border-radius: 28px;
  box-shadow:
    0 30px 60px -30px rgba(59, 130, 246, 0.40),
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
  color: var(--af-ink);
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
  color: var(--af-mute);
}
.sld-cover-meta {
  margin-top: 18px;
  padding: 18px 28px;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid var(--af-line);
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
  color: var(--af-mute);
  text-transform: uppercase;
  min-width: 110px;
  text-align: right;
}
.sld-cover-meta-v {
  color: var(--af-ink);
  font-weight: 600;
}
.sld-cover-hint {
  margin-top: 24px;
  display: inline-flex; align-items: center; gap: 10px;
  font-size: 11px; letter-spacing: 0.16em; font-weight: 700;
  color: var(--af-mute);
  text-transform: uppercase;
  align-self: center;
}
.sld-cover-hint-arrow {
  display: inline-block;
  animation: sldCoverArrow 1.8s ease-in-out infinite;
  color: var(--af-blue);
  font-size: 16px;
}
@keyframes sldCoverArrow {
  0%, 100% { transform: translateY(0); opacity: 0.7; }
  50% { transform: translateY(4px); opacity: 1; }
}

/* ===== Smart routing (NEXUS) — slide 8 ===== */
.sld-sr {
  display: grid; grid-template-columns: 220px 200px 1fr;
  gap: 24px; align-items: center;
  margin-top: 8px;
  padding: 36px 28px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--af-line-strong);
  border-radius: 22px;
}
.sld-sr-buyer {
  display: flex; align-items: center; gap: 14px;
  padding: 18px 20px;
  background: linear-gradient(180deg, rgba(255,255,255,0.85), rgba(248,253,252,0.85));
  border: 1px solid var(--af-line);
  border-radius: 14px;
}
.sld-sr-avatar {
  width: 44px; height: 44px;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--af-deep), var(--af-blue));
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 700; letter-spacing: 0.05em;
}
.sld-sr-meta { display: flex; flex-direction: column; gap: 2px; }
.sld-sr-label { font-size: 11px; letter-spacing: 0.16em; font-weight: 700; color: var(--af-blue); text-transform: uppercase; }
.sld-sr-sub { font-size: 12px; color: var(--af-mute); }
.sld-sr-arrow {
  position: relative;
  display: flex; flex-direction: column; gap: 8px; align-items: center;
}
.sld-sr-agent {
  font-size: 12px; letter-spacing: 0.16em; font-weight: 800;
  color: var(--af-blue);
  text-transform: uppercase;
  padding: 6px 14px;
  background: rgba(139, 92, 246, 0.14);
  border: 1px solid rgba(139, 92, 246, 0.35);
  border-radius: 999px;
  display: inline-flex; align-items: center; gap: 8px;
}
.sld-sr-agent-dot {
  width: 6px; height: 6px; border-radius: 999px; background: var(--af-blue-2);
  animation: sldPulse 1.5s ease-in-out infinite;
}
.sld-sr-agent-sub {
  font-size: 10px; letter-spacing: 0.14em; font-weight: 600;
  color: var(--af-mute);
  text-transform: uppercase;
}
.sld-sr-arrow-line {
  position: relative;
  width: 80%; height: 3px;
  background: linear-gradient(90deg, transparent, var(--af-blue), transparent);
  border-radius: 999px;
  overflow: hidden;
}
.sld-sr-arrow-pulse {
  position: absolute; top: -1px; left: 0;
  width: 24px; height: 5px;
  background: radial-gradient(ellipse, rgba(139, 92, 246, 0.95), transparent 70%);
  border-radius: 999px;
  animation: sldWirePulse 2s ease-in-out infinite;
}
.sld-sr-reps {
  display: flex; flex-direction: column; gap: 10px;
}
.sld-sr-rep {
  padding: 14px 18px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid var(--af-line);
  border-radius: 12px;
  position: relative;
  opacity: 0.7;
  transition: opacity .25s ease, transform .25s ease, box-shadow .25s ease;
}
.sld-sr-rep.is-match {
  opacity: 1;
  background:
    radial-gradient(ellipse 80% 100% at 100% 0%, rgba(139, 92, 246, 0.16), transparent 70%),
    rgba(255, 255, 255, 0.95);
  border-color: var(--af-line-strong);
  box-shadow: 0 18px 40px -22px rgba(59, 130, 246, 0.30);
  transform: translateX(6px);
}
.sld-sr-rep-name {
  font-size: 14px; font-weight: 700;
  color: var(--af-ink);
  display: inline-flex; align-items: center; gap: 8px;
}
.sld-sr-rep-star { color: var(--af-blue-2); font-size: 16px; }
.sld-sr-rep-tag { margin-top: 2px; font-size: 12px; color: var(--af-ink-2); }
.sld-sr-rep-cap { margin-top: 4px; font-size: 10px; letter-spacing: 0.12em; color: var(--af-mute); text-transform: uppercase; font-weight: 600; }
.sld-sr-rep-match {
  margin-top: 6px;
  font-size: 10px; letter-spacing: 0.14em; font-weight: 700;
  color: var(--af-blue);
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
  background: linear-gradient(180deg, #1E293B 0%, #0F172A 100%);
  border-radius: 36px;
  padding: 12px;
  box-shadow:
    0 60px 110px -50px rgba(59, 130, 246, 0.45),
    0 30px 60px -30px rgba(59, 130, 246, 0.30),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  transform: rotateX(8deg) rotateY(-10deg);
  transform-style: preserve-3d;
  position: relative;
}
.sld-phone-notch {
  position: absolute; top: 14px; left: 50%; transform: translateX(-50%);
  width: 90px; height: 22px; border-radius: 12px;
  background: #0F172A;
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
  color: var(--af-mute);
}
.sld-phone-card {
  padding: 18px;
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid var(--af-line-strong);
  border-radius: 16px;
  box-shadow: 0 14px 30px -16px rgba(59, 130, 246, 0.30);
  display: flex; flex-direction: column; gap: 10px;
}
.sld-phone-card-eyebrow {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 9.5px; letter-spacing: 0.20em; font-weight: 700;
  color: var(--af-blue);
  text-transform: uppercase;
  padding: 4px 10px;
  background: rgba(139, 92, 246, 0.14);
  border-radius: 999px;
  align-self: flex-start;
}
.sld-phone-card-dot {
  width: 5px; height: 5px; border-radius: 999px;
  background: var(--af-blue-2);
}
.sld-phone-card-amount {
  font-size: 36px; font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--af-ink);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.sld-phone-card-meta {
  font-size: 11px; letter-spacing: 0.18em; font-weight: 600;
  color: var(--af-mute);
  text-transform: uppercase;
}
.sld-phone-card-row {
  display: flex; justify-content: space-between; align-items: baseline;
  padding-top: 8px;
  border-top: 1px dashed var(--af-line);
  font-size: 12px;
  color: var(--af-ink-2);
}
.sld-phone-card-row strong {
  font-weight: 700;
  color: var(--af-ink);
  font-variant-numeric: tabular-nums;
}
.sld-phone-card-cta {
  margin-top: 4px;
  padding: 12px 16px;
  background: linear-gradient(135deg, var(--af-deep) 0%, var(--af-blue) 100%);
  color: #fff;
  border-radius: 10px;
  font-size: 13px; font-weight: 700;
  text-align: center;
  letter-spacing: 0.02em;
}
.sld-phone-card-foot {
  font-size: 9px; letter-spacing: 0.10em;
  color: var(--af-mute);
  text-align: center;
  font-weight: 600;
}
.sld-phone-tip {
  font-size: 11px; color: var(--af-mute);
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
  border: 1px solid var(--af-line);
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
  border: 1px solid var(--af-line);
  border-radius: 14px;
}
.sld-vert-side-row.accent {
  background:
    radial-gradient(ellipse 80% 100% at 100% 0%, rgba(139, 92, 246, 0.16), transparent 70%),
    rgba(255, 255, 255, 0.95);
  border-color: var(--af-line-strong);
}
.sld-vert-side-k {
  font-size: 10px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--af-mute);
  text-transform: uppercase;
}
.sld-vert-side-row.accent .sld-vert-side-k { color: var(--af-blue); }
.sld-vert-side-v {
  margin-top: 6px;
  font-size: 24px; font-weight: 800;
  color: var(--af-ink);
  letter-spacing: -0.025em;
  font-variant-numeric: tabular-nums;
}
.sld-vert-side-sub {
  margin-top: 4px;
  font-size: 11px; color: var(--af-mute);
}
.sld-vert-eyebrow {
  font-size: 10px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--af-mute);
  text-transform: uppercase;
  margin-bottom: 12px;
}
.sld-vert-pains {
  list-style: none; padding: 0; margin: 0;
  display: flex; flex-direction: column; gap: 8px;
}
.sld-vert-pains li {
  display: flex; align-items: flex-start; gap: 10px;
  font-size: 13px; color: var(--af-ink-2);
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
  border: 1px solid var(--af-line-strong);
  border-radius: 14px;
  text-align: center;
}
.sld-vert-outcome-v {
  font-size: 26px; font-weight: 800;
  letter-spacing: -0.025em;
  background: linear-gradient(135deg, var(--af-deep) 0%, var(--af-blue-2) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  font-variant-numeric: tabular-nums;
}
.sld-vert-outcome-k {
  margin-top: 4px;
  font-size: 11px; letter-spacing: 0.14em;
  color: var(--af-mute);
  text-transform: uppercase;
  font-weight: 600;
}
.sld-vert-quote {
  padding: 24px 28px;
  background:
    radial-gradient(ellipse 80% 100% at 0% 50%, rgba(139, 92, 246, 0.12), transparent 70%),
    rgba(255, 255, 255, 0.95);
  border: 1px solid var(--af-line-strong);
  border-radius: 16px;
  display: flex; flex-direction: column; gap: 12px;
  box-shadow: 0 18px 50px -28px rgba(59, 130, 246, 0.26);
}
.sld-vert-quote blockquote {
  margin: 0;
  font-size: 18px; line-height: 1.5;
  color: var(--af-ink);
  font-style: italic;
}
.sld-vert-quote-attr {
  display: flex; gap: 8px; align-items: baseline;
  padding-top: 10px;
  border-top: 1px dashed var(--af-line);
}
.sld-vert-quote-name {
  font-size: 13px; font-weight: 700;
  color: var(--af-ink);
}
.sld-vert-quote-role {
  font-size: 12px; color: var(--af-mute);
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
  background: linear-gradient(135deg, #FFFFFF 0%, #EEF2FF 100%);
  color: var(--af-deep);
  border: 1px solid rgba(59, 130, 246, 0.30);
  box-shadow:
    0 30px 60px -28px rgba(59, 130, 246, 0.45),
    0 10px 24px -16px rgba(59, 130, 246, 0.28);
  transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
}
.sld-finale-primary:hover {
  transform: translateY(-4px);
  box-shadow:
    0 50px 100px -36px rgba(59, 130, 246, 0.55),
    0 14px 32px -16px rgba(59, 130, 246, 0.35);
  border-color: rgba(59, 130, 246, 0.50);
}
.sld-finale-primary-h {
  font-size: 30px; font-weight: 700;
  letter-spacing: -0.024em;
  color: var(--af-deep);
  background: linear-gradient(120deg, var(--af-deep) 0%, var(--af-blue) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.sld-finale-primary-sub {
  font-size: 13px; letter-spacing: 0.04em;
  color: var(--af-mute);
  font-weight: 500;
}
.sld-finale-primary-arrow {
  position: absolute;
  right: 30px; top: 50%;
  transform: translateY(-50%);
  width: 44px; height: 44px;
  border-radius: 999px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, var(--af-blue) 0%, var(--af-blue-2) 100%);
  color: #fff;
  font-size: 20px;
  box-shadow: 0 8px 20px -8px rgba(59, 130, 246, 0.55);
  transition: transform .18s ease;
}
.sld-finale-primary:hover .sld-finale-primary-arrow {
  transform: translateY(-50%) translateX(4px);
}
.sld-finale-trust {
  margin-top: 18px;
  font-size: 11px; letter-spacing: 0.10em;
  color: var(--af-mute);
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
  .sld-stage-metric { border-right: none; border-bottom: 1px solid var(--af-line); padding-right: 0; padding-bottom: 16px; }
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
  .sld-trust-hero-row > div { border-right: none; border-bottom: 1px dashed var(--af-line); padding-bottom: 16px; }
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

/* ===== APEX · Pre-approval result console (slide after Stage 1) =====
 * Mocked as a real product UI: status bar, 3-column readout, footer.
 * Mono numerals + monospaced spacing make it read as data, not copy. */
.sld-apex {
  position: relative;
  margin: 28px 0 8px;
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(15, 23, 42, 0.92) 0%, rgba(15, 23, 42, 0.86) 100%);
  border: 1px solid rgba(59, 130, 246, 0.22);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.04) inset,
    0 30px 60px -32px rgba(59, 130, 246, 0.35),
    0 12px 28px -16px rgba(8, 18, 40, 0.55);
  overflow: hidden;
}
.sld-apex::before {
  content: "";
  position: absolute; inset: 0;
  pointer-events: none;
  background:
    radial-gradient(120% 80% at 0% 0%, rgba(59, 130, 246, 0.16) 0%, transparent 55%),
    radial-gradient(80% 60% at 100% 0%, rgba(139, 92, 246, 0.12) 0%, transparent 55%);
}
.sld-apex-head {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 22px 14px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.14);
}
.sld-apex-head-l {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}
.sld-apex-glyph {
  width: 32px; height: 32px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.22), rgba(139, 92, 246, 0.22));
  color: #c7d2fe;
}
.sld-apex-glyph svg { width: 20px; height: 20px; }
.sld-apex-title {
  font-size: 14px;
  font-weight: 600;
  color: #e2e8f0;
  letter-spacing: 0.02em;
}
.sld-apex-buyer {
  margin-top: 3px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 11.5px;
  color: rgba(148, 163, 184, 0.78);
}
.sld-apex-buyer-k {
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 10px;
  color: rgba(148, 163, 184, 0.55);
}
.sld-apex-buyer-v {
  color: #cbd5e1;
}
.sld-apex-buyer-sep {
  color: rgba(148, 163, 184, 0.4);
}
.sld-apex-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px 6px 10px;
  border-radius: 999px;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: #6ee7b7;
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.32);
}
.sld-apex-status-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.18);
  animation: apexPulse 2.4s ease-in-out infinite;
}
@keyframes apexPulse {
  0%, 100% { box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.14); }
  50%      { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0.04); }
}
.sld-apex-grid {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0;
}
.sld-apex-col {
  padding: 18px 22px 22px;
  border-right: 1px solid rgba(148, 163, 184, 0.10);
}
.sld-apex-col:last-child { border-right: 0; }
.sld-apex-col-h {
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: rgba(148, 163, 184, 0.7);
  margin-bottom: 14px;
}
.sld-apex-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 0;
  border-bottom: 1px dashed rgba(148, 163, 184, 0.10);
}
.sld-apex-row:last-child { border-bottom: 0; }
.sld-apex-row-total {
  margin-top: 6px;
  padding-top: 12px;
  border-top: 1px solid rgba(59, 130, 246, 0.32);
  border-bottom: 0;
}
.sld-apex-k {
  font-size: 13px;
  color: #cbd5e1;
}
.sld-apex-v {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 14px;
  color: #f1f5f9;
  font-variant-numeric: tabular-nums;
}
.sld-apex-v-strong {
  color: #93c5fd;
  font-weight: 700;
}
.sld-apex-v-money {
  color: #bfdbfe;
  font-weight: 600;
}
.sld-apex-v-muted {
  color: rgba(148, 163, 184, 0.55);
}
.sld-apex-v-total {
  color: #ddd6fe;
  font-weight: 700;
  font-size: 16px;
  letter-spacing: 0.01em;
}
.sld-apex-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 4px 10px 4px 8px;
  border-radius: 999px;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
}
.sld-apex-pill-yes {
  color: #6ee7b7;
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.28);
}
.sld-apex-pill-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #10b981;
}
.sld-apex-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 22px;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 11.5px;
  color: rgba(148, 163, 184, 0.78);
  border-top: 1px solid rgba(148, 163, 184, 0.10);
  background: rgba(8, 15, 32, 0.4);
}
.sld-apex-foot-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #60a5fa;
  box-shadow: 0 0 8px rgba(96, 165, 250, 0.6);
}
@media (max-width: 980px) {
  .sld-apex-grid { grid-template-columns: 1fr; }
  .sld-apex-col { border-right: 0; border-bottom: 1px solid rgba(148, 163, 184, 0.10); }
  .sld-apex-col:last-child { border-bottom: 0; }
}
@media (max-width: 640px) {
  .sld-apex-head { flex-direction: column; align-items: flex-start; }
  .sld-apex-status { align-self: flex-start; }
}
`;
