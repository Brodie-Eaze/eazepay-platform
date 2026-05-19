/**
 * CoachPay · Onboarding (/coachpay/onboarding)
 *
 * AureanAI-style onboarding page, tinted for CoachPay's purple
 * palette. 4 stepped agent modules adapted for the high-ticket
 * coaching sales motion: discovery-call intake → lender + card-
 * stack → soft-pull / tier ladder → merchant-direct payout.
 *
 * See /medpay/onboarding/page.tsx for the structural twin. The 4
 * modules (CORE / NEXUS / ORACLE / FLUX) map 1:1 across MedPay /
 * TradePay / CoachPay so any partner moving across verticals sees
 * the same shape.
 */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Step = {
  id: string;
  n: string;
  agent: string;
  title: string;
  body: string;
  items: string[];
  time: string;
  configLabel: string;
  configHref: string;
};

const STEPS: Step[] = [
  {
    id: 'core',
    n: '01',
    agent: 'CORE',
    title: 'Account setup',
    body: 'Provision your branded CoachPay partner portal, invite your closer team, and upload the KYB documents that anchor every lender file we submit on your behalf.',
    items: [
      'Branded partner portal provisioned',
      'Closer team invites · admin + rep roles',
      'Brand kit + KYB document upload',
    ],
    time: '≈ 5 min',
    configLabel: 'Continue setup',
    configHref: '/welcome',
  },
  {
    id: 'nexus',
    n: '02',
    agent: 'NEXUS',
    title: 'Lender marketplace',
    body: "We submit your coaching business to the CoachPay lender panel (LendingPoint / Upgrade / Best Egg / Marcus / Lightstream) plus the 800+ credit-card and BNPL aggregator for underwriting. Each lender has to approve you for traffic before they appear in the waterfall — once they're live, NEXUS surfaces the cheapest monthly to the prospect.",
    items: [
      'Lender panel underwriting · personal-loan tier',
      'Card + BNPL aggregator · 800+ issuers',
      'Carrier appetite + ticket caps · $5k – $50k',
    ],
    time: '≈ 2–3 business days',
    configLabel: 'Configure NEXUS',
    configHref: '/admin?surface=brand-portal&brand=coach-pay&panel=LenderPanelMatrix',
  },
  {
    id: 'oracle',
    n: '03',
    agent: 'ORACLE',
    title: 'Smart forms & financial qualification',
    body: 'Connect your HighSale CRM so every discovery-call soft-pull lands as a contact, drop the Pixie tracking pixel on your enrolment page for funnel attribution, and pick the smart-form fields + credit thresholds that drive qualification — including the card-stack ceiling for $20k+ enrolments.',
    items: [
      'HighSale CRM connection (API + webhook)',
      'Pixie pixel install + funnel events',
      'Discovery-call form fields + card-stack ceiling',
    ],
    time: '≈ 15 min',
    configLabel: 'Configure ORACLE',
    configHref: '/admin?surface=brand-portal&brand=coach-pay&panel=AgentsPanel',
  },
  {
    id: 'flux',
    n: '04',
    agent: 'FLUX',
    title: 'Payment processing',
    body: 'FLUX onboards your coaching business to MiCamp Solutions — the merchant-direct processor that settles funded enrolments straight to your bank in 48–72 hours. Confirm your routing details, sign the MiCamp processing agreement, and verify the first $10 test settlement.',
    items: [
      'MiCamp merchant account application',
      'Settlement bank routing + voided check',
      'First $10 test settlement',
    ],
    time: '≈ 2–3 business days',
    configLabel: 'Configure FLUX',
    configHref: '/admin?surface=brand-portal&brand=coach-pay&panel=PayoutDestinationsPanel',
  },
];

