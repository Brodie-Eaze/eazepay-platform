/**
 * TradePay · Onboarding (/tradepay/onboarding)
 *
 * AureanAI-style onboarding page, tinted for TradePay's orange
 * palette. 4 stepped agent modules adapted for the trades sales
 * motion: estimator intake → lender panel → soft-pull / tier
 * ladder → merchant-direct payout.
 *
 * See /medpay/onboarding/page.tsx for the structural twin. Both
 * share the same .glass / .step / .progress-fill primitives — only
 * the accent colors and per-vertical copy differ. The 4 modules
 * (CORE / NEXUS / ORACLE / FLUX) map 1:1 across MedPay / TradePay /
 * CoachPay so any partner moving across verticals sees the same
 * shape.
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
    body: 'Provision your branded TradePay partner portal, invite your estimator team, and upload the KYB documents that anchor every lender file we submit on your behalf.',
    items: [
      'Branded partner portal provisioned',
      'Estimator team invites · admin + closer roles',
      'KYB document upload',
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
    body: "We submit your trade business to the EazePay lender marketplace for underwriting. Each lender has to approve you for traffic before they appear in the waterfall — once they're live, NEXUS quotes them in parallel and surfaces the cheapest monthly to the homeowner.",
    items: [
      'Lender panel underwriting',
      'Carrier appetite + ticket caps',
      'Best-offer presentation rules',
    ],
    time: '≈ 2–3 business days',
    configLabel: 'Configure NEXUS',
    configHref: '/admin?surface=brand-portal&brand=trade-pay&panel=LenderPanelMatrix',
  },
  {
    id: 'oracle',
    n: '03',
    agent: 'ORACLE',
    title: 'Smart forms & financial qualification',
    body: 'Configure your smart-form fields, set up the smart routing rules that decide which lender quotes which lead, and connect your HighSale CRM so every doorstep soft-pull lands as a contact.',
    items: [
      'Smart form configuration',
      'Smart routing rules',
      'HighSale CRM connection (API + webhook)',
    ],
    time: '≈ 15 min',
    configLabel: 'Configure ORACLE',
    configHref: '/admin?surface=brand-portal&brand=trade-pay&panel=AgentsPanel',
  },
  {
    id: 'flux',
    n: '04',
    agent: 'FLUX',
    title: 'Payment processing',
    body: 'FLUX onboards your trade business to MiCamp Solutions — a payment processor with better-than-industry rates for the general checkout payments you take outside the lender flow (deposits, cash sales, follow-on charges). Lender-funded jobs still settle merchant-direct from each lender, separately. Confirm your routing details and sign the MiCamp processing agreement.',
    items: [
      'MiCamp merchant account application',
      'Settlement bank routing + voided check',
      'MiCamp processing agreement signed',
    ],
    time: '≈ 2–3 business days',
    configLabel: 'Configure FLUX',
    configHref: '/admin?surface=brand-portal&brand=trade-pay&panel=PayoutDestinationsPanel',
  },
];

export default function TradePayOnboarding(): JSX.Element {
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
    <div className="tp-onb-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="tp-onb-ambient-bg">
        <div className="ambient-glow" />
        <div className="ambient-grid" />
      </div>

      <header className="tp-onb-nav">
        <div className="tp-onb-nav-inner">
          <Link href="/tradepay/checkout" className="tp-onb-brand" aria-label="TradePay home">
            <span className="tp-onb-brand-mark">
              <LogoIcon />
            </span>
            <span className="tp-onb-brand-word">
              <span className="grad-text-brand">Trade</span>
              <span className="tp-onb-brand-slash">/</span>
              <span className="tp-onb-brand-suffix">Pay</span>
            </span>
          </Link>
          <nav className="tp-onb-nav-links">
            <Link href="/sales/tradepay">Sales deck</Link>
            <Link href="/landing/tradepay">Platform</Link>
            <Link href="/help">Support</Link>
          </nav>
        </div>
      </header>

      <main className="tp-onb-main">
        <section className="tp-onb-hero">
          <div className="tp-onb-container">
            <div className="tp-onb-eyebrow-pill">
              <span className="tp-onb-pulse-dot" />
              ACTIVATE TRADEPAY
            </div>
            <h1 className="tp-onb-h1">
              <span className="grad-text">Onboarding</span>
            </h1>
            <p className="tp-onb-hero-sub">
              Four short modules. Saves automatically. Come back any time. Your launch engineer is
              in your Slack channel.
            </p>
          </div>
        </section>

        <section className="tp-onb-body">
          <div className="tp-onb-container-narrow">
            <div className="tp-onb-progress glass">
              <div className="tp-onb-progress-head">
                <span className="tp-onb-progress-label">
                  <span className="stat-num">{completeCount}</span> of{' '}
                  <span className="stat-num">{STEPS.length}</span> complete
                </span>
                <span className="tp-onb-progress-pct stat-num">{progressPct}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
            </div>

            <div className="tp-onb-steps">
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
                    <div className="tp-onb-step-head">
                      <div className={`step-num ${isActive ? 'is-active' : ''}`}>
                        {isDone ? <CheckIcon /> : s.n}
                      </div>
                      <div className="tp-onb-step-head-r">
                        <div className="tp-onb-step-meta">
                          <span className="agent-badge">{s.agent}</span>
                          <span className="time-chip">⌛ {s.time}</span>
                          {isDone ? <span className="done-pill">✓ Complete</span> : null}
                        </div>
                        <h3 className="tp-onb-step-title">{s.title}</h3>
                        <p className="tp-onb-step-body">{s.body}</p>
                        <ul className="tp-onb-step-items">
                          {s.items.map((it, j) => (
                            <li key={j}>
                              <span className="mark" aria-hidden>
                                <CheckIcon size={11} />
                              </span>
                              <span>{it}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="tp-onb-step-actions">
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

            <div className="tp-onb-launch glass-hi rounded-2xl">
              <div>
                <div className="tp-onb-launch-tag">FINAL STEP</div>
                <h3 className="tp-onb-launch-h">Book your launch call</h3>
                <p className="tp-onb-launch-b">
                  30 minutes with the TradePay launch team. We walk the first doorstep soft-pull on
                  your real traffic and validate the lender panel together.
                </p>
              </div>
              <Link href="/help" className="btn-primary btn-lg">
                Book launch call <ArrowIcon />
              </Link>
            </div>

            <div className="tp-onb-foot-note">
              Saves automatically. Come back any time. Your launch engineer is in your Slack
              channel.
            </div>
          </div>
        </section>
      </main>

      <footer className="tp-onb-footer">
        <div className="tp-onb-container-narrow tp-onb-footer-inner">
          <div className="tp-onb-footer-brand">
            <LogoIcon />
            <span>
              <span className="grad-text-brand">TradePay</span> · A vertical of EazePay
            </span>
          </div>
          <div className="tp-onb-footer-links">
            <Link href="/sales/tradepay">Sales deck</Link>
            <Link href="/landing/tradepay">Platform</Link>
            <Link href="/help">Support</Link>
          </div>
          <div className="tp-onb-footer-meta">NMLS #2456701 · FCRA · ECOA · TILA</div>
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
        d="M3 12l9-7 9 7v8a2 2 0 0 1-2 2h-4v-6h-6v6H5a2 2 0 0 1-2-2v-8z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

/* ---------- CSS (Aurean port, TradePay orange accent) ---------- */

