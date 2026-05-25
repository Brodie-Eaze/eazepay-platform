/**
 * /platform/flow — end-to-end visual map of the EazePay customer
 * journey using real screenshots from production. Mirrors the journey
 * Brodie described:
 *
 *   1. Landing (MedPay / TradePay / CoachPay)
 *   2. Checkout
 *   3. Onboarding — HighSale+Pixie · Lender Marketplace · MyCamp
 *   4. Partner portal — operator sends application link
 *   5. Client intake form (HighSale API runs financial data)
 *   6. Real-time offers landed (client view + operator view +
 *      EazePay command centre — all three pushed simultaneously)
 *   7. Outcome — approved / settled / declined, pushed back to portal
 *
 * Screenshots are captured by
 *   apps/partner-portal/scripts/capture-flow-screenshots.mjs
 * and live in
 *   apps/partner-portal/public/flow-screenshots/
 * To refresh:
 *   node apps/partner-portal/scripts/capture-flow-screenshots.mjs
 *
 * The page itself is server-rendered (no client interactivity needed)
 * so initial paint is instant — only the screenshot images load lazily.
 */
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'How EazePay works · end-to-end customer journey',
  description: 'Every screen, in order, from landing page through partner portal to a funded loan.',
};

const BASE = 'https://eazepay-platform-production.up.railway.app';

interface Shot {
  /** File in /public/flow-screenshots */
  file: string;
  /** Caption shown under the screenshot */
  caption: string;
  /** Sub-caption / route hint */
  hint: string;
  /** Live URL — clickable from the card */
  href: string;
  /** External integration (HighSale, MyCamp) — opens in new tab */
  external?: boolean;
}

interface Phase {
  num: string;
  title: string;
  intro: string;
  shots: Shot[];
}

