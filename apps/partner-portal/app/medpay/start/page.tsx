/**
 * MedPay · Landing (/medpay/start)
 *
 * Single-hero focused conversion page. One job: take a prospect from
 * cold to /medpay/checkout. Mirrors Aurean's /start: a compact nav,
 * a stacked hero with primary + secondary CTA, a trust strip, and a
 * minimal footer. No marketing tour — that's what /medpay (Website)
 * is for. No long explanation — that's what the existing
 * /landing/medpay page is for.
 *
 * Palette: MedPay teal tokens (matches /landing/medpay so a prospect
 * bouncing between routes sees one consistent brand).
 */

import Link from 'next/link';

export default function MedPayLandingStart(): JSX.Element {
  return (
    <div className="mpf-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* Nav — intentionally compact. Two links + a CTA. */}
      <header className="mpf-nav">
        <div className="mpf-nav-inner">
          <Link href="/medpay/start" className="mpf-brand" aria-label="MedPay home">
            <span className="mpf-brand-mark">
              <LogoIcon />
            </span>
            <span className="mpf-brand-word">
              MedPay<span className="mpf-brand-sub">/Patient Financing</span>
            </span>
          </Link>
          <nav className="mpf-nav-links" aria-label="Primary">
            <Link href="/medpay">See the platform</Link>
            <Link href="/landing/medpay">Long story</Link>
          </nav>
          <Link href="/medpay/checkout" className="mpf-btn-primary mpf-nav-cta">
            Start your practice
          </Link>
        </div>
      </header>

      <main className="mpf-main">
        {/* HERO */}
        <section className="mpf-hero">
          <div className="mpf-container">
            <div className="mpf-eyebrow-pill">
              <span className="mpf-pulse-dot" />
              For dental · med spa · derm · vet · vision
            </div>

            <h1 className="mpf-h1">
              <span className="mpf-grad-teal">From patient consult</span>
              <br />
              <span className="mpf-grad-teal-deep">to funded treatment.</span>
              <br />
              <span className="mpf-grad-teal">Under 72 hours.</span>
            </h1>

            <p className="mpf-hero-sub">
              MedPay puts a soft-pull lender marketplace at the chair. Approve more patients today,
              fund them this week. One signup, one platform.
            </p>

            <div className="mpf-hero-ctas">
              <Link href="/medpay/checkout" className="mpf-btn-primary mpf-btn-lg">
                Start your practice
                <ArrowIcon />
              </Link>
              <Link href="/medpay" className="mpf-btn-ghost mpf-btn-lg">
                See the platform
              </Link>
            </div>

            {/* Trust + pricing micro-line — bears the same NMLS posture
                as /landing/medpay so the line is consistent across
                surfaces. */}
            <div className="mpf-trust-line">
              <span className="mpf-trust-item">
                <ShieldIcon /> NMLS&nbsp;#2456701
              </span>
              <span className="mpf-trust-dot" aria-hidden>
                ·
              </span>
              <span className="mpf-trust-item">% of funded volume only</span>
              <span className="mpf-trust-dot" aria-hidden>
                ·
              </span>
              <span className="mpf-trust-item">No monthly fee, no contract</span>
            </div>
          </div>
        </section>

        {/* SOCIAL PROOF STRIP — 4 quantified stats in the Aurean dense
            grid layout, teal-tinted instead of dark. */}
        <section className="mpf-stats">
          <div className="mpf-container">
            <div className="mpf-stat-grid">
              <Stat n="12,400+" k="Patients funded to date" sub="+1,420 in last 30d" />
              <Stat n="$240M+" k="Funded to date" sub="+$18M this quarter" />
              <Stat n="Real-time" k="Lender marketplace" sub="parallel quoting" />
              <Stat n="48-72hr" k="Merchant-direct payout" sub="from loan settle" />
            </div>
          </div>
        </section>

        {/* WHAT YOU GET — 3-pillar grid mirroring Aurean's "what's in
            the box" treatment, in MedPay teal. */}
        <section className="mpf-pillars">
          <div className="mpf-container">
            <div className="mpf-section-head">
              <div className="mpf-eyebrow">What you get</div>
              <h2 className="mpf-h2">
                <span className="mpf-grad-teal-deep">Three pillars.</span>{' '}
                <span className="mpf-grad-teal">One platform.</span>
              </h2>
            </div>
            <div className="mpf-pillar-grid">
              <Pillar
                n="01"
                head="Soft-pull at the chair"
                body="Patient enters last 4 of SSN + DOB on your iPad. Fundability tier returns in under 10 seconds. Zero credit impact."
              />
              <Pillar
                n="02"
                head="Lender marketplace"
                body="Every lender quotes in parallel on one soft pull. Patient sees the cheapest qualifying offer. Decline rate is the floor of the marketplace, not the floor of a single lender."
              />
              <Pillar
                n="03"
                head="Merchant-direct funding"
                body="Lender disburses to your business account in 48 to 72 hours. No clawback on routine defaults. The lender carries the credit risk, not the practice."
              />
            </div>
          </div>
        </section>

        {/* CLOSING CTA — final push to /medpay/checkout. Different
            visual treatment from the hero CTA so it doesn't read as
            a duplicate. */}
        <section className="mpf-close">
          <div className="mpf-container">
            <div className="mpf-close-card">
              <div className="mpf-close-left">
                <div className="mpf-eyebrow">Ready when you are</div>
                <h2 className="mpf-h2">
                  <span className="mpf-grad-teal-deep">5-minute signup.</span>{' '}
                  <span className="mpf-grad-teal">Live by Thursday.</span>
                </h2>
                <p className="mpf-close-sub">
                  Sign the agreement, complete KYB, and run your first soft-pull on a real patient
                  within hours. No card collected. No monthly fee. Cancel anytime.
                </p>
              </div>
              <div className="mpf-close-right">
                <Link href="/medpay/checkout" className="mpf-btn-primary mpf-btn-xl">
                  Start your practice
                  <ArrowIcon />
                </Link>
                <Link href="/medpay" className="mpf-link-quiet">
                  Or explore the platform first →
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="mpf-footer">
        <div className="mpf-container mpf-footer-inner">
          <div className="mpf-footer-brand">
            <LogoIcon />
            <span>MedPay · A vertical of EazePay</span>
          </div>
          <div className="mpf-footer-meta">
            NMLS #2456701 · Loans subject to lender approval · Illustrative figures based on
            representative funnel inputs
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ----------------------------- helper components ----------------------- */

function Stat({ n, k, sub }: { n: string; k: string; sub: string }) {
  return (
    <div className="mpf-stat-cell">
      <div className="mpf-stat-n">{n}</div>
      <div className="mpf-stat-k">{k}</div>
      <div className="mpf-stat-sub">
        <span className="mpf-stat-sub-dot" /> {sub}
      </div>
    </div>
  );
}

function Pillar({ n, head, body }: { n: string; head: string; body: string }) {
  return (
    <article className="mpf-pillar">
      <div className="mpf-pillar-n">{n}</div>
      <h3 className="mpf-pillar-head">{head}</h3>
      <p className="mpf-pillar-body">{body}</p>
    </article>
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
function ShieldIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

/* ================================== CSS ============================== */

const CSS = `
.mpf-root {
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
.mpf-brand-word {
  font-size: 14px; font-weight: 700; letter-spacing: -0.01em;
  color: var(--mp-ink);
}
.mpf-brand-sub {
  font-weight: 500; color: var(--mp-mute); margin-left: 2px;
}
.mpf-nav-links {
  display: flex; gap: 22px;
  margin-left: auto;
  font-size: 13px; color: var(--mp-ink-2);
  font-weight: 500;
}
.mpf-nav-links a { transition: color .15s ease; }
.mpf-nav-links a:hover { color: var(--mp-teal); }
.mpf-nav-cta { font-size: 13px; padding: 8px 16px; }

/* ============================== TYPOGRAPHY ====================== */
.mpf-grad-teal {
  background: linear-gradient(120deg, var(--mp-teal) 0%, var(--mp-teal-2) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.mpf-grad-teal-deep {
  background: linear-gradient(120deg, var(--mp-deep) 0%, var(--mp-teal) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.mpf-h1 {
  font-size: 84px; font-weight: 800;
  letter-spacing: -0.038em; line-height: 1.02;
  margin: 0;
}
.mpf-h2 {
  font-size: 44px; font-weight: 800;
  letter-spacing: -0.028em; line-height: 1.1;
  margin: 0;
}

/* ============================== HERO ============================ */
.mpf-hero {
  position: relative;
  padding: 96px 0 64px;
}
.mpf-eyebrow-pill {
  display: inline-flex; align-items: center; gap: 10px;
  font-size: 11px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--mp-teal);
  text-transform: uppercase;
  padding: 7px 14px;
  background: rgba(34, 184, 160, 0.10);
  border: 1px solid var(--mp-line);
  border-radius: 999px;
  margin-bottom: 32px;
}
.mpf-pulse-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--mp-teal-2);
  box-shadow: 0 0 0 0 rgba(34, 184, 160, 0.5);
  animation: mpfPulse 1.6s ease-in-out infinite;
}
@keyframes mpfPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(34, 184, 160, 0.5); }
  50%      { box-shadow: 0 0 0 8px rgba(34, 184, 160, 0); }
}
.mpf-hero-sub {
  margin: 32px 0 0 0;
  font-size: 20px; line-height: 1.55;
  color: var(--mp-ink-2);
  max-width: 720px;
}
.mpf-hero-ctas {
  margin-top: 36px;
  display: flex; flex-wrap: wrap; gap: 10px;
}
.mpf-btn-primary {
  display: inline-flex; align-items: center; gap: 8px;
  background: linear-gradient(135deg, var(--mp-deep) 0%, var(--mp-teal) 100%);
  color: #fff;
  border-radius: 10px;
  font-weight: 600; font-size: 14px;
  padding: 12px 22px;
  border: 1px solid var(--mp-deep);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  box-shadow: 0 14px 30px -14px rgba(14, 124, 102, 0.45);
}
.mpf-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 18px 40px -16px rgba(14, 124, 102, 0.55); }
.mpf-btn-lg { font-size: 15px; padding: 14px 26px; }
.mpf-btn-xl { font-size: 16px; padding: 16px 30px; }
.mpf-btn-ghost {
  display: inline-flex; align-items: center; gap: 8px;
  background: rgba(255,255,255,0.95);
  color: var(--mp-ink);
  border-radius: 10px;
  font-weight: 600; font-size: 14px;
  padding: 12px 22px;
  border: 1px solid var(--mp-line-strong);
}
.mpf-btn-ghost:hover { border-color: var(--mp-teal); color: var(--mp-teal); }

.mpf-trust-line {
  margin-top: 24px;
  display: flex; flex-wrap: wrap; align-items: center;
  gap: 10px;
  font-size: 11px; letter-spacing: 0.10em;
  text-transform: uppercase;
  font-weight: 600;
  color: var(--mp-mute);
}
.mpf-trust-item {
  display: inline-flex; align-items: center; gap: 6px;
}
.mpf-trust-item svg { color: var(--mp-teal); }
.mpf-trust-dot { color: var(--mp-line-strong); }

/* ============================== STATS STRIP ===================== */
.mpf-stats {
  padding: 48px 0 32px;
}
.mpf-stat-grid {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: var(--mp-line);
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid var(--mp-line);
}
.mpf-stat-cell {
  background: rgba(255,255,255,0.92);
  padding: 28px 26px;
}
.mpf-stat-n {
  font-size: 34px; font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--mp-ink);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.mpf-stat-k {
  margin-top: 8px;
  font-size: 11px; letter-spacing: 0.16em; font-weight: 700;
  color: var(--mp-mute);
  text-transform: uppercase;
}
.mpf-stat-sub {
  margin-top: 10px;
  font-size: 12px; color: var(--mp-teal);
  display: inline-flex; align-items: center; gap: 6px;
}
.mpf-stat-sub-dot {
  width: 5px; height: 5px; border-radius: 999px;
  background: var(--mp-teal-2);
}

/* ============================== PILLARS ========================= */
.mpf-pillars { padding: 80px 0; }
.mpf-section-head {
  margin-bottom: 36px;
}
.mpf-eyebrow {
  display: inline-block;
  font-size: 11px; letter-spacing: 0.20em; font-weight: 700;
  color: var(--mp-teal);
  text-transform: uppercase;
  margin-bottom: 14px;
}
.mpf-pillar-grid {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 18px;
}
.mpf-pillar {
  background: rgba(255,255,255,0.92);
  border: 1px solid var(--mp-line-strong);
  border-radius: 20px;
  padding: 30px;
  box-shadow: 0 18px 50px -28px rgba(14, 124, 102, 0.22);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.mpf-pillar:hover {
  transform: translateY(-3px);
  box-shadow: 0 26px 60px -28px rgba(14, 124, 102, 0.32);
}
.mpf-pillar-n {
  font-size: 11px; letter-spacing: 0.22em; font-weight: 700;
  color: var(--mp-teal);
  text-transform: uppercase;
}
.mpf-pillar-head {
  margin: 12px 0 14px 0;
  font-size: 22px; font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--mp-ink);
}
.mpf-pillar-body {
  margin: 0;
  font-size: 14px; line-height: 1.6;
  color: var(--mp-ink-2);
}

/* ============================== CLOSE CTA ======================== */
.mpf-close { padding: 24px 0 80px; }
.mpf-close-card {
  background:
    radial-gradient(ellipse 60% 100% at 100% 50%, rgba(34, 184, 160, 0.15), transparent 60%),
    linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(248,253,252,0.95) 100%);
  border: 1px solid var(--mp-line-strong);
  border-radius: 28px;
  padding: 48px;
  box-shadow: 0 30px 80px -30px rgba(14, 124, 102, 0.30);
  display: grid; grid-template-columns: 1.4fr 1fr;
  gap: 48px; align-items: center;
}
.mpf-close-sub {
  margin: 18px 0 0 0;
  font-size: 15px; color: var(--mp-ink-2); line-height: 1.6;
}
.mpf-close-right {
  display: flex; flex-direction: column; gap: 14px; align-items: flex-start;
}
.mpf-link-quiet {
  font-size: 12px; color: var(--mp-mute);
  border-bottom: 1px dashed var(--mp-line-strong);
  padding-bottom: 1px;
}
.mpf-link-quiet:hover { color: var(--mp-teal); border-color: var(--mp-teal); }

/* ============================== FOOTER ========================== */
.mpf-footer {
  padding: 32px 0 48px;
  border-top: 1px solid var(--mp-line);
}
.mpf-footer-inner {
  display: flex; justify-content: space-between; align-items: center;
  gap: 24px; flex-wrap: wrap;
  font-size: 12px; color: var(--mp-mute);
}
.mpf-footer-brand {
  display: inline-flex; align-items: center; gap: 10px;
  font-weight: 600; color: var(--mp-ink-2);
}
.mpf-footer-brand svg { color: var(--mp-teal); }
.mpf-footer-meta {
  max-width: 540px; text-align: right; line-height: 1.5;
}

/* ============================== RESPONSIVE ====================== */
@media (max-width: 1024px) {
  .mpf-h1 { font-size: 60px; }
  .mpf-h2 { font-size: 34px; }
  .mpf-stat-grid { grid-template-columns: repeat(2, 1fr); }
  .mpf-pillar-grid { grid-template-columns: 1fr; }
  .mpf-close-card { grid-template-columns: 1fr; }
  .mpf-nav-links { display: none; }
  .mpf-footer-inner { flex-direction: column; align-items: flex-start; }
  .mpf-footer-meta { text-align: left; }
}
@media (max-width: 640px) {
  .mpf-h1 { font-size: 42px; }
  .mpf-h2 { font-size: 26px; }
  .mpf-stat-grid { grid-template-columns: 1fr; }
  .mpf-container { padding: 0 20px; }
  .mpf-hero { padding: 56px 0 40px; }
  .mpf-close-card { padding: 32px; }
}
`;
