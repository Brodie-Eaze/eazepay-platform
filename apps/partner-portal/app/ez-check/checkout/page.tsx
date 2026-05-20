/**
 * EZ Check · Checkout (/ez-check/checkout)
 *
 * Same checkout pattern as /<brand>/checkout (MedPay/TradePay/CoachPay)
 * but for the EZ Check pre-qualification product:
 *
 *   • $5,000 one-time setup fee.
 *   • $3 per data pull (metered, billed monthly in arrears).
 *   • No monthly platform fee. No origination percentage.
 *
 * The "What activates today" grid shows the three onboarding modules
 * (CORE / HELIX / ORACLE) — same record consumed by the onboarding
 * dark module page so labels stay aligned.
 *
 * Palette: EZ Check sky-blue / slate (light theme). Inline `.ezk-*`
 * namespace to keep the surface self-contained.
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EZ_CHECK_MODULES } from '../../../lib/ez-check-theme';

export default function EzCheckCheckout(): JSX.Element {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [billingEmail, setBillingEmail] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [paying, setPaying] = useState(false);
  const [stripeNote, setStripeNote] = useState<string | null>(null);

  const canProceed = agreed && billingEmail.length > 3 && businessName.length > 1;

  async function payWithStripe() {
    if (!canProceed || paying) return;
    setPaying(true);
    setStripeNote(null);
    try {
      const res = await fetch('/api/billing/stripe/create-setup-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: 'ez-check', businessName, billingEmail }),
      });
      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url as string;
        return;
      }
      if (data?.stub && data?.redirect) {
        setStripeNote(
          'Stripe checkout placeholder — proceeding to onboarding. Setup fee will be invoiced once Stripe is wired up.',
        );
        router.push(data.redirect as string);
        return;
      }
      // Fallback: send the operator to onboarding so they can complete the
      // funnel even if the Stripe session route isn't wired for ez-check yet.
      router.push('/ez-check/onboarding');
    } catch {
      setStripeNote('Network error. Please try again.');
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="ezk-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* NAV */}
      <header className="ezk-nav">
        <div className="ezk-container ezk-nav-inner">
          <Link href="/landing/ez-check" className="ezk-brand" aria-label="EZ Check home">
            <span className="ezk-brand-mark">
              <LogoIcon />
            </span>
            <span className="ezk-brand-word">
              <span className="ezk-brand-word-l">EZ</span>
              <span className="ezk-brand-slash">/</span>
              <span className="ezk-brand-word-r">Check</span>
            </span>
          </Link>
          <nav className="ezk-nav-links" aria-label="Primary">
            <Link href="/sales/ez-check">Sales deck</Link>
            <Link href="/landing/ez-check">Platform</Link>
          </nav>
          <div className="ezk-nav-cta-group">
            <Link href="/sign-in" className="ezk-nav-link">
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="ezk-main">
        {/* HERO */}
        <section className="ezk-hero">
          <div className="ezk-container">
            <div className="ezk-eyebrow-pill">
              <span className="ezk-pulse-dot" />
              Activate EZ Check · Step 1 of 2
            </div>
            <h1 className="ezk-h1">
              <span className="ezk-grad-blue">Activate EZ Check</span>
              <br />
              <span className="ezk-grad-blue-deep">for your funnel.</span>
            </h1>
            <p className="ezk-hero-sub">
              One-time setup. Pay-as-you-pull. No monthly platform fee, no per-lead minimums, no
              contract. Drop the widget into your funnel and start shipping qualified buyers to your
              calendar this week.
            </p>
          </div>
        </section>

        {/* PRICING */}
        <section className="ezk-pricing">
          <div className="ezk-container">
            <div className="ezk-pricing-grid">
              <PricingTier
                tag="01 · SETUP"
                head="One-time setup fee"
                body="Workspace provisioning, agent stack activation, smart-form configuration, smart-routing rules, embed snippet, sales-team training. Paid once on signing."
                v="$5,000"
                when="USD · charged on signing"
                hero
              />
              <PricingTier
                tag="02 · USAGE"
                head="Per data pull"
                body="Every form submission that triggers a qualification data pull is billed flat. Form submissions that bounce before the pull are free. Volume tiers available above 5,000/mo."
                v="$3"
                when="per data pull · billed monthly"
              />
              <PricingTier
                tag="03 · CALENDAR"
                head="Qualified buyers on your calendar"
                body="Smart routing drops each qualified buyer onto your sales calendar (or your closers' calendars) the same minute they cross the qualification threshold."
                v="$0"
                when="no per-booking fee · ever"
              />
            </div>

            <div className="ezk-pricing-foot">
              <FootStat k="Monthly platform fee" v="$0" />
              <FootStat k="Contract term" v="No lock-in" />
              <FootStat k="Time to live" v="Up to 5 business days" />
              <FootStat k="Vertical" v="Any online business" />
            </div>
          </div>
        </section>

        {/* WHAT ACTIVATES TODAY — the three onboarding modules */}
        <section className="ezk-section">
          <div className="ezk-container">
            <h2 className="ezk-h2">What activates today</h2>
            <p className="ezk-section-sub">
              Three cards, one per onboarding module — the full EZ Check stack lights up on signing.
              No phased rollout, no premium-tier gating.
            </p>
            <div className="ezk-includes-grid">
              {EZ_CHECK_MODULES.map((m) => (
                <Include key={m.id} tag={`${m.n} · ${m.agent}`} head={m.title} body={m.body} />
              ))}
            </div>
          </div>
        </section>

        {/* AGREEMENT + CHECKOUT FORM */}
        <section className="ezk-section ezk-section-bordered">
          <div className="ezk-container">
            <div className="ezk-co-wrap">
              <div className="ezk-co-l">
                <h2 className="ezk-h2">Agreement snapshot</h2>
                <ul className="ezk-co-points">
                  <li>
                    <span className="ezk-co-check" aria-hidden>
                      ✓
                    </span>
                    EZ Check is a pre-qualification engine. It does not originate loans, hold funds,
                    or extend credit. The buyer&apos;s underwriting outcome stays with your business
                    and its partners.
                  </li>
                  <li>
                    <span className="ezk-co-check" aria-hidden>
                      ✓
                    </span>
                    Soft-pull data sources are used in compliance with FCRA, ECOA / Reg B, and GLBA.
                    Pulls require the buyer&apos;s consent at form submit.
                  </li>
                  <li>
                    <span className="ezk-co-check" aria-hidden>
                      ✓
                    </span>
                    Buy-once, run-forever. No fixed contract term. You can stop the metered billing
                    any time by disabling the widget — existing pulls still bill that month.
                  </li>
                  <li>
                    <span className="ezk-co-check" aria-hidden>
                      ✓
                    </span>
                    Audit log retained for 7 years. Every data pull is hashed, signed, and
                    timestamped — exportable from your admin console at any time.
                  </li>
                </ul>

                <Link href="/help" className="ezk-co-fine">
                  Full master service agreement →
                </Link>
              </div>

              <form className="ezk-co-form" onSubmit={(e) => e.preventDefault()}>
                <div className="ezk-co-form-head">
                  <span className="ezk-co-form-tag">CHECKOUT</span>
                  <span className="ezk-co-form-h">Start onboarding</span>
                </div>
                <label className="ezk-co-field">
                  <span className="ezk-co-label">Business legal name</span>
                  <input
                    type="text"
                    placeholder="Acme Funnels, LLC"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    autoComplete="organization"
                  />
                </label>
                <label className="ezk-co-field">
                  <span className="ezk-co-label">Billing email</span>
                  <input
                    type="email"
                    placeholder="billing@acmefunnels.com"
                    value={billingEmail}
                    onChange={(e) => setBillingEmail(e.target.value)}
                    autoComplete="email"
                  />
                </label>
                <label className="ezk-co-checkbox">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                  />
                  <span>
                    I agree to the $5,000 one-time setup fee and $3 per data pull billed monthly in
                    arrears. I have authority to bind the named business.
                  </span>
                </label>
                <div className="ezk-stripe-block">
                  <div className="ezk-stripe-head">
                    <div className="ezk-stripe-head-l">
                      <span className="ezk-stripe-tag">PAY SETUP FEE</span>
                      <span className="ezk-stripe-amt">$5,000.00</span>
                    </div>
                    <div className="ezk-stripe-cards" aria-hidden>
                      <span className="ezk-stripe-card-pill">VISA</span>
                      <span className="ezk-stripe-card-pill">MC</span>
                      <span className="ezk-stripe-card-pill">AMEX</span>
                      <span className="ezk-stripe-card-pill">ACH</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={payWithStripe}
                    className={`ezk-btn-primary ezk-btn-lg ezk-co-cta ezk-stripe-btn ${
                      canProceed && !paying ? '' : 'is-disabled'
                    }`}
                    aria-disabled={!canProceed || paying}
                    disabled={!canProceed || paying}
                  >
                    {paying ? 'Opening Stripe…' : 'Pay $5,000 with Stripe'}
                    <ArrowIcon />
                  </button>
                  {stripeNote ? <div className="ezk-stripe-note">{stripeNote}</div> : null}
                </div>
                <div className="ezk-co-foot">
                  Stripe Checkout · 256-bit TLS · Live in up to 5 business days
                </div>
              </form>
            </div>
          </div>
        </section>
      </main>

      <footer className="ezk-footer">
        <div className="ezk-container ezk-footer-inner">
          <div className="ezk-footer-brand">
            <LogoIcon />
            <span>EZ Check · A product of EazePay</span>
          </div>
          <div className="ezk-footer-meta">
            FCRA · ECOA · GLBA · Audit log retained 7 yrs · Buyer consent required on every pull
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ----------------------------- helpers ---------------------------------- */