const PHASES: Phase[] = [
  {
    num: '01',
    title: 'Operator lands',
    intro:
      'Three brand landing pages funnel operators in by vertical. Healthcare → MedPay, trades + home services → TradePay, coaches + education → CoachPay. Each is its own brand on the same platform.',
    shots: [
      {
        file: '01-medpay-landing-page.png',
        caption: 'MedPay landing',
        hint: 'eazepay-platform-production.up.railway.app/landing/medpay',
        href: `${BASE}/landing/medpay`,
      },
      {
        file: '02-tradepay-landing-page.png',
        caption: 'TradePay landing',
        hint: '/landing/tradepay',
        href: `${BASE}/landing/tradepay`,
      },
      {
        file: '03-coachpay-landing-page.png',
        caption: 'CoachPay landing',
        hint: '/landing/coachpay',
        href: `${BASE}/landing/coachpay`,
      },
      {
        file: '04-medpay-sales-deck.png',
        caption: 'Sales deck',
        hint: '/sales/medpay',
        href: `${BASE}/sales/medpay`,
      },
    ],
  },
  {
    num: '02',
    title: 'Operator checks out',
    intro:
      'One-time setup fee. The checkout is plan-aware so reps can quote the right tier. Payment lands them on the welcome screen with the onboarding link queued.',
    shots: [
      {
        file: '05-checkout-medpay.png',
        caption: 'Checkout · $10k plan',
        hint: '/medpay/checkout?plan=10k',
        href: `${BASE}/medpay/checkout?plan=10k`,
      },
      {
        file: '06-welcome.png',
        caption: 'Welcome',
        hint: '/welcome/medpay',
        href: `${BASE}/welcome/medpay`,
      },
    ],
  },
  {
    num: '03',
    title: 'Onboarding · configure the 4 modules',
    intro:
      'The onboarding hub gates 4 module configurations. Operator sets up their HighSale account (which contains Pixie — the smart-form + smart-routing engine), wires up the lender marketplace (which lenders to enable + tier rules), and plugs in MyCamp as the payment processor. When all green, the partner portal unlocks.',
    shots: [
      {
        file: '07-onboarding-hub.png',
        caption: 'Onboarding hub',
        hint: '/medpay/onboarding',
        href: `${BASE}/medpay/onboarding`,
      },
      {
        file: '08-highsale-pixie-smart-form-routing.png',
        caption: 'HighSale · Pixie',
        hint: 'Smart form + routing · external',
        href: 'https://highsale.com/',
        external: true,
      },
      {
        file: '09-lender-marketplace-setup.png',
        caption: 'Lender marketplace setup',
        hint: '/medpay/onboarding/lender-marketplace',
        href: `${BASE}/medpay/onboarding/lender-marketplace`,
      },
      {
        file: '10-mycamp-payment-processor.png',
        caption: 'MyCamp processor',
        hint: 'Payment processor · external',
        href: 'https://micamp.com/',
        external: true,
      },
    ],
  },
  {
    num: '04',
    title: 'Operator enters the partner portal',
    intro:
      'From the portal home the operator can see live pipeline, send an application link directly to a client (SMS / email / branded URL), and manage their settings, team, and billing.',
    shots: [
      {
        file: '11-portal-home.png',
        caption: 'Portal home',
        hint: '/v/medpay',
        href: `${BASE}/v/medpay`,
      },
      {
        file: '12-send-link-application-to-client.png',
        caption: 'Send link · to client',
        hint: '/v/medpay/send-link',
        href: `${BASE}/v/medpay/send-link`,
      },
    ],
  },
  {
    num: '05',
    title: 'Client opens the intake form',
    intro:
      "Client clicks the link, lands on the operator's branded apply page. Pixie's smart-form is plugged into the back of the intake — it adapts on partial answers and routes by intent. As the form completes, HighSale API runs the financial data and pushes the profile to EazePay's decision engine in the cloud.",
    shots: [
      {
        file: '13-branded-apply-intake-form.png',
        caption: 'Branded apply / intake form',
        hint: '/apply/medpay',
        href: `${BASE}/apply/medpay`,
      },
    ],
  },
  {
    num: '06',
    title: 'Offers land in real time · three places at once',
    intro:
      "The decision engine fires the qualified profile across the lender panel in parallel. Quotes come back and are propensity-scored. The result is pushed simultaneously to three places: the client's offer screen (so they pick), the operator's portal (so they can coach the close), and EazePay's command centre (so we can see every application across every operator in real time).",
    shots: [
      {
        file: '14-client-sees-ranked-offers.png',
        caption: 'Client sees ranked offers',
        hint: '/apply/medpay#offers',
        href: `${BASE}/apply/medpay#offers`,
      },
      {
        file: '15-applications-list-operator-view.png',
        caption: 'Operator sees same application',
        hint: '/v/medpay/applications',
        href: `${BASE}/v/medpay/applications`,
      },
      {
        file: '16-command-centre-applications.png',
        caption: 'EazePay command centre',
        hint: '/admin/marketplace',
        href: `${BASE}/admin/marketplace`,
      },
    ],
  },
  {
    num: '07',
    title: 'Outcome · approved · settled · declined',
    intro:
      'Client picks an offer (scored by likelihood of approval), gets routed to that lender for underwriting. Lender returns an outcome via webhook — approved, declined, or settled. EazePay persists it, fires a realtime push to the operator portal and an email + SMS to the operator, and updates the command centre. Operator sees the status flip on-screen without refreshing.',
    shots: [
      {
        file: '17-application-detail-live-status.png',
        caption: 'Application detail · live status',
        hint: '/v/medpay/applications/[id]',
        href: `${BASE}/v/medpay/applications/demo`,
      },
      {
        file: '18-settlements-payouts-to-operator-bank.png',
        caption: 'Settlements · payouts',
        hint: '/v/medpay/settlements',
        href: `${BASE}/v/medpay/settlements`,
      },
      {
        file: '19-insights-pipeline-funded.png',
        caption: 'Insights · pipeline + funded $',
        hint: '/v/medpay/insights',
        href: `${BASE}/v/medpay/insights`,
      },
      {
        file: '20-command-centre-control-panel.png',
        caption: 'Command centre · control panel',
        hint: '/control-panel',
        href: `${BASE}/control-panel`,
      },
    ],
  },
];

