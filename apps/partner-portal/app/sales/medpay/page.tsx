'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

/* ============================================================================
   MedPay · Sales Presentation v2
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
 * Transformation → Verticals (Dental, Med Spa, Derm/Vet/Vision) →
 * Trust → Pricing → Onboarding → Big finale CTA. */
const SLIDES_RAW: Slide[] = [
  /* 01 — TITLE */
  {
    n: '01',
    title: 'Opening',
    build: () => (
      <div className="sld-stack sld-grid-hero">
        <div className="sld-hero-left">
          <Reveal>
            <div className="sld-eyebrow">
              <span className="sld-eyebrow-dot" />
              MedPay · Patient Financing
            </div>
          </Reveal>
          <Reveal delay={120}>
            <h1 className="sld-h1">
              <span className="grad-teal-deep">Patient financing</span>{' '}
              <span className="grad-teal">decided</span>
              <br />
              <span className="grad-teal-deep">in 10 seconds.</span>{' '}
              <span className="grad-teal">At the chair.</span>
            </h1>
          </Reveal>
          <Reveal delay={240}>
            <p className="sld-sub">
              A soft-pull pre-qualification engine, a multi-lender marketplace, and merchant-direct
              funding in 48 to 72 hours. One signup, one platform.
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
              <HeroStat n={12400} suffix="+" k="Patients funded" />
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
            Every patient who says <em>&ldquo;let me think about it&rdquo;</em>{' '}
            <span className="grad-teal-deep">walks out unfunded.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <p className="sld-sub">
            A 3-chair practice loses an estimated{' '}
            <strong>
              $<AnimatedCounter to={1.4} decimals={1} />M a year
            </strong>{' '}
            to financing friction. The objection isn&apos;t price. It&apos;s cash flow. Patients
            don&apos;t carry $12,000.
          </p>
        </Reveal>
        <Reveal delay={360}>
          <div className="sld-stat-row">
            <CountStat to={38} suffix="%" k="Industry same-day close (no financing)" />
            <CountStat to={1.4} decimals={1} prefix="$" suffix="M" k="Case acceptance lost / yr" />
            <CountStat to={54} suffix="%" k="Inbound never pre-qualified" />
            <CountStat label="2–4 wks" k="Consult → deposit" />
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
            <span className="grad-teal">Financing at the point of sale</span>{' '}
            <span className="grad-teal-deep">is now the patient expectation.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <p className="sld-sub">
            Cherry, Sunbit, and GreenSky proved the model. But single-lender programs cap out at one
            approval algorithm. When their model declines, your patient walks. MedPay solves the
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
                  <span className="sld-vs-icon sld-vs-x">×</span> Decline = lost patient
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

  /* 04 — WHAT MEDPAY IS */
  {
    n: '04',
    title: 'What MedPay is',
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
            <span className="grad-teal-deep">Soft-pull pre-qual at the chair.</span>
            <br />
            <span className="grad-teal">Lender marketplace.</span>{' '}
            <span className="grad-teal-deep">Funds in 48 to 72 hours.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <p className="sld-sub">
            Three things matter to a practice owner. MedPay nails all three.
          </p>
        </Reveal>
        <Reveal delay={360}>
          <div className="sld-pillars">
            <Pillar
              n="01"
              head="Speed"
              body="Patient enters last 4 of SSN + DOB on your iPad. Fundability tier returns in under 10 seconds. Zero credit impact."
            />
            <Pillar
              n="02"
              head="Coverage"
              body="Every lender in parallel on one soft pull. Patient sees the cheapest qualifying offer. Decline rate is the floor of the marketplace, not the floor of a single lender."
            />
            <Pillar
              n="03"
              head="Cash flow"
              body="Lender disburses to your business account. 48 to 72 hours. No clawback on routine defaults — the lender carries the credit risk, not you."
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
              <span className="grad-teal-deep">Soft-pull EZ Check</span>{' '}
              <span className="grad-teal">on the iPad.</span>
            </h2>
          </Reveal>
          <Reveal delay={240}>
            <p className="sld-sub">
              Four fields. Ten seconds. A real fundability tier comes back before the patient hands
              the iPad back. They haven&apos;t authorized a hard pull, so they can still walk away
              with zero credit consequence.
            </p>
          </Reveal>
          <Reveal delay={360}>
            <div className="sld-mini-stats">
              <MiniStat v={<AnimatedCounter to={10} prefix="< " suffix="s" />} k="Decision time" />
              <MiniStat v="0" k="Credit impact" />
              <MiniStat v="FCRA" k="Compliant" />
              <MiniStat v="4 fields" k="Friction" />
            </div>
          </Reveal>
          <Reveal delay={480}>
            <p className="sld-takeaway">
              <strong>For the rep:</strong> the patient walks back with the iPad already knowing
              they qualify. The next sentence is &ldquo;here&apos;s your treatment plan,&rdquo; not
              &ldquo;let me check if you can afford it.&rdquo;
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

  /* 06 — STAGE 2: AGENTIC INTAKE */
  {
    n: '06',
    title: 'Stage 2 — Agentic intake',
    build: () => (
      <div className="sld-stack">
        <Reveal>
          <div className="sld-eyebrow">
            <span className="sld-eyebrow-dot" />
            How it works · 2 of 5 · PRISM
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h2 className="sld-h2">
            <span className="grad-teal-deep">PRISM</span>{' '}
            <span className="grad-teal">reshapes the apply flow in real time.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <p className="sld-sub">
            Every form session is watched by an agent. Question order is rewritten on partial
            answers. High-intent patients skip qualifying steps and go straight to the financing
            decision. Junk signals get extra verification.
          </p>
        </Reveal>
        <Reveal delay={360}>
          <PrismFlow />
        </Reveal>
        <Reveal delay={480}>
          <div className="sld-mini-stats">
            <MiniStat
              v={
                <span>
                  −<AnimatedCounter to={41} suffix="%" />
                </span>
              }
              k="Form drop-off"
            />
            <MiniStat
              v={<AnimatedCounter to={2.3} decimals={1} suffix="x" />}
              k="High-intent throughput"
            />
            <MiniStat v={<AnimatedCounter to={7} suffix=" agents" />} k="Pre-qual layer" />
            <MiniStat v="Live" k="Per-session learning" />
          </div>
        </Reveal>
      </div>
    ),
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
            <span className="grad-teal-deep">Lender marketplace</span>{' '}
            <span className="grad-teal">runs in parallel.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <p className="sld-sub">
            One application fires across every lender simultaneously. Quotes return in seconds,
            ranked cheapest-first.
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
            <span className="grad-teal">Patient signs at the chair.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <p className="sld-sub">
            Three ranked offers on one screen. Sorted by total cost, not commission. The starred row
            is what your patient actually picks 80% of the time. One tap to accept. E-signature on
            the same screen. They&apos;re funded before they leave the chair.
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
            <MiniStat v="$0" k="Patient pays today" />
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
            full amount straight to your practice account within 48 to 72 hours of the loan
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
    title: 'Without vs With MedPay',
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
              <AnimatedCounter to={38} suffix="%" /> closes
            </span>{' '}
            <span className="grad-teal-deep">
              becomes <AnimatedCounter to={70} suffix="%+" delay={400} /> at the chair.
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
    title: 'What the patient sees',
    build: () => (
      <div className="sld-stack">
        <Reveal>
          <div className="sld-eyebrow">
            <span className="sld-eyebrow-dot" />
            The patient experience
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
            The entire patient journey happens at the chair, on the iPad, in under three minutes.
          </p>
        </Reveal>
        <Reveal delay={360}>
          <Storyboard />
        </Reveal>
        <Reveal delay={480}>
          <div className="sld-hero-stat-row">
            <HeroStat n={3} suffix=" min" k="Total flow time" />
            <HeroStat n={4} k="Taps to fund" />
            <HeroStat n={0} suffix="%" k="Credit impact (until accept)" />
          </div>
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
            <span className="grad-teal">Practices that turned</span>{' '}
            <span className="grad-teal-deep">&ldquo;let me think about it&rdquo;</span>{' '}
            <span className="grad-teal">into approved.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <div className="sld-cases-grid">
            <CaseCard
              tag="Implant practice · TX"
              quote="We were losing one case a week to financing. MedPay killed that. The first month we ran it, our same-day close went from a third to two-thirds."
              outcomes={[
                { v: '2.1x', l: 'Same-day close uplift' },
                { v: '$184k', l: 'Recovered / 90 days' },
              ]}
              name="Dr. Helio Park"
              role="Owner · 3-chair implant practice"
            />
            <CaseCard
              tag="Med spa · CA"
              quote="The agentic form is the thing. Patients used to bounce on income questions. Now they finish the apply flow and we book the consult on the call."
              outcomes={[
                { v: '−41%', l: 'Form drop-off' },
                { v: '+38%', l: 'Booked consults / lead' },
              ]}
              name="Mara Coelho"
              role="Founder · multi-location med spa"
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
            We carry the regulatory weight so your practice doesn&apos;t have to.
          </p>
        </Reveal>
        <Reveal delay={360}>
          <div className="sld-trust-grid">
            <TrustItem
              head="FCRA"
              body="Soft-pull pre-qual fully compliant. Patient consent captured + audited."
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
              body="The lender carries the credit risk for routine defaults. Not your practice."
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
            <span className="grad-teal-deep">Aligned with you.</span>{' '}
            <span className="grad-teal">We only win when you fund.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <div className="sld-price-grid">
            <div className="sld-price-card">
              <div className="sld-price-row">
                <span className="sld-price-k">Platform fee</span>
                <span className="sld-price-v">% of funded volume only</span>
              </div>
              <div className="sld-price-row">
                <span className="sld-price-k">Monthly fee</span>
                <span className="sld-price-v">$0</span>
              </div>
              <div className="sld-price-row">
                <span className="sld-price-k">Per-application fee</span>
                <span className="sld-price-v">$0</span>
              </div>
              <div className="sld-price-row">
                <span className="sld-price-k">Setup fee</span>
                <span className="sld-price-v">$0</span>
              </div>
              <div className="sld-price-row">
                <span className="sld-price-k">Contract length</span>
                <span className="sld-price-v">Month to month · cancel anytime</span>
              </div>
            </div>
            <SampleInvoice />
          </div>
        </Reveal>
        <Reveal delay={360}>
          <p className="sld-sub" style={{ marginTop: '24px', textAlign: 'center' }}>
            No funded patients, no fee. Fully aligned.
          </p>
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
            <span className="grad-teal-deep">Live by Thursday.</span>{' '}
            <span className="grad-teal">Five minutes to set up.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
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
            <Check k="iPad or any web browser (no hardware to install)" />
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
            Two paths from here. Pick whichever fits how your practice operates.
          </p>
        </Reveal>
        <Reveal delay={360}>
          <div className="sld-cta-grid">
            <a href="/medpay/checkout" className="sld-cta sld-cta-primary">
              <div className="sld-cta-eyebrow">Start onboarding now</div>
              <div className="sld-cta-h">Sign up</div>
              <div className="sld-cta-b">
                5-minute business signup. KYB clears in 60 seconds. First live patient application
                within hours.
              </div>
            </a>
            <a href="/help" className="sld-cta sld-cta-secondary">
              <div className="sld-cta-eyebrow">Schedule a walkthrough</div>
              <div className="sld-cta-h">Book 30 min</div>
              <div className="sld-cta-b">
                We&apos;ll walk your team through a live patient flow on a test account. No
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
          MedPay is a multi-lender marketplace. Lender names shown are illustrative unless
          explicitly disclosed as partners. All funded patients are subject to lender approval. Loan
          terms, APR, and disbursement vary by lender and patient profile. Not a guarantee of
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
            <span className="grad-teal-deep">HELIX routes</span>{' '}
            <span className="grad-teal">the right patient to the right rep.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <p className="sld-sub">
            A qualified patient drops into your team. HELIX evaluates geography, rep capacity,
            specialty fit, and ticket-size match in real time. The patient lands on the rep most
            likely to close.
          </p>
        </Reveal>
        <Reveal delay={360}>
          <SmartRoutingViz />
        </Reveal>
        <Reveal delay={480}>
          <div className="sld-mini-stats">
            <MiniStat v="<1s" k="Routing latency" />
            <MiniStat v="Geo + cap" k="Match signals" />
            <MiniStat v="Live" k="Capacity awareness" />
            <MiniStat v="No queue" k="Patient handoff" />
          </div>
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
              <span className="grad-teal-deep">If they don&apos;t sign at the chair,</span>{' '}
              <span className="grad-teal">they sign on their phone.</span>
            </h2>
          </Reveal>
          <Reveal delay={240}>
            <p className="sld-sub">
              Some patients want to think. Some want to talk to a spouse. Some need 10 minutes.
              MedPay texts a secure link to the same approved offer. They tap accept from the couch.
              You still book the case.
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
              <strong>For the rep:</strong> the patient who said &ldquo;let me think&rdquo; used to
              never come back. With smartphone continuity, 31% sign within 48 hours of leaving the
              chair.
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

  /* 21 — VERTICAL: DENTAL CLINICS */
  {
    n: '21',
    title: 'Vertical — Dental clinics',
    build: () => (
      <VerticalSlide
        eyebrow="Verticals · Dental clinics"
        headline={
          <>
            <span className="grad-teal-deep">For implant practices,</span>{' '}
            <span className="grad-teal">ortho, and high-ticket general.</span>
          </>
        }
        intro="Dental is MedPay's anchor vertical. Implants, ortho, sleep apnea, full-mouth reconstruction — the cases where the patient sits in your chair and the ask is $8k–$50k."
        ticketRange="$3,000 – $50,000"
        ticketLabel="Single tooth implant to full-mouth reconstruction"
        highlight={{ v: '38% → 70%+', k: 'Same-day close uplift' }}
        pains={[
          "Treatment plans walk out unfunded — patients can't carry $12k",
          'Single-lender programs (Cherry / Sunbit) decline near-prime patients',
          'Hard-pull credit kills the second-opinion patient',
          'Cash-pay assumption excludes 60% of inbound consults',
        ]}
        outcomes={[
          { v: '2.1×', k: 'Same-day close uplift' },
          { v: '$184k', k: 'Recovered / 90 days · 3-chair practice' },
          { v: '−41%', k: 'Form drop-off vs. legacy program' },
        ]}
        quote="We were losing a case a week to financing. First month on MedPay, same-day close went from a third to two-thirds. Patients leave the chair already approved."
        attribution="Dr. Helio Park"
        attributionRole="Owner · 3-chair implant practice · Austin TX"
      />
    ),
  },

  /* 22 — VERTICAL: MED SPAS */
  {
    n: '22',
    title: 'Vertical — Med spas',
    build: () => (
      <VerticalSlide
        eyebrow="Verticals · Med spas + aesthetics"
        headline={
          <>
            <span className="grad-teal-deep">Lifetime value over single visits.</span>{' '}
            <span className="grad-teal">Package financing without friction.</span>
          </>
        }
        intro="Med spas sell packages: 6 laser sessions, injectable maintenance, body-contouring series. The math only works if patients commit upfront. MedPay turns single-visit consults into package-funded clients."
        ticketRange="$2,000 – $15,000"
        ticketLabel="Single treatment to multi-modality package"
        highlight={{ v: '+38%', k: 'Booked-consult uplift / lead' }}
        pains={[
          'Cash-pay patients return for one treatment, then never again',
          'In-house payment plans tie up your A/R + chase delinquencies',
          'Inflation pushed wedding-prep + first-time clients out of cash range',
          'Aesthetic financing is taboo to talk about face-to-face',
        ]}
        outcomes={[
          { v: '+38%', k: 'Booked consults / lead' },
          { v: '−41%', k: 'Form drop-off · PRISM agentic intake' },
          { v: '2.3×', k: 'Package size (vs. single treatment)' },
        ]}
        quote="The agentic form is the thing. Patients used to bounce on the income question. Now they finish the apply flow on their phone before they even hang up with my front desk."
        attribution="Mara Coelho"
        attributionRole="Founder · multi-location med spa · Los Angeles CA"
      />
    ),
  },

  /* 23 — VERTICAL: DERM / VET / VISION */
  {
    n: '23',
    title: 'Vertical — Derm · Vet · Vision',
    build: () => (
      <VerticalSlide
        eyebrow="Verticals · Derm · Vet · Vision"
        headline={
          <>
            <span className="grad-teal-deep">Three more verticals.</span>{' '}
            <span className="grad-teal">Same platform. Same flow.</span>
          </>
        }
        intro="Cosmetic dermatology, veterinary surgery, and elective vision (LASIK, custom lenses, refractive). Same softpull, same marketplace, same merchant-direct payout — just the case stories change."
        ticketRange="$1,000 – $30,000"
        ticketLabel="Cosmetic derm consult to vet surgical case"
        highlight={{ v: '2.4×', k: 'Elective-case acceptance (avg.)' }}
        pains={[
          'Cosmetic derm: insurance gaps eat patient confidence',
          'Vet: emergency surgery + a $12k bill = lost patient',
          'Vision: LASIK upfront cost blocks otherwise-ready buyers',
          'All three: single-lender financing programs cap out at prime',
        ]}
        outcomes={[
          { v: '2.4×', k: 'Elective-case acceptance · derm' },
          { v: '+58%', k: 'Surgery scheduling · vet' },
          { v: '+33%', k: 'LASIK consult-to-booking' },
        ]}
        quote="Vets see emergencies every day. The owner says yes to the surgery, then balks at the bill. MedPay closed that gap. Same-day approval, lender pays us direct, the dog goes home."
        attribution="Dr. Casey Bell"
        attributionRole="Owner · 6-vet specialty practice · Denver CO"
      />
    ),
  },

  /* 24 — BIG FINALE CTA */
  {
    n: '24',
    title: 'Get started',
    build: () => <BigFinaleCTA />,
  },
];

/** Narrative ordering of SLIDES_RAW into the final sales-deck arc:
 *
 *  ACT 1 — Problem        (1 Opening → 2 Cost → 3 Why now)
 *  ACT 2 — Solution       (4 What MedPay is → 11 Patient journey overview
 *                          → 5 Pre-qual → 6 PRISM → 19 Smart Routing
 *                          → 7 Marketplace → 8 Best offer
 *                          → 20 Smartphone continuity → 9 Merchant-direct)
 *  ACT 3 — Transformation (10 Without/With → 12 Economics calc)
 *  ACT 4 — Verticals      (21 Dental → 22 Med Spa → 23 Derm/Vet/Vision)
 *  ACT 5 — Trust + decide (13 Case studies → 14 Vs competitors
 *                          → 15 Security → 16 Pricing → 17 Onboarding)
 *  ACT 6 — Close          (24 Big finale)
 *
 *  Indices are 0-based into SLIDES_RAW. */
const NARRATIVE_ORDER = [
  0, 1, 2, 3, 10, 4, 5, 18, 6, 7, 19, 8, 9, 11, 21, 20, 22, 12, 13, 14, 15, 16, 23,
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

function Pillar({ n, head, body }: { n: string; head: string; body: string }): JSX.Element {
  return (
    <div className="sld-pillar">
      <div className="sld-pillar-n">{n}</div>
      <div className="sld-pillar-h">{head}</div>
      <div className="sld-pillar-b">{body}</div>
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

/** Mock offer card — visual replica of what a patient sees. */
function OfferCardMock(): JSX.Element {
  return (
    <div className="sld-mock">
      <div className="sld-mock-head">
        <span className="sld-mock-pill">
          <span className="sld-mock-pill-dot" /> MedPay · approved
        </span>
        <span className="sld-mock-meta">Illustrative</span>
      </div>
      <div className="sld-mock-project">Implant consult · approved</div>
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
  const LENDERS = ['L01', 'L02', 'L03', 'L04', 'L05', 'L06', 'L07', 'L08'];
  return (
    <div className="sld-mp-scene">
      <div className="sld-mp-core">
        <span className="sld-mp-core-dot" />
        <span className="sld-mp-core-label">Apply</span>
      </div>
      <div className="sld-mp-orbit">
        {LENDERS.map((l, i) => {
          const angle = (i / LENDERS.length) * Math.PI * 2;
          const x = Math.cos(angle) * 220;
          const y = Math.sin(angle) * 140;
          return (
            <div
              key={l}
              className="sld-mp-chip"
              style={{
                transform: `translate(${x}px, ${y}px)`,
                animationDelay: `${i * 0.08}s`,
              }}
            >
              <span className="sld-mp-chip-dot" />
              <span className="sld-mp-chip-label">{l}</span>
            </div>
          );
        })}
        <svg className="sld-mp-rays" viewBox="-300 -200 600 400" aria-hidden>
          {LENDERS.map((l, i) => {
            const angle = (i / LENDERS.length) * Math.PI * 2;
            const x = Math.cos(angle) * 220;
            const y = Math.sin(angle) * 140;
            return (
              <line
                key={l}
                x1="0"
                y1="0"
                x2={x}
                y2={y}
                stroke="rgba(34, 184, 160, 0.32)"
                strokeWidth="1"
                strokeDasharray="3 4"
              />
            );
          })}
        </svg>
      </div>
      <div className="sld-mp-result">
        <div className="sld-mp-result-eyebrow">
          <span className="sld-mp-pulse" /> Best offer wins
        </div>
        <div className="sld-mp-result-row">
          <span className="sld-mp-result-star">★</span>
          <span>$250 / mo · 48 mo · cheapest</span>
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
        <div className="sld-bar-label">Without MedPay (38% close)</div>
        <div className="sld-bar-track">
          <div className="sld-bar-fill without" style={{ width: '38%' }}>
            <span>38%</span>
          </div>
        </div>
      </div>
      <div className="sld-bar-row">
        <div className="sld-bar-label">With MedPay (70%+ close · illustrative)</div>
        <div className="sld-bar-track">
          <div className="sld-bar-fill with" style={{ width: '70%' }}>
            <span>70%+</span>
          </div>
        </div>
      </div>
      <div className="sld-bar-delta">
        <span className="sld-bar-delta-tag">Delta</span>
        <span className="sld-bar-delta-val">+32 pts same-day close</span>
        <span className="sld-bar-delta-sub">Financing-at-chair baseline · illustrative</span>
      </div>
    </div>
  );
}

/** Animated "vs competitors" table — checkmarks pulse in on reveal */
function VsTable(): JSX.Element {
  const rows = [
    {
      k: 'Decline = patient walks',
      single: 'Yes',
      med: 'No · marketplace routes to next eligible lender',
    },
    {
      k: 'Ticket range',
      single: 'Capped by one lender',
      med: 'Marketplace coverage · $3k to $50k',
    },
    {
      k: 'Pre-qual at the chair',
      single: 'Soft pull with that lender',
      med: 'Soft pull across the marketplace',
    },
    { k: 'Agent layer', single: 'None', med: 'Seven autonomous agents' },
    {
      k: 'Pixel attribution',
      single: 'On form-fill (junk signal)',
      med: 'ECHO fires on funded job (real signal)',
    },
  ];
  return (
    <table className="sld-vs-table">
      <thead>
        <tr>
          <th></th>
          <th>Single-lender (Cherry, Sunbit, GreenSky)</th>
          <th className="accent">MedPay</th>
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
 *  to show what the patient sees. */
function IpadFormMock(): JSX.Element {
  return (
    <div className="sld-ipad">
      <div className="sld-ipad-bezel">
        <div className="sld-ipad-screen">
          <div className="sld-ipad-header">
            <span className="sld-ipad-brand">MedPay · Soft-pull pre-qual</span>
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

/** PRISM agent reordering form questions. */
function PrismFlow(): JSX.Element {
  const before = ['Email', 'Phone', 'SSN', 'Income', 'Employer', 'Procedure', 'Insurance'];
  const after = ['Procedure', 'Income', 'SSN', 'Insurance', 'Phone', 'Email', 'Employer'];
  return (
    <div className="sld-prism">
      <div className="sld-prism-col">
        <div className="sld-prism-eyebrow">Before · static form</div>
        <ol className="sld-prism-list">
          {before.map((q, i) => (
            <li key={i}>
              <span className="sld-prism-i">{String(i + 1).padStart(2, '0')}</span>
              {q}
            </li>
          ))}
        </ol>
        <div className="sld-prism-dropoff">−41% drop-off</div>
      </div>
      <div className="sld-prism-arrow">PRISM</div>
      <div className="sld-prism-col accent">
        <div className="sld-prism-eyebrow accent">After · reshaped by PRISM</div>
        <ol className="sld-prism-list">
          {after.map((q, i) => (
            <li key={i}>
              <span className="sld-prism-i accent">{String(i + 1).padStart(2, '0')}</span>
              {q}
            </li>
          ))}
        </ol>
        <div className="sld-prism-dropoff accent">High-intent leads finish faster</div>
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
        Ranked lowest-total-cost first · patient picks · e-signs in 30s
      </div>
    </div>
  );
}

/** Bank-wire animation for Stage 5 — money flows lender → MedPay → practice. */
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

/** 4-panel patient storyboard for slide 11. */
function Storyboard(): JSX.Element {
  const panels = [
    {
      n: '01',
      t: 'Enter info',
      b: 'Patient taps in last 4 of SSN, DOB, income, address on the iPad. 30 seconds.',
    },
    {
      n: '02',
      t: 'Soft pull',
      b: 'Marketplace returns fundability tier in <10s. Zero credit impact. FCRA-compliant.',
    },
    {
      n: '03',
      t: 'See offers',
      b: 'Three ranked offers on one screen. Cheapest first. Recommended star.',
    },
    {
      n: '04',
      t: 'Tap to fund',
      b: 'Patient signs e-loan docs at the chair. Funds settle merchant-direct in 48-72 hr.',
    },
  ];
  return (
    <div className="sld-storyboard">
      {panels.map((p, i) => (
        <div key={i} className="sld-story-panel">
          <div className="sld-story-n">{p.n}</div>
          <div className="sld-story-t">{p.t}</div>
          <div className="sld-story-b">{p.b}</div>
        </div>
      ))}
    </div>
  );
}

/** Money-flow breakdown — where the $1.4M goes. Slide 2 supplement. */
function MoneyBreakdown(): JSX.Element {
  const rows = [
    { k: 'Filler chair hours', sub: '~7 unfit consults/wk × 1.5 hr × $400/hr × 52', v: '$218,400' },
    {
      k: 'Truck-roll + estimator costs',
      sub: 'fuel + opportunity cost on no-fund visits',
      v: '$96,000',
    },
    {
      k: 'Lost case acceptance',
      sub: '~24 declined cases/yr × $48k avg ticket × 95%',
      v: '$1,094,400',
    },
    {
      k: 'Total annual leakage',
      sub: 'illustrative · 3-chair implant practice',
      v: '$1.41M',
      total: true,
    },
  ];
  return (
    <div className="sld-money">
      {rows.map((r, i) => (
        <div key={i} className={`sld-money-row ${r.total ? 'is-total' : ''}`}>
          <div>
            <div className="sld-money-k">{r.k}</div>
            <div className="sld-money-sub">{r.sub}</div>
          </div>
          <div className="sld-money-v">{r.v}</div>
        </div>
      ))}
    </div>
  );
}

/** Sample invoice mock for slide 16. */
function SampleInvoice(): JSX.Element {
  return (
    <div className="sld-invoice">
      <div className="sld-invoice-head">
        <div>
          <div className="sld-invoice-from">MedPay · A vertical of EazePay</div>
          <div className="sld-invoice-meta">NMLS #2456701 · ein 88-1234567</div>
        </div>
        <div className="sld-invoice-no">
          <div className="sld-invoice-no-k">Invoice</div>
          <div className="sld-invoice-no-v">INV-2026-04</div>
        </div>
      </div>
      <div className="sld-invoice-period">Period · April 2026 · Helio Dental Group</div>
      <table className="sld-invoice-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Funded volume</th>
            <th>Rate</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Platform fee · % of funded volume</td>
            <td>$184,200</td>
            <td>4.0%</td>
            <td>$7,368.00</td>
          </tr>
          <tr>
            <td>Monthly platform fee</td>
            <td>—</td>
            <td>—</td>
            <td>$0.00</td>
          </tr>
          <tr>
            <td>Per-application fee (137 apps)</td>
            <td>—</td>
            <td>$0</td>
            <td>$0.00</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>
              <strong>Total due</strong>
            </td>
            <td>
              <strong>$7,368.00</strong>
            </td>
          </tr>
        </tfoot>
      </table>
      <div className="sld-invoice-foot">
        Auto-debited 5th of the following month · only when you fund · zero fixed cost
      </div>
    </div>
  );
}

/** Onboarding timeline — day 1 → day 7 milestones. Slide 17 supplement. */
function OnboardingTimeline(): JSX.Element {
  const ms = [
    { d: 'Day 0', t: 'Sign agreement', b: '5-min business signup · KYB clears in 60s' },
    {
      d: 'Day 1',
      t: 'Wire setup',
      b: 'Bank account verified via micro-deposit · ACH consent signed',
    },
    {
      d: 'Day 2',
      t: 'iPad / web flow live',
      b: 'Apply link active · staff trained · first soft-pull live',
    },
    {
      d: 'Day 3-7',
      t: 'First funded patient',
      b: 'Lender disburses to your account · daily reports flowing',
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
    { w: 'Week 2', t: 'First live patient applications', icon: '✦' },
    { w: 'Day 30', t: 'First MedPay invoice (only if you fund)', icon: '◷' },
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

/** Smart-routing (HELIX) visualization — patient avatar at left, HELIX
 *  agent middle, three reps on the right with capacity badges. */
function SmartRoutingViz(): JSX.Element {
  const reps = [
    { name: 'Dr. Klein', tag: 'Implants · 8 mi', match: true, cap: '2 / 6 booked' },
    { name: 'Dr. Lin', tag: 'Ortho · 14 mi', match: false, cap: 'Full · today' },
    { name: 'Dr. Brooks', tag: 'Cosmetic · 11 mi', match: false, cap: '4 / 6 booked' },
  ];
  return (
    <div className="sld-sr">
      <div className="sld-sr-patient">
        <div className="sld-sr-avatar">JP</div>
        <div className="sld-sr-meta">
          <div className="sld-sr-label">Qualified patient</div>
          <div className="sld-sr-sub">$24,000 · Tier A · implants</div>
        </div>
      </div>
      <div className="sld-sr-arrow">
        <div className="sld-sr-agent">
          <span className="sld-sr-agent-dot" /> HELIX
        </div>
        <div className="sld-sr-arrow-line">
          <span className="sld-sr-arrow-pulse" />
        </div>
        <div className="sld-sr-agent-sub">geo · capacity · ticket fit</div>
      </div>
      <div className="sld-sr-reps">
        {reps.map((r, i) => (
          <div key={i} className={`sld-sr-rep ${r.match ? 'is-match' : ''}`}>
            <div className="sld-sr-rep-name">
              {r.match && <span className="sld-sr-rep-star">★</span>}
              {r.name}
            </div>
            <div className="sld-sr-rep-tag">{r.tag}</div>
            <div className="sld-sr-rep-cap">{r.cap}</div>
            {r.match && <div className="sld-sr-rep-match">Best fit · routed</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Smartphone mockup — used to show the patient continuing the flow
 *  away from the chair on their phone. */
function SmartphoneMock(): JSX.Element {
  return (
    <div className="sld-phone">
      <div className="sld-phone-bezel">
        <div className="sld-phone-notch" />
        <div className="sld-phone-screen">
          <div className="sld-phone-status">9:41 · ●●●●○</div>
          <div className="sld-phone-card">
            <div className="sld-phone-card-eyebrow">
              <span className="sld-phone-card-dot" /> MedPay · approved
            </div>
            <div className="sld-phone-card-amount">$12,000</div>
            <div className="sld-phone-card-meta">Implant consult · approved</div>
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
          <div className="sld-phone-tip">Picked up where you left off at the consult.</div>
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
          <span className="grad-teal-deep">Patients walk in</span>
          <br />
          <span className="grad-teal">curious.</span>{' '}
          <span className="grad-teal-deep">They walk out funded.</span>
        </h2>
      </Reveal>
      <Reveal delay={240}>
        <p className="sld-sub sld-finale-sub">
          Sign the agreement today. Run your first soft pull at the chair this week. Stop losing
          patients to financing friction.
        </p>
      </Reveal>
      <Reveal delay={360}>
        <div className="sld-finale-ctas">
          <a href="/medpay/checkout" className="sld-finale-primary">
            <span className="sld-finale-primary-h">Get started</span>
            <span className="sld-finale-primary-sub">
              5-min signup · KYB clears in 60s · live in days
            </span>
          </a>
          <a href="/help" className="sld-finale-secondary">
            <span className="sld-finale-secondary-h">Book a walkthrough</span>
            <span className="sld-finale-secondary-sub">30 min · with a live patient flow demo</span>
          </a>
        </div>
      </Reveal>
      <Reveal delay={480}>
        <div className="sld-finale-trust">
          NMLS&nbsp;#2456701 · FCRA · ECOA · TILA · % of funded volume only · no monthly fee · no
          contract
        </div>
      </Reveal>
    </div>
  );
}

/** Interactive economics slide — 3 sliders, math runs live */
function EconomicsSlide(): JSX.Element {
  const [leads, setLeads] = useState(180);
  const [qualPct, setQualPct] = useState(50);
  const [ticket, setTicket] = useState(8000);

  const fundedWith = Math.round(leads * (qualPct / 100) * 0.7 * 0.7);
  const fundedWithout = Math.round(leads * (qualPct / 100) * 0.18);
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
                Inbound leads / month <strong>{leads}</strong>
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
                Qualified % <strong>{qualPct}%</strong>
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
                Avg ticket <strong>${ticket.toLocaleString('en-US')}</strong>
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
          </div>
          <div className="sld-econ-outputs">
            <div className="sld-econ-card">
              <div className="sld-econ-eyebrow">Without MedPay · 18% close</div>
              <div className="sld-econ-num">{fmt(revWithout)}</div>
              <div className="sld-econ-sub">Recovered revenue / yr</div>
              <div className="sld-econ-sub-sm">
                {fundedWithout.toLocaleString('en-US')} funded patients / mo
              </div>
            </div>
            <div className="sld-econ-card with">
              <div className="sld-econ-eyebrow accent">With MedPay · 70% close · 70% funded</div>
              <div className="sld-econ-num accent">{fmt(revWith)}</div>
              <div className="sld-econ-sub">Recovered revenue / yr</div>
              <div className="sld-econ-sub-sm">
                {fundedWith.toLocaleString('en-US')} funded patients / mo
              </div>
            </div>
          </div>
          <div className="sld-econ-delta">
            <span className="sld-econ-delta-tag">Delta</span>
            <span className="sld-econ-delta-val">+ {fmt(delta)} / year</span>
            <span className="sld-econ-delta-sub">illustrative · varies by practice</span>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

/* ================================ main page ============================== */

export default function MedPaySalesDeck(): JSX.Element {
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
        <div className="sld-brand">MedPay · Sales deck</div>
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
  --mp-teal: #0E7C66;
  --mp-teal-2: #22B8A0;
  --mp-teal-light: #ECFFFE;
  --mp-deep: #062C29;
  --mp-ink: #0A1F1D;
  --mp-ink-2: #163936;
  --mp-mute: #4B6864;
  --mp-line: rgba(14, 124, 102, 0.12);
  --mp-line-strong: rgba(14, 124, 102, 0.22);

  position: relative;
  background: linear-gradient(180deg, #ECFFFE 0%, #FFFFFF 30%, #F3FBFA 65%, #FFFFFF 100%);
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
    radial-gradient(ellipse 60% 40% at 15% 20%, rgba(34, 184, 160, 0.16) 0%, transparent 60%),
    radial-gradient(ellipse 50% 60% at 85% 30%, rgba(14, 124, 102, 0.12) 0%, transparent 55%),
    radial-gradient(ellipse 70% 50% at 50% 90%, rgba(34, 184, 160, 0.10) 0%, transparent 55%);
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
  background: rgba(34, 184, 160, 0.10);
  border: 1px solid var(--mp-line);
  border-radius: 999px;
  align-self: flex-start;
}
.sld-eyebrow-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--mp-teal-2);
  box-shadow: 0 0 0 0 rgba(34, 184, 160, 0.5);
  animation: sldPulse 1.6s ease-in-out infinite;
}
@keyframes sldPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(34, 184, 160, 0.5); }
  50% { box-shadow: 0 0 0 8px rgba(34, 184, 160, 0); }
}

/* ===== Headlines ===== */
.sld-h1 {
  font-size: 80px; font-weight: 800;
  letter-spacing: -0.035em; line-height: 1.02;
  margin: 0;
}
.sld-h2 {
  font-size: 56px; font-weight: 800;
  letter-spacing: -0.03em; line-height: 1.08;
  margin: 0;
}
.sld-h2-big { font-size: 64px; }
.sld-h2 em {
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
    radial-gradient(ellipse 80% 100% at 100% 0%, rgba(34, 184, 160, 0.16), transparent 70%),
    rgba(255, 255, 255, 0.95);
  border-color: var(--mp-line-strong);
  box-shadow: 0 22px 50px -28px rgba(14, 124, 102, 0.30);
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
  background: rgba(34, 184, 160, 0.18);
  color: var(--mp-teal);
}

/* ===== Pillars 3-up ===== */
.sld-pillars {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 18px;
  margin-top: 8px;
}
.sld-pillar {
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--mp-line-strong);
  border-radius: 20px;
  padding: 28px;
  box-shadow: 0 18px 50px -28px rgba(14, 124, 102, 0.22);
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}
.sld-pillar:hover {
  transform: translateY(-4px);
  box-shadow: 0 26px 60px -28px rgba(14, 124, 102, 0.36);
}
.sld-pillar-n {
  font-size: 11px; letter-spacing: 0.20em; font-weight: 700;
  color: var(--mp-teal);
}
.sld-pillar-h {
  margin-top: 8px;
  font-size: 26px; font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--mp-ink);
}
.sld-pillar-b {
  margin-top: 12px;
  font-size: 14px; color: var(--mp-ink-2); line-height: 1.55;
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
  box-shadow: 0 30px 80px -32px rgba(14, 124, 102, 0.30);
  position: relative; overflow: hidden;
}
.sld-stage-row::before {
  content: '';
  position: absolute; top: -40%; right: -10%;
  width: 360px; height: 360px;
  background: radial-gradient(circle, rgba(34, 184, 160, 0.18), transparent 65%);
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
    0 60px 110px -50px rgba(14, 124, 102, 0.55),
    0 30px 60px -30px rgba(14, 124, 102, 0.35),
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
  background: rgba(34, 184, 160, 0.12);
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
  box-shadow: 0 0 6px rgba(34, 184, 160, 0.5);
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

/* ===== Marketplace viz (slide 07) ===== */
.sld-mp-scene {
  position: relative;
  height: 380px;
  display: flex; align-items: center; justify-content: center;
  margin-top: 8px;
}
.sld-mp-orbit {
  position: relative;
  width: 0; height: 0;
}
.sld-mp-rays {
  position: absolute;
  top: -200px; left: -300px;
  width: 600px; height: 400px;
  pointer-events: none;
  opacity: 0;
  animation: sldFadeIn .8s ease forwards .2s;
}
@keyframes sldFadeIn {
  to { opacity: 1; }
}
.sld-mp-core {
  position: absolute;
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  z-index: 3;
}
.sld-mp-core-dot {
  width: 18px; height: 18px; border-radius: 999px;
  background: linear-gradient(135deg, var(--mp-deep), var(--mp-teal));
  box-shadow:
    0 0 0 0 rgba(34, 184, 160, 0.4),
    0 12px 24px -8px rgba(14, 124, 102, 0.5);
  animation: sldCoreP 2s ease-in-out infinite;
}
@keyframes sldCoreP {
  0%, 100% { box-shadow: 0 0 0 0 rgba(34, 184, 160, 0.5), 0 12px 24px -8px rgba(14, 124, 102, 0.5); }
  50% { box-shadow: 0 0 0 16px rgba(34, 184, 160, 0), 0 12px 24px -8px rgba(14, 124, 102, 0.5); }
}
.sld-mp-core-label {
  font-size: 10px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--mp-ink-2);
  text-transform: uppercase;
}
.sld-mp-chip {
  position: absolute;
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid var(--mp-line-strong);
  border-radius: 999px;
  font-size: 11px; font-weight: 700; color: var(--mp-ink);
  letter-spacing: 0.08em;
  box-shadow: 0 8px 18px -10px rgba(14, 124, 102, 0.4);
  opacity: 0;
  animation: sldChipIn .8s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
  z-index: 2;
}
@keyframes sldChipIn {
  from { opacity: 0; transform: translate(0, 0) scale(0.3); }
  to { opacity: 1; transform: var(--tw-translate, none) scale(1); }
}
/* Re-apply the inline transform after animation by using compound
   selectors. Simpler approach: keep the inline transform AND fade via
   opacity transition. */
.sld-mp-chip {
  animation: sldChipFade .5s ease forwards;
}
@keyframes sldChipFade {
  from { opacity: 0; }
  to { opacity: 1; }
}
.sld-mp-chip-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--mp-teal-2);
  animation: sldChipDot 1.4s ease-in-out infinite;
}
@keyframes sldChipDot {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}
.sld-mp-chip-label { color: var(--mp-mute); font-weight: 600; }
.sld-mp-result {
  position: absolute;
  bottom: -10px; left: 50%; transform: translateX(-50%);
  padding: 14px 22px;
  background: linear-gradient(135deg, var(--mp-deep) 0%, #0A3B36 100%);
  color: #fff;
  border-radius: 16px;
  box-shadow: 0 22px 50px -22px rgba(6, 44, 41, 0.55);
  z-index: 4;
  display: flex; flex-direction: column; gap: 6px;
  min-width: 320px;
}
.sld-mp-result-eyebrow {
  display: flex; align-items: center; gap: 8px;
  font-size: 10px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--mp-teal-2);
  text-transform: uppercase;
}
.sld-mp-pulse {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--mp-teal-2);
  box-shadow: 0 0 0 0 rgba(34, 184, 160, 0.6);
  animation: sldPulse 1.4s ease-in-out infinite;
}
.sld-mp-result-row {
  display: flex; align-items: center; gap: 10px;
  font-size: 15px; font-weight: 600;
}
.sld-mp-result-star {
  color: var(--mp-teal-2);
  font-size: 18px;
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
    linear-gradient(90deg, rgba(34, 184, 160, 0.18) 0%, rgba(34, 184, 160, 0.06) 100%);
  border: 1px solid rgba(34, 184, 160, 0.35);
  display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap;
}
.sld-bar-delta-tag {
  font-size: 10px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--mp-teal);
  text-transform: uppercase;
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(34, 184, 160, 0.22);
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
  gap: 16px;
}
.sld-econ-input {
  padding: 20px 22px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--mp-line);
  border-radius: 16px;
}
.sld-econ-input label {
  display: flex; justify-content: space-between; align-items: baseline;
  font-size: 12px; font-weight: 600;
  color: var(--mp-mute);
  letter-spacing: 0.04em;
  margin-bottom: 12px;
}
.sld-econ-input strong {
  font-size: 22px; font-weight: 800;
  color: var(--mp-teal);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
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
  box-shadow: 0 6px 16px -4px rgba(14, 124, 102, 0.45);
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
    radial-gradient(ellipse 80% 100% at 100% 0%, rgba(34, 184, 160, 0.18), transparent 70%),
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
.sld-econ-delta {
  padding: 18px 22px;
  border-radius: 14px;
  background:
    linear-gradient(90deg, rgba(34, 184, 160, 0.18) 0%, rgba(34, 184, 160, 0.06) 100%);
  border: 1px solid rgba(34, 184, 160, 0.35);
  display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap;
}
.sld-econ-delta-tag {
  font-size: 10px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--mp-teal);
  text-transform: uppercase;
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(34, 184, 160, 0.22);
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
  box-shadow: 0 24px 50px -28px rgba(14, 124, 102, 0.30);
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
  background: rgba(34, 184, 160, 0.18);
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
  box-shadow: 0 22px 50px -28px rgba(14, 124, 102, 0.22);
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
  box-shadow: 0 24px 50px -28px rgba(14, 124, 102, 0.30);
}
.sld-cta-primary {
  background: linear-gradient(180deg, var(--mp-deep) 0%, #0A3B36 100%);
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
  box-shadow: 0 12px 30px -12px rgba(14, 124, 102, 0.20);
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
  background: rgba(34, 184, 160, 0.06);
  border: 1px solid rgba(34, 184, 160, 0.18);
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
    0 60px 110px -50px rgba(14, 124, 102, 0.40),
    0 30px 60px -30px rgba(14, 124, 102, 0.25),
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

/* PRISM before/after flow */
.sld-prism {
  display: grid; grid-template-columns: 1fr 80px 1fr;
  gap: 12px; align-items: center;
  margin-top: 8px;
}
.sld-prism-col {
  padding: 22px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid var(--mp-line);
  border-radius: 16px;
}
.sld-prism-col.accent {
  background:
    radial-gradient(ellipse 80% 100% at 100% 0%, rgba(34, 184, 160, 0.14), transparent 70%),
    rgba(255, 255, 255, 0.95);
  border-color: var(--mp-line-strong);
}
.sld-prism-eyebrow {
  font-size: 10px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--mp-mute);
  text-transform: uppercase;
  margin-bottom: 12px;
}
.sld-prism-eyebrow.accent { color: var(--mp-teal); }
.sld-prism-list {
  list-style: none; padding: 0; margin: 0;
  display: flex; flex-direction: column; gap: 6px;
}
.sld-prism-list li {
  display: flex; align-items: center; gap: 10px;
  font-size: 13px; color: var(--mp-ink-2);
  padding: 6px 0;
}
.sld-prism-i {
  width: 24px; height: 24px;
  border-radius: 6px;
  background: rgba(15,23,42,0.06);
  color: var(--mp-mute);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.sld-prism-i.accent {
  background: rgba(34, 184, 160, 0.16);
  color: var(--mp-teal);
}
.sld-prism-arrow {
  text-align: center;
  font-size: 11px; letter-spacing: 0.20em; font-weight: 700;
  color: var(--mp-teal);
  text-transform: uppercase;
  padding: 12px 0;
  background: linear-gradient(180deg, rgba(34, 184, 160, 0.10), transparent);
  border-radius: 12px;
}
.sld-prism-dropoff {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed var(--mp-line);
  font-size: 11px; font-weight: 600;
  color: var(--mp-mute);
  text-align: right;
}
.sld-prism-dropoff.accent { color: var(--mp-teal); }

/* Offer stack — slide 8 */
.sld-offer-stack {
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid var(--mp-line-strong);
  border-radius: 18px;
  padding: 8px 22px;
  margin-top: 8px;
  box-shadow: 0 22px 50px -28px rgba(14, 124, 102, 0.30);
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
  background: linear-gradient(90deg, rgba(34, 184, 160, 0.08), transparent);
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
  background: rgba(34, 184, 160, 0.18);
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
  box-shadow: 0 14px 30px -14px rgba(14, 124, 102, 0.45);
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

/* Storyboard — slide 11 */
.sld-storyboard {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-top: 8px;
}
.sld-story-panel {
  padding: 24px 22px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--mp-line);
  border-radius: 18px;
  display: flex; flex-direction: column; gap: 10px;
  position: relative;
  overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.sld-story-panel:hover {
  transform: translateY(-4px);
  box-shadow: 0 22px 50px -28px rgba(14, 124, 102, 0.30);
}
.sld-story-panel::before {
  content: '';
  position: absolute; top: -30px; right: -30px;
  width: 120px; height: 120px;
  background: radial-gradient(circle, rgba(34, 184, 160, 0.10), transparent 70%);
  pointer-events: none;
}
.sld-story-n {
  font-size: 11px; letter-spacing: 0.22em; font-weight: 700;
  color: var(--mp-teal);
}
.sld-story-t {
  font-size: 22px; font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--mp-ink);
}
.sld-story-b {
  font-size: 13.5px; color: var(--mp-ink-2);
  line-height: 1.55;
}

/* Money breakdown — slide 2 */
.sld-money {
  display: flex; flex-direction: column;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--mp-line);
  border-radius: 18px;
  overflow: hidden;
}
.sld-money-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 18px 24px;
  border-bottom: 1px dashed var(--mp-line);
  gap: 24px;
}
.sld-money-row:last-child { border-bottom: none; }
.sld-money-row.is-total {
  background: linear-gradient(90deg, rgba(34, 184, 160, 0.10) 0%, transparent 100%);
  border-top: 1px solid var(--mp-line-strong);
}
.sld-money-k {
  font-size: 14px; font-weight: 700;
  color: var(--mp-ink);
}
.sld-money-sub {
  margin-top: 3px;
  font-size: 12px; color: var(--mp-mute);
}
.sld-money-v {
  font-size: 22px; font-weight: 800;
  color: var(--mp-ink);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}
.sld-money-row.is-total .sld-money-v {
  background: linear-gradient(135deg, var(--mp-deep) 0%, var(--mp-teal-2) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  font-size: 28px;
}

/* Pricing 2-col grid + sample invoice */
.sld-price-grid {
  display: grid; grid-template-columns: 1fr 1.05fr;
  gap: 18px;
  align-items: stretch;
  margin-top: 12px;
}
.sld-price-card { margin: 0 !important; padding: 8px 22px !important; }
.sld-invoice {
  padding: 24px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid var(--mp-line-strong);
  border-radius: 18px;
  box-shadow: 0 22px 50px -28px rgba(14, 124, 102, 0.25);
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
  box-shadow: 0 0 0 4px rgba(34, 184, 160, 0.2);
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
  background: rgba(34, 184, 160, 0.18);
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
  background: rgba(34, 184, 160, 0.14);
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
.sld-sr-patient {
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
  background: rgba(34, 184, 160, 0.14);
  border: 1px solid rgba(34, 184, 160, 0.35);
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
  background: radial-gradient(ellipse, rgba(34, 184, 160, 0.95), transparent 70%);
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
    radial-gradient(ellipse 80% 100% at 100% 0%, rgba(34, 184, 160, 0.16), transparent 70%),
    rgba(255, 255, 255, 0.95);
  border-color: var(--mp-line-strong);
  box-shadow: 0 18px 40px -22px rgba(14, 124, 102, 0.30);
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
    0 60px 110px -50px rgba(14, 124, 102, 0.45),
    0 30px 60px -30px rgba(14, 124, 102, 0.30),
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
  box-shadow: 0 14px 30px -16px rgba(14, 124, 102, 0.30);
  display: flex; flex-direction: column; gap: 10px;
}
.sld-phone-card-eyebrow {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 9.5px; letter-spacing: 0.20em; font-weight: 700;
  color: var(--mp-teal);
  text-transform: uppercase;
  padding: 4px 10px;
  background: rgba(34, 184, 160, 0.14);
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
    radial-gradient(ellipse 80% 100% at 100% 0%, rgba(34, 184, 160, 0.16), transparent 70%),
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
    radial-gradient(ellipse 80% 100% at 0% 50%, rgba(34, 184, 160, 0.12), transparent 70%),
    rgba(255, 255, 255, 0.95);
  border: 1px solid var(--mp-line-strong);
  border-radius: 16px;
  display: flex; flex-direction: column; gap: 12px;
  box-shadow: 0 18px 50px -28px rgba(14, 124, 102, 0.26);
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
.sld-finale-primary,
.sld-finale-secondary {
  display: flex; flex-direction: column; gap: 8px;
  padding: 28px 30px;
  border-radius: 18px;
  text-align: left;
  transition: transform .15s ease, box-shadow .15s ease;
}
.sld-finale-primary {
  background: linear-gradient(135deg, var(--mp-deep) 0%, #0A3B36 100%);
  color: #fff;
  border: 1px solid var(--mp-deep);
  box-shadow: 0 30px 60px -28px rgba(14, 124, 102, 0.55);
}
.sld-finale-primary:hover {
  transform: translateY(-3px);
  box-shadow: 0 40px 80px -32px rgba(14, 124, 102, 0.7);
}
.sld-finale-primary-h {
  font-size: 26px; font-weight: 800;
  letter-spacing: -0.02em;
}
.sld-finale-primary-sub {
  font-size: 12px; letter-spacing: 0.04em;
  opacity: 0.85;
}
.sld-finale-secondary {
  background: rgba(255, 255, 255, 0.92);
  color: var(--mp-ink);
  border: 1px solid var(--mp-line-strong);
}
.sld-finale-secondary:hover {
  transform: translateY(-3px);
  box-shadow: 0 22px 50px -22px rgba(14, 124, 102, 0.30);
}
.sld-finale-secondary-h {
  font-size: 26px; font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--mp-teal);
}
.sld-finale-secondary-sub {
  font-size: 12px; letter-spacing: 0.04em;
  color: var(--mp-mute);
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
  .sld-mp-scene { transform: scale(0.7); transform-origin: center; }
}
`;
