/**
 * EZ Check · Onboarding (/ez-check/onboarding)
 *
 * Aurean-style dark module page — same visual DNA as the per-brand
 * MedPay / TradePay / CoachPay onboarding screens, but with three
 * modules instead of four (EZ Check is a standalone pre-qualification
 * product, not a lender marketplace) and the sky-blue palette.
 *
 * The module list is read from `lib/ez-check-theme.ts` so the labels
 * stay aligned with the checkout's "What activates today" grid and
 * the landing page's feature list.
 *
 * Visual DNA preserved from Aurean / MedPay-onboarding:
 *   • Dark base (#0a0e1c) with radial ambient glow + dot grid
 *   • Glass-morphism cards (backdrop-filter blur + translucent fill)
 *   • Gradient-to-ash text headings
 *   • Numbered step circles with brand-tinted glow on the active step
 *   • Slim progress bar ("N of 3 complete")
 *   • Per-step: agent badge, title, body, items list, time chip,
 *     "Continue setup" link + "Mark complete" action
 *   • Final "Book launch call" CTA card
 */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { EZ_CHECK_MODULES, type EzCheckModule } from '../../lib/ez-check-theme';

type StepView = EzCheckModule & {
  configLabel: string;
  configHref: string;
};

/**
 * Each module's "Continue setup" CTA opens a mailto so the launch
 * engineer picks up the request and configures it server-side. EZ
 * Check has no self-serve admin console of its own yet — the actual
 * configuration screens still live in the EazePay back-office and
 * aren't reachable from this standalone marketing app.
 */
const STEPS: StepView[] = EZ_CHECK_MODULES.map((m) => ({
  ...m,
  configLabel: 'Continue setup',
  configHref: `mailto:launch@eazepay.com?subject=EZ%20Check%20—%20${encodeURIComponent(
    m.title,
  )}%20setup`,
}));