export default function PlatformFlowPage(): JSX.Element {
  const totalShots = PHASES.reduce((acc, p) => acc + p.shots.length, 0);
  return (
    <div className="pf-root">
      <PfStyles />
      <div className="pf-mesh" aria-hidden />

      <header className="pf-hero">
        <div className="pf-eyebrow">
          <span className="pf-eyebrow-dot" />
          EazePay platform · how it works
        </div>
        <h1 className="pf-h1">
          <span className="pf-grad-deep">The full customer journey,</span>{' '}
          <span className="pf-grad">screen by screen.</span>
        </h1>
        <p className="pf-sub">
          Real screenshots, captured from the live platform, in the order a buyer + operator
          actually experience them. 7 phases &middot; {totalShots} screens &middot; landing page to
          funded loan.
        </p>
        <div className="pf-toc">
          {PHASES.map((p) => (
            <a key={p.num} href={`#phase-${p.num}`} className="pf-toc-link">
              <span className="pf-toc-n">{p.num}</span>
              <span className="pf-toc-t">{p.title}</span>
            </a>
          ))}
        </div>
      </header>

      <main className="pf-main">
        {PHASES.map((phase) => (
          <section key={phase.num} id={`phase-${phase.num}`} className="pf-phase">
            <div className="pf-phase-head">
              <div className="pf-phase-num">{phase.num}</div>
              <div className="pf-phase-meta">
                <h2 className="pf-phase-title">{phase.title}</h2>
                <p className="pf-phase-intro">{phase.intro}</p>
              </div>
            </div>
            <div className="pf-grid" data-count={phase.shots.length}>
              {phase.shots.map((shot, i) => (
                <ShotCard key={i} shot={shot} />
              ))}
            </div>
          </section>
        ))}
      </main>

      <footer className="pf-footer">
        <div className="pf-footer-row">
          <div>
            <div className="pf-footer-h">Want the live walk-through?</div>
            <div className="pf-footer-s">
              Every card above is clickable &mdash; opens the real URL on the live platform.
            </div>
          </div>
          <Link href="/sales/medpay" className="pf-cta">
            See the MedPay sales deck →
          </Link>
        </div>
        <div className="pf-footer-meta">
          EazePay &middot; eazepay-platform-production.up.railway.app &middot; 7 phases &middot;{' '}
          {totalShots} screens
        </div>
      </footer>
    </div>
  );
}

function ShotCard({ shot }: { shot: Shot }): JSX.Element {
  return (
    <a
      href={shot.href}
      target={shot.external ? '_blank' : undefined}
      rel={shot.external ? 'noopener noreferrer' : undefined}
      className="pf-card"
    >
      <div className="pf-card-img">
        <Image
          src={`/flow-screenshots/${shot.file}`}
          alt={shot.caption}
          width={1440}
          height={900}
          sizes="(max-width: 720px) 100vw, (max-width: 1100px) 50vw, 33vw"
          loading="lazy"
          className="pf-card-img-el"
        />
        <div className="pf-card-overlay" aria-hidden>
          <span className="pf-card-overlay-arrow">→</span>
        </div>
      </div>
      <div className="pf-card-meta">
        <div className="pf-card-caption">
          {shot.caption}
          {shot.external ? <span className="pf-card-ext">EXT</span> : null}
        </div>
        <div className="pf-card-hint">{shot.hint}</div>
      </div>
    </a>
  );
}

function PfStyles(): JSX.Element {
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />;
}

