/**
 * MedPay · Onboarding (/medpay/onboarding)
 *
 * Direct port of the AUREAN/AI onboarding page styling
 * (https://aurean-ai-landing-production.up.railway.app/onboarding)
 * but tinted for MedPay's teal palette and with the consolidated
 * agent stack (CORE / NEXUS / ORACLE / FLUX) as the four setup
 * modules instead of Aurean's (PRISM / VEGA / NEXUS / FLUX).
 *
 * The four modules walk the practice owner through the actual
 * configuration tools each one lives in. CTAs either open a third-party
 * tool in a new tab (HighLevel, MiCamp) or route to an internal MedPay
 * setup page. Step type carries an `external: boolean` flag that
 * switches the CTA between Next.js <Link> and a target="_blank" <a>
 * with an external-link arrow icon.
 *
 *   01 CORE   — Account setup            -> /medpay/signup (internal)
 *   02 ORACLE — Smart forms + routing    -> HighLevel sub-account (external)
 *   03 FLUX   — Payment processing       -> MiCamp onboarding (external)
 *   04 NEXUS  — Lender marketplace setup -> /medpay/onboarding/lender-marketplace (internal)
 *
 * Visual DNA preserved from Aurean:
 *   • Dark base (#0a0a14) with radial ambient glow + dot grid
 *   • Glass-morphism cards (backdrop-filter blur + translucent fill)
 *   • Gradient-to-ash text headings
 *   • Numbered step circles with brand-tinted glow on the active step
 *   • Slim progress bar at the top ("N of 4 complete")
 *   • Per-step: agent badge, title, body, items list, time chip,
 *     "Continue setup" link + "Mark complete" action
 *   • Final "Book launch call" CTA card
 *   • "Saves automatically · your launch engineer is in your Slack"
 *     supportive footer
 *
 * Tinted for MedPay:
 *   • Ambient glow uses teal radial (#0E7C66 / #22B8A0)
 *   • Active step glow + progress fill use teal gradient
 *   • Agent badges use the deck's monospace + teal pill style
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
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
  /**
   * When true the CTA opens in a new tab with rel="noopener noreferrer"
   * and shows an external-link arrow. Use for hand-offs to third-party
   * tools (HighLevel, MiCamp). Default false = internal Next.js route.
   */
  external?: boolean;
};

const STEPS: Step[] = [
  {
    id: 'core',
    n: '01',
    agent: 'CORE',
    title: 'Account setup',
    body: 'Provision your branded MedPay partner portal, invite your practice team, and upload the KYB documents that anchor every lender file we submit on your behalf.',
    items: [
      'Branded partner portal provisioned',
      'Practice team invites · admin + closer roles',
      'KYB document upload',
    ],
    time: '≈ 5 min',
    configLabel: 'Continue setup',
    configHref: '/medpay/signup',
  },
  {
    id: 'oracle',
    n: '02',
    agent: 'ORACLE',
    title: 'Smart forms & financial qualification',
    body: 'Build your smart form and the smart-routing rules that decide which calendar each qualified buyer lands on. We hand you straight off to HighSale so the form, the CRM webhook, and the pipeline all live in one place. Come back and mark this complete once the smart form is live.',
    items: [
      'Smart form field configuration in HighSale',
      'Smart routing rules · calendar + sales rep',
      'CRM webhook + pixel tracking',
    ],
    time: '≈ 15 min',
    configLabel: 'Open HighSale',
    configHref: 'https://highsale.com/',
    external: true,
  },
  {
    id: 'flux',
    n: '03',
    agent: 'FLUX',
    title: 'Payment processing',
    body: 'We onboard you to MiCamp Solutions for the general checkout payments you take outside the lender flow (deposits, cash sales, follow-on charges). Lender-funded loans still settle merchant-direct from each lender, separately. Click through to complete the MiCamp merchant application and sign the processing agreement.',
    items: [
      'MiCamp merchant account application',
      'Settlement bank routing + voided check',
      'MiCamp processing agreement signed',
    ],
    time: '≈ 2–3 business days',
    configLabel: 'Open MiCamp onboarding',
    configHref: 'https://micamp.com/',
    external: true,
  },
  {
    id: 'nexus',
    n: '04',
    agent: 'NEXUS',
    title: 'Lender marketplace',
    body: 'Tell us your ticket sizes, treatment categories, monthly volume target, and any existing lender relationships. We use this to underwrite you with the right panel of lenders so NEXUS can quote them in parallel on every soft-pull and surface the cheapest monthly to the patient.',
    items: [
      'Practice profile + ticket caps',
      'Treatment categories funded',
      'Existing lender relationships (if any)',
    ],
    time: '≈ 10 min',
    configLabel: 'Open lender setup',
    configHref: '/medpay/onboarding/lender-marketplace',
  },
];