function PricingTier({
  tag,
  head,
  body,
  v,
  when,
  hero,
}: {
  tag: string;
  head: string;
  body: string;
  v: string;
  when: string;
  hero?: boolean;
}) {
  return (
    <article className={`ezk-tier ${hero ? 'is-hero' : ''}`}>
      <div className="ezk-tier-tag">{tag}</div>
      <h3 className="ezk-tier-head">{head}</h3>
      <p className="ezk-tier-body">{body}</p>
      <div className="ezk-tier-foot">
        <div className="ezk-tier-v">{v}</div>
        <div className="ezk-tier-when">{when}</div>
      </div>
    </article>
  );
}

function Include({ tag, head, body }: { tag: string; head: string; body: string }) {
  return (
    <div className="ezk-include">
      <div className="ezk-include-mark" aria-hidden>
        ✓
      </div>
      <div>
        <div className="ezk-include-tag">{tag}</div>
        <div className="ezk-include-h">{head}</div>
        <div className="ezk-include-b">{body}</div>
      </div>
    </div>
  );
}

function FootStat({ k, v }: { k: string; v: string }) {
  return (
    <div className="ezk-foot-stat">
      <div className="ezk-foot-stat-k">{k}</div>
      <div className="ezk-foot-stat-v">{v}</div>
    </div>
  );
}

function LogoIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
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

/* ============================== CSS ==================================== */

const CSS = `
.ezk-root {
  --ezk-blue: #3B82F6;
  --ezk-blue-2: #60A5FA;
  --ezk-blue-deep: #1E3A8A;
  --ezk-blue-light: #F0F9FF;
  --ezk-ink: #0F172A;
  --ezk-ink-2: #1E293B;
  --ezk-mute: #64748B;
  --ezk-line: rgba(59, 130, 246, 0.12);
  --ezk-line-strong: rgba(59, 130, 246, 0.22);

  background: linear-gradient(180deg, #F0F9FF 0%, #FFFFFF 30%, #F8FAFC 65%, #FFFFFF 100%);
  color: var(--ezk-ink);
  font-family: inherit;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
  min-height: 100vh;
}
.ezk-root * { box-sizing: border-box; }
.ezk-root a { color: inherit; text-decoration: none; }
.ezk-container { max-width: 1180px; margin: 0 auto; padding: 0 32px; }

/* NAV */
.ezk-nav {
  position: sticky; top: 0; z-index: 30;
  background: rgba(255, 255, 255, 0.85);
  border-bottom: 1px solid var(--ezk-line);
  backdrop-filter: blur(10px);
}
.ezk-nav-inner {
  max-width: 1180px; margin: 0 auto;
  padding: 14px 32px;
  display: flex; align-items: center; gap: 32px;
}
.ezk-brand {
  display: inline-flex; align-items: center; gap: 10px;
  color: var(--ezk-blue);
}
.ezk-brand-mark {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--ezk-blue) 0%, var(--ezk-blue-2) 100%);
  color: #fff;
  box-shadow: 0 8px 24px -8px rgba(59, 130, 246, 0.45);
}
.ezk-brand-word { font-weight: 700; font-size: 16px; letter-spacing: -0.01em; color: var(--ezk-ink); }
.ezk-brand-word-l { color: var(--ezk-blue); }
.ezk-brand-slash { color: var(--ezk-mute); margin: 0 1px; font-weight: 400; }
.ezk-brand-word-r { color: var(--ezk-ink); }
.ezk-nav-links {
  display: inline-flex; gap: 22px;
  margin-left: 16px;
  font-size: 13.5px; color: var(--ezk-ink-2);
}
.ezk-nav-links a:hover { color: var(--ezk-blue); }
.ezk-nav-cta-group { margin-left: auto; display: inline-flex; align-items: center; gap: 14px; }
.ezk-nav-link { font-size: 13.5px; color: var(--ezk-ink-2); }
.ezk-nav-link:hover { color: var(--ezk-blue); }

/* HERO */
.ezk-main { position: relative; }
.ezk-hero { padding: 64px 0 32px; }
.ezk-eyebrow-pill {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.10);
  border: 1px solid var(--ezk-line-strong);
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 11px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--ezk-blue); text-transform: uppercase;
}
.ezk-pulse-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--ezk-blue-2);
  box-shadow: 0 0 0 0 rgba(96, 165, 250, 0.55);
  animation: ezkPulse 1.6s ease-in-out infinite;
}
@keyframes ezkPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(96, 165, 250, 0.55); } 50% { box-shadow: 0 0 0 6px rgba(96, 165, 250, 0); } }
.ezk-h1 {
  margin: 18px 0 14px;
  font-size: clamp(40px, 5vw, 64px); font-weight: 700;
  letter-spacing: -0.028em; line-height: 1.04;
  color: var(--ezk-ink);
}
.ezk-grad-blue { background: linear-gradient(120deg, var(--ezk-blue) 0%, var(--ezk-blue-2) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent; }
.ezk-grad-blue-deep { background: linear-gradient(120deg, var(--ezk-blue-deep) 0%, var(--ezk-blue) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent; }
.ezk-hero-sub {
  margin: 0; max-width: 720px;
  font-size: 17px; line-height: 1.55;
  color: var(--ezk-ink-2);
}

/* PRICING */
.ezk-pricing { padding: 28px 0; }
.ezk-pricing-grid {
  display: grid; grid-template-columns: 1fr 1fr 1fr;
  gap: 16px;
}
.ezk-tier {
  position: relative;
  padding: 24px 24px 22px;
  background: #fff;
  border: 1px solid var(--ezk-line);
  border-radius: 18px;
  display: flex; flex-direction: column; gap: 10px;
  box-shadow: 0 18px 50px -28px rgba(59, 130, 246, 0.22);
}
.ezk-tier.is-hero {
  background:
    radial-gradient(ellipse 70% 100% at 0% 0%, rgba(96, 165, 250, 0.20), transparent 65%),
    linear-gradient(135deg, var(--ezk-blue-deep) 0%, #1E40AF 100%);
  color: #fff;
  border-color: rgba(96, 165, 250, 0.34);
  box-shadow:
    0 28px 60px -28px rgba(59, 130, 246, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.10);
}
.ezk-tier-tag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px; letter-spacing: 0.22em; font-weight: 700;
  color: var(--ezk-blue); text-transform: uppercase;
}
.ezk-tier.is-hero .ezk-tier-tag { color: var(--ezk-blue-2); }
.ezk-tier-head { margin: 4px 0 6px; font-size: 18px; font-weight: 600; letter-spacing: -0.018em; color: var(--ezk-ink); }
.ezk-tier.is-hero .ezk-tier-head { color: #fff; }
.ezk-tier-body { margin: 0; font-size: 13.5px; line-height: 1.5; color: var(--ezk-ink-2); }
.ezk-tier.is-hero .ezk-tier-body { color: rgba(255, 255, 255, 0.72); }
.ezk-tier-foot {
  margin-top: auto; padding-top: 14px;
  display: flex; flex-direction: column; gap: 4px;
}
.ezk-tier-v {
  font-size: 38px; font-weight: 700;
  letter-spacing: -0.035em; line-height: 1;
  background: linear-gradient(135deg, var(--ezk-blue-deep) 0%, var(--ezk-blue) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  font-variant-numeric: tabular-nums;
}
.ezk-tier.is-hero .ezk-tier-v {
  background: linear-gradient(135deg, #fff 0%, var(--ezk-blue-2) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.ezk-tier-when {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px; color: var(--ezk-mute); letter-spacing: 0.04em;
}
.ezk-tier.is-hero .ezk-tier-when { color: rgba(255, 255, 255, 0.60); }
.ezk-pricing-foot {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 8px; margin-top: 16px;
}
.ezk-foot-stat {
  padding: 14px 16px;
  background: #fff;
  border: 1px solid var(--ezk-line);
  border-radius: 12px;
  display: flex; flex-direction: column; gap: 4px;
}
.ezk-foot-stat-k {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px; letter-spacing: 0.12em; font-weight: 700;
  color: var(--ezk-mute); text-transform: uppercase;
}
.ezk-foot-stat-v {
  font-size: 16px; font-weight: 600; letter-spacing: -0.012em;
  color: var(--ezk-ink);
}

/* SECTIONS */
.ezk-section { padding: 56px 0 24px; }
.ezk-section-bordered {
  padding: 56px 0;
  border-top: 1px solid var(--ezk-line);
  margin-top: 32px;
}
.ezk-h2 {
  margin: 0 0 8px;
  font-size: 30px; font-weight: 600; letter-spacing: -0.022em;
  color: var(--ezk-ink);
}
.ezk-section-sub {
  margin: 0 0 24px;
  font-size: 15px; line-height: 1.55; color: var(--ezk-mute);
  max-width: 640px;
}

/* what activates today */
.ezk-includes-grid {
  display: grid; grid-template-columns: 1fr 1fr 1fr;
  gap: 14px;
}
.ezk-include {
  display: grid; grid-template-columns: 28px 1fr;
  gap: 14px; align-items: start;
  padding: 18px 20px;
  background: #fff;
  border: 1px solid var(--ezk-line);
  border-radius: 14px;
  transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease;
}
.ezk-include:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 36px -16px rgba(59, 130, 246, 0.22);
  border-color: var(--ezk-line-strong);
}
.ezk-include-mark {
  display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px;
  border-radius: 999px;
  background: rgba(96, 165, 250, 0.18);
  color: var(--ezk-blue);
  font-size: 13px; font-weight: 700;
}
.ezk-include-tag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10px; letter-spacing: 0.20em; font-weight: 700;
  color: var(--ezk-blue); text-transform: uppercase;
  margin-bottom: 4px;
}
.ezk-include-h { font-size: 15px; font-weight: 600; letter-spacing: -0.012em; color: var(--ezk-ink); margin-bottom: 6px; }
.ezk-include-b { font-size: 12.5px; line-height: 1.5; color: var(--ezk-ink-2); }

/* CHECKOUT */
.ezk-co-wrap {
  display: grid; grid-template-columns: 1.1fr 0.9fr;
  gap: 36px; align-items: start;
}
.ezk-co-points {
  list-style: none; padding: 0; margin: 16px 0 24px;
  display: flex; flex-direction: column; gap: 12px;
}
.ezk-co-points li {
  display: grid; grid-template-columns: 22px 1fr;
  gap: 12px; align-items: start;
  font-size: 13.5px; line-height: 1.55;
  color: var(--ezk-ink-2);
}
.ezk-co-check {
  display: inline-flex; align-items: center; justify-content: center;
  width: 18px; height: 18px;
  border-radius: 999px;
  background: rgba(96, 165, 250, 0.22);
  color: var(--ezk-blue);
  font-size: 11px; font-weight: 700;
  margin-top: 2px;
}
.ezk-co-fine {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 13px; color: var(--ezk-blue);
  font-weight: 600;
}
.ezk-co-fine:hover { text-decoration: underline; }
.ezk-co-form {
  padding: 24px;
  background:
    radial-gradient(ellipse 80% 100% at 100% 0%, rgba(96, 165, 250, 0.14), transparent 70%),
    rgba(255, 255, 255, 0.98);
  border: 1px solid var(--ezk-line-strong);
  border-radius: 18px;
  display: flex; flex-direction: column; gap: 14px;
  box-shadow: 0 28px 60px -28px rgba(59, 130, 246, 0.32);
}
.ezk-co-form-head { display: flex; flex-direction: column; gap: 4px; margin-bottom: 6px; }
.ezk-co-form-tag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px; letter-spacing: 0.22em; font-weight: 700;
  color: var(--ezk-blue); text-transform: uppercase;
}
.ezk-co-form-h { font-size: 22px; font-weight: 600; letter-spacing: -0.02em; color: var(--ezk-ink); }
.ezk-co-field { display: flex; flex-direction: column; gap: 6px; }
.ezk-co-label {
  font-size: 12.5px; font-weight: 600;
  color: var(--ezk-ink-2);
  letter-spacing: 0.02em;
}
.ezk-co-field input {
  padding: 11px 14px;
  font-size: 14px; color: var(--ezk-ink);
  background: #fff;
  border: 1px solid var(--ezk-line-strong);
  border-radius: 10px;
  outline: none;
  transition: border-color .15s ease, box-shadow .15s ease;
}
.ezk-co-field input:focus {
  border-color: var(--ezk-blue);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.18);
}
.ezk-co-checkbox {
  display: grid; grid-template-columns: 22px 1fr;
  gap: 10px; align-items: start;
  font-size: 13px; line-height: 1.5;
  color: var(--ezk-ink-2);
  cursor: pointer;
}
.ezk-co-checkbox input[type="checkbox"] {
  appearance: none; -webkit-appearance: none;
  width: 18px; height: 18px;
  border: 1.5px solid var(--ezk-line-strong);
  border-radius: 5px;
  background: #fff;
  cursor: pointer;
  position: relative;
  margin-top: 2px;
}
.ezk-co-checkbox input[type="checkbox"]:checked {
  background: var(--ezk-blue);
  border-color: var(--ezk-blue);
}
.ezk-co-checkbox input[type="checkbox"]:checked::after {
  content: '';
  position: absolute;
  left: 5px; top: 1px;
  width: 5px; height: 10px;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}
.ezk-co-cta {
  margin-top: 4px;
  width: 100%;
  display: inline-flex; align-items: center; justify-content: center; gap: 10px;
}
.ezk-co-cta.is-disabled {
  opacity: 0.45;
  cursor: not-allowed;
  pointer-events: none;
}
.ezk-co-foot {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px; letter-spacing: 0.06em;
  color: var(--ezk-mute);
  text-align: center;
  margin-top: 4px;
}

/* STRIPE */
.ezk-stripe-block {
  margin-top: 8px;
  padding: 14px;
  background:
    radial-gradient(ellipse 100% 100% at 0% 0%, rgba(59, 130, 246, 0.10), transparent 70%),
    rgba(255, 255, 255, 0.7);
  border: 1px solid var(--ezk-line-strong);
  border-radius: 14px;
}
.ezk-stripe-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.ezk-stripe-head-l { display: flex; flex-direction: column; gap: 2px; }
.ezk-stripe-tag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10px; letter-spacing: 0.22em; font-weight: 700;
  color: var(--ezk-blue); text-transform: uppercase;
}
.ezk-stripe-amt {
  font-size: 22px; font-weight: 700;
  letter-spacing: -0.022em;
  color: var(--ezk-ink);
  font-variant-numeric: tabular-nums;
}
.ezk-stripe-cards { display: inline-flex; gap: 4px; flex-wrap: wrap; }
.ezk-stripe-card-pill {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 9.5px; font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--ezk-mute);
  padding: 3px 7px;
  background: rgba(59, 130, 246, 0.06);
  border: 1px solid var(--ezk-line);
  border-radius: 6px;
}
.ezk-stripe-btn { width: 100%; justify-content: center; }
.ezk-stripe-note {
  margin-top: 10px;
  padding: 10px 12px;
  font-size: 12px; line-height: 1.45;
  color: var(--ezk-ink-2);
  background: rgba(59, 130, 246, 0.06);
  border: 1px dashed var(--ezk-line-strong);
  border-radius: 8px;
}

/* BUTTONS */
.ezk-btn-primary {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 12px 22px;
  background: linear-gradient(135deg, var(--ezk-blue) 0%, var(--ezk-blue-2) 100%);
  color: #fff;
  font-size: 14px; font-weight: 600;
  border-radius: 999px;
  border: 0; cursor: pointer;
  box-shadow: 0 12px 24px -8px rgba(59, 130, 246, 0.45);
  transition: transform .15s ease, box-shadow .15s ease;
}
.ezk-btn-primary:hover:not(.is-disabled):not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 16px 32px -8px rgba(59, 130, 246, 0.55);
}
.ezk-btn-lg { padding: 14px 28px; font-size: 15px; }

/* FOOTER */
.ezk-footer {
  margin-top: 64px;
  padding: 32px 0;
  border-top: 1px solid var(--ezk-line);
  background: rgba(255, 255, 255, 0.6);
}
.ezk-footer-inner {
  display: flex; align-items: center; justify-content: space-between;
  gap: 24px;
}
.ezk-footer-brand {
  display: inline-flex; align-items: center; gap: 10px;
  font-size: 13.5px; color: var(--ezk-ink-2); font-weight: 500;
}
.ezk-footer-meta { font-size: 12px; color: var(--ezk-mute); text-align: right; }

/* RESPONSIVE */
@media (max-width: 980px) {
  .ezk-pricing-grid { grid-template-columns: 1fr; }
  .ezk-pricing-foot { grid-template-columns: 1fr 1fr; }
  .ezk-includes-grid { grid-template-columns: 1fr; }
  .ezk-co-wrap { grid-template-columns: 1fr; }
  .ezk-footer-inner { flex-direction: column; align-items: flex-start; gap: 12px; text-align: left; }
  .ezk-footer-meta { text-align: left; }
  .ezk-nav-links { display: none; }
}
`;
