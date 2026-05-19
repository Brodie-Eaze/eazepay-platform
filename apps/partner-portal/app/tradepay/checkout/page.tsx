/**
 * TradePay · Checkout (/tradepay/checkout)
 *
 * Aurean-style conversion page. The prospect lands here from
 * /tradepay/start, the sales deck final CTA, or the /landing/tradepay
 * page. They see the full pricing ($10k setup + $3/lead +
 * 4% origination), what's included, an agreement snapshot, and a
 * single primary CTA to start onboarding.
 *
 * Palette: TradePay teal (matches /landing/tradepay + /tradepay/start).
 *
 * The CSS is intentionally inline (`.mpf-*` namespace) to keep the
 * surface self-contained and prevent cascade collisions with the
 * partner-portal Tailwind. Same pattern as /tradepay/start.
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function TradePayCheckout(): JSX.Element {
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
        body: JSON.stringify({ brand: 'tradepay', businessName, billingEmail }),
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
      setStripeNote('Could not start Stripe checkout. Please try again or email ops@eazepay.com.');
    } catch {
      setStripeNote('Network error. Please try again.');
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="mpf-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* ============================== NAV ============================== */}
      <header className="mpf-nav">
        <div className="mpf-container mpf-nav-inner">
          <Link href="/tradepay/start" className="mpf-brand" aria-label="TradePay home">
            <span className="mpf-brand-mark">
              <LogoIcon />
            </span>
            <span className="mpf-brand-word">
              TradePay<span className="mpf-brand-sub">/Homeowner Financing</span>
            </span>
          </Link>
          <nav className="mpf-nav-links" aria-label="Primary">
            <Link href="/sales/tradepay">Sales deck</Link>
            <Link href="/landing/tradepay">Long story</Link>
          </nav>
          <div className="mpf-nav-cta-group">
            <Link href="/sign-in" className="mpf-nav-link">
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="mpf-main">
        {/* HERO */}
        <section className="mpf-hero">
          <div className="mpf-container">
            <div className="mpf-eyebrow-pill">
              <span className="mpf-pulse-dot" />
              Activate TradePay · Step 1 of 2
            </div>
            <h1 className="mpf-h1">
              <span className="mpf-grad-teal">Activate TradePay</span>
              <br />
              <span className="mpf-grad-teal-deep">at the doorstep.</span>
            </h1>
            <p className="mpf-hero-sub">
              One platform fee, one per-lead charge, and a clean origination percentage on funded
              loans. Nothing else. No monthly bill, no per-application charge, no clawbacks on
              routine defaults — the lender carries the credit risk, you just install the job.
            </p>
          </div>
        </section>

        {/* PRICING — three line items */}
        <section className="mpf-pricing">
          <div className="mpf-container">
            <div className="mpf-pricing-grid">
              <PricingTier
                tag="01 · PLATFORM SETUP"
                head="One-time platform fee"
                body="Full account configuration, agent stack activation, lender-marketplace provisioning, partner-portal access, staff training. Paid once on signing."
                v="$10,000"
                when="USD · charged on signing"
                hero
              />
              <PricingTier
                tag="02 · USAGE"
                head="Per smart-form lead"
                body="Every lead that runs through the HELIX intake form and the ORACLE soft pull is billed flat. No charge for traffic that bounces before the form."
                v="$3"
                when="per lead · billed monthly"
              />
              <PricingTier
                tag="03 · ORIGINATION"
                head="% of funded loan amount"
                body="At the end of each month we invoice 4% of loans that actually settled. No funded loan → no origination fee. Tracked per-lender, per-business."
                v="4%"
                when="of settled loan · monthly invoice"
              />
            </div>

            <div className="mpf-pricing-foot">
              <FootStat k="Monthly platform fee" v="$0" />
              <FootStat k="Per-application fee" v="$0" />
              <FootStat k="Time to live" v="Up to 5 business days" />
              <FootStat k="Contract term" v="Buy once · run forever" />
            </div>
          </div>
        </section>

        {/* WHAT YOU GET */}
        <section className="mpf-section">
          <div className="mpf-container">
            <h2 className="mpf-h2">What activates today</h2>
            <p className="mpf-section-sub">
              Four cards, one per onboarding module — the full TradePay stack lights up on signing.
              No phased rollout, no premium-tier gating.
            </p>
            <div className="mpf-includes-grid">
              {/* 01 · Account setup */}
              <Include
                head="Branded TradePay partner portal"
                body="Full crew access · admin + estimator roles · per-rep performance · live data on the jobs you've sent"
              />
              {/* 02 · Lender marketplace */}
              <Include
                head="Lender marketplace"
                body="We submit you to the EazePay lender marketplace for underwriting. Once each lender approves you, they all quote in parallel."
              />
              {/* 03 · Smart forms & financial qualification */}
              <Include
                head="Smart form + smart routing + HighSale CRM"
                body="Configure the smart-form fields, set up the smart routing rules, and connect your HighSale CRM so every doorstep soft-pull lands as a contact."
              />
              {/* 04 · Payment processing */}
              <Include
                head="MiCamp payment processing"
                body="Onboarded to MiCamp Solutions — better-than-industry rates on the general checkout payments you take outside the lender flow (deposits, cash sales, follow-on charges). Lender-funded jobs still settle merchant-direct from each lender."
              />
            </div>
          </div>
        </section>

        {/* AGREEMENT SUMMARY + CHECKOUT FORM */}
        <section className="mpf-section mpf-section-bordered">
          <div className="mpf-container">
            <div className="mpf-co-wrap">
              <div className="mpf-co-l">
                <h2 className="mpf-h2">Agreement snapshot</h2>
                <ul className="mpf-co-points">
                  <li>
                    <span className="mpf-co-check" aria-hidden>
                      ✓
                    </span>
                    EazePay (NMLS #2456701) operates the marketplace as the licensed loan
                    originator. Lenders carry the credit risk; the business does not.
                  </li>
                  <li>
                    <span className="mpf-co-check" aria-hidden>
                      ✓
                    </span>
                    No clawback on routine defaults. Promotional plan clawback (if any) is capped at
                    the promo discount and disclosed per-lender at the offer screen.
                  </li>
                  <li>
                    <span className="mpf-co-check" aria-hidden>
                      ✓
                    </span>
                    Buy-once, run-forever. No fixed contract term; you can stop running new traffic
                    any time. Existing loans funded under TradePay continue under their lender
                    terms.
                  </li>
                  <li>
                    <span className="mpf-co-check" aria-hidden>
                      ✓
                    </span>
                    FCRA, ECOA / Reg B, TILA compliance baked into every soft-pull and offer screen.
                    Audit log retained for 7 years.
                  </li>
                </ul>

                <Link href="/help" className="mpf-co-fine">
                  Full master service agreement →
                </Link>
              </div>

              <form className="mpf-co-form" onSubmit={(e) => e.preventDefault()}>
                <div className="mpf-co-form-head">
                  <span className="mpf-co-form-tag">CHECKOUT</span>
                  <span className="mpf-co-form-h">Start onboarding</span>
                </div>
                <label className="mpf-co-field">
                  <span className="mpf-co-label">Business legal name</span>
                  <input
                    type="text"
                    placeholder="Holloway Roofing Co., LLC"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    autoComplete="organization"
                  />
                </label>
                <label className="mpf-co-field">
                  <span className="mpf-co-label">Billing email</span>
                  <input
                    type="email"
                    placeholder="ar@hollowayroofing.com"
                    value={billingEmail}
                    onChange={(e) => setBillingEmail(e.target.value)}
                    autoComplete="email"
                  />
                </label>
                <label className="mpf-co-checkbox">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                  />
                  <span>
                    I agree to the $10,000 one-time platform fee, $3 per smart-form lead, and 4% of
                    settled loan amount. I have authority to bind the named business.
                  </span>
                </label>
                <div className="mpf-stripe-block">
                  <div className="mpf-stripe-head">
                    <div className="mpf-stripe-head-l">
                      <span className="mpf-stripe-tag">PAY SETUP FEE</span>
                      <span className="mpf-stripe-amt">$10,000.00</span>
                    </div>
                    <div className="mpf-stripe-cards" aria-hidden>
                      <span className="mpf-stripe-card-pill">VISA</span>
                      <span className="mpf-stripe-card-pill">MC</span>
                      <span className="mpf-stripe-card-pill">AMEX</span>
                      <span className="mpf-stripe-card-pill">ACH</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={payWithStripe}
                    className={`mpf-btn-primary mpf-btn-lg mpf-co-cta mpf-stripe-btn ${
                      canProceed && !paying ? '' : 'is-disabled'
                    }`}
                    aria-disabled={!canProceed || paying}
                    disabled={!canProceed || paying}
                  >
                    {paying ? 'Opening Stripe…' : 'Pay $10,000 with Stripe'}
                    <ArrowIcon />
                  </button>
                  {stripeNote ? <div className="mpf-stripe-note">{stripeNote}</div> : null}
                </div>
                <div className="mpf-co-foot">
                  Stripe Checkout · 256-bit TLS · KYB clears in 60s · Live in up to 5 business days
                </div>
              </form>
            </div>
          </div>
        </section>
      </main>

      <footer className="mpf-footer">
        <div className="mpf-container mpf-footer-inner">
          <div className="mpf-footer-brand">
            <LogoIcon />
            <span>TradePay · A vertical of EazePay</span>
          </div>
          <div className="mpf-footer-meta">
            NMLS #2456701 · Loans subject to lender approval · Disclosures available on the offer
            screen at apply time
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ----------------------------- helper components ----------------------- */

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
    <article className={`mpf-tier ${hero ? 'is-hero' : ''}`}>
      <div className="mpf-tier-tag">{tag}</div>
      <h3 className="mpf-tier-head">{head}</h3>
      <p className="mpf-tier-body">{body}</p>
      <div className="mpf-tier-foot">
        <div className="mpf-tier-v">{v}</div>
        <div className="mpf-tier-when">{when}</div>
      </div>
    </article>
  );
}