const CSS = `
.tp-onb-root {
  --brand: #EA580C;
  --brand-2: #FB923C;
  --brand-deep: #431407;
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
.tp-onb-root * { box-sizing: border-box; }
.tp-onb-root a { color: inherit; text-decoration: none; }

.tp-onb-ambient-bg { position: fixed; inset: 0; pointer-events: none; z-index: 0; }
.ambient-glow {
  position: absolute; inset: 0;
  background:
    radial-gradient(ellipse 80% 60% at 50% 0%, rgba(234, 88, 12, 0.40), transparent 60%),
    radial-gradient(ellipse 60% 50% at 80% 80%, rgba(251, 146, 60, 0.25), transparent 60%);
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
  background: linear-gradient(180deg, rgba(45, 30, 20, 0.55), rgba(20, 14, 10, 0.55));
  border: 1px solid rgba(255, 255, 255, 0.07);
  backdrop-filter: blur(14px);
}
.glass-hi {
  background:
    radial-gradient(ellipse 60% 100% at 0% 0%, rgba(251, 146, 60, 0.22), transparent 65%),
    linear-gradient(180deg, rgba(45, 30, 20, 0.55), rgba(26, 18, 12, 0.55));
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
.tp-onb-nav {
  position: sticky; top: 0; z-index: 30;
  background: rgba(10, 10, 20, 0.65);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.tp-onb-nav-inner {
  max-width: 1180px; margin: 0 auto;
  padding: 14px 32px;
  display: flex; align-items: center; gap: 32px;
}
.tp-onb-brand { display: inline-flex; align-items: center; gap: 10px; color: var(--ink); }
.tp-onb-brand-mark {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--brand) 0%, var(--brand-2) 100%);
  color: #fff;
  box-shadow: 0 8px 24px -8px rgba(251, 146, 60, 0.45);
}
.tp-onb-brand-word { font-weight: 700; font-size: 16px; letter-spacing: -0.01em; }
.tp-onb-brand-slash { color: var(--ink-3); margin: 0 1px; }
.tp-onb-brand-suffix { color: var(--ink); }
.tp-onb-nav-links { margin-left: auto; display: inline-flex; gap: 22px; font-size: 13.5px; color: var(--ink-2); }
.tp-onb-nav-links a:hover { color: var(--brand-2); }

/* main */
.tp-onb-main { position: relative; z-index: 1; }
.tp-onb-hero { padding: 56px 0 12px; }
.tp-onb-container { max-width: 1180px; margin: 0 auto; padding: 0 32px; }
.tp-onb-container-narrow { max-width: 920px; margin: 0 auto; padding: 0 32px; }

.tp-onb-eyebrow-pill {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(251, 146, 60, 0.10);
  border: 1px solid rgba(251, 146, 60, 0.22);
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 11px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--brand-2); text-transform: uppercase;
}
.tp-onb-pulse-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--brand-2);
  animation: tpOnbPulse 1.6s ease-in-out infinite;
}
@keyframes tpOnbPulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(251, 146, 60, 0.55); }
  50% { box-shadow: 0 0 0 6px rgba(251, 146, 60, 0); }
}
.tp-onb-h1 {
  margin: 18px 0 14px;
  font-size: clamp(48px, 7vw, 96px);
  font-weight: 700; letter-spacing: -0.03em; line-height: 1.02;
}
.tp-onb-hero-sub { max-width: 560px; font-size: 16px; line-height: 1.55; color: var(--ink-2); }

/* progress */
.tp-onb-body { padding: 12px 0 80px; }
.tp-onb-progress { padding: 16px 22px; border-radius: 16px; margin-bottom: 28px; }
.tp-onb-progress-head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 10px;
  font-size: 13px; color: var(--ink-2);
}
.tp-onb-progress-pct { color: var(--ink); font-weight: 600; }
.progress-track {
  height: 4px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 999px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--brand) 0%, var(--brand-2) 100%);
  box-shadow: 0 0 16px rgba(251, 146, 60, 0.55);
  transition: width .6s cubic-bezier(.2,.7,.2,1);
}

/* steps */
.tp-onb-steps { display: flex; flex-direction: column; gap: 14px; }
.rounded-2xl { border-radius: 18px; }
.step { padding: 22px 22px 18px; transition: border-color .25s ease, box-shadow .25s ease, transform .25s ease; }
.step.is-active {
  border-color: rgba(251, 146, 60, 0.45) !important;
  box-shadow:
    0 30px 60px -28px rgba(251, 146, 60, 0.55),
    0 0 0 1px rgba(251, 146, 60, 0.20) inset;
}
.step.is-done { opacity: 0.6; }
.tp-onb-step-head { display: grid; grid-template-columns: 44px 1fr; gap: 18px; align-items: start; }
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
  box-shadow: 0 0 24px rgba(251, 146, 60, 0.55);
}
.step.is-done .step-num {
  background: rgba(251, 146, 60, 0.18);
  border-color: rgba(251, 146, 60, 0.35);
  color: var(--brand-2);
}
.tp-onb-step-head-r { min-width: 0; }
.tp-onb-step-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 6px; }
.agent-badge {
  display: inline-flex; align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--brand-2); text-transform: uppercase;
  background: rgba(251, 146, 60, 0.10);
  border: 1px solid rgba(251, 146, 60, 0.30);
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
  background: rgba(251, 146, 60, 0.10);
  border: 1px solid rgba(251, 146, 60, 0.30);
}
.tp-onb-step-title { margin: 0; font-size: 22px; font-weight: 600; letter-spacing: -0.02em; color: var(--ink); }
.tp-onb-step-body { margin: 6px 0 14px; font-size: 13.5px; line-height: 1.55; color: var(--ink-2); max-width: 620px; }
.tp-onb-step-items { list-style: none; padding: 0; margin: 0 0 16px; display: flex; flex-direction: column; gap: 7px; }
.tp-onb-step-items li { display: inline-flex; align-items: center; gap: 10px; font-size: 13px; color: var(--ink-2); }
.mark {
  display: inline-flex; align-items: center; justify-content: center;
  width: 18px; height: 18px;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--brand) 0%, var(--brand-2) 100%);
  color: #fff;
  flex-shrink: 0;
}
.tp-onb-step-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 6px; }

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
    0 14px 28px -10px rgba(251, 146, 60, 0.45),
    inset 0 -2px 0 rgba(0, 0, 0, 0.08);
  transition: transform .15s ease, box-shadow .15s ease;
}
.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow:
    0 18px 36px -10px rgba(251, 146, 60, 0.6),
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
.tp-onb-launch {
  margin-top: 28px;
  padding: 26px 28px;
  display: flex; align-items: center; justify-content: space-between;
  gap: 24px;
}
.tp-onb-launch-tag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px; letter-spacing: 0.22em; font-weight: 700;
  color: var(--brand-2); text-transform: uppercase;
  margin-bottom: 6px;
}
.tp-onb-launch-h { margin: 0 0 6px; font-size: 22px; font-weight: 600; letter-spacing: -0.02em; color: var(--ink); }
.tp-onb-launch-b { margin: 0; font-size: 13.5px; line-height: 1.55; color: var(--ink-2); max-width: 520px; }
.tp-onb-foot-note {
  margin-top: 18px;
  text-align: center;
  font-size: 12.5px; color: var(--ink-3);
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  letter-spacing: 0.02em;
}

/* footer */
.tp-onb-footer {
  position: relative; z-index: 1;
  padding: 32px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(10, 10, 20, 0.4);
}
.tp-onb-footer-inner { display: flex; align-items: center; justify-content: space-between; gap: 24px; }
.tp-onb-footer-brand { display: inline-flex; align-items: center; gap: 10px; font-size: 13.5px; color: var(--ink-2); }
.tp-onb-footer-links { display: inline-flex; gap: 22px; font-size: 13px; color: var(--ink-2); }
.tp-onb-footer-links a:hover { color: var(--brand-2); }
.tp-onb-footer-meta {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 11px; letter-spacing: 0.10em;
  color: var(--ink-3); text-transform: uppercase;
}

@media (max-width: 760px) {
  .tp-onb-launch { flex-direction: column; align-items: flex-start; }
  .tp-onb-footer-inner { flex-direction: column; align-items: flex-start; }
  .tp-onb-nav-links { display: none; }
  .tp-onb-step-head { grid-template-columns: 36px 1fr; gap: 12px; }
  .step-num { width: 36px; height: 36px; }
}
`;
