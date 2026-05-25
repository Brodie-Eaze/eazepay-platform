/**
 * /coachpay/signup — branded sign-up wizard for the CoachPay funnel.
 *
 * Visual chrome matches /coachpay/onboarding exactly:
 *   · Dark base (#0a0a14) with radial ambient CoachPay violet glow + dot grid
 *   · Sticky CoachPay header with the Coach/Pay wordmark + nav
 *   · Hero with "ACTIVATE COACHPAY" eyebrow pill + gradient "Sign up"
 *   · Glass-style form surface re-skinning the shared wizard
 */
import Link from 'next/link';
import OnboardingWizard from '../../welcome/wizard';

export const metadata = {
  title: 'CoachPay · Sign up',
  description: 'Activate your branded CoachPay partner portal.',
};

function LogoIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2.5l9 5v9l-9 5-9-5v-9l9-5z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill="rgba(255,255,255,0.08)"
      />
      <path
        d="M12 6.5v11M7 9.5l5 3 5-3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function CoachPaySignupPage(): JSX.Element {
  return (
    <div className="cp-su-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="cp-su-ambient-bg" aria-hidden>
        <div className="ambient-glow" />
        <div className="ambient-grid" />
      </div>

      <header className="cp-su-nav">
        <div className="cp-su-nav-inner">
          <Link href="/coachpay" className="cp-su-brand" aria-label="CoachPay home">
            <span className="cp-su-brand-mark">
              <LogoIcon />
            </span>
            <span className="cp-su-brand-word">
              <span className="grad-text-brand">Coach</span>
              <span className="cp-su-brand-slash">/</span>
              <span className="cp-su-brand-suffix">Pay</span>
            </span>
          </Link>
          <nav className="cp-su-nav-links">
            <Link href="/sales/coachpay">Sales deck</Link>
            <Link href="/landing/coachpay">Platform</Link>
            <Link href="/help">Support</Link>
          </nav>
        </div>
      </header>

      <main className="cp-su-main">
        <section className="cp-su-hero">
          <div className="cp-su-container">
            <div className="cp-su-eyebrow-pill">
              <span className="cp-su-pulse-dot" />
              ACTIVATE COACHPAY
            </div>
            <h1 className="cp-su-h1">
              <span className="grad-text">Sign up</span>
            </h1>
            <p className="cp-su-hero-sub">
              Tell us about your practice. Four short steps. Saves automatically. Your launch
              engineer is one Slack message away.
            </p>
          </div>
        </section>

        <section className="cp-su-body">
          <div className="cp-su-container-narrow">
            <div className="cp-su-form-surface glass">
              <OnboardingWizard brand="coachpay" hideHeader />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

const CSS = `
.cp-su-root {
  --brand: #8B5CF6;
  --brand-2: #A78BFA;
  --brand-deep: #4C1D95;
  --ink: #EEEEF2;
  --ink-2: #B9B9C7;
  --ink-3: #8A8AA0;
  --bg-deep: #0a0a14;

  position: relative; min-height: 100vh;
  background: var(--bg-deep); color: var(--ink);
  -webkit-font-smoothing: antialiased; overflow-x: hidden;
}
.cp-su-root * { box-sizing: border-box; }
.cp-su-root a { color: inherit; text-decoration: none; }

.cp-su-ambient-bg { position: fixed; inset: 0; pointer-events: none; z-index: 0; }
.ambient-glow {
  position: absolute; inset: 0;
  background:
    radial-gradient(ellipse 80% 60% at 50% 0%, rgba(139, 92, 246, 0.38), transparent 60%),
    radial-gradient(ellipse 60% 50% at 80% 80%, rgba(167, 139, 250, 0.22), transparent 60%);
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
  background: linear-gradient(180deg, rgba(40, 28, 60, 0.55), rgba(18, 14, 28, 0.55));
  border: 1px solid rgba(255, 255, 255, 0.07);
  backdrop-filter: blur(14px);
}
.grad-text {
  background: linear-gradient(180deg, #fff, #b9b9c7);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.grad-text-brand {
  background: linear-gradient(135deg, #fff, var(--brand-2) 60%, var(--brand));
  -webkit-background-clip: text; background-clip: text; color: transparent;
}

.cp-su-nav {
  position: sticky; top: 0; z-index: 30;
  background: rgba(10, 10, 20, 0.65); backdrop-filter: blur(14px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.cp-su-nav-inner {
  max-width: 1180px; margin: 0 auto; padding: 14px 32px;
  display: flex; align-items: center; gap: 32px;
}
.cp-su-brand { display: inline-flex; align-items: center; gap: 10px; color: var(--ink); }
.cp-su-brand-mark {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: 8px;
  background: linear-gradient(135deg, var(--brand) 0%, var(--brand-2) 100%);
  color: #fff; box-shadow: 0 8px 24px -8px rgba(167, 139, 250, 0.45);
}
.cp-su-brand-word { font-weight: 700; font-size: 16px; letter-spacing: -0.01em; }
.cp-su-brand-slash { color: var(--ink-3); margin: 0 1px; }
.cp-su-brand-suffix { color: var(--ink); }
.cp-su-nav-links { margin-left: auto; display: inline-flex; gap: 22px; font-size: 13.5px; color: var(--ink-2); }
.cp-su-nav-links a:hover { color: var(--brand-2); }

.cp-su-main { position: relative; z-index: 1; }
.cp-su-hero { padding: 56px 0 12px; }
.cp-su-container { max-width: 1180px; margin: 0 auto; padding: 0 32px; }
.cp-su-container-narrow { max-width: 920px; margin: 0 auto; padding: 0 32px; }

.cp-su-eyebrow-pill {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 6px 14px; border-radius: 999px;
  background: rgba(167, 139, 250, 0.10); border: 1px solid rgba(167, 139, 250, 0.22);
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 11px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--brand-2); text-transform: uppercase;
}
.cp-su-pulse-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--brand-2); box-shadow: 0 0 10px var(--brand-2);
  animation: cpSuPulse 2s ease-in-out infinite;
}
@keyframes cpSuPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
.cp-su-h1 {
  margin: 18px 0 12px;
  font-size: clamp(48px, 7vw, 72px); font-weight: 700;
  letter-spacing: -0.028em; line-height: 0.98;
}
.cp-su-hero-sub { font-size: 16px; line-height: 1.55; color: var(--ink-2); max-width: 640px; }

.cp-su-body { padding: 24px 0 80px; position: relative; z-index: 1; }
.cp-su-form-surface { margin-top: 8px; border-radius: 18px; overflow: hidden; }

/* ── Re-skin wizard ── */
.cp-su-form-surface {
  --bg:             18  22  38;
  --bg-elevated:    34  28  52;
  --bg-muted:       26  20  40;
  --bg-inverse:     238 238 242;
  --fg:             238 238 242;
  --fg-secondary:   185 185 199;
  --fg-muted:       138 148 168;
  --fg-on-accent:   255 255 255;
  --fg-inverse:     10  10  20;
  --fg-link:        167 139 250;
  --border:         50  40  70;
  --border-strong:  72  60  100;
  --border-focus:   167 139 250;
  --accent:         139 92  246;
  --accent-fg:      255 255 255;
}
.cp-su-form-surface main { background: transparent !important; }
.cp-su-form-surface input,
.cp-su-form-surface select,
.cp-su-form-surface textarea {
  background: rgba(10, 10, 20, 0.5) !important;
  border-color: rgba(50, 40, 70, 0.9) !important;
  color: #EEEEF2 !important;
}
.cp-su-form-surface input::placeholder,
.cp-su-form-surface textarea::placeholder { color: rgba(138, 148, 168, 0.7) !important; }
.cp-su-form-surface input:focus,
.cp-su-form-surface select:focus,
.cp-su-form-surface textarea:focus {
  border-color: rgba(167, 139, 250, 0.6) !important;
  box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.18) !important;
  outline: none !important;
}
.cp-su-form-surface label { color: rgb(185 185 199) !important; }
.cp-su-form-surface button[class*="bg-["],
.cp-su-form-surface a[class*="bg-["] {
  background: linear-gradient(135deg, var(--brand) 0%, var(--brand-2) 100%) !important;
  color: #fff !important; border: 0 !important;
  box-shadow: 0 12px 28px -10px rgba(167, 139, 250, 0.45);
}
.cp-su-form-surface button[class*="bg-["]:hover,
.cp-su-form-surface a[class*="bg-["]:hover { filter: brightness(1.08); }
.cp-su-form-surface ol[aria-label="Sign-up steps"] li > * { color: var(--ink-2) !important; }
.cp-su-form-surface div[class*="bg-bg-elevated"] {
  background: linear-gradient(180deg, rgba(40, 28, 60, 0.30), rgba(18, 14, 28, 0.30)) !important;
  border-color: rgba(255, 255, 255, 0.06) !important;
}
.cp-su-form-surface div[class*="bg-bg-muted"] { background: rgba(10, 10, 20, 0.30) !important; }
.cp-su-form-surface [class*="text-fg-secondary"] { color: #B9B9C7 !important; }
.cp-su-form-surface [class*="text-fg-muted"] { color: #8A8AA0 !important; }
.cp-su-form-surface .text-fg, .cp-su-form-surface [class~="text-fg"] { color: #EEEEF2 !important; }
.cp-su-form-surface [class*="border-border-strong"] { border-color: rgba(72, 60, 100, 0.9) !important; }
.cp-su-form-surface [class*="border-border"] { border-color: rgba(50, 40, 70, 0.9) !important; }
.cp-su-form-surface [role="alert"] {
  background: rgba(220, 90, 90, 0.10) !important;
  border-color: rgba(220, 90, 90, 0.35) !important;
  color: #FBB6B6 !important;
}
@media (max-width: 720px) {
  .cp-su-container, .cp-su-container-narrow { padding: 0 20px; }
}
`;