function Include({ head, body }: { head: string; body: string }) {
  return (
    <div className="mpf-include">
      <div className="mpf-include-mark" aria-hidden>
        ✓
      </div>
      <div>
        <div className="mpf-include-h">{head}</div>
        <div className="mpf-include-b">{body}</div>
      </div>
    </div>
  );
}

function FootStat({ k, v }: { k: string; v: string }) {
  return (
    <div className="mpf-foot-stat">
      <div className="mpf-foot-stat-k">{k}</div>
      <div className="mpf-foot-stat-v">{v}</div>
    </div>
  );
}

function LogoIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
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

/* ================================== CSS ============================== */

const CSS = `
.mpf-root {
  --mp-teal: #EA580C;
  --mp-teal-2: #FB923C;
  --mp-teal-light: #FFF7ED;
  --mp-deep: #431407;
  --mp-ink: #0F172A;
  --mp-ink-2: #1E293B;
  --mp-mute: #64748B;
  --mp-line: rgba(234, 88, 12, 0.12);
  --mp-line-strong: rgba(234, 88, 12, 0.22);

  background: linear-gradient(180deg, #FFF7ED 0%, #FFFFFF 30%, #FAFAF9 65%, #FFFFFF 100%);
  color: var(--mp-ink);
  font-family: inherit;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
  min-height: 100vh;
}
.mpf-root * { box-sizing: border-box; }
.mpf-root a { color: inherit; text-decoration: none; }
.mpf-container { max-width: 1180px; margin: 0 auto; padding: 0 32px; }

/* ============================== NAV ============================== */
.mpf-nav {
  position: sticky; top: 0; z-index: 30;
  background: rgba(255,255,255,0.85);
  border-bottom: 1px solid var(--mp-line);
  backdrop-filter: blur(10px);
}
.mpf-nav-inner {
  max-width: 1180px; margin: 0 auto;
  padding: 14px 32px;
  display: flex; align-items: center; gap: 32px;
}
.mpf-brand {
  display: inline-flex; align-items: center; gap: 10px;
  color: var(--mp-teal);
}
.mpf-brand-mark {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--mp-teal) 0%, var(--mp-teal-2) 100%);
  color: #fff;
}
.mpf-brand-word { font-weight: 700; font-size: 16px; letter-spacing: -0.01em; color: var(--mp-ink); }
.mpf-brand-sub { font-weight: 500; color: var(--mp-mute); margin-left: 2px; }
.mpf-nav-links {
  display: inline-flex; gap: 22px;
  margin-left: 16px;
  font-size: 13.5px; color: var(--mp-ink-2);
}
.mpf-nav-links a:hover { color: var(--mp-teal); }
.mpf-nav-cta-group { margin-left: auto; display: inline-flex; align-items: center; gap: 14px; }
.mpf-nav-link { font-size: 13.5px; color: var(--mp-ink-2); }
.mpf-nav-link:hover { color: var(--mp-teal); }

/* ============================== HERO ============================== */
.mpf-main { position: relative; }
.mpf-hero { padding: 64px 0 32px; }
.mpf-eyebrow-pill {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(234, 88, 12, 0.10);
  border: 1px solid var(--mp-line-strong);
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 11px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--mp-teal); text-transform: uppercase;
}
.mpf-pulse-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--mp-teal-2);
  box-shadow: 0 0 0 0 rgba(251, 146, 60, 0.55);
  animation: mpfPulse 1.6s ease-in-out infinite;
}
@keyframes mpfPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(251, 146, 60, 0.55); } 50% { box-shadow: 0 0 0 6px rgba(251, 146, 60, 0); } }
.mpf-h1 {
  margin: 18px 0 14px;
  font-size: clamp(40px, 5vw, 64px); font-weight: 700;
  letter-spacing: -0.028em; line-height: 1.04;
  color: var(--mp-ink);
}
.mpf-grad-teal { background: linear-gradient(120deg, var(--mp-teal) 0%, var(--mp-teal-2) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent; }
.mpf-grad-teal-deep { background: linear-gradient(120deg, var(--mp-deep) 0%, var(--mp-teal) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent; }
.mpf-hero-sub {
  margin: 0; max-width: 720px;
  font-size: 17px; line-height: 1.55;
  color: var(--mp-ink-2);
}

/* ============================== PRICING ============================== */
.mpf-pricing { padding: 28px 0; }
.mpf-pricing-grid {
  display: grid; grid-template-columns: 1fr 1fr 1fr;
  gap: 16px;
}
.mpf-tier {
  position: relative;
  padding: 24px 24px 22px;
  background: #fff;
  border: 1px solid var(--mp-line);
  border-radius: 18px;
  display: flex; flex-direction: column; gap: 10px;
  box-shadow: 0 18px 50px -28px rgba(234, 88, 12, 0.22);
}
.mpf-tier.is-hero {
  background:
    radial-gradient(ellipse 70% 100% at 0% 0%, rgba(251, 146, 60, 0.16), transparent 65%),
    linear-gradient(135deg, var(--mp-deep) 0%, #7C2D12 100%);
  color: #fff;
  border-color: rgba(251, 146, 60, 0.30);
  box-shadow:
    0 28px 60px -28px rgba(234, 88, 12, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.10);
}
.mpf-tier-tag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px; letter-spacing: 0.22em; font-weight: 700;
  color: var(--mp-teal); text-transform: uppercase;
}
.mpf-tier.is-hero .mpf-tier-tag { color: var(--mp-teal-2); }
.mpf-tier-head { margin: 4px 0 6px; font-size: 18px; font-weight: 600; letter-spacing: -0.018em; color: var(--mp-ink); }
.mpf-tier.is-hero .mpf-tier-head { color: #fff; }
.mpf-tier-body { margin: 0; font-size: 13.5px; line-height: 1.5; color: var(--mp-ink-2); }
.mpf-tier.is-hero .mpf-tier-body { color: rgba(255, 255, 255, 0.72); }
.mpf-tier-foot {
  margin-top: auto; padding-top: 14px;
  display: flex; flex-direction: column; gap: 4px;
}
.mpf-tier-v {
  font-size: 38px; font-weight: 700;
  letter-spacing: -0.035em; line-height: 1;
  background: linear-gradient(135deg, var(--mp-deep) 0%, var(--mp-teal) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  font-variant-numeric: tabular-nums;
}
.mpf-tier.is-hero .mpf-tier-v {
  background: linear-gradient(135deg, #fff 0%, var(--mp-teal-2) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.mpf-tier-when {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px; color: var(--mp-mute); letter-spacing: 0.04em;
}
.mpf-tier.is-hero .mpf-tier-when { color: rgba(255, 255, 255, 0.60); }
.mpf-pricing-foot {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 8px; margin-top: 16px;
}
.mpf-foot-stat {
  padding: 14px 16px;
  background: #fff;
  border: 1px solid var(--mp-line);
  border-radius: 12px;
  display: flex; flex-direction: column; gap: 4px;
}
.mpf-foot-stat-k {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px; letter-spacing: 0.12em; font-weight: 700;
  color: var(--mp-mute); text-transform: uppercase;
}
.mpf-foot-stat-v {
  font-size: 16px; font-weight: 600; letter-spacing: -0.012em;
  color: var(--mp-ink);
}

/* ============================== SECTIONS ============================== */
.mpf-section { padding: 56px 0 24px; }
.mpf-section-bordered {
  padding: 56px 0;
  border-top: 1px solid var(--mp-line);
  margin-top: 32px;
}
.mpf-h2 {
  margin: 0 0 8px;
  font-size: 30px; font-weight: 600; letter-spacing: -0.022em;
  color: var(--mp-ink);
}
.mpf-section-sub {
  margin: 0 0 24px;
  font-size: 15px; line-height: 1.55; color: var(--mp-mute);
  max-width: 640px;
}

/* "what activates today" grid */
.mpf-includes-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.mpf-include {
  display: grid; grid-template-columns: 28px 1fr;
  gap: 14px; align-items: start;
  padding: 16px 18px;
  background: #fff;
  border: 1px solid var(--mp-line);
  border-radius: 12px;
}
.mpf-include-mark {
  display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px;
  border-radius: 999px;
  background: rgba(251, 146, 60, 0.16);
  color: var(--mp-teal);
  font-size: 13px; font-weight: 700;
}
.mpf-include-h { font-size: 14.5px; font-weight: 600; letter-spacing: -0.012em; color: var(--mp-ink); margin-bottom: 4px; }
.mpf-include-b { font-size: 12.5px; line-height: 1.5; color: var(--mp-ink-2); }

/* ============================== CHECKOUT FORM ============================== */
.mpf-co-wrap {
  display: grid; grid-template-columns: 1.1fr 0.9fr;
  gap: 36px; align-items: start;
}
.mpf-co-points {
  list-style: none; padding: 0; margin: 16px 0 24px;
  display: flex; flex-direction: column; gap: 12px;
}
.mpf-co-points li {
  display: grid; grid-template-columns: 22px 1fr;
  gap: 12px; align-items: start;
  font-size: 13.5px; line-height: 1.55;
  color: var(--mp-ink-2);
}
.mpf-co-check {
  display: inline-flex; align-items: center; justify-content: center;
  width: 18px; height: 18px;
  border-radius: 999px;
  background: rgba(251, 146, 60, 0.20);
  color: var(--mp-teal);
  font-size: 11px; font-weight: 700;
  margin-top: 2px;
}
.mpf-co-fine {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 13px; color: var(--mp-teal);
  font-weight: 600;
}
.mpf-co-fine:hover { text-decoration: underline; }
.mpf-co-form {
  padding: 24px;
  background:
    radial-gradient(ellipse 80% 100% at 100% 0%, rgba(251, 146, 60, 0.12), transparent 70%),
    rgba(255, 255, 255, 0.98);
  border: 1px solid var(--mp-line-strong);
  border-radius: 18px;
  display: flex; flex-direction: column; gap: 14px;
  box-shadow: 0 28px 60px -28px rgba(234, 88, 12, 0.32);
}
.mpf-co-form-head { display: flex; flex-direction: column; gap: 4px; margin-bottom: 6px; }
.mpf-co-form-tag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px; letter-spacing: 0.22em; font-weight: 700;
  color: var(--mp-teal); text-transform: uppercase;
}
.mpf-co-form-h { font-size: 22px; font-weight: 600; letter-spacing: -0.02em; color: var(--mp-ink); }
.mpf-co-field { display: flex; flex-direction: column; gap: 6px; }
.mpf-co-label {
  font-size: 12.5px; font-weight: 600;
  color: var(--mp-ink-2);
  letter-spacing: 0.02em;
}
.mpf-co-field input {
  padding: 11px 14px;
  font-size: 14px; color: var(--mp-ink);
  background: #fff;
  border: 1px solid var(--mp-line-strong);
  border-radius: 10px;
  outline: none;
  transition: border-color .15s ease, box-shadow .15s ease;
}
.mpf-co-field input:focus {
  border-color: var(--mp-teal);
  box-shadow: 0 0 0 3px rgba(251, 146, 60, 0.18);
}
.mpf-co-checkbox {
  display: grid; grid-template-columns: 22px 1fr;
  gap: 10px; align-items: start;
  font-size: 13px; line-height: 1.5;
  color: var(--mp-ink-2);
  cursor: pointer;
}
.mpf-co-checkbox input[type="checkbox"] {
  appearance: none; -webkit-appearance: none;
  width: 18px; height: 18px;
  border: 1.5px solid var(--mp-line-strong);
  border-radius: 5px;
  background: #fff;
  cursor: pointer;
  position: relative;
  margin-top: 2px;
}
.mpf-co-checkbox input[type="checkbox"]:checked {
  background: var(--mp-teal);
  border-color: var(--mp-teal);
}
.mpf-co-checkbox input[type="checkbox"]:checked::after {
  content: '';
  position: absolute;
  left: 5px; top: 1px;
  width: 5px; height: 10px;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}
.mpf-co-cta {
  margin-top: 4px;
  width: 100%;
  display: inline-flex; align-items: center; justify-content: center; gap: 10px;
}
.mpf-co-cta.is-disabled {
  opacity: 0.45;
  cursor: not-allowed;
  pointer-events: none;
}
.mpf-co-foot {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px; letter-spacing: 0.06em;
  color: var(--mp-mute);
  text-align: center;
  margin-top: 4px;
}

/* ============================== STRIPE PAY BLOCK ============================== */
.mpf-stripe-block {
  margin-top: 8px;
  padding: 14px;
  background:
    radial-gradient(ellipse 100% 100% at 0% 0%, rgba(234, 88, 12, 0.10), transparent 70%),
    rgba(255, 255, 255, 0.7);
  border: 1px solid var(--mp-line-strong);
  border-radius: 14px;
}
.mpf-stripe-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.mpf-stripe-head-l { display: flex; flex-direction: column; gap: 2px; }
.mpf-stripe-tag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10px; letter-spacing: 0.22em; font-weight: 700;
  color: var(--mp-teal); text-transform: uppercase;
}
.mpf-stripe-amt {
  font-size: 22px; font-weight: 700;
  letter-spacing: -0.022em;
  color: var(--mp-ink);
  font-variant-numeric: tabular-nums;
}
.mpf-stripe-cards { display: inline-flex; gap: 4px; flex-wrap: wrap; }
.mpf-stripe-card-pill {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 9.5px; font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--mp-mute);
  padding: 3px 7px;
  background: rgba(234, 88, 12, 0.06);
  border: 1px solid var(--mp-line);
  border-radius: 6px;
}
.mpf-stripe-btn { width: 100%; justify-content: center; }
.mpf-stripe-note {
  margin-top: 10px;
  padding: 10px 12px;
  font-size: 12px; line-height: 1.45;
  color: var(--mp-ink-2);
  background: rgba(234, 88, 12, 0.06);
  border: 1px dashed var(--mp-line-strong);
  border-radius: 8px;
}

/* ============================== BUTTONS ============================== */
.mpf-btn-primary {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 12px 22px;
  background: linear-gradient(135deg, var(--mp-teal) 0%, var(--mp-teal-2) 100%);
  color: #fff;
  font-size: 14px; font-weight: 600;
  border-radius: 999px;
  box-shadow: 0 12px 24px -8px rgba(234, 88, 12, 0.45);
  transition: transform .15s ease, box-shadow .15s ease;
}
.mpf-btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 32px -8px rgba(234, 88, 12, 0.55);
}
.mpf-btn-lg { padding: 14px 28px; font-size: 15px; }

/* ============================== FOOTER ============================== */
.mpf-footer {
  margin-top: 64px;
  padding: 32px 0;
  border-top: 1px solid var(--mp-line);
  background: rgba(255, 255, 255, 0.6);
}
.mpf-footer-inner {
  display: flex; align-items: center; justify-content: space-between;
  gap: 24px;
}
.mpf-footer-brand {
  display: inline-flex; align-items: center; gap: 10px;
  font-size: 13.5px; color: var(--mp-ink-2); font-weight: 500;
}
.mpf-footer-meta { font-size: 12px; color: var(--mp-mute); text-align: right; }

/* ============================== RESPONSIVE ============================== */
@media (max-width: 980px) {
  .mpf-pricing-grid { grid-template-columns: 1fr; }
  .mpf-pricing-foot { grid-template-columns: 1fr 1fr; }
  .mpf-includes-grid { grid-template-columns: 1fr; }
  .mpf-co-wrap { grid-template-columns: 1fr; }
  .mpf-footer-inner { flex-direction: column; align-items: flex-start; gap: 12px; text-align: left; }
  .mpf-footer-meta { text-align: left; }
  .mpf-nav-links { display: none; }
}
`;