export default function CoachPayOnboarding(): JSX.Element {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [activeIdx, setActiveIdx] = useState(0);

  const completeCount = done.size;
  const progressPct = Math.round((completeCount / STEPS.length) * 100);

  useEffect(() => {
    const firstOpen = STEPS.findIndex((s) => !done.has(s.id));
    setActiveIdx(firstOpen === -1 ? STEPS.length - 1 : firstOpen);
  }, [done]);

  function markDone(id: string) {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="cp-onb-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="cp-onb-ambient-bg">
        <div className="ambient-glow" />
        <div className="ambient-grid" />
      </div>

      <header className="cp-onb-nav">
        <div className="cp-onb-nav-inner">
          <Link href="/coachpay/checkout" className="cp-onb-brand" aria-label="CoachPay home">
            <span className="cp-onb-brand-mark">
              <LogoIcon />
            </span>
            <span className="cp-onb-brand-word">
              <span className="grad-text-brand">Coach</span>
              <span className="cp-onb-brand-slash">/</span>
              <span className="cp-onb-brand-suffix">Pay</span>
            </span>
          </Link>
          <nav className="cp-onb-nav-links">
            <Link href="/sales/coachpay">Sales deck</Link>
            <Link href="/landing/coachpay">Platform</Link>
            <Link href="/help">Support</Link>
          </nav>
        </div>
      </header>

      <main className="cp-onb-main">
        <section className="cp-onb-hero">
          <div className="cp-onb-container">
            <div className="cp-onb-eyebrow-pill">
              <span className="cp-onb-pulse-dot" />
              ACTIVATE COACHPAY
            </div>
            <h1 className="cp-onb-h1">
              <span className="grad-text">Onboarding</span>
            </h1>
            <p className="cp-onb-hero-sub">
              Four short modules. Saves automatically. Come back any time. Your launch engineer is
              in your Slack channel.
            </p>
          </div>
        </section>

        <section className="cp-onb-body">
          <div className="cp-onb-container-narrow">
            <div className="cp-onb-progress glass">
              <div className="cp-onb-progress-head">
                <span className="cp-onb-progress-label">
                  <span className="stat-num">{completeCount}</span> of{' '}
                  <span className="stat-num">{STEPS.length}</span> complete
                </span>
                <span className="cp-onb-progress-pct stat-num">{progressPct}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
            </div>

            <div className="cp-onb-steps">
              {STEPS.map((s, i) => {
                const isDone = done.has(s.id);
                const isActive = i === activeIdx && !isDone;
                return (
                  <article
                    key={s.id}
                    className={`glass card step rounded-2xl reveal ${isActive ? 'is-active' : ''} ${
                      isDone ? 'is-done' : ''
                    }`}
                  >
                    <div className="cp-onb-step-head">
                      <div className={`step-num ${isActive ? 'is-active' : ''}`}>
                        {isDone ? <CheckIcon /> : s.n}
                      </div>
                      <div className="cp-onb-step-head-r">
                        <div className="cp-onb-step-meta">
                          <span className="agent-badge">{s.agent}</span>
                          <span className="time-chip">⌛ {s.time}</span>
                          {isDone ? <span className="done-pill">✓ Complete</span> : null}
                        </div>
                        <h3 className="cp-onb-step-title">{s.title}</h3>
                        <p className="cp-onb-step-body">{s.body}</p>
                        <ul className="cp-onb-step-items">
                          {s.items.map((it, j) => (
                            <li key={j}>
                              <span className="mark" aria-hidden>
                                <CheckIcon size={11} />
                              </span>
                              <span>{it}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="cp-onb-step-actions">
                          <Link href={s.configHref} className="btn-primary">
                            {s.configLabel} <ArrowIcon />
                          </Link>
                          <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => markDone(s.id)}
                          >
                            {isDone ? 'Mark incomplete' : 'Mark complete'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="cp-onb-launch glass-hi rounded-2xl">
              <div>
                <div className="cp-onb-launch-tag">FINAL STEP</div>
                <h3 className="cp-onb-launch-h">Book your launch call</h3>
                <p className="cp-onb-launch-b">
                  30 minutes with the CoachPay launch team. We walk the first discovery-call
                  soft-pull on your real traffic, validate the lender + card-stack panel, and queue
                  the live-fire test settlement.
                </p>
              </div>
              <Link href="/help" className="btn-primary btn-lg">
                Book launch call <ArrowIcon />
              </Link>
            </div>

            <div className="cp-onb-foot-note">
              Saves automatically. Come back any time. Your launch engineer is in your Slack
              channel.
            </div>
          </div>
        </section>
      </main>

      <footer className="cp-onb-footer">
        <div className="cp-onb-container-narrow cp-onb-footer-inner">
          <div className="cp-onb-footer-brand">
            <LogoIcon />
            <span>
              <span className="grad-text-brand">CoachPay</span> · A vertical of EazePay
            </span>
          </div>
          <div className="cp-onb-footer-links">
            <Link href="/sales/coachpay">Sales deck</Link>
            <Link href="/landing/coachpay">Platform</Link>
            <Link href="/help">Support</Link>
          </div>
          <div className="cp-onb-footer-meta">NMLS #2456701 · FCRA · ECOA · TILA</div>
        </div>
      </footer>
    </div>
  );
}

/* ---------- icons ---------- */

function LogoIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 19l3-12 4 9 4-9 3 12"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="5" cy="19" r="1.4" fill="currentColor" />
      <circle cx="19" cy="19" r="1.4" fill="currentColor" />
    </svg>
  );
}
function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12l5 5 9-11"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ---------- CSS (Aurean port, CoachPay purple accent) ---------- */

const CSS = `
.cp-onb-root {
  --brand: #8B5CF6;
  --brand-2: #A78BFA;
  --brand-deep: #4C1D95;
  --ink: #EEEEF2;
  --ink-2: #B9B9C7;
  --ink-3: #8A8AA0;
  --bg: #0a0a14;

  position: relative;
  min-height: 100vh;
  background: var(--bg);
  color: var(--ink);
  font-family: inherit;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}
.cp-onb-root * { box-sizing: border-box; }
.cp-onb-root a { color: inherit; text-decoration: none; }

.cp-onb-ambient-bg { position: fixed; inset: 0; pointer-events: none; z-index: 0; }
.ambient-glow {
  position: absolute; inset: 0;
  background:
    radial-gradient(ellipse 80% 60% at 50% 0%, rgba(139, 92, 246, 0.45), transparent 60%),
    radial-gradient(ellipse 60% 50% at 80% 80%, rgba(167, 139, 250, 0.30), transparent 60%);
}
.ambient-grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: radial-gradient(ellipse at center, black 40%, transparent 80%);
}
.glass {
  background: linear-gradient(180deg, rgba(35,35,63,0.55), rgba(16,16,35,0.55));
  border: 1px solid rgba(255, 255, 255, 0.07);
  backdrop-filter: blur(14px);
}
.glass-hi {
  background:
    radial-gradient(ellipse 60% 100% at 0% 0%, rgba(167, 139, 250, 0.22), transparent 65%),
    linear-gradient(180deg, rgba(58,58,106,0.35), rgba(26,26,46,0.55));
  border: 1px solid rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(18px);
}
.grad-text {
  background: linear-gradient(180deg, #fff, #b9b9c7);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.grad-text-brand {
  background: linear-gradient(135deg, #fff, var(--brand-2) 60%, var(--brand));
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.stat-num { font-variant-numeric: tabular-nums; }

/* nav */
.cp-onb-nav {
  position: sticky; top: 0; z-index: 30;
  background: rgba(10, 10, 20, 0.65);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.cp-onb-nav-inner {
  max-width: 1180px; margin: 0 auto;
  padding: 14px 32px;
  display: flex; align-items: center; gap: 32px;
}
.cp-onb-brand { display: inline-flex; align-items: center; gap: 10px; color: var(--ink); }
.cp-onb-brand-mark {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--brand) 0%, var(--brand-2) 100%);
  color: #fff;
  box-shadow: 0 8px 24px -8px rgba(139, 92, 246, 0.55);
}
.cp-onb-brand-word { font-weight: 700; font-size: 16px; letter-spacing: -0.01em; }
.cp-onb-brand-slash { color: var(--ink-3); margin: 0 1px; }
.cp-onb-brand-suffix { color: var(--ink); }
.cp-onb-nav-links { margin-left: auto; display: inline-flex; gap: 22px; font-size: 13.5px; color: var(--ink-2); }
.cp-onb-nav-links a:hover { color: var(--brand-2); }

/* main */
.cp-onb-main { position: relative; z-index: 1; }
.cp-onb-hero { padding: 56px 0 12px; }
.cp-onb-container { max-width: 1180px; margin: 0 auto; padding: 0 32px; }
.cp-onb-container-narrow { max-width: 920px; margin: 0 auto; padding: 0 32px; }

.cp-onb-eyebrow-pill {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(139, 92, 246, 0.12);
  border: 1px solid rgba(167, 139, 250, 0.32);
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 11px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--brand-2); text-transform: uppercase;
}
.cp-onb-pulse-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--brand-2);
  animation: cpOnbPulse 1.6s ease-in-out infinite;
}
@keyframes cpOnbPulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(167, 139, 250, 0.55); }
  50% { box-shadow: 0 0 0 6px rgba(167, 139, 250, 0); }
}
.cp-onb-h1 {
  margin: 18px 0 14px;
  font-size: clamp(48px, 7vw, 96px);
  font-weight: 700; letter-spacing: -0.03em; line-height: 1.02;
}
.cp-onb-hero-sub { max-width: 560px; font-size: 16px; line-height: 1.55; color: var(--ink-2); }

/* progress */
.cp-onb-body { padding: 12px 0 80px; }
.cp-onb-progress { padding: 16px 22px; border-radius: 16px; margin-bottom: 28px; }
.cp-onb-progress-head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 10px;
  font-size: 13px; color: var(--ink-2);
}
.cp-onb-progress-pct { color: var(--ink); font-weight: 600; }
.progress-track {
  height: 4px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 999px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--brand) 0%, var(--brand-2) 100%);
  box-shadow: 0 0 16px rgba(167, 139, 250, 0.55);
  transition: width .6s cubic-bezier(.2,.7,.2,1);
}

/* steps */
.cp-onb-steps { display: flex; flex-direction: column; gap: 14px; }
.rounded-2xl { border-radius: 18px; }
.step { padding: 22px 22px 18px; transition: border-color .25s ease, box-shadow .25s ease, transform .25s ease; }
.step.is-active {
  border-color: rgba(167, 139, 250, 0.45) !important;
  box-shadow:
    0 30px 60px -28px rgba(139, 92, 246, 0.65),
    0 0 0 1px rgba(167, 139, 250, 0.20) inset;
}
.step.is-done { opacity: 0.6; }
.cp-onb-step-head { display: grid; grid-template-columns: 44px 1fr; gap: 18px; align-items: start; }
.step-num {
  width: 44px; height: 44px;
  border-radius: 999px;
  display: inline-flex; align-items: center; justify-content: center;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.10);
  color: var(--ink);
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 13px; font-weight: 700;
}
.step-num.is-active {
  background: linear-gradient(135deg, var(--brand) 0%, var(--brand-2) 100%);
  border-color: var(--brand-2);
  color: #fff;
  box-shadow: 0 0 24px rgba(167, 139, 250, 0.65);
}
.step.is-done .step-num {
  background: rgba(167, 139, 250, 0.18);
  border-color: rgba(167, 139, 250, 0.35);
  color: var(--brand-2);
}
.cp-onb-step-head-r { min-width: 0; }
.cp-onb-step-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 6px; }
.agent-badge {
  display: inline-flex; align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--brand-2); text-transform: uppercase;
  background: rgba(139, 92, 246, 0.12);
  border: 1px solid rgba(167, 139, 250, 0.32);
}
.time-chip {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 9px;
  border-radius: 999px;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px;
  color: var(--ink-2);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.done-pill {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 9px;
  border-radius: 999px;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px; font-weight: 700;
  color: var(--brand-2);
  background: rgba(139, 92, 246, 0.12);
  border: 1px solid rgba(167, 139, 250, 0.32);
}
.cp-onb-step-title { margin: 0; font-size: 22px; font-weight: 600; letter-spacing: -0.02em; color: var(--ink); }
.cp-onb-step-body { margin: 6px 0 14px; font-size: 13.5px; line-height: 1.55; color: var(--ink-2); max-width: 620px; }
.cp-onb-step-items { list-style: none; padding: 0; margin: 0 0 16px; display: flex; flex-direction: column; gap: 7px; }
.cp-onb-step-items li { display: inline-flex; align-items: center; gap: 10px; font-size: 13px; color: var(--ink-2); }
.mark {
  display: inline-flex; align-items: center; justify-content: center;
  width: 18px; height: 18px;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--brand) 0%, var(--brand-2) 100%);
  color: #fff;
  flex-shrink: 0;
}
.cp-onb-step-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 6px; }

/* buttons */
.btn-primary {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 18px;
  border: 0; cursor: pointer;
  border-radius: 999px;
  font-size: 13px; font-weight: 600;
  color: #fff;
  background: linear-gradient(180deg, var(--brand-2), var(--brand));
  box-shadow:
    0 14px 28px -10px rgba(139, 92, 246, 0.55),
    inset 0 -2px 0 rgba(0, 0, 0, 0.08);
  transition: transform .15s ease, box-shadow .15s ease;
}
.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow:
    0 18px 36px -10px rgba(139, 92, 246, 0.7),
    inset 0 -2px 0 rgba(0, 0, 0, 0.08);
}
.btn-lg { padding: 14px 26px; font-size: 14px; }
.btn-ghost {
  padding: 10px 16px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: var(--ink);
  font-size: 13px; font-weight: 500;
  cursor: pointer;
  transition: all .15s ease;
}
.btn-ghost:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.24);
}

/* launch CTA */
.cp-onb-launch {
  margin-top: 28px;
  padding: 26px 28px;
  display: flex; align-items: center; justify-content: space-between;
  gap: 24px;
}
.cp-onb-launch-tag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px; letter-spacing: 0.22em; font-weight: 700;
  color: var(--brand-2); text-transform: uppercase;
  margin-bottom: 6px;
}
.cp-onb-launch-h { margin: 0 0 6px; font-size: 22px; font-weight: 600; letter-spacing: -0.02em; color: var(--ink); }
.cp-onb-launch-b { margin: 0; font-size: 13.5px; line-height: 1.55; color: var(--ink-2); max-width: 520px; }
.cp-onb-foot-note {
  margin-top: 18px;
  text-align: center;
  font-size: 12.5px; color: var(--ink-3);
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  letter-spacing: 0.02em;
}

/* footer */
.cp-onb-footer {
  position: relative; z-index: 1;
  padding: 32px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(10, 10, 20, 0.4);
}
.cp-onb-footer-inner { display: flex; align-items: center; justify-content: space-between; gap: 24px; }
.cp-onb-footer-brand { display: inline-flex; align-items: center; gap: 10px; font-size: 13.5px; color: var(--ink-2); }
.cp-onb-footer-links { display: inline-flex; gap: 22px; font-size: 13px; color: var(--ink-2); }
.cp-onb-footer-links a:hover { color: var(--brand-2); }
.cp-onb-footer-meta {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 11px; letter-spacing: 0.10em;
  color: var(--ink-3); text-transform: uppercase;
}

@media (max-width: 760px) {
  .cp-onb-launch { flex-direction: column; align-items: flex-start; }
  .cp-onb-footer-inner { flex-direction: column; align-items: flex-start; }
  .cp-onb-nav-links { display: none; }
  .cp-onb-step-head { grid-template-columns: 36px 1fr; gap: 12px; }
  .step-num { width: 36px; height: 36px; }
}
`;
