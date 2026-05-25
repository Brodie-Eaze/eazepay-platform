/**
 * /platform/flow — Figma-style flowchart of the EazePay customer
 * journey. Screenshots are the nodes; arrows + labels explain how
 * the flow moves between them.
 *
 * Re-capture screenshots:
 *   node apps/partner-portal/scripts/capture-flow-screenshots.mjs
 */
import type { Metadata } from 'next';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'EazePay · how it all flows',
  description: 'One landing page. Every screen, every arrow, every step.',
};

const BASE = 'https://eazepay-platform-production.up.railway.app';

interface Node {
  file: string;
  label: string;
  url: string;
  actor: 'op' | 'con' | 'eaze' | 'len';
  external?: boolean;
}

/* ─────────────────────────────────────────────────────────────────
 * Sections. Each section is its own mini-flowchart with nodes +
 * arrows. Order top-to-bottom mirrors the operator + consumer
 * journey end-to-end. */

interface LinearFlow {
  kind: 'linear';
  title: string;
  description: string;
  nodes: Node[];
  /** Optional label per gap. nodes.length - 1 entries. */
  arrowLabels?: string[];
}
interface FanOutFlow {
  kind: 'fan-out';
  title: string;
  description: string;
  source: Node;
  /** Label on the wedge of arrows leaving the source. */
  sourceToFanLabel?: string;
  fan: Node[];
  /** If present, fan converges to a single sink with this label. */
  sink?: Node;
  fanToSinkLabel?: string;
}

type Section = LinearFlow | FanOutFlow;