const CSS = `
.pf-root {
  --pf-blue: #3B82F6;
  --pf-blue-2: #60A5FA;
  --pf-violet: #8B5CF6;
  --pf-violet-2: #A78BFA;
  --pf-deep: #0B1224;
  --pf-ink: #0F172A;
  --pf-mute: #475569;
  --pf-line: rgba(59, 130, 246, 0.12);
  --pf-line-strong: rgba(59, 130, 246, 0.22);

  position: relative;
  min-height: 100vh;
  background: linear-gradient(180deg, #EEF2FF 0%, #FFFFFF 30%, #F5F3FF 65%, #FFFFFF 100%);
  color: var(--pf-ink);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}
.pf-root * { box-sizing: border-box; }
.pf-root a { color: inherit; text-decoration: none; }

.pf-mesh {
  position: fixed; inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse 60% 40% at 15% 20%, rgba(139, 92, 246, 0.16) 0%, transparent 60%),
    radial-gradient(ellipse 50% 60% at 85% 30%, rgba(59, 130, 246, 0.12) 0%, transparent 55%),
    radial-gradient(ellipse 70% 50% at 50% 90%, rgba(139, 92, 246, 0.10) 0%, transparent 55%);
}

/* ===== HERO ===== */
.pf-hero {
  position: relative; z-index: 1;
  max-width: 1200px; margin: 0 auto;
  padding: 80px 32px 40px;
  text-align: center;
}
.pf-eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(139, 92, 246, 0.12);
  border: 1px solid rgba(139, 92, 246, 0.24);
  font-size: 11.5px; font-weight: 700;
  letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--pf-violet);
}
.pf-eyebrow-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--pf-violet);
}
.pf-h1 {
  margin: 24px 0 18px;
  font-size: clamp(40px, 6vw, 72px);
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -0.025em;
}
.pf-grad {
  background: linear-gradient(120deg, var(--pf-blue) 0%, var(--pf-violet) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.pf-grad-deep {
  background: linear-gradient(120deg, var(--pf-deep) 0%, var(--pf-blue) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.pf-sub {
  max-width: 720px; margin: 0 auto 28px;
  font-size: 17px;
  line-height: 1.55;
  color: var(--pf-mute);
}
.pf-toc {
  display: flex; flex-wrap: wrap; gap: 10px;
  justify-content: center;
  margin-top: 8px;
}
.pf-toc-link {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 14px 8px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--pf-line);
  font-size: 13px; font-weight: 600;
  color: var(--pf-ink);
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}
.pf-toc-link:hover {
  transform: translateY(-1px);
  border-color: var(--pf-line-strong);
  box-shadow: 0 6px 18px -10px rgba(59, 130, 246, 0.4);
}
.pf-toc-n {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px;
  border-radius: 50%;
  background: var(--pf-blue);
  color: #fff;
  font-size: 11px; font-weight: 700;
  letter-spacing: 0;
}
.pf-toc-t { letter-spacing: -0.005em; }

/* ===== MAIN ===== */
.pf-main {
  position: relative; z-index: 1;
  max-width: 1320px; margin: 0 auto;
  padding: 40px 32px 80px;
}

.pf-phase {
  margin-bottom: 64px;
  scroll-margin-top: 32px;
}
.pf-phase-head {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 20px;
  align-items: start;
  margin-bottom: 28px;
}
.pf-phase-num {
  display: flex; align-items: center; justify-content: center;
  width: 64px; height: 64px;
  border-radius: 18px;
  background: linear-gradient(135deg, var(--pf-blue) 0%, var(--pf-violet) 100%);
  color: #fff;
  font-size: 24px; font-weight: 800;
  letter-spacing: -0.01em;
  box-shadow:
    0 12px 28px -14px rgba(59, 130, 246, 0.6),
    0 6px 12px -6px rgba(139, 92, 246, 0.4);
}
.pf-phase-meta { padding-top: 4px; }
.pf-phase-title {
  margin: 0 0 8px;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--pf-ink);
}
.pf-phase-intro {
  margin: 0;
  font-size: 15.5px;
  line-height: 1.55;
  color: var(--pf-mute);
  max-width: 880px;
}

/* ===== GRID (responsive · auto-adapts to shot count) ===== */
.pf-grid {
  display: grid;
  gap: 20px;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}
.pf-grid[data-count="1"] {
  grid-template-columns: minmax(0, 720px);
  justify-content: center;
}
.pf-grid[data-count="2"] {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
@media (max-width: 640px) {
  .pf-grid,
  .pf-grid[data-count="2"],
  .pf-grid[data-count="1"] {
    grid-template-columns: 1fr;
  }
}

/* ===== CARD ===== */
.pf-card {
  display: block;
  border-radius: 16px;
  background: #fff;
  border: 1px solid var(--pf-line);
  overflow: hidden;
  transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
  position: relative;
}
.pf-card:hover {
  transform: translateY(-4px);
  border-color: var(--pf-line-strong);
  box-shadow:
    0 24px 48px -22px rgba(59, 130, 246, 0.35),
    0 12px 24px -12px rgba(139, 92, 246, 0.22);
}
.pf-card-img {
  position: relative;
  aspect-ratio: 16 / 10;
  background: linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 100%);
  overflow: hidden;
}
.pf-card-img-el {
  display: block;
  width: 100%; height: 100%;
  object-fit: cover;
  object-position: top center;
  transition: transform 0.5s ease;
}
.pf-card:hover .pf-card-img-el { transform: scale(1.02); }

.pf-card-overlay {
  position: absolute;
  inset: 0;
  display: flex; align-items: flex-end; justify-content: flex-end;
  padding: 14px;
  background: linear-gradient(180deg, transparent 60%, rgba(11, 18, 36, 0.55) 100%);
  opacity: 0;
  transition: opacity 0.25s ease;
}
.pf-card:hover .pf-card-overlay { opacity: 1; }
.pf-card-overlay-arrow {
  display: inline-flex; align-items: center; justify-content: center;
  width: 36px; height: 36px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.95);
  color: var(--pf-blue);
  font-size: 18px; font-weight: 700;
}

.pf-card-meta {
  padding: 14px 16px 16px;
  border-top: 1px solid var(--pf-line);
}
.pf-card-caption {
  display: flex; align-items: center; gap: 8px;
  font-size: 14.5px; font-weight: 700;
  color: var(--pf-ink);
  letter-spacing: -0.012em;
}
.pf-card-ext {
  display: inline-flex; align-items: center;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(139, 92, 246, 0.12);
  color: var(--pf-violet);
  font-size: 9.5px; font-weight: 700;
  letter-spacing: 0.1em;
}
.pf-card-hint {
  margin-top: 4px;
  font-size: 11.5px; font-weight: 500;
  color: var(--pf-mute);
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  letter-spacing: -0.005em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* ===== FOOTER ===== */
.pf-footer {
  position: relative; z-index: 1;
  max-width: 1200px; margin: 0 auto;
  padding: 40px 32px 80px;
}
.pf-footer-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 24px;
  align-items: center;
  padding: 28px 32px;
  border-radius: 20px;
  background:
    radial-gradient(ellipse 60% 100% at 0% 50%, rgba(59, 130, 246, 0.18), transparent 60%),
    rgba(255, 255, 255, 0.92);
  border: 1px solid var(--pf-line-strong);
  box-shadow: 0 16px 40px -20px rgba(59, 130, 246, 0.3);
}
.pf-footer-h {
  font-size: 19px; font-weight: 700;
  color: var(--pf-ink);
  letter-spacing: -0.018em;
}
.pf-footer-s {
  margin-top: 4px;
  font-size: 14px;
  color: var(--pf-mute);
}
.pf-cta {
  display: inline-flex; align-items: center;
  padding: 12px 22px;
  border-radius: 999px;
  background: linear-gradient(120deg, var(--pf-blue) 0%, var(--pf-violet) 100%);
  color: #fff;
  font-size: 14.5px; font-weight: 700;
  letter-spacing: -0.005em;
  box-shadow: 0 12px 28px -12px rgba(59, 130, 246, 0.55);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.pf-cta:hover {
  transform: translateY(-1px);
  box-shadow: 0 18px 36px -14px rgba(59, 130, 246, 0.65);
}
.pf-footer-meta {
  margin-top: 18px;
  text-align: center;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 11px;
  color: var(--pf-mute);
  letter-spacing: 0.04em;
}

@media (max-width: 720px) {
  .pf-phase-head { grid-template-columns: 1fr; gap: 12px; }
  .pf-phase-num { width: 52px; height: 52px; font-size: 20px; }
  .pf-footer-row { grid-template-columns: 1fr; }
}
`;
