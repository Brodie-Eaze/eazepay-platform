'use client';

import { useEffect, useState, useCallback } from 'react';

/* ============================================================================
   MedPay · Sales Presentation
   18-slide deck for a sales rep walking a dental practice owner through MedPay.
   Same design tokens as the landing page (mp-* CSS, teal palette, glass cards).
   Scroll-snap navigation, keyboard arrows, slide counter, prev/next controls.
   ========================================================================== */

interface Slide {
  n: string;
  title: string;
  build: () => JSX.Element;
}

const SLIDES: Slide[] = [
  /* 01 — TITLE */
  {
    n: '01',
    title: 'Opening',
    build: () => (
      <div className="sld-stack">
        <div className="sld-eyebrow">
          <span className="sld-eyebrow-dot" />
          MedPay · Patient Financing
        </div>
        <h1 className="sld-h1">
          <span className="grad-teal-deep">Patient financing</span>{' '}
          <span className="grad-teal">decided</span>
          <br />
          <span className="grad-teal-deep">in 10 seconds.</span>{' '}
          <span className="grad-teal">At the chair.</span>
        </h1>
        <p className="sld-sub">
          A soft-pull pre-qualification engine, a multi-lender marketplace, and merchant-direct
          funding in 48 to 72 hours. One signup, one platform.
        </p>
        <div className="sld-chips">
          <span className="sld-chip">FCRA soft pull · 0 impact</span>
          <span className="sld-chip">Lender marketplace · parallel quoting</span>
          <span className="sld-chip">Merchant-direct payout</span>
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
        <div className="sld-eyebrow">
          <span className="sld-eyebrow-dot" />
          The cost of doing nothing
        </div>
        <h2 className="sld-h2">
          Every patient who says <em>&ldquo;let me think about it&rdquo;</em>{' '}
          <span className="grad-teal-deep">walks out unfunded.</span>
        </h2>
        <p className="sld-sub">
          A 3-chair practice loses an estimated <strong>$1.4M a year</strong> to financing friction.
          The objection isn&apos;t price. It&apos;s cash flow. Patients don&apos;t carry $12,000.
        </p>
        <div className="sld-stat-row">
          <Stat v="38%" k="Industry same-day close (no financing)" />
          <Stat v="$1.4M" k="Case acceptance lost / yr (3-chair)" />
          <Stat v="54%" k="Inbound never pre-qualified" />
          <Stat v="2–4 wks" k="Consult → deposit" />
        </div>
      </div>
    ),
  },

  /* 03 — WHY NOW */
  {
    n: '03',
    title: 'Why now',
    build: () => (
      <div className="sld-stack">
        <div className="sld-eyebrow">
          <span className="sld-eyebrow-dot" />
          Why now
        </div>
        <h2 className="sld-h2">
          <span className="grad-teal">Financing at the point of sale</span>{' '}
          <span className="grad-teal-deep">is now the patient expectation.</span>
        </h2>
        <p className="sld-sub">
          Cherry, Sunbit, and GreenSky proved the model. But single-lender programs cap out at one
          approval algorithm. When their model declines, your patient walks. MedPay solves the
          ceiling.
        </p>
        <ul className="sld-bullets">
          <li>
            <span className="sld-bullet-k">Single-lender programs</span>
            <span>
              One approval algorithm. One ticket range. One credit tier. Decline = lost patient.
            </span>
          </li>
          <li>
            <span className="sld-bullet-k">Multi-lender marketplace</span>
            <span>
              Every lender in parallel on one soft pull. The patient gets the cheapest offer they
              qualify for, full stop.
            </span>
          </li>
        </ul>
      </div>
    ),
  },

  /* 04 — WHAT MEDPAY IS */
  {
    n: '04',
    title: 'What MedPay is',
    build: () => (
      <div className="sld-stack">
        <div className="sld-eyebrow">
          <span className="sld-eyebrow-dot" />
          The pitch
        </div>
        <h2 className="sld-h2">
          <span className="grad-teal-deep">Soft-pull pre-qual at the chair.</span>
          <br />
          <span className="grad-teal">Lender marketplace.</span>{' '}
          <span className="grad-teal-deep">Funds in 48 to 72 hours.</span>
        </h2>
        <p className="sld-sub">Three things matter to a practice owner. MedPay nails all three.</p>
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
      </div>
    ),
  },

  /* 05 — HOW IT WORKS · STAGE 1: PRE-QUAL */
  {
    n: '05',
    title: 'Stage 1 — Pre-qual',
    build: () => (
      <div className="sld-stack">
        <div className="sld-eyebrow">
          <span className="sld-eyebrow-dot" />
          How it works · 1 of 5
        </div>
        <h2 className="sld-h2">
          <span className="grad-teal-deep">Soft-pull EZ Check</span>{' '}
          <span className="grad-teal">on the iPad.</span>
        </h2>
        <StageRow
          metric="< 10s"
          label="Pre-qual"
          body="Patient enters last 4 of SSN, date of birth, income, and address. Soft pull returns a fundability tier in under 10 seconds. Zero credit impact. FCRA-compliant. The patient has not yet authorized a hard pull — they can walk away with no consequence."
        />
      </div>
    ),
  },

  /* 06 — STAGE 2: AGENTIC INTAKE */
  {
    n: '06',
    title: 'Stage 2 — Agentic intake',
    build: () => (
      <div className="sld-stack">
        <div className="sld-eyebrow">
          <span className="sld-eyebrow-dot" />
          How it works · 2 of 5
        </div>
        <h2 className="sld-h2">
          <span className="grad-teal-deep">PRISM</span>{' '}
          <span className="grad-teal">reshapes the apply flow.</span>
        </h2>
        <StageRow
          metric="−41%"
          label="Form drop-off"
          body="Every form session is watched by PRISM. It reorders questions on partial answers, skips qualifying steps for high-intent patients, and adds verification when the signal looks junky. High-intent patients skip straight to the financing decision."
        />
      </div>
    ),
  },

  /* 07 — STAGE 3: MARKETPLACE */
  {
    n: '07',
    title: 'Stage 3 — Marketplace',
    build: () => (
      <div className="sld-stack">
        <div className="sld-eyebrow">
          <span className="sld-eyebrow-dot" />
          How it works · 3 of 5
        </div>
        <h2 className="sld-h2">
          <span className="grad-teal-deep">Lender marketplace</span>{' '}
          <span className="grad-teal">runs in parallel.</span>
        </h2>
        <StageRow
          metric="5s SLA"
          label="Per round-trip"
          body="MedPay fires one application across the lender marketplace at the same instant. Every lender quotes in parallel. The marketplace returns ranked offers. The patient sees one screen with the cheapest qualifying offer first."
        />
      </div>
    ),
  },

  /* 08 — STAGE 4: OFFER */
  {
    n: '08',
    title: 'Stage 4 — Best offer wins',
    build: () => (
      <div className="sld-stack">
        <div className="sld-eyebrow">
          <span className="sld-eyebrow-dot" />
          How it works · 4 of 5
        </div>
        <h2 className="sld-h2">
          <span className="grad-teal-deep">Best offer wins.</span>{' '}
          <span className="grad-teal">Patient signs at the chair.</span>
        </h2>
        <StageRow
          metric="One tap"
          label="To accept"
          body="Offers ranked consumer-best (lowest total cost). Patient sees one screen with the recommended offer and two alternates. Tap to accept the approval. E-loan documents are signed right there. The patient is funded."
        />
      </div>
    ),
  },

  /* 09 — STAGE 5: FUNDED */
  {
    n: '09',
    title: 'Stage 5 — Merchant-direct',
    build: () => (
      <div className="sld-stack">
        <div className="sld-eyebrow">
          <span className="sld-eyebrow-dot" />
          How it works · 5 of 5
        </div>
        <h2 className="sld-h2">
          <span className="grad-teal-deep">Lender disburses</span>{' '}
          <span className="grad-teal">direct to your business account.</span>
        </h2>
        <StageRow
          metric="48 to 72hr"
          label="Merchant-direct"
          body="No intermediary holds the funds. Payouts land within 48 to 72 hours of the loan settling. The lender carries the credit risk. No clawback on routine defaults. Credit risk sits with the lender, not the practice."
        />
      </div>
    ),
  },

  /* 10 — WITHOUT / WITH MEDPAY */
  {
    n: '10',
    title: 'Without vs With MedPay',
    build: () => (
      <div className="sld-stack">
        <div className="sld-eyebrow">
          <span className="sld-eyebrow-dot" />
          The change
        </div>
        <h2 className="sld-h2">
          <span className="grad-teal">38% closes</span>{' '}
          <span className="grad-teal-deep">becomes 70%+ at the chair.</span>
        </h2>
        <div className="sld-compare-grid">
          <div className="sld-compare-card without">
            <div className="sld-compare-eyebrow">Without MedPay</div>
            <ul>
              <li>
                <span>38%</span>
                <span>Same-day close (industry avg.)</span>
              </li>
              <li>
                <span>$1.4M</span>
                <span>Case acceptance lost / yr (3-chair)</span>
              </li>
              <li>
                <span>54%</span>
                <span>Inbound never pre-qualified</span>
              </li>
              <li>
                <span>2–4 wks</span>
                <span>Consult → deposit</span>
              </li>
            </ul>
          </div>
          <div className="sld-compare-card with">
            <div className="sld-compare-eyebrow accent">With MedPay</div>
            <ul>
              <li>
                <span>70%+</span>
                <span>Same-day close (financing at chair, illustrative)</span>
              </li>
              <li>
                <span>Same-day</span>
                <span>Consult → approval → funded</span>
              </li>
              <li>
                <span>Marketplace</span>
                <span>Soft-pull lender marketplace · parallel quote</span>
              </li>
              <li>
                <span>Direct</span>
                <span>Lender disburses merchant-direct · 48 to 72hr</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    ),
  },

  /* 11 — THE PATIENT EXPERIENCE */
  {
    n: '11',
    title: 'What the patient sees',
    build: () => (
      <div className="sld-stack">
        <div className="sld-eyebrow">
          <span className="sld-eyebrow-dot" />
          The patient experience
        </div>
        <h2 className="sld-h2">
          <span className="grad-teal-deep">One screen.</span>{' '}
          <span className="grad-teal">Approved. Pick a plan.</span>
        </h2>
        <div className="sld-offer-card">
          <div className="sld-offer-head">
            <span className="sld-offer-pill">
              <span className="sld-offer-pill-dot" /> MedPay · approved
            </span>
            <span className="sld-offer-meta">Illustrative example</span>
          </div>
          <div className="sld-offer-project">Implant consult · approved</div>
          <div className="sld-offer-amount">
            $12,000
            <span className="sld-offer-amount-sub">approved</span>
          </div>
          <div className="sld-offer-row">
            <div>
              <div className="sld-offer-row-k">Est. monthly</div>
              <div className="sld-offer-row-v">$250 / mo · 48 mo</div>
            </div>
            <div>
              <div className="sld-offer-row-k">Term</div>
              <div className="sld-offer-row-v">48 months</div>
            </div>
          </div>
          <div className="sld-offer-foot">
            FCRA soft pull · funds in 48 to 72hr · merchant-direct
          </div>
        </div>
      </div>
    ),
  },

  /* 12 — YOUR ECONOMICS */
  {
    n: '12',
    title: 'Your economics',
    build: () => (
      <div className="sld-stack">
        <div className="sld-eyebrow">
          <span className="sld-eyebrow-dot" />
          Your economics
        </div>
        <h2 className="sld-h2">
          <span className="grad-teal">What MedPay would do</span>{' '}
          <span className="grad-teal-deep">for a 3-chair practice.</span>
        </h2>
        <p className="sld-sub">
          Funnel assumption: 180 inbound leads / month, 50% qualified, an $8,000 average ticket.
          Illustrative — the real ROI calculator on the landing page lets a prospect drop in their
          own numbers.
        </p>
        <div className="sld-econ-grid">
          <div className="sld-econ-card">
            <div className="sld-econ-eyebrow">Without MedPay (18% close)</div>
            <div className="sld-econ-num">$1.56M</div>
            <div className="sld-econ-sub">Recovered revenue / yr</div>
            <div className="sld-econ-sub-sm">194 funded patients / yr</div>
          </div>
          <div className="sld-econ-card with">
            <div className="sld-econ-eyebrow accent">With MedPay (70% close · 70% funded)</div>
            <div className="sld-econ-num accent">$4.23M</div>
            <div className="sld-econ-sub">Recovered revenue / yr</div>
            <div className="sld-econ-sub-sm">529 funded patients / yr</div>
          </div>
        </div>
        <div className="sld-econ-delta">
          <span className="sld-econ-delta-tag">Delta</span>
          <span className="sld-econ-delta-val">+ $2.67M / year</span>
          <span className="sld-econ-delta-sub">335 additional funded patients · illustrative</span>
        </div>
      </div>
    ),
  },

  /* 13 — CASE STUDIES */
  {
    n: '13',
    title: 'Case studies',
    build: () => (
      <div className="sld-stack">
        <div className="sld-eyebrow">
          <span className="sld-eyebrow-dot" />
          Case studies
        </div>
        <h2 className="sld-h2">
          <span className="grad-teal">Practices that turned</span>{' '}
          <span className="grad-teal-deep">&ldquo;let me think about it&rdquo;</span>{' '}
          <span className="grad-teal">into approved.</span>
        </h2>
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
      </div>
    ),
  },

  /* 14 — HOW WE'RE DIFFERENT */
  {
    n: '14',
    title: 'How we are different',
    build: () => (
      <div className="sld-stack">
        <div className="sld-eyebrow">
          <span className="sld-eyebrow-dot" />
          The difference
        </div>
        <h2 className="sld-h2">
          <span className="grad-teal-deep">Marketplace beats</span>{' '}
          <span className="grad-teal">single-lender programs.</span>
        </h2>
        <table className="sld-vs-table">
          <thead>
            <tr>
              <th></th>
              <th>Single-lender (Cherry, Sunbit, GreenSky)</th>
              <th className="accent">MedPay</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Decline = patient walks</td>
              <td>Yes</td>
              <td className="accent">No · marketplace routes to next eligible lender</td>
            </tr>
            <tr>
              <td>Ticket range</td>
              <td>Capped by one lender&apos;s policy</td>
              <td className="accent">Marketplace coverage · $3k to $50k</td>
            </tr>
            <tr>
              <td>Pre-qual at the chair</td>
              <td>Soft pull only with that lender</td>
              <td className="accent">Soft pull qualifies across the marketplace</td>
            </tr>
            <tr>
              <td>Agent layer</td>
              <td>None</td>
              <td className="accent">Seven autonomous agents (intake · routing · attribution)</td>
            </tr>
            <tr>
              <td>Pixel attribution</td>
              <td>Fires on form-fill (junk signal)</td>
              <td className="accent">ECHO fires on funded job (real signal)</td>
            </tr>
          </tbody>
        </table>
      </div>
    ),
  },

  /* 15 — SECURITY + COMPLIANCE */
  {
    n: '15',
    title: 'Security + compliance',
    build: () => (
      <div className="sld-stack">
        <div className="sld-eyebrow">
          <span className="sld-eyebrow-dot" />
          Security + compliance
        </div>
        <h2 className="sld-h2">
          <span className="grad-teal-deep">Bank-grade by default.</span>
        </h2>
        <p className="sld-sub">
          We carry the regulatory weight so your practice doesn&apos;t have to.
        </p>
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
      </div>
    ),
  },

  /* 16 — PRICING */
  {
    n: '16',
    title: 'Pricing',
    build: () => (
      <div className="sld-stack">
        <div className="sld-eyebrow">
          <span className="sld-eyebrow-dot" />
          Pricing
        </div>
        <h2 className="sld-h2">
          <span className="grad-teal-deep">Aligned with you.</span>{' '}
          <span className="grad-teal">We only win when you fund.</span>
        </h2>
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
        <p className="sld-sub" style={{ marginTop: '24px', textAlign: 'center' }}>
          No funded patients, no fee. Fully aligned.
        </p>
      </div>
    ),
  },

  /* 17 — WHAT YOU NEED TO ONBOARD */
  {
    n: '17',
    title: 'Onboarding',
    build: () => (
      <div className="sld-stack">
        <div className="sld-eyebrow">
          <span className="sld-eyebrow-dot" />
          Onboarding
        </div>
        <h2 className="sld-h2">
          <span className="grad-teal-deep">Live by Thursday.</span>{' '}
          <span className="grad-teal">Five minutes to set up.</span>
        </h2>
        <ol className="sld-steps">
          <li>
            <span className="sld-step-n">01</span>
            <div>
              <div className="sld-step-h">Practice signup</div>
              <div className="sld-step-b">
                Business details (EIN, address, owner info, last 4 SSN). 5 minutes. KYB clears in
                under 60 seconds.
              </div>
            </div>
          </li>
          <li>
            <span className="sld-step-n">02</span>
            <div>
              <div className="sld-step-h">iPad / web setup</div>
              <div className="sld-step-b">
                Open the apply link on any iPad at the chair, or share it as a URL. No hardware to
                install. No new POS terminal.
              </div>
            </div>
          </li>
          <li>
            <span className="sld-step-n">03</span>
            <div>
              <div className="sld-step-h">First live application</div>
              <div className="sld-step-b">
                Run your first soft-pull on a real patient within hours of signup. Real approval.
                Real funds. Real disbursement.
              </div>
            </div>
          </li>
          <li>
            <span className="sld-step-n">04</span>
            <div>
              <div className="sld-step-h">Reports + reconciliation</div>
              <div className="sld-step-b">
                Daily funded summary, monthly invoice for the platform fee, full audit trail per
                loan.
              </div>
            </div>
          </li>
        </ol>
      </div>
    ),
  },

  /* 18 — NEXT STEPS */
  {
    n: '18',
    title: 'Next steps',
    build: () => (
      <div className="sld-stack">
        <div className="sld-eyebrow">
          <span className="sld-eyebrow-dot" />
          Next steps
        </div>
        <h2 className="sld-h2 sld-h2-big">
          <span className="grad-teal-deep">Let&apos;s have you</span>{' '}
          <span className="grad-teal">signed and live this week.</span>
        </h2>
        <p className="sld-sub" style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto' }}>
          Two paths from here. Pick whichever fits how your practice operates.
        </p>
        <div className="sld-cta-grid">
          <a href="/submit/med-pay" className="sld-cta sld-cta-primary">
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
        <p className="sld-disclaimer">
          MedPay is a multi-lender marketplace. Lender names shown are illustrative unless
          explicitly disclosed as partners. All funded patients are subject to lender approval. Loan
          terms, APR, and disbursement vary by lender and patient profile. Not a guarantee of
          approval.
        </p>
      </div>
    ),
  },
];