const SECTIONS: Section[] = [
  {
    kind: 'linear',
    title: '1 · Operator discovers + signs up',
    description:
      'Per-vertical brand landing pages funnel by industry. Sales rep walks the deck. Operator pays the setup fee at checkout. Welcome screen hands them the onboarding link.',
    nodes: [
      {
        file: '04-medpay-sales-deck.png',
        label: 'Sales deck',
        url: `${BASE}/sales/medpay`,
        actor: 'op',
      },
      {
        file: '08-checkout-10k-tier.png',
        label: 'Checkout',
        url: `${BASE}/medpay/checkout?plan=10k`,
        actor: 'op',
      },
      {
        file: '10-welcome-success.png',
        label: 'Welcome',
        url: `${BASE}/welcome/medpay`,
        actor: 'op',
      },
    ],
    arrowLabels: ['picks a plan', 'pays setup fee'],
  },

  {
    kind: 'fan-out',
    title: '2 · Onboarding · 4 modules to configure',
    description:
      'Onboarding hub gates 4 module configurations. When all green, the partner portal unlocks.',
    source: {
      file: '11-onboarding-hub.png',
      label: 'Onboarding hub',
      url: `${BASE}/medpay/onboarding`,
      actor: 'op',
    },
    sourceToFanLabel: 'configures all 4',
    fan: [
      {
        file: '13-highsale-pixie-external.png',
        label: 'HighSale + Pixie · smart form',
        url: 'https://highsale.com/',
        actor: 'op',
        external: true,
      },
      {
        file: '12-partner-portal-signup-config.png',
        label: 'Partner portal config',
        url: `${BASE}/medpay/signup`,
        actor: 'op',
      },
      {
        file: '14-lender-marketplace-setup.png',
        label: 'Lender marketplace',
        url: `${BASE}/medpay/onboarding/lender-marketplace`,
        actor: 'op',
      },
      {
        file: '15-mycamp-processor-external.png',
        label: 'MyCamp processor',
        url: 'https://micamp.com/',
        actor: 'op',
        external: true,
      },
    ],
    sink: {
      file: '16-portal-home-dashboard.png',
      label: 'Partner portal unlocks',
      url: `${BASE}/v/medpay`,
      actor: 'op',
    },
    fanToSinkLabel: 'all 4 complete',
  },

  {
    kind: 'linear',
    title: '3 · Inside the portal · operator sends a link to client',
    description:
      'From the portal home the operator sends a branded apply link to their client by SMS / email / QR.',
    nodes: [
      {
        file: '16-portal-home-dashboard.png',
        label: 'Portal home',
        url: `${BASE}/v/medpay`,
        actor: 'op',
      },
      {
        file: '17-portal-send-link-to-client.png',
        label: 'Send link to client',
        url: `${BASE}/v/medpay/send-link`,
        actor: 'op',
      },
    ],
    arrowLabels: ['composes the link'],
  },

  {
    kind: 'linear',
    title: '4 · Client opens the intake · Pixie + HighSale + decision engine',
    description:
      "Client clicks the link, lands on the operator's branded apply page. Pixie's smart form is plugged into the front of the intake. HighSale API on the back runs the financial data — soft-pull credit, income, DTI — and pushes the full pre-approval profile to EazePay's decision engine in the cloud.",
    nodes: [
      {
        file: '17-portal-send-link-to-client.png',
        label: 'Operator sends link',
        url: `${BASE}/v/medpay/send-link`,
        actor: 'op',
      },
      {
        file: '22-client-intake-pixie-smart-form.png',
        label: 'Client intake · Pixie',
        url: `${BASE}/apply/medpay`,
        actor: 'con',
      },
      {
        file: '13-highsale-pixie-external.png',
        label: 'HighSale API runs financial data',
        url: 'https://highsale.com/',
        actor: 'eaze',
        external: true,
      },
    ],
    arrowLabels: ['SMS / email', 'profile pushed to cloud'],
  },

  {
    kind: 'fan-out',
    title: '5 · Decision engine · fans out to lender panel · ranks offers',
    description:
      "Decision engine fires the buyer's profile across the configured lender panel in PARALLEL. Quotes come back in seconds, get propensity-scored, ranked cheapest-first into the offer stack.",
    source: {
      file: '23-lenders-panel-admin-view.png',
      label: 'Decision engine + lender panel',
      url: `${BASE}/lenders`,
      actor: 'eaze',
    },
    sourceToFanLabel: 'parallel quote · 8s timeout',
    fan: [
      {
        file: '24-marketplaces-panel-admin.png',
        label: 'Lender 1 quote',
        url: `${BASE}/marketplaces`,
        actor: 'len',
      },
      {
        file: '24-marketplaces-panel-admin.png',
        label: 'Lender 2 quote',
        url: `${BASE}/marketplaces`,
        actor: 'len',
      },
      {
        file: '24-marketplaces-panel-admin.png',
        label: 'Lender 3 quote',
        url: `${BASE}/marketplaces`,
        actor: 'len',
      },
    ],
    sink: {
      file: '26-client-sees-ranked-offers.png',
      label: 'Ranked offer stack',
      url: `${BASE}/apply/medpay#offers`,
      actor: 'eaze',
    },
    fanToSinkLabel: 'ranked cheapest-first',
  },

  {
    kind: 'fan-out',
    title: '6 · Offers land in THREE places · simultaneously',
    description:
      "Decision engine fires ONE Pusher event on channel app-[applicationId] that the client's offer screen, the operator's portal, AND EazePay's command centre are all subscribed to. All three update in real time.",
    source: {
      file: '26-client-sees-ranked-offers.png',
      label: 'Ranked offer stack',
      url: `${BASE}/apply/medpay#offers`,
      actor: 'eaze',
    },
    sourceToFanLabel: 'Pusher fires · realtime',
    fan: [
      {
        file: '26-client-sees-ranked-offers.png',
        label: "Client's offer screen",
        url: `${BASE}/apply/medpay#offers`,
        actor: 'con',
      },
      {
        file: '27-portal-applications-list.png',
        label: "Operator's portal",
        url: `${BASE}/v/medpay/applications`,
        actor: 'op',
      },
      {
        file: '28-command-centre-all-applications.png',
        label: 'EazePay command centre',
        url: `${BASE}/applications`,
        actor: 'eaze',
      },
    ],
  },

  {
    kind: 'linear',
    title: '7 · Client picks · lender does underwriting · webhook back',
    description:
      'Client picks an offer (UI is propensity-sorted but they can pick any). Handed over to the lender for underwriting. Lender resolves, POSTs our webhook with approved/declined/funded. We persist + push back to portal + command centre.',
    nodes: [
      {
        file: '26-client-sees-ranked-offers.png',
        label: 'Client picks offer',
        url: `${BASE}/apply/medpay#offers`,
        actor: 'con',
      },
      {
        file: '24-marketplaces-panel-admin.png',
        label: 'Lender underwriting',
        url: `${BASE}/marketplaces`,
        actor: 'len',
      },
      {
        file: '31-webhooks-inbound-from-lenders.png',
        label: 'Webhook to EazePay',
        url: `${BASE}/webhooks`,
        actor: 'eaze',
      },
    ],
    arrowLabels: ['accept + handoff', 'approved · settled · declined'],
  },

  {
    kind: 'fan-out',
    title: '8 · Outcome updates both portal + command centre',
    description:
      'EazePay HMAC-verifies, persists to applications + offers + application_events, fires Pusher status-changed + funded events, sends outcome email + SMS.',
    source: {
      file: '31-webhooks-inbound-from-lenders.png',
      label: 'Webhook persisted',
      url: `${BASE}/webhooks`,
      actor: 'eaze',
    },
    sourceToFanLabel: 'realtime push + email + SMS',
    fan: [
      {
        file: '30-application-detail-live-status.png',
        label: 'Operator portal · live status',
        url: `${BASE}/v/medpay/applications/demo`,
        actor: 'op',
      },
      {
        file: '28-command-centre-all-applications.png',
        label: 'Command centre · updated',
        url: `${BASE}/applications`,
        actor: 'eaze',
      },
    ],
  },

  {
    kind: 'linear',
    title: '9 · Settlement · lender wires direct to operator bank',
    description:
      "The lender wires the loan amount direct to the operator's bank account in 48–72 hours. EazePay does NOT touch the consumer money. Operator sees settlement land in the portal; EazePay separately invoices monthly for setup + origination fees.",
    nodes: [
      {
        file: '24-marketplaces-panel-admin.png',
        label: 'Lender approves + funds',
        url: `${BASE}/marketplaces`,
        actor: 'len',
      },
      {
        file: '35-portal-settlements-payouts.png',
        label: 'Operator portal · settlements',
        url: `${BASE}/v/medpay/settlements`,
        actor: 'op',
      },
      {
        file: '34-portal-billing.png',
        label: 'Operator portal · billing',
        url: `${BASE}/v/medpay/billing`,
        actor: 'op',
      },
    ],
    arrowLabels: ['ACH wire · 48–72 hr · merchant-direct', 'EazePay invoices monthly'],
  },
];