export default function EzCheckOnboarding(): JSX.Element {
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
    <div className="ezk-onb-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ezk-onb-ambient-bg">
        <div className="ambient-glow" />
        <div className="ambient-grid" />
      </div>

      {/* HEADER */}
      <header className="ezk-onb-nav">
        <div className="ezk-onb-nav-inner">
          <Link href="/" className="ezk-onb-brand" aria-label="EZ Check home">
            <span className="ezk-onb-brand-mark">
              <LogoIcon />
            </span>
            <span className="ezk-onb-brand-word">
              <span className="grad-text-brand">EZ</span>
              <span className="ezk-onb-brand-slash">/</span>
              <span className="ezk-onb-brand-suffix">Check</span>
            </span>
          </Link>
          <nav className="ezk-onb-nav-links">
            <Link href="/sales">Sales deck</Link>
            <Link href="/">Platform</Link>
            <a href="mailto:launch@eazepay.com?subject=EZ%20Check%20—%20support">Support</a>
          </nav>
        </div>
      </header>

      <main className="ezk-onb-main">
        {/* Hero */}
        <section className="ezk-onb-hero">
          <div className="ezk-onb-container">
            <div className="ezk-onb-eyebrow-pill">
              <span className="ezk-onb-pulse-dot" />
              ACTIVATE EZ CHECK
            </div>
            <h1 className="ezk-onb-h1">
              <span className="grad-text">Onboarding</span>
            </h1>
            <p className="ezk-onb-hero-sub">
              Three short modules. Saves automatically. Come back any time. Your launch engineer is
              in your Slack channel.
            </p>
          </div>
        </section>

        {/* Progress + steps */}
        <section className="ezk-onb-body">
          <div className="ezk-onb-container-narrow">
            <div className="ezk-onb-progress glass">
              <div className="ezk-onb-progress-head">
                <span className="ezk-onb-progress-label">
                  <span className="stat-num">{completeCount}</span> of{' '}
                  <span className="stat-num">{STEPS.length}</span> complete
                </span>
                <span className="ezk-onb-progress-pct stat-num">{progressPct}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
            </div>

            <div className="ezk-onb-steps">
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
                    <div className="ezk-onb-step-head">
                      <div className={`step-num ${isActive ? 'is-active' : ''}`}>
                        {isDone ? <CheckIcon /> : s.n}
                      </div>
                      <div className="ezk-onb-step-head-r">
                        <div className="ezk-onb-step-meta">
                          <span className="agent-badge">{s.agent}</span>
                          <span className="time-chip">⌛ {s.time}</span>
                          {isDone ? <span className="done-pill">✓ Complete</span> : null}
                        </div>
                        <h3 className="ezk-onb-step-title">{s.title}</h3>
                        <p className="ezk-onb-step-body">{s.body}</p>
                        <ul className="ezk-onb-step-items">
                          {s.items.map((it, j) => (
                            <li key={j}>
                              <span className="mark" aria-hidden>
                                <CheckIcon size={11} />
                              </span>
                              <span>{it}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="ezk-onb-step-actions">
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

            {/* Final CTA */}
            <div className="ezk-onb-launch glass-hi rounded-2xl">
              <div>
                <div className="ezk-onb-launch-tag">FINAL STEP</div>
                <h3 className="ezk-onb-launch-h">Book your launch call</h3>
                <p className="ezk-onb-launch-b">
                  30 minutes with the EZ Check launch team. We walk the first qualified buyer
                  through your live funnel and validate the smart-routing rules with you on screen.
                </p>
              </div>
              <a
                href="mailto:launch@eazepay.com?subject=EZ%20Check%20—%20book%20launch%20call"
                className="btn-primary btn-lg"
              >
                Book launch call <ArrowIcon />
              </a>
            </div>

            <div className="ezk-onb-foot-note">
              Saves automatically. Come back any time. Your launch engineer is in your Slack
              channel.
            </div>
          </div>
        </section>
      </main>

      <footer className="ezk-onb-footer">
        <div className="ezk-onb-container-narrow ezk-onb-footer-inner">
          <div className="ezk-onb-footer-brand">
            <LogoIcon />
            <span>
              <span className="grad-text-brand">EZ Check</span> · A product of EazePay
            </span>
          </div>
          <div className="ezk-onb-footer-links">
            <Link href="/sales">Sales deck</Link>
            <Link href="/">Platform</Link>
            <a href="mailto:launch@eazepay.com?subject=EZ%20Check%20—%20support">Support</a>
          </div>
          <div className="ezk-onb-footer-meta">FCRA · ECOA · GLBA · Audit log retained 7 yrs</div>
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
        d="M4 12l5 5 11-13"
        stroke="currentColor"
        strokeWidth="2.2"
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

/* ---------- CSS (sky-blue / slate dark module page) ---------- */

const CSS = `
.ezk-onb-root {
  --brand: #3B82F6;
  --brand-2: #60A5FA;
  --brand-deep: #1E3A8A;
  --ink: #EEF2F8;
  --ink-2: #B9C0D0;
  --ink-3: #8893A8;
  --bg: #0a0e1c;
  --bg-2: #0F1426;
  --bg-3: #141A2E;

  position: relative;
  min-height: 100vh;
  background: var(--bg);
  color: var(--ink);
  font-family: inherit;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}
.ezk-onb-root * { box-sizing: border-box; }
.ezk-onb-root a { color: inherit; text-decoration: none; }

.ezk-onb-ambient-bg {
  position: fixed; inset: 0;
  pointer-events: none;
  z-index: 0;
}
.ambient-glow {
  position: absolute; inset: 0;
  background:
    radial-gradient(ellipse 80% 60% at 50% 0%, rgba(59, 130, 246, 0.40), transparent 60%),
    radial-gradient(ellipse 60% 50% at 80% 80%, rgba(96, 165, 250, 0.22), transparent 60%);
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
  background: linear-gradient(180deg, rgba(30, 40, 64, 0.55), rgba(16, 22, 36, 0.55));
  border: 1px solid rgba(255, 255, 255, 0.07);
  backdrop-filter: blur(14px);
}
.glass-hi {
  background:
    radial-gradient(ellipse 60% 100% at 0% 0%, rgba(96, 165, 250, 0.22), transparent 65%),
    linear-gradient(180deg, rgba(30, 40, 64, 0.55), rgba(20, 26, 40, 0.55));
  border: 1px solid rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(18px);
}

.grad-text {
  background: linear-gradient(180deg, #fff, #B9C0D0);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.grad-text-brand {
  background: linear-gradient(135deg, #fff, var(--brand-2) 60%, var(--brand));
  -webkit-background-clip: text; background-clip: text; color: transparent;
}

.stat-num { font-variant-numeric: tabular-nums; }

/* nav */
.ezk-onb-nav {
  position: sticky; top: 0; z-index: 30;
  background: rgba(10, 14, 28, 0.65);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.ezk-onb-nav-inner {
  max-width: 1180px; margin: 0 auto;
  padding: 14px 32px;
  display: flex; align-items: center; gap: 32px;
}
.ezk-onb-brand {
  display: inline-flex; align-items: center; gap: 10px;
  color: var(--ink);
}
.ezk-onb-brand-mark {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--brand) 0%, var(--brand-2) 100%);
  color: #fff;
  box-shadow: 0 8px 24px -8px rgba(96, 165, 250, 0.45);
}
.ezk-onb-brand-word { font-weight: 700; font-size: 16px; letter-spacing: -0.01em; }
.ezk-onb-brand-slash { color: var(--ink-3); margin: 0 1px; }
.ezk-onb-brand-suffix { color: var(--ink); }
.ezk-onb-nav-links {
  margin-left: auto;
  display: inline-flex; gap: 22px;
  font-size: 13.5px; color: var(--ink-2);
}
.ezk-onb-nav-links a:hover { color: var(--brand-2); }

/* main */
.ezk-onb-main { position: relative; z-index: 1; }

.ezk-onb-hero { padding: 56px 0 12px; }
.ezk-onb-container { max-width: 1180px; margin: 0 auto; padding: 0 32px; }
.ezk-onb-container-narrow { max-width: 920px; margin: 0 auto; padding: 0 32px; }

.ezk-onb-eyebrow-pill {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(96, 165, 250, 0.10);
  border: 1px solid rgba(96, 165, 250, 0.24);
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 11px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--brand-2); text-transform: uppercase;
}
.ezk-onb-pulse-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--brand-2);
  box-shadow: 0 0 0 0 rgba(96, 165, 250, 0.55);
  animation: ezkOnbPulse 1.6s ease-in-out infinite;
}
@keyframes ezkOnbPulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(96, 165, 250, 0.55); }
  50% { box-shadow: 0 0 0 6px rgba(96, 165, 250, 0); }
}
.ezk-onb-h1 {
  margin: 18px 0 14px;
  font-size: clamp(48px, 7vw, 96px);
  font-weight: 700; letter-spacing: -0.03em; line-height: 1.02;
}
.ezk-onb-hero-sub {
  max-width: 560px;
  font-size: 16px; line-height: 1.55;
  color: var(--ink-2);
}

/* progress */
.ezk-onb-body { padding: 12px 0 80px; }
.ezk-onb-progress {
  padding: 16px 22px;
  border-radius: 16px;
  margin-bottom: 28px;
}
.ezk-onb-progress-head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 10px;
  font-size: 13px; color: var(--ink-2);
}
.ezk-onb-progress-pct { color: var(--ink); font-weight: 600; }
.progress-track {
  height: 4px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 999px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--brand) 0%, var(--brand-2) 100%);
  box-shadow: 0 0 16px rgba(96, 165, 250, 0.55);
  transition: width .6s cubic-bezier(.2,.7,.2,1);
}

/* steps */
.ezk-onb-steps { display: flex; flex-direction: column; gap: 14px; }
.rounded-2xl { border-radius: 18px; }
.step {
  padding: 22px 22px 18px;
  transition: border-color .25s ease, box-shadow .25s ease, transform .25s ease;
}
.step.is-active {
  border-color: rgba(96, 165, 250, 0.45) !important;
  box-shadow:
    0 30px 60px -28px rgba(96, 165, 250, 0.55),
    0 0 0 1px rgba(96, 165, 250, 0.20) inset;
}
.step.is-done { opacity: 0.6; }
.ezk-onb-step-head {
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
  box-shadow: 0 0 24px rgba(96, 165, 250, 0.55);
}
.step.is-done .step-num {
  background: rgba(96, 165, 250, 0.18);
  border-color: rgba(96, 165, 250, 0.35);
  color: var(--brand-2);
}
.ezk-onb-step-head-r { min-width: 0; }
.ezk-onb-step-meta {
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
  background: rgba(96, 165, 250, 0.10);
  border: 1px solid rgba(96, 165, 250, 0.30);
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
  background: rgba(96, 165, 250, 0.10);
  border: 1px solid rgba(96, 165, 250, 0.30);
}
.ezk-onb-step-title {
  margin: 0;
  font-size: 22px; font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--ink);
}
.ezk-onb-step-body {
  margin: 6px 0 14px;
  font-size: 13.5px; line-height: 1.55;
  color: var(--ink-2);
  max-width: 620px;
}
.ezk-onb-step-items {
  list-style: none; padding: 0; margin: 0 0 16px;
  display: flex; flex-direction: column; gap: 7px;
}
.ezk-onb-step-items li {
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
.ezk-onb-step-actions {
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
    0 14px 28px -10px rgba(96, 165, 250, 0.45),
    inset 0 -2px 0 rgba(0, 0, 0, 0.08);
  transition: transform .15s ease, box-shadow .15s ease;
}
.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow:
    0 18px 36px -10px rgba(96, 165, 250, 0.6),
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
.ezk-onb-launch {
  margin-top: 28px;
  padding: 26px 28px;
  display: flex; align-items: center; justify-content: space-between;
  gap: 24px;
}
.ezk-onb-launch-tag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px; letter-spacing: 0.22em; font-weight: 700;
  color: var(--brand-2); text-transform: uppercase;
  margin-bottom: 6px;
}
.ezk-onb-launch-h {
  margin: 0 0 6px;
  font-size: 22px; font-weight: 600; letter-spacing: -0.02em;
  color: var(--ink);
}
.ezk-onb-launch-b {
  margin: 0;
  font-size: 13.5px; line-height: 1.55;
  color: var(--ink-2);
  max-width: 520px;
}
.ezk-onb-foot-note {
  margin-top: 18px;
  text-align: center;
  font-size: 12.5px; color: var(--ink-3);
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  letter-spacing: 0.02em;
}

/* footer */
.ezk-onb-footer {
  position: relative; z-index: 1;
  padding: 32px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(10, 14, 28, 0.4);
}
.ezk-onb-footer-inner {
  display: flex; align-items: center; justify-content: space-between;
  gap: 24px;
}
.ezk-onb-footer-brand {
  display: inline-flex; align-items: center; gap: 10px;
  font-size: 13.5px; color: var(--ink-2);
}
.ezk-onb-footer-links { display: inline-flex; gap: 22px; font-size: 13px; color: var(--ink-2); }
.ezk-onb-footer-links a:hover { color: var(--brand-2); }
.ezk-onb-footer-meta {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 11px; letter-spacing: 0.10em;
  color: var(--ink-3); text-transform: uppercase;
}

@media (max-width: 760px) {
  .ezk-onb-launch { flex-direction: column; align-items: flex-start; }
  .ezk-onb-footer-inner { flex-direction: column; align-items: flex-start; }
  .ezk-onb-nav-links { display: none; }
  .ezk-onb-step-head { grid-template-columns: 36px 1fr; gap: 12px; }
  .step-num { width: 36px; height: 36px; }
}
`;
