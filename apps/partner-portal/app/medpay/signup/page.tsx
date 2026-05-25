/**
 * /medpay/signup — branded sign-up wizard for the MedPay funnel.
 *
 * Visual chrome matches /medpay/onboarding exactly:
 *   · Dark base (#0a0a14) with radial ambient teal glow + dot grid
 *   · Sticky MedPay header with Med/Pay wordmark + nav (Sales deck /
 *     Platform / Support)
 *   · Hero with eyebrow pill ("ACTIVATE MEDPAY") + gradient "Sign up"
 *     headline + sub
 *   · Glass-style form surface
 *
 * The wizard form fields themselves are still the shared
 * <OnboardingWizard brand="medpay" /> component — we wrap it in a
 * scoped CSS-variable override so its Tailwind classes (bg-bg,
 * bg-bg-elevated, text-fg, border-border, …) all re-resolve to dark /
 * teal values inside this page. No wizard code change beyond a
 * `hideHeader` prop so it doesn't double-up our chrome.
 */
import Link from 'next/link';
import OnboardingWizard from '../../welcome/wizard';

export const metadata = {
  title: 'MedPay · Sign up',
  description: 'Activate your branded MedPay partner portal.',
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

export default function MedPaySignupPage(): JSX.Element {
  return (
    <div className="mp-su-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="mp-su-ambient-bg" aria-hidden>
        <div className="ambient-glow" />
        <div className="ambient-grid" />
      </div>

      <header className="mp-su-nav">
        <div className="mp-su-nav-inner">
          <Link href="/medpay/start" className="mp-su-brand" aria-label="MedPay home">
            <span className="mp-su-brand-mark">
              <LogoIcon />
            </span>
            <span className="mp-su-brand-word">
              <span className="grad-text-brand">Med</span>
              <span className="mp-su-brand-slash">/</span>
              <span className="mp-su-brand-suffix">Pay</span>
            </span>
          </Link>
          <nav className="mp-su-nav-links">
            <Link href="/sales/medpay">Sales deck</Link>
            <Link href="/landing/medpay">Platform</Link>
            <Link href="/help">Support</Link>
          </nav>
        </div>
      </header>

      <main className="mp-su-main">
        <section className="mp-su-hero">
          <div className="mp-su-container">
            <div className="mp-su-eyebrow-pill">
              <span className="mp-su-pulse-dot" />
              ACTIVATE MEDPAY
            </div>
            <h1 className="mp-su-h1">
              <span className="grad-text">Sign up</span>
            </h1>
            <p className="mp-su-hero-sub">
              Tell us about your practice. Four short steps. Saves automatically. Your launch
              engineer is one Slack message away.
            </p>
          </div>
        </section>

        <section className="mp-su-body">
          <div className="mp-su-container-narrow">
            <div className="mp-su-form-surface glass">
              <OnboardingWizard brand="medpay" hideHeader />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

const CSS = `
.mp-su-root {
  --brand: #0E7C66;
  --brand-2: #22B8A0;
  --brand-deep: #062C29;
  --ink: #EEEEF2;
  --ink-2: #B9B9C7;
  --ink-3: #8A8AA0;
  --bg-deep: #0a0a14;
  --bg-2: #101023;
  --bg-3: #16162a;

  position: relative;
  min-height: 100vh;
  background: var(--bg-deep);
  color: var(--ink);
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}
.mp-su-root * { box-sizing: border-box; }
.mp-su-root a { color: inherit; text-decoration: none; }

.mp-su-ambient-bg {
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
.grad-text {
  background: linear-gradient(180deg, #fff, #b9b9c7);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.grad-text-brand {
  background: linear-gradient(135deg, #fff, var(--brand-2) 60%, var(--brand));
  -webkit-background-clip: text; background-clip: text; color: transparent;
}

.mp-su-nav {
  position: sticky; top: 0; z-index: 30;
  background: rgba(10, 10, 20, 0.65);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.mp-su-nav-inner {
  max-width: 1180px; margin: 0 auto;
  padding: 14px 32px;
  display: flex; align-items: center; gap: 32px;
}
.mp-su-brand {
  display: inline-flex; align-items: center; gap: 10px;
  color: var(--ink);
}
.mp-su-brand-mark {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--brand) 0%, var(--brand-2) 100%);
  color: #fff;
  box-shadow: 0 8px 24px -8px rgba(34, 184, 160, 0.45);
}
.mp-su-brand-word { font-weight: 700; font-size: 16px; letter-spacing: -0.01em; }
.mp-su-brand-slash { color: var(--ink-3); margin: 0 1px; }
.mp-su-brand-suffix { color: var(--ink); }
.mp-su-nav-links {
  margin-left: auto;
  display: inline-flex; gap: 22px;
  font-size: 13.5px; color: var(--ink-2);
}
.mp-su-nav-links a:hover { color: var(--brand-2); }

.mp-su-main { position: relative; z-index: 1; }

.mp-su-hero { padding: 56px 0 12px; }
.mp-su-container { max-width: 1180px; margin: 0 auto; padding: 0 32px; }
.mp-su-container-narrow { max-width: 920px; margin: 0 auto; padding: 0 32px; }

.mp-su-eyebrow-pill {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(34, 184, 160, 0.10);
  border: 1px solid rgba(34, 184, 160, 0.22);
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 11px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--brand-2); text-transform: uppercase;
}
.mp-su-pulse-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--brand-2);
  box-shadow: 0 0 10px var(--brand-2);
  animation: mpSuPulse 2s ease-in-out infinite;
}
@keyframes mpSuPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.mp-su-h1 {
  margin: 18px 0 12px;
  font-size: clamp(48px, 7vw, 72px);
  font-weight: 700;
  letter-spacing: -0.028em;
  line-height: 0.98;
}
.mp-su-hero-sub {
  font-size: 16px;
  line-height: 1.55;
  color: var(--ink-2);
  max-width: 640px;
}

.mp-su-body { padding: 24px 0 80px; position: relative; z-index: 1; }
.mp-su-form-surface {
  margin-top: 8px;
  border-radius: 18px;
  overflow: hidden;
}

/* ════════════════════════════════════════════════════════════
   RE-SKIN THE WIZARD
   The wizard uses the Tailwind preset's CSS variables (--bg,
   --fg, --border etc. as space-separated RGB triplets). Scoping
   the overrides to .mp-su-form-surface flips the wizard's entire
   palette to dark + MedPay teal without touching its code.
   ════════════════════════════════════════════════════════════ */
.mp-su-form-surface {
  --bg:             18  22  38;
  --bg-elevated:    26  34  54;
  --bg-muted:       18  28  40;
  --bg-inverse:     238 238 242;
  --fg:             238 238 242;
  --fg-secondary:   185 185 199;
  --fg-muted:       138 148 168;
  --fg-on-accent:   255 255 255;
  --fg-inverse:     10  10  20;
  --fg-link:        34  184 160;
  --border:         34  46  68;
  --border-strong:  46  66  98;
  --border-focus:   34  184 160;
  --accent:         14  124 102;
  --accent-fg:      255 255 255;
}
/* Wizard main bg is provided by glass already — drop the inner bg */
.mp-su-form-surface main { background: transparent !important; }

/* Inputs / selects / textareas — dark glass look */
.mp-su-form-surface input,
.mp-su-form-surface select,
.mp-su-form-surface textarea {
  background: rgba(10, 10, 20, 0.5) !important;
  border-color: rgba(34, 46, 68, 0.9) !important;
  color: #EEEEF2 !important;
}
.mp-su-form-surface input::placeholder,
.mp-su-form-surface textarea::placeholder {
  color: rgba(138, 148, 168, 0.7) !important;
}
.mp-su-form-surface input:focus,
.mp-su-form-surface select:focus,
.mp-su-form-surface textarea:focus {
  border-color: rgba(34, 184, 160, 0.6) !important;
  box-shadow: 0 0 0 3px rgba(34, 184, 160, 0.18) !important;
  outline: none !important;
}
.mp-su-form-surface label { color: rgb(185 185 199) !important; }

/* Primary CTA → MedPay teal gradient */
.mp-su-form-surface button[class*="bg-["],
.mp-su-form-surface a[class*="bg-["] {
  background: linear-gradient(135deg, var(--brand) 0%, var(--brand-2) 100%) !important;
  color: #fff !important;
  border: 0 !important;
  box-shadow: 0 12px 28px -10px rgba(34, 184, 160, 0.45);
}
.mp-su-form-surface button[class*="bg-["]:hover,
.mp-su-form-surface a[class*="bg-["]:hover { filter: brightness(1.08); }

/* Breadcrumb pills */
.mp-su-form-surface ol[aria-label="Sign-up steps"] li > * { color: var(--ink-2) !important; }

/* Cards / nested blocks in the form steps */
.mp-su-form-surface div[class*="bg-bg-elevated"] {
  background: linear-gradient(180deg, rgba(35, 47, 45, 0.30), rgba(16, 22, 21, 0.30)) !important;
  border-color: rgba(255, 255, 255, 0.06) !important;
}
.mp-su-form-surface div[class*="bg-bg-muted"] { background: rgba(10, 10, 20, 0.30) !important; }

/* Inline text colours */
.mp-su-form-surface [class*="text-fg-secondary"] { color: #B9B9C7 !important; }
.mp-su-form-surface [class*="text-fg-muted"] { color: #8A8AA0 !important; }
.mp-su-form-surface .text-fg, .mp-su-form-surface [class~="text-fg"] { color: #EEEEF2 !important; }

/* Borders */
.mp-su-form-surface [class*="border-border-strong"] { border-color: rgba(46, 66, 98, 0.9) !important; }
.mp-su-form-surface [class*="border-border"] { border-color: rgba(34, 46, 68, 0.9) !important; }

/* Error alert */
.mp-su-form-surface [role="alert"] {
  background: rgba(220, 90, 90, 0.10) !important;
  border-color: rgba(220, 90, 90, 0.35) !important;
  color: #FBB6B6 !important;
}

@media (max-width: 720px) {
  .mp-su-container, .mp-su-container-narrow { padding: 0 20px; }
}
`;