export default function PlatformFlowPage(): JSX.Element {
  return (
    <main className="fl-root">
      <FlStyles />
      <div className="fl-mesh" aria-hidden />

      <header className="fl-hero">
        <div className="fl-eyebrow">
          <span className="fl-eyebrow-dot" />
          EazePay platform · how it all flows
        </div>
        <h1 className="fl-h1">
          One landing page. <span className="fl-grad">Every screen, every arrow.</span>
        </h1>
        <p className="fl-sub">
          Real screenshots from production · {SECTIONS.length} sections of the customer journey ·
          arrows show what happens between each screen. Click any screenshot to open the live URL.
        </p>
        <ActorLegend />
      </header>

      <div className="fl-canvas">
        {SECTIONS.map((s, i) => (
          <SectionBlock key={i} section={s} />
        ))}
      </div>

      <footer className="fl-footer">That&apos;s the entire EazePay platform · end-to-end.</footer>
    </main>
  );
}

function ActorLegend(): JSX.Element {
  return (
    <div className="fl-legend">
      <span className="fl-legend-item">
        <span className="fl-dot fl-dot-op" /> Operator
      </span>
      <span className="fl-legend-item">
        <span className="fl-dot fl-dot-con" /> Consumer
      </span>
      <span className="fl-legend-item">
        <span className="fl-dot fl-dot-eaze" /> EazePay
      </span>
      <span className="fl-legend-item">
        <span className="fl-dot fl-dot-len" /> Lender
      </span>
    </div>
  );
}

function SectionBlock({ section }: { section: Section }): JSX.Element {
  return (
    <section className="fl-section">
      <header className="fl-section-head">
        <h2 className="fl-section-title">{section.title}</h2>
        <p className="fl-section-desc">{section.description}</p>
      </header>
      {section.kind === 'linear' ? <LinearChart flow={section} /> : <FanOutChart flow={section} />}
    </section>
  );
}