const STORAGE_KEY = 'medpay-onboarding-done-v1';

export default function MedPayOnboarding(): JSX.Element {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [activeIdx, setActiveIdx] = useState(0);

  const completeCount = done.size;
  const progressPct = Math.round((completeCount / STEPS.length) * 100);

  /**
   * Hydrate completed-modules state from localStorage on mount so the
   * practice owner can close the tab and pick up where they left off.
   * Wrapped in try/catch because localStorage can throw in some Safari
   * private-mode / iframe sandbox contexts and onboarding shouldn't break.
   */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const ids = JSON.parse(raw);
      if (Array.isArray(ids)) {
        const valid = ids.filter(
          (id): id is string => typeof id === 'string' && STEPS.some((s) => s.id === id),
        );
        if (valid.length) setDone(new Set(valid));
      }
    } catch {
      /* ignore — fall back to empty state */
    }
  }, []);

  useEffect(() => {
    // first incomplete step gets the active glow
    const firstOpen = STEPS.findIndex((s) => !done.has(s.id));
    setActiveIdx(firstOpen === -1 ? STEPS.length - 1 : firstOpen);
  }, [done]);

  function markDone(id: string) {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      // persist immediately so a quick refresh doesn't lose the click
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore storage failures */
      }
      return next;
    });
  }

  return (
    <div className="mp-onb-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="mp-onb-ambient-bg">
        <div className="ambient-glow" />
        <div className="ambient-grid" />
      </div>

      {/* HEADER */}
      <header className="mp-onb-nav">
        <div className="mp-onb-nav-inner">
          <Link href="/medpay/start" className="mp-onb-brand" aria-label="MedPay home">
            <span className="mp-onb-brand-mark">
              <LogoIcon />
            </span>
            <span className="mp-onb-brand-word">
              <span className="grad-text-brand">Med</span>
              <span className="mp-onb-brand-slash">/</span>
              <span className="mp-onb-brand-suffix">Pay</span>
            </span>
          </Link>
          <nav className="mp-onb-nav-links">
            <Link href="/sales/medpay">Sales deck</Link>
            <Link href="/landing/medpay">Platform</Link>
            <Link href="/help">Support</Link>
          </nav>
        </div>
      </header>

      <main className="mp-onb-main">
        {/* Hero */}
        <section className="mp-onb-hero">
          <div className="mp-onb-container">
            <div className="mp-onb-eyebrow-pill">
              <span className="mp-onb-pulse-dot" />
              ACTIVATE MEDPAY
            </div>
            <h1 className="mp-onb-h1">
              <span className="grad-text">Onboarding</span>
            </h1>
            <p className="mp-onb-hero-sub">
              Four short modules. Saves automatically. Come back any time. Your launch engineer is
              in your Slack channel.
            </p>
          </div>
        </section>

        {/* Progress + steps */}
        <section className="mp-onb-body">
          <div className="mp-onb-container-narrow">
            <div className="mp-onb-progress glass">
              <div className="mp-onb-progress-head">
                <span className="mp-onb-progress-label">
                  <span className="stat-num">{completeCount}</span> of{' '}
                  <span className="stat-num">{STEPS.length}</span> complete
                </span>
                <span className="mp-onb-progress-pct stat-num">{progressPct}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
            </div>

            <div className="mp-onb-steps">
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
                    <div className="mp-onb-step-head">
                      <div className={`step-num ${isActive ? 'is-active' : ''}`}>
                        {isDone ? <CheckIcon /> : s.n}
                      </div>
                      <div className="mp-onb-step-head-r">
                        <div className="mp-onb-step-meta">
                          <span className="agent-badge">{s.agent}</span>
                          <span className="time-chip">⌛ {s.time}</span>
                          {isDone ? <span className="done-pill">✓ Complete</span> : null}
                        </div>
                        <h3 className="mp-onb-step-title">{s.title}</h3>
                        <p className="mp-onb-step-body">{s.body}</p>
                        <ul className="mp-onb-step-items">
                          {s.items.map((it, j) => (
                            <li key={j}>
                              <span className="mark" aria-hidden>
                                <CheckIcon size={11} />
                              </span>
                              <span>{it}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="mp-onb-step-actions">
                          {s.external ? (
                            <a
                              href={s.configHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-primary"
                            >
                              {s.configLabel} <ExternalIcon />
                            </a>
                          ) : (
                            <Link href={s.configHref} className="btn-primary">
                              {s.configLabel} <ArrowIcon />
                            </Link>
                          )}
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

            {/* Final CTA */}
            <div className="mp-onb-launch glass-hi rounded-2xl">
              <div>
                <div className="mp-onb-launch-tag">FINAL STEP</div>
                <h3 className="mp-onb-launch-h">Book your launch call</h3>
                <p className="mp-onb-launch-b">
                  30 minutes with the MedPay launch team. We walk the first soft-pull on your real
                  traffic and validate the lender panel together.
                </p>
              </div>
              <Link href="/help" className="btn-primary btn-lg">
                Book launch call <ArrowIcon />
              </Link>
            </div>

            <div className="mp-onb-foot-note">
              Saves automatically. Come back any time. Your launch engineer is in your Slack
              channel.
            </div>
          </div>
        </section>
      </main>

      <footer className="mp-onb-footer">
        <div className="mp-onb-container-narrow mp-onb-footer-inner">
          <div className="mp-onb-footer-brand">
            <LogoIcon />
            <span>
              <span className="grad-text-brand">MedPay</span> · A vertical of EazePay
            </span>
          </div>
          <div className="mp-onb-footer-links">
            <Link href="/sales/medpay">Sales deck</Link>
            <Link href="/landing/medpay">Platform</Link>
            <Link href="/help">Support</Link>
          </div>
          <div className="mp-onb-footer-meta">NMLS #2456701 · FCRA · ECOA · TILA</div>
        </div>
      </footer>

      {/*
        Floating concierge CTA · Hub + Concierge pattern. Persistent across
        the whole onboarding page so a practice owner who's stuck on any
        module (HighSale wiring, MiCamp app, lender form) can grab a launch
        engineer instantly without scrolling back to the header.
      */}
      <a
        href="mailto:launch@eazepay.com?subject=MedPay%20launch%20call%20%E2%80%94%20stuck%20on%20onboarding&body=Hi%20launch%20team%2C%20I%27m%20setting%20up%20MedPay%20and%20want%20to%20jump%20on%20a%2015-min%20call%20to%20walk%20through%20it%20together.%20Practice%20name%3A%20"
        className="mp-onb-fab"
        aria-label="Book a 15-min launch call with the MedPay team"
      >
        <span className="mp-onb-fab-dot" aria-hidden />
        <span className="mp-onb-fab-h">Stuck?</span>
        <span className="mp-onb-fab-b">Book a 15-min launch call →</span>
      </a>
    </div>
  );
}

/* ---------- icons ---------- */

function LogoIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2" y="3" width="20" height="18" rx="4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 12h10M12 7v10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
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
function ExternalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1h5"
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

/* ---------- CSS (AureanAI port, MedPay teal accent) ---------- */

const CSS = `
.mp-onb-root {
  --brand: #0E7C66;
  --brand-2: #22B8A0;
  --brand-deep: #062C29;
  --ink: #EEEEF2;
  --ink-2: #B9B9C7;
  --ink-3: #8A8AA0;
  --bg: #0a0a14;
  --bg-2: #101023;
  --bg-3: #16162a;

  position: relative;
  min-height: 100vh;
  background: var(--bg);
  color: var(--ink);
  font-family: inherit;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}
.mp-onb-root * { box-sizing: border-box; }
.mp-onb-root a { color: inherit; text-decoration: none; }

.mp-onb-ambient-bg {
  position: fixed; inset: 0;
  pointer-events: none;
  z-index: 0;
}
.ambient-glow {
  position: absolute; inset: 0;
  background:
    radial-gradient(ellipse 80% 60% at 50% 0%, rgba(14, 124, 102, 0.40), transparent 60%),
    radial-gradient(ellipse 60% 50% at 80% 80%, rgba(34, 184, 160, 0.25), transparent 60%);
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
  background: linear-gradient(180deg, rgba(35, 47, 45, 0.55), rgba(16, 22, 21, 0.55));
  border: 1px solid rgba(255, 255, 255, 0.07);
  backdrop-filter: blur(14px);
}
.glass-hi {
  background:
    radial-gradient(ellipse 60% 100% at 0% 0%, rgba(34, 184, 160, 0.22), transparent 65%),
    linear-gradient(180deg, rgba(35, 47, 45, 0.55), rgba(20, 26, 25, 0.55));
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
.mp-onb-nav {
  position: sticky; top: 0; z-index: 30;
  background: rgba(10, 10, 20, 0.65);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.mp-onb-nav-inner {
  max-width: 1180px; margin: 0 auto;
  padding: 14px 32px;
  display: flex; align-items: center; gap: 32px;
}
.mp-onb-brand {
  display: inline-flex; align-items: center; gap: 10px;
  color: var(--ink);
}
.mp-onb-brand-mark {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--brand) 0%, var(--brand-2) 100%);
  color: #fff;
  box-shadow: 0 8px 24px -8px rgba(34, 184, 160, 0.45);
}
.mp-onb-brand-word { font-weight: 700; font-size: 16px; letter-spacing: -0.01em; }
.mp-onb-brand-slash { color: var(--ink-3); margin: 0 1px; }
.mp-onb-brand-suffix { color: var(--ink); }
.mp-onb-nav-links {
  margin-left: auto;
  display: inline-flex; gap: 22px;
  font-size: 13.5px; color: var(--ink-2);
}
.mp-onb-nav-links a:hover { color: var(--brand-2); }

/* main */
.mp-onb-main { position: relative; z-index: 1; }

.mp-onb-hero { padding: 56px 0 12px; }
.mp-onb-container { max-width: 1180px; margin: 0 auto; padding: 0 32px; }
.mp-onb-container-narrow { max-width: 920px; margin: 0 auto; padding: 0 32px; }

.mp-onb-eyebrow-pill {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(34, 184, 160, 0.10);
  border: 1px solid rgba(34, 184, 160, 0.22);
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 11px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--brand-2); text-transform: uppercase;
}
.mp-onb-pulse-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--brand-2);
  box-shadow: 0 0 0 0 rgba(34, 184, 160, 0.55);
  animation: mpOnbPulse 1.6s ease-in-out infinite;
}
@keyframes mpOnbPulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(34, 184, 160, 0.55); }
  50% { box-shadow: 0 0 0 6px rgba(34, 184, 160, 0); }
}
.mp-onb-h1 {
  margin: 18px 0 14px;
  font-size: clamp(48px, 7vw, 96px);
  font-weight: 700; letter-spacing: -0.03em; line-height: 1.02;
}
.mp-onb-hero-sub {
  max-width: 560px;
  font-size: 16px; line-height: 1.55;
  color: var(--ink-2);
}

/* progress */
.mp-onb-body { padding: 12px 0 80px; }
.mp-onb-progress {
  padding: 16px 22px;
  border-radius: 16px;
  margin-bottom: 28px;
}
.mp-onb-progress-head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 10px;
  font-size: 13px; color: var(--ink-2);
}
.mp-onb-progress-pct { color: var(--ink); font-weight: 600; }
.progress-track {
  height: 4px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 999px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--brand) 0%, var(--brand-2) 100%);
  box-shadow: 0 0 16px rgba(34, 184, 160, 0.55);
  transition: width .6s cubic-bezier(.2,.7,.2,1);
}

/* steps */
.mp-onb-steps { display: flex; flex-direction: column; gap: 14px; }
.rounded-2xl { border-radius: 18px; }
.step {
  padding: 22px 22px 18px;
  transition: border-color .25s ease, box-shadow .25s ease, transform .25s ease;
}
.step.is-active {
  border-color: rgba(34, 184, 160, 0.45) !important;
  box-shadow:
    0 30px 60px -28px rgba(34, 184, 160, 0.55),
    0 0 0 1px rgba(34, 184, 160, 0.20) inset;
}
.step.is-done { opacity: 0.6; }
.mp-onb-step-head {
  display: grid; grid-template-columns: 44px 1fr;
  gap: 18px; align-items: start;
}
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
  box-shadow: 0 0 24px rgba(34, 184, 160, 0.55);
}
.step.is-done .step-num {
  background: rgba(34, 184, 160, 0.18);
  border-color: rgba(34, 184, 160, 0.35);
  color: var(--brand-2);
}
.mp-onb-step-head-r { min-width: 0; }
.mp-onb-step-meta {
  display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
  margin-bottom: 6px;
}
.agent-badge {
  display: inline-flex; align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--brand-2); text-transform: uppercase;
  background: rgba(34, 184, 160, 0.10);
  border: 1px solid rgba(34, 184, 160, 0.30);
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
  background: rgba(34, 184, 160, 0.10);
  border: 1px solid rgba(34, 184, 160, 0.30);
}
.mp-onb-step-title {
  margin: 0;
  font-size: 22px; font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--ink);
}
.mp-onb-step-body {
  margin: 6px 0 14px;
  font-size: 13.5px; line-height: 1.55;
  color: var(--ink-2);
  max-width: 620px;
}
.mp-onb-step-items {
  list-style: none; padding: 0; margin: 0 0 16px;
  display: flex; flex-direction: column; gap: 7px;
}
.mp-onb-step-items li {
  display: inline-flex; align-items: center; gap: 10px;
  font-size: 13px; color: var(--ink-2);
}
.mark {
  display: inline-flex; align-items: center; justify-content: center;
  width: 18px; height: 18px;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--brand) 0%, var(--brand-2) 100%);
  color: #fff;
  flex-shrink: 0;
}
.mp-onb-step-actions {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  margin-top: 6px;
}

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
    0 14px 28px -10px rgba(34, 184, 160, 0.45),
    inset 0 -2px 0 rgba(0, 0, 0, 0.08);
  transition: transform .15s ease, box-shadow .15s ease;
}
.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow:
    0 18px 36px -10px rgba(34, 184, 160, 0.6),
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
.mp-onb-launch {
  margin-top: 28px;
  padding: 26px 28px;
  display: flex; align-items: center; justify-content: space-between;
  gap: 24px;
}
.mp-onb-launch-tag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px; letter-spacing: 0.22em; font-weight: 700;
  color: var(--brand-2); text-transform: uppercase;
  margin-bottom: 6px;
}
.mp-onb-launch-h {
  margin: 0 0 6px;
  font-size: 22px; font-weight: 600; letter-spacing: -0.02em;
  color: var(--ink);
}
.mp-onb-launch-b {
  margin: 0;
  font-size: 13.5px; line-height: 1.55;
  color: var(--ink-2);
  max-width: 520px;
}
.mp-onb-foot-note {
  margin-top: 18px;
  text-align: center;
  font-size: 12.5px; color: var(--ink-3);
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  letter-spacing: 0.02em;
}

/* footer */
.mp-onb-footer {
  position: relative; z-index: 1;
  padding: 32px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(10, 10, 20, 0.4);
}
.mp-onb-footer-inner {
  display: flex; align-items: center; justify-content: space-between;
  gap: 24px;
}
.mp-onb-footer-brand {
  display: inline-flex; align-items: center; gap: 10px;
  font-size: 13.5px; color: var(--ink-2);
}
.mp-onb-footer-links { display: inline-flex; gap: 22px; font-size: 13px; color: var(--ink-2); }
.mp-onb-footer-links a:hover { color: var(--brand-2); }
.mp-onb-footer-meta {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 11px; letter-spacing: 0.10em;
  color: var(--ink-3); text-transform: uppercase;
}

/* Floating concierge CTA · stays bottom-right on every scroll position */
.mp-onb-fab {
  position: fixed;
  bottom: 24px; right: 24px;
  z-index: 50;
  display: inline-flex; align-items: center; gap: 12px;
  padding: 14px 22px;
  background: linear-gradient(135deg, #0E7C66, #22B8A0);
  color: #fff;
  border-radius: 999px;
  box-shadow: 0 18px 44px -10px rgba(14, 124, 102, 0.55), 0 2px 8px rgba(0, 0, 0, 0.18);
  text-decoration: none;
  font-size: 14px;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}
.mp-onb-fab:hover {
  transform: translateY(-2px);
  box-shadow: 0 22px 52px -10px rgba(14, 124, 102, 0.65), 0 4px 12px rgba(0, 0, 0, 0.22);
}
.mp-onb-fab-dot {
  width: 9px; height: 9px; border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.18);
  animation: mp-onb-fab-pulse 1.8s ease-in-out infinite;
}
@keyframes mp-onb-fab-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.45); }
  50%      { box-shadow: 0 0 0 8px rgba(255, 255, 255, 0); }
}
.mp-onb-fab-h { font-weight: 700; letter-spacing: -0.01em; }
.mp-onb-fab-b { opacity: 0.92; }

@media (max-width: 760px) {
  .mp-onb-launch { flex-direction: column; align-items: flex-start; }
  .mp-onb-footer-inner { flex-direction: column; align-items: flex-start; }
  .mp-onb-nav-links { display: none; }
  .mp-onb-fab {
    bottom: 16px; right: 16px;
    padding: 12px 18px;
    font-size: 13px;
  }
  .mp-onb-fab-h { display: none; }
  .mp-onb-step-head { grid-template-columns: 36px 1fr; gap: 12px; }
  .step-num { width: 36px; height: 36px; }
}
`;