/* ============================ helper components =========================== */

function Stat({ v, k }: { v: string; k: string }) {
  return (
    <div className="sld-stat">
      <div className="sld-stat-v">{v}</div>
      <div className="sld-stat-k">{k}</div>
    </div>
  );
}

function Pillar({ n, head, body }: { n: string; head: string; body: string }) {
  return (
    <div className="sld-pillar">
      <div className="sld-pillar-n">{n}</div>
      <div className="sld-pillar-h">{head}</div>
      <div className="sld-pillar-b">{body}</div>
    </div>
  );
}

function StageRow({ metric, label, body }: { metric: string; label: string; body: string }) {
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
}) {
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

function TrustItem({ head, body }: { head: string; body: string }) {
  return (
    <div className="sld-trust-item">
      <div className="sld-trust-head">{head}</div>
      <div className="sld-trust-body">{body}</div>
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

  // Sync state when the user scrolls manually (scroll-snap will park them
  // on a slide boundary). IntersectionObserver fires when each slide
  // crosses the 55% threshold of the SCROLLING CONTAINER.
  // The container here is .sld-stack-root (which has overflow-y:scroll +
  // scroll-snap), NOT the document viewport — so we pass it explicitly
  // as the observer root, otherwise intersections never fire on a
  // page where the body itself doesn't scroll.
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

  // Keyboard nav — Left/Right arrows + Space (next).
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

      {/* Top-right slide counter + brand chip */}
      <div className="sld-chrome">
        <div className="sld-brand">MedPay · Sales deck</div>
        <div className="sld-counter">
          <span className="sld-counter-cur">{String(idx + 1).padStart(2, '0')}</span>
          <span className="sld-counter-sep"> / </span>
          <span className="sld-counter-tot">{String(SLIDES.length).padStart(2, '0')}</span>
        </div>
      </div>

      {/* Bottom prev/next + slide picker */}
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

      {/* Slide stack — scroll-snap parents each section to viewport */}
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

/* Gradient text utilities — same as the landing */
.sld-root .grad-teal {
  background: linear-gradient(120deg, var(--mp-teal) 0%, var(--mp-teal-2) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.sld-root .grad-teal-deep {
  background: linear-gradient(120deg, var(--mp-deep) 0%, var(--mp-teal) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}

/* Slide structure */
.sld-stack-root {
  scroll-snap-type: y mandatory;
  height: 100vh;
  overflow-y: scroll;
}
.sld-slide {
  scroll-snap-align: start;
  scroll-snap-stop: always;
  min-height: 100vh;
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
  max-width: 1100px;
  width: 100%;
  display: flex; flex-direction: column;
  gap: 24px;
}

/* Eyebrow pill */
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
  box-shadow: 0 0 0 3px rgba(34, 184, 160, 0.20);
}

/* Headlines */
.sld-h1 {
  font-size: 78px; font-weight: 800;
  letter-spacing: -0.035em; line-height: 1.02;
  margin: 0;
}
.sld-h2 {
  font-size: 56px; font-weight: 800;
  letter-spacing: -0.03em; line-height: 1.08;
  margin: 0;
}
.sld-h2-big {
  font-size: 64px;
}
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
.sld-sub strong {
  color: var(--mp-teal);
  font-weight: 700;
}

/* Trust chips row */
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

/* Stat row */
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
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.sld-stat-k {
  margin-top: 6px;
  font-size: 12px; color: var(--mp-mute);
  line-height: 1.4;
}

/* Bullets list */
.sld-bullets {
  list-style: none; padding: 0; margin: 12px 0 0 0;
  display: flex; flex-direction: column; gap: 16px;
}
.sld-bullets li {
  display: grid; grid-template-columns: 220px 1fr;
  gap: 24px; align-items: baseline;
  padding: 20px 24px;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid var(--mp-line);
  border-radius: 14px;
}
.sld-bullet-k {
  font-size: 13px; letter-spacing: 0.12em; font-weight: 700;
  text-transform: uppercase;
  color: var(--mp-teal);
}
.sld-bullets li > span:last-child {
  font-size: 15px; color: var(--mp-ink-2); line-height: 1.55;
}

/* Pillars grid (3-up) */
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
  font-size: 14px; color: var(--mp-ink-2);
  line-height: 1.55;
}

/* Stage row — single-line metric + body */
.sld-stage-row {
  display: grid; grid-template-columns: 280px 1fr;
  gap: 40px; align-items: center;
  margin-top: 16px;
  padding: 36px 40px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid var(--mp-line-strong);
  border-radius: 24px;
  box-shadow: 0 24px 60px -30px rgba(14, 124, 102, 0.22);
}
.sld-stage-metric {
  border-right: 1px solid var(--mp-line);
  padding-right: 32px;
}
.sld-stage-metric-v {
  font-size: 56px; font-weight: 800;
  letter-spacing: -0.03em;
  background: linear-gradient(135deg, var(--mp-deep) 0%, var(--mp-teal) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  line-height: 1;
}
.sld-stage-metric-l {
  margin-top: 8px;
  font-size: 11px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--mp-mute);
  text-transform: uppercase;
}
.sld-stage-body {
  font-size: 17px; color: var(--mp-ink-2); line-height: 1.6;
  margin: 0;
}

/* Without / With compare cards */
.sld-compare-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 18px;
  margin-top: 8px;
}
.sld-compare-card {
  padding: 28px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid var(--mp-line);
}
.sld-compare-card.with {
  background:
    radial-gradient(ellipse 80% 100% at 100% 0%, rgba(34, 184, 160, 0.15), transparent 70%),
    rgba(255, 255, 255, 0.92);
  border-color: var(--mp-line-strong);
  box-shadow: 0 22px 50px -28px rgba(14, 124, 102, 0.30);
}
.sld-compare-eyebrow {
  font-size: 11px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--mp-mute);
  text-transform: uppercase;
  margin-bottom: 16px;
}
.sld-compare-eyebrow.accent { color: var(--mp-teal); }
.sld-compare-card ul {
  list-style: none; padding: 0; margin: 0;
  display: flex; flex-direction: column;
}
.sld-compare-card li {
  display: grid; grid-template-columns: 130px 1fr;
  gap: 16px; align-items: baseline;
  padding: 14px 0;
  border-bottom: 1px dashed var(--mp-line);
}
.sld-compare-card li:last-child { border-bottom: none; }
.sld-compare-card li > span:first-child {
  font-size: 20px; font-weight: 700; letter-spacing: -0.018em;
  color: var(--mp-ink);
  font-variant-numeric: tabular-nums;
  word-break: keep-all;
}
.sld-compare-card.with li > span:first-child {
  color: var(--mp-teal);
}
.sld-compare-card li > span:last-child {
  font-size: 13px; color: var(--mp-ink-2); line-height: 1.45;
}

/* Offer card (Slide 11) */
.sld-offer-card {
  margin-top: 16px;
  max-width: 540px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid var(--mp-line-strong);
  border-radius: 22px;
  padding: 28px;
  box-shadow:
    0 30px 70px -28px rgba(14, 124, 102, 0.35),
    0 1px 0 rgba(255, 255, 255, 1) inset;
}
.sld-offer-head {
  display: flex; align-items: center; justify-content: space-between;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--mp-line);
}
.sld-offer-pill {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 10.5px; letter-spacing: 0.20em; font-weight: 700;
  color: var(--mp-teal);
  text-transform: uppercase;
  padding: 4px 10px;
  background: rgba(34, 184, 160, 0.12);
  border-radius: 999px;
}
.sld-offer-pill-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--mp-teal-2);
}
.sld-offer-meta {
  font-size: 10px; letter-spacing: 0.18em;
  color: var(--mp-mute);
  text-transform: uppercase;
  padding: 3px 8px;
  background: rgba(15, 23, 42, 0.04);
  border-radius: 6px;
}
.sld-offer-project {
  margin-top: 14px;
  font-size: 11px; letter-spacing: 0.22em;
  color: var(--mp-mute);
  text-transform: uppercase;
}
.sld-offer-amount {
  margin-top: 4px;
  font-size: 42px; font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--mp-ink);
  font-variant-numeric: tabular-nums;
  display: flex; align-items: baseline; gap: 12px;
}
.sld-offer-amount-sub {
  font-size: 13px; font-weight: 600;
  color: var(--mp-teal);
  text-transform: uppercase;
  letter-spacing: 0.18em;
}
.sld-offer-row {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--mp-line);
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 24px;
}
.sld-offer-row-k {
  font-size: 10px; letter-spacing: 0.18em;
  color: var(--mp-mute);
  text-transform: uppercase;
}
.sld-offer-row-v {
  margin-top: 4px;
  font-size: 16px; font-weight: 600;
  color: var(--mp-ink);
}
.sld-offer-foot {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--mp-line);
  font-size: 11px; letter-spacing: 0.16em;
  color: var(--mp-mute);
  text-transform: uppercase;
  text-align: center;
}