function LinearChart({ flow }: { flow: LinearFlow }): JSX.Element {
  return (
    <div className="fl-linear">
      {flow.nodes.map((n, i) => (
        <div key={i} className="fl-linear-step">
          <NodeCard node={n} />
          {i < flow.nodes.length - 1 && (
            <Arrow label={flow.arrowLabels?.[i]} direction="horizontal" />
          )}
        </div>
      ))}
    </div>
  );
}

function FanOutChart({ flow }: { flow: FanOutFlow }): JSX.Element {
  return (
    <div className="fl-fan">
      <div className="fl-fan-source">
        <NodeCard node={flow.source} />
      </div>
      <div className="fl-fan-arrow-down">
        <Arrow label={flow.sourceToFanLabel} direction="down" />
      </div>
      <div className="fl-fan-fan">
        {flow.fan.map((n, i) => (
          <div key={i} className="fl-fan-fan-cell">
            <NodeCard node={n} compact />
          </div>
        ))}
      </div>
      {flow.sink && (
        <>
          <div className="fl-fan-arrow-down">
            <Arrow label={flow.fanToSinkLabel} direction="down" converge />
          </div>
          <div className="fl-fan-source">
            <NodeCard node={flow.sink} />
          </div>
        </>
      )}
    </div>
  );
}

function NodeCard({ node, compact }: { node: Node; compact?: boolean }): JSX.Element {
  const actorClass = `fl-actor-${node.actor}`;
  return (
    <a
      href={node.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`fl-card ${compact ? 'fl-card-compact' : ''} ${actorClass}`}
    >
      <div className="fl-card-img">
        <Image
          src={`/flow-screenshots/${node.file}`}
          alt={node.label}
          width={1440}
          height={900}
          sizes="(max-width: 720px) 100vw, (max-width: 1100px) 33vw, 280px"
          loading="lazy"
          className="fl-card-img-el"
        />
      </div>
      <div className="fl-card-meta">
        <span className={`fl-card-dot fl-dot-${node.actor}`} />
        <span className="fl-card-label">{node.label}</span>
        {node.external && <span className="fl-card-ext">EXT</span>}
      </div>
    </a>
  );
}

function Arrow({
  label,
  direction,
  converge,
}: {
  label?: string;
  direction: 'horizontal' | 'down';
  converge?: boolean;
}): JSX.Element {
  if (direction === 'horizontal') {
    return (
      <div className="fl-arrow-h">
        <svg viewBox="0 0 120 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <defs>
            <marker
              id={`arrowhead-h-${label?.replace(/\s/g, '') ?? 'plain'}`}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="#3B82F6" />
            </marker>
          </defs>
          <line
            x1="2"
            y1="12"
            x2="110"
            y2="12"
            stroke="#3B82F6"
            strokeWidth="2"
            markerEnd={`url(#arrowhead-h-${label?.replace(/\s/g, '') ?? 'plain'})`}
          />
        </svg>
        {label && <div className="fl-arrow-label">{label}</div>}
      </div>
    );
  }
  return (
    <div className="fl-arrow-d">
      {label && <div className="fl-arrow-label fl-arrow-label-d">{label}</div>}
      <svg
        viewBox={converge ? '0 0 200 60' : '0 0 200 60'}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <defs>
          <marker
            id={`arrowhead-d-${converge ? 'c' : 'f'}-${label?.replace(/\s/g, '') ?? 'plain'}`}
            viewBox="0 0 10 10"
            refX="5"
            refY="9"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M0,0 L5,10 L10,0 z" fill="#3B82F6" />
          </marker>
        </defs>
        {converge ? (
          <>
            <path d="M30,5 Q100,30 100,55" stroke="#3B82F6" strokeWidth="2" fill="none" />
            <path d="M100,5 L100,55" stroke="#3B82F6" strokeWidth="2" fill="none" />
            <path
              d="M170,5 Q100,30 100,55"
              stroke="#3B82F6"
              strokeWidth="2"
              fill="none"
              markerEnd={`url(#arrowhead-d-c-${label?.replace(/\s/g, '') ?? 'plain'})`}
            />
          </>
        ) : (
          <>
            <path d="M100,5 L100,55" stroke="#3B82F6" strokeWidth="2" fill="none" />
            <path d="M100,5 Q30,30 30,55" stroke="#3B82F6" strokeWidth="2" fill="none" />
            <path
              d="M100,5 Q170,30 170,55"
              stroke="#3B82F6"
              strokeWidth="2"
              fill="none"
              markerEnd={`url(#arrowhead-d-f-${label?.replace(/\s/g, '') ?? 'plain'})`}
            />
          </>
        )}
      </svg>
    </div>
  );
}

function FlStyles(): JSX.Element {
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />;
}

const CSS = `
.fl-root {
  --fl-bg: #FAFBFF;
  --fl-card: #FFFFFF;
  --fl-ink: #0F172A;
  --fl-mute: #475569;
  --fl-faint: #94A3B8;
  --fl-line: #E2E8F0;
  --fl-line-strong: #CBD5E1;
  --fl-blue: #3B82F6;
  --fl-violet: #8B5CF6;
  --fl-op: #3B82F6;      /* Operator — blue */
  --fl-con: #10B981;     /* Consumer — green */
  --fl-eaze: #8B5CF6;    /* EazePay — violet */
  --fl-len: #F59E0B;     /* Lender — amber */

  min-height: 100vh;
  background: var(--fl-bg);
  color: var(--fl-ink);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  position: relative;
}
.fl-root * { box-sizing: border-box; }
.fl-root a { color: inherit; text-decoration: none; }

.fl-mesh {
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background:
    radial-gradient(ellipse 60% 40% at 10% 10%, rgba(59, 130, 246, 0.06) 0%, transparent 60%),
    radial-gradient(ellipse 70% 50% at 90% 30%, rgba(139, 92, 246, 0.06) 0%, transparent 60%);
}

/* ===== HERO ===== */
.fl-hero {
  position: relative; z-index: 1;
  max-width: 1100px; margin: 0 auto;
  padding: 64px 32px 32px;
  text-align: center;
}
.fl-eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 6px 14px; border-radius: 999px;
  background: #fff; border: 1px solid var(--fl-line);
  font-size: 11.5px; font-weight: 700;
  letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--fl-violet);
}
.fl-eyebrow-dot {
  width: 6px; height: 6px; border-radius: 50%; background: var(--fl-violet);
}
.fl-h1 {
  margin: 24px 0 16px;
  font-size: clamp(36px, 5vw, 56px);
  font-weight: 800;
  line-height: 1.1; letter-spacing: -0.025em;
}
.fl-grad {
  background: linear-gradient(120deg, var(--fl-blue) 0%, var(--fl-violet) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.fl-sub {
  max-width: 680px; margin: 0 auto 28px;
  font-size: 16px; line-height: 1.55; color: var(--fl-mute);
}
.fl-legend {
  display: inline-flex; flex-wrap: wrap; justify-content: center; gap: 18px;
  padding: 10px 18px; border-radius: 999px;
  background: #fff; border: 1px solid var(--fl-line);
  font-size: 12.5px; font-weight: 600;
}
.fl-legend-item {
  display: inline-flex; align-items: center; gap: 7px;
  color: var(--fl-mute);
}
.fl-dot {
  display: inline-block;
  width: 8px; height: 8px; border-radius: 50%;
}
.fl-dot-op { background: var(--fl-op); }
.fl-dot-con { background: var(--fl-con); }
.fl-dot-eaze { background: var(--fl-eaze); }
.fl-dot-len { background: var(--fl-len); }

/* ===== CANVAS ===== */
.fl-canvas {
  position: relative; z-index: 1;
  max-width: 1400px; margin: 0 auto;
  padding: 24px 24px 80px;
}

/* ===== SECTION ===== */
.fl-section {
  margin: 56px 0;
  padding: 32px;
  background: #fff;
  border: 1px solid var(--fl-line);
  border-radius: 18px;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.8) inset,
    0 12px 32px -18px rgba(15, 23, 42, 0.08);
}
.fl-section-head {
  margin-bottom: 28px;
  max-width: 880px;
}
.fl-section-title {
  margin: 0 0 8px;
  font-size: 22px; font-weight: 800;
  letter-spacing: -0.018em;
  color: var(--fl-ink);
}
.fl-section-desc {
  margin: 0;
  font-size: 14.5px; line-height: 1.55;
  color: var(--fl-mute);
}

/* ===== LINEAR CHART ===== */
.fl-linear {
  display: flex; align-items: stretch; justify-content: center;
  gap: 0; flex-wrap: wrap;
}
.fl-linear-step {
  display: flex; align-items: center; gap: 0;
  flex-shrink: 0;
}

/* ===== FAN CHART ===== */
.fl-fan {
  display: flex; flex-direction: column; align-items: center; gap: 0;
}
.fl-fan-source { display: flex; justify-content: center; }
.fl-fan-arrow-down {
  display: flex; flex-direction: column; align-items: center;
  width: 100%; max-width: 800px;
  padding: 4px 0;
}
.fl-fan-fan {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  width: 100%; max-width: 1100px;
  padding: 8px 0;
}
.fl-fan-fan-cell { display: flex; justify-content: center; }

/* ===== NODE CARD ===== */
.fl-card {
  display: flex; flex-direction: column;
  width: 240px;
  background: #fff;
  border: 2px solid var(--fl-line);
  border-radius: 12px;
  overflow: hidden;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  cursor: pointer;
}
.fl-card:hover {
  transform: translateY(-3px);
  border-color: var(--fl-blue);
  box-shadow: 0 16px 32px -16px rgba(59, 130, 246, 0.4);
}
.fl-card-compact { width: 220px; }
.fl-card-img {
  width: 100%;
  aspect-ratio: 16 / 10;
  background: #F1F5F9;
  overflow: hidden;
}
.fl-card-img-el {
  display: block;
  width: 100%; height: 100%;
  object-fit: cover; object-position: top center;
}
.fl-card-meta {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--fl-line);
}
.fl-card-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.fl-card-label {
  font-size: 12.5px; font-weight: 700;
  color: var(--fl-ink);
  line-height: 1.3; letter-spacing: -0.01em;
  flex: 1; min-width: 0;
}
.fl-card-ext {
  padding: 2px 5px; border-radius: 3px;
  background: rgba(139, 92, 246, 0.12); color: var(--fl-violet);
  font-size: 9px; font-weight: 700; letter-spacing: 0.1em;
}
.fl-actor-op { border-top: 4px solid var(--fl-op); }
.fl-actor-con { border-top: 4px solid var(--fl-con); }
.fl-actor-eaze { border-top: 4px solid var(--fl-eaze); }
.fl-actor-len { border-top: 4px solid var(--fl-len); }

/* ===== ARROWS ===== */
.fl-arrow-h {
  display: flex; flex-direction: column; align-items: center;
  width: 120px; min-width: 80px;
  padding: 0 8px;
}
.fl-arrow-h svg { width: 100%; height: 24px; display: block; }
.fl-arrow-d {
  display: flex; flex-direction: column; align-items: center;
  width: 200px;
}
.fl-arrow-d svg { width: 200px; height: 60px; display: block; }
.fl-arrow-label {
  margin-top: 4px;
  font-size: 11px; font-weight: 600;
  color: var(--fl-mute);
  font-style: italic;
  text-align: center;
  letter-spacing: -0.005em;
  max-width: 160px;
}
.fl-arrow-label-d { margin: 0 0 4px; }

/* ===== FOOTER ===== */
.fl-footer {
  position: relative; z-index: 1;
  max-width: 1100px; margin: 0 auto;
  padding: 40px 32px 80px;
  text-align: center;
  font-size: 13px; font-weight: 600;
  color: var(--fl-faint);
  letter-spacing: 0.04em;
}

@media (max-width: 900px) {
  .fl-linear { flex-direction: column; align-items: center; }
  .fl-linear-step { flex-direction: column; }
  .fl-arrow-h { width: 100%; padding: 12px 0; transform: rotate(90deg); height: 32px; }
  .fl-arrow-h svg { transform: rotate(0deg); }
}
@media (max-width: 720px) {
  .fl-section { padding: 24px 18px; margin: 32px 0; }
  .fl-card, .fl-card-compact { width: 100%; max-width: 320px; }
}
`;