/* Economics grid (Slide 12) */
.sld-econ-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 18px;
  margin-top: 8px;
}
.sld-econ-card {
  padding: 28px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid var(--mp-line);
}
.sld-econ-card.with {
  background:
    radial-gradient(ellipse 70% 100% at 100% 0%, rgba(34, 184, 160, 0.18), transparent 70%),
    rgba(255, 255, 255, 0.95);
  border-color: var(--mp-line-strong);
  box-shadow: 0 22px 50px -28px rgba(14, 124, 102, 0.30);
}
.sld-econ-eyebrow {
  font-size: 11px; letter-spacing: 0.16em; font-weight: 700;
  color: var(--mp-mute);
  text-transform: uppercase;
}
.sld-econ-eyebrow.accent { color: var(--mp-teal); }
.sld-econ-num {
  margin-top: 14px;
  font-size: 56px; font-weight: 800;
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
  margin-top: 16px;
  padding: 22px 28px;
  border-radius: 16px;
  background: linear-gradient(90deg, rgba(34, 184, 160, 0.18) 0%, rgba(34, 184, 160, 0.06) 100%);
  border: 1px solid rgba(34, 184, 160, 0.35);
  display: flex; align-items: baseline; gap: 16px; flex-wrap: wrap;
}
.sld-econ-delta-tag {
  font-size: 10px; letter-spacing: 0.18em; font-weight: 700;
  text-transform: uppercase;
  color: var(--mp-teal);
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(34, 184, 160, 0.22);
}
.sld-econ-delta-val {
  font-size: 30px; font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--mp-ink);
  font-variant-numeric: tabular-nums;
}
.sld-econ-delta-sub {
  font-size: 13px; color: var(--mp-ink-2);
  margin-left: auto;
}

/* Case studies (Slide 13) */
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
.sld-case-name {
  font-size: 13px; font-weight: 600;
  color: var(--mp-ink);
}
.sld-case-role {
  font-size: 11px; color: var(--mp-mute);
}

/* Vs table (Slide 14) */
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
.sld-vs-table th,
.sld-vs-table td {
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
.sld-vs-table th.accent,
.sld-vs-table td.accent {
  color: var(--mp-teal);
  font-weight: 600;
}
.sld-vs-table th.accent {
  color: var(--mp-teal);
}
.sld-vs-table tr:last-child td { border-bottom: none; }
.sld-vs-table tbody td:first-child {
  color: var(--mp-mute);
  font-weight: 600;
  font-size: 13px;
}

/* Trust grid (Slide 15) */
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

/* Pricing card (Slide 16) */
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
.sld-price-v {
  font-size: 18px; font-weight: 700;
  color: var(--mp-ink);
}

/* Onboarding steps (Slide 17) */
.sld-steps {
  list-style: none; padding: 0; margin: 12px 0 0 0;
  display: flex; flex-direction: column;
  counter-reset: step;
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
.sld-step-h {
  font-size: 17px; font-weight: 700;
  color: var(--mp-ink);
}
.sld-step-b {
  margin-top: 4px;
  font-size: 13.5px; color: var(--mp-ink-2);
  line-height: 1.55;
}

/* CTA grid (Slide 18) */
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
.sld-cta-secondary .sld-cta-eyebrow {
  color: var(--mp-teal);
}
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

/* Chrome — top-right slide counter + brand */
.sld-chrome {
  position: fixed;
  top: 20px; right: 24px;
  z-index: 20;
  display: flex; align-items: center; gap: 14px;
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.85);
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
.sld-counter-sep { color: var(--mp-mute); }
.sld-counter-tot { color: var(--mp-mute); }

/* Bottom prev/next + dots */
.sld-nav {
  position: fixed;
  bottom: 20px; left: 50%; transform: translateX(-50%);
  z-index: 20;
  display: flex; align-items: center; gap: 14px;
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.92);
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
  transition: background 0.15s ease, transform 0.15s ease;
}
.sld-nav-btn:hover:not(:disabled) {
  background: var(--mp-teal);
  color: #fff;
  border-color: var(--mp-teal);
}
.sld-nav-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
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
.sld-dot:hover {
  background: var(--mp-teal-2);
}

@media (max-width: 1024px) {
  .sld-h1 { font-size: 56px; }
  .sld-h2 { font-size: 40px; }
  .sld-h2-big { font-size: 46px; }
  .sld-stat-row { grid-template-columns: repeat(2, 1fr); }
  .sld-pillars { grid-template-columns: 1fr; }
  .sld-stage-row { grid-template-columns: 1fr; }
  .sld-stage-metric { border-right: none; border-bottom: 1px solid var(--mp-line); padding-right: 0; padding-bottom: 16px; }
  .sld-compare-grid { grid-template-columns: 1fr; }
  .sld-econ-grid { grid-template-columns: 1fr; }
  .sld-cases-grid { grid-template-columns: 1fr; }
  .sld-trust-grid { grid-template-columns: repeat(2, 1fr); }
  .sld-cta-grid { grid-template-columns: 1fr; }
  .sld-slide { padding: 60px 32px; }
}
@media (max-width: 640px) {
  .sld-h1 { font-size: 42px; }
  .sld-h2 { font-size: 30px; }
  .sld-stat-row { grid-template-columns: 1fr; }
  .sld-trust-grid { grid-template-columns: 1fr; }
  .sld-brand { display: none; }
}
`;
