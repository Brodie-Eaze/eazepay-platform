/**
 * /platform/overview — investor / lender-grade platform overview.
 *
 * A single scroll-through narrative that explains the whole company:
 * what EazePay is, how it works end-to-end, the surfaces + rails, the
 * value to each stakeholder, the AI agent fleet that builds + operates
 * it, the full architecture, the request/money flow, and the human
 * departments the fleet stands in for.
 *
 * Styling convention (matches /platform/flow + the /apply pages): these
 * standalone brand pages do NOT reliably get Tailwind utilities
 * processed, so everything is inline `<style dangerouslySetInnerHTML>`
 * CSS scoped under `.ov-root`. No external images — every diagram is
 * hand-built CSS / inline SVG.
 *
 * Truthfulness rule (this page is shown to lenders + auditors): every
 * compliance line is true today. PCI is described as out-of-scope
 * (SAQ A — no cardholder data), encryption / RLS / append-only audit /
 * FCRA consent gate are live; SOC 2 is "readiness in progress / Type I
 * targeted", never "certified". No invented metrics, logos, or dollars.
 */
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'EazePay · platform overview',
  description:
    'The whole platform on one page: an AI-operated fintech — card-processing ISO + ' +
    'FCRA soft-pull lender marketplace — built and run by a ~62-agent council.',
};

const PORTAL = 'https://eazepay-platform-production.up.railway.app';

/* ════════════════════════════════════════════════════════════════════
 * 5 · AGENT FLEET — grouped, representative subset (~36 agents).
 * Roles are one-liners; nothing fabricated beyond what the council
 * actually does in this repo.
 * ════════════════════════════════════════════════════════════════════ */
interface Agent {
  name: string;
  role: string;
}
interface Department {
  key: string;
  label: string;
  blurb: string;
  agents: Agent[];
}

const FLEET: Department[] = [
  {
    key: 'eng',
    label: 'Engineering Council',
    blurb: 'Designs, builds and hardens every service, schema and migration.',
    agents: [
      { name: 'senior-engineer', role: 'System design + code review backbone' },
      { name: 'hardening-engineer', role: 'Fail-closed defaults, edge-case armor' },
      { name: 'payments-engineer', role: 'Settlement, payout + processor rails' },
      { name: 'frontend-architect', role: 'Next.js App Router, a11y, perf budgets' },
      { name: 'database-architect', role: 'Postgres modeling, RLS, indexing' },
      { name: 'migration-engineer', role: 'Zero-downtime schema evolution' },
      { name: 'reliability-engineer', role: 'SLOs, retries, DLQ, idempotency' },
      { name: 'integration-engineer', role: 'Lender + processor adapter contracts' },
    ],
  },
  {
    key: 'risk',
    label: 'Compliance & Risk Swarm',
    blurb: 'The 0.0001% layer — fair lending, AML, privacy, security posture.',
    agents: [
      { name: 'soc2-auditor', role: 'Readiness controls + evidence punch-list' },
      { name: 'fraud-aml-engineer', role: 'BSA officer — OFAC, SAR triggers' },
      { name: 'risk-underwriting-engineer', role: 'FCRA / ECOA decision integrity' },
      { name: 'privacy-officer', role: 'PII classification, RTBF, retention' },
      { name: 'ciso', role: 'Security strategy + control ownership' },
      { name: 'pen-tester', role: 'Adversarial probing, abuse cases' },
      { name: 'security-auditor', role: 'Dependency, secret + config audit' },
      { name: 'compliance-officer', role: 'Reg mapping, adverse-action notices' },
    ],
  },
  {
    key: 'prod',
    label: 'Product & Growth',
    blurb: 'Shapes the product surface and the loops that compound it.',
    agents: [
      { name: 'feature-architect', role: 'Slices scope into shippable bets' },
      { name: 'product-engineer', role: 'Full-stack feature delivery' },
      { name: 'gtm-strategist', role: 'Vertical positioning + packaging' },
      { name: 'growth-loop-architect', role: 'Referral + activation loops' },
      { name: 'design-critique', role: 'Visual quality + brand consistency' },
      { name: 'lifecycle-engineer', role: 'Onboarding + retention messaging' },
    ],
  },
  {
    key: 'ops',
    label: 'Platform & Operations',
    blurb: 'Keeps the rails up, the money reconciled and incidents short.',
    agents: [
      { name: 'devops-platform-engineer', role: 'CI/CD, infra, Railway → AWS cutover' },
      { name: 'incident-commander', role: 'Sev triage, comms, postmortems' },
      { name: 'settlements-engineer', role: 'Payout reconciliation + ledgering' },
      { name: 'observability-engineer', role: 'OTel traces, metrics, alerting' },
      { name: 'release-manager', role: 'Change control + safe rollouts' },
    ],
  },
  {
    key: 'inprod',
    label: 'In-Product Agents',
    blurb: 'Run live inside the product, customer- and operator-facing.',
    agents: [
      { name: 'support-agent', role: 'Operator + consumer help in-app' },
      { name: 'onboarding-agent', role: 'Guides merchants through KYB + config' },
      { name: 'decisioning-agent', role: 'Ranks the marketplace by total cost' },
      { name: 'eaze-ai-copilot', role: 'Operator command-center assistant' },
    ],
  },
];

const FLEET_TOTAL = 62;

/* ════════════════════════════════════════════════════════════════════
 * 6 · ARCHITECTURE — layered component map data.
 * ════════════════════════════════════════════════════════════════════ */
const SERVICES_17: string[] = [
  'auth',
  'user · PII vault',
  'merchant · KYB',
  'risk',
  'orchestration',
  'payment',
  'settlement',
  'lender',
  'compliance-doc',
  'audit',
  'notification',
  'webhook',
  'events',
  'billing',
  'admin',
  'application',
  'email',
];

/* ════════════════════════════════════════════════════════════════════
 * 8 · DEPARTMENTS + POSITIONS the fleet stands in for.
 * ════════════════════════════════════════════════════════════════════ */
interface DeptRow {
  dept: string;
  positions: string;
  agents: string;
  human: string;
}
const DEPT_TABLE: DeptRow[] = [
  {
    dept: 'Engineering',
    positions: 'Staff engineer · SRE · DBA · Security engineer',
    agents: 'senior-engineer, reliability-engineer, database-architect, hardening-engineer',
    human: 'Architecture sign-off on irreversible migrations',
  },
  {
    dept: 'Compliance',
    positions: 'CISO · BSA/AML officer · Privacy officer · Fair-lending analyst · Internal audit',
    agents: 'ciso, fraud-aml-engineer, privacy-officer, risk-underwriting-engineer, soc2-auditor',
    human: 'External pentest · counsel review · audit observation window',
  },
  {
    dept: 'Product',
    positions: 'CPO · Product manager · Designer',
    agents: 'feature-architect, product-engineer, design-critique',
    human: 'Roadmap + pricing calls',
  },
  {
    dept: 'Growth / GTM',
    positions: 'Head of growth · Lifecycle marketer',
    agents: 'gtm-strategist, growth-loop-architect, lifecycle-engineer',
    human: 'Brand + partner relationships',
  },
  {
    dept: 'Operations',
    positions: 'Settlements ops · Support · Incident commander',
    agents: 'settlements-engineer, support-agent, incident-commander',
    human: 'Executing manual money transfers',
  },
  {
    dept: 'Finance',
    positions: 'Controller · FP&A',
    agents: 'settlements-engineer, billing service, reporting',
    human: 'Bank reconciliation + tax filing',
  },
];

/* ════════════════════════════════════════════════════════════════════
 * SHARED ICONS — small inline SVGs (no deps).
 * ════════════════════════════════════════════════════════════════════ */
function Glyph({ d, fill }: { d: string; fill?: boolean }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="ov-glyph" aria-hidden>
      <path
        d={d}
        fill={fill ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={fill ? 0 : 1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
const ICON = {
  apply: 'M5 4h9l5 5v11a0 0 0 0 1 0 0H5zM14 4v5h5M8 13h8M8 17h6',
  consent: 'M9 12l2 2 4-4M12 3l7 3v6c0 4-3 7-7 8-4-1-7-4-7-8V6z',
  engine: 'M12 8v8M8 12h8M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2 2M16.4 16.4l2 2',
  rank: 'M4 18V9M10 18V5M16 18v-6M20 18V8',
  offer: 'M4 7h16v10H4zM4 11h16M8 15h4',
  webhook: 'M7 8a4 4 0 116 3M9 16a4 4 0 116-3M5 16a4 4 0 004 4',
  settle: 'M3 7h18v10H3zM3 11h18M7 15h2',
  audit: 'M6 3h9l3 3v15H6zM9 12l2 2 4-4',
  merchant: 'M4 8l1-3h14l1 3M4 8h16v11H4zM9 19v-6h6v6',
  consumer: 'M12 12a4 4 0 100-8 4 4 0 000 8zM5 20c0-3.5 3-6 7-6s7 2.5 7 6',
  operator: 'M3 12h4l2 6 4-14 2 8h6',
  lender: 'M4 10l8-5 8 5M5 10v8M19 10v8M9 18v-5M15 18v-5M3 21h18',
} as const;

/* ════════════════════════════════════════════════════════════════════
 * PAGE
 * ════════════════════════════════════════════════════════════════════ */
export default function PlatformOverviewPage(): JSX.Element {
  return (
    <main className="ov-root">
      <OvStyles />

      <BackBar />
      <Hero />

      <Section1WhatItIs />
      <Section2HowItWorks />
      <Section3WhatsInvolved />
      <Section4Outcome />
      <Section5Fleet />
      <Section6Architecture />
      <Section7Flow />
      <Section8Departments />

      <ClosingBand />
    </main>
  );
}

/* ─────────────────────────────── Back bar ─────────────────────────── */
function BackBar(): JSX.Element {
  return (
    <div className="ov-backbar">
      <a className="ov-back" href={`${PORTAL}/platform/flow`}>
        <svg viewBox="0 0 24 24" aria-hidden className="ov-back-ico">
          <path
            d="M15 18l-6-6 6-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Back to flow
      </a>
      <span className="ov-backbrand">
        <span className="ov-mark">E</span>
        EazePay
      </span>
    </div>
  );
}

/* ─────────────────────────────── Hero ─────────────────────────────── */
function Hero(): JSX.Element {
  return (
    <header className="ov-hero">
      <div className="ov-hero-grid" aria-hidden />
      <div className="ov-hero-glow" aria-hidden />
      <div className="ov-hero-inner">
        <div className="ov-eyebrow">
          <span className="ov-eyebrow-dot" />
          Platform overview · for lenders &amp; investors
        </div>
        <h1 className="ov-h1">
          The fintech platform that runs itself.
          <span className="ov-h1-grad">
            {' '}
            An ISO + a lender marketplace, operated by a council of AI.
          </span>
        </h1>
        <p className="ov-lede">
          EazePay does two regulated things at once: it is a card-processing ISO under MiCamp, and a
          consumer-financing marketplace that runs FCRA soft-pull prequalification and refers
          consumers to lenders. We are not a lender — we connect consumers with financing partners.
          The entire stack is designed, hardened and operated by a ~{FLEET_TOTAL}-agent AI council.
        </p>
        <div className="ov-hero-pills">
          {[
            'Card-processing ISO',
            'Soft-pull lender marketplace',
            'Multi-vertical · MedPay · TradePay · CoachPay',
            `~${FLEET_TOTAL} AI agents`,
          ].map((p) => (
            <span key={p} className="ov-hpill">
              {p}
            </span>
          ))}
        </div>

        <div className="ov-hero-stats">
          <HeroStat k="17" v="backend services" />
          <HeroStat k="3" v="customer verticals" />
          <HeroStat k="SAQ A" v="PCI scope (no card data)" />
          <HeroStat k="AES-256-GCM" v="per-row PII encryption" />
        </div>

        <nav className="ov-toc" aria-label="Sections">
          {[
            '1 · What it is',
            '2 · How it works',
            "3 · What's involved",
            '4 · The outcome',
            '5 · The agent fleet',
            '6 · Architecture',
            '7 · The flow',
            '8 · Departments',
          ].map((t, i) => (
            <a key={t} className="ov-toc-link" href={`#s${i + 1}`}>
              {t}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
function HeroStat({ k, v }: { k: string; v: string }): JSX.Element {
  return (
    <div className="ov-hstat">
      <div className="ov-hstat-k">{k}</div>
      <div className="ov-hstat-v">{v}</div>
    </div>
  );
}

/* ─────────────── Section scaffolding ─────────────── */
function SectionHead({
  id,
  num,
  kicker,
  title,
  intro,
}: {
  id: string;
  num: string;
  kicker: string;
  title: string;
  intro: string;
}): JSX.Element {
  return (
    <header className="ov-shead" id={id}>
      <div className="ov-skicker">
        <span className="ov-snum">{num}</span>
        {kicker}
      </div>
      <h2 className="ov-stitle">{title}</h2>
      <p className="ov-sintro">{intro}</p>
    </header>
  );
}

/* ════════ 1 · WHAT IT IS ════════ */
function Section1WhatItIs(): JSX.Element {
  const verticals = [
    {
      code: 'MedPay',
      d: ICON.merchant,
      who: 'Medical & dental',
      copy: 'Patient financing at the point of care — elective, dental, vet and specialty practices.',
      accent: '#0FB5A6',
    },
    {
      code: 'TradePay',
      d: ICON.operator,
      who: 'Trades & home services',
      copy: 'Finance the quote on the spot — HVAC, roofing, solar, remodels and contractors.',
      accent: '#F59E0B',
    },
    {
      code: 'CoachPay',
      d: ICON.consumer,
      who: 'Coaching & education',
      copy: 'Spread the cost of programs — coaches, bootcamps, courses and consultants.',
      accent: '#8B5CF6',
    },
  ];
  return (
    <section className="ov-section ov-sec-light">
      <SectionHead
        id="s1"
        num="01"
        kicker="What it is"
        title="An AI-operated fintech that does processing and financing as one platform."
        intro="EazePay is two regulated businesses fused behind a single rail. On one side it operates as a
        card-processing ISO under MiCamp. On the other it runs a consumer-financing marketplace: an
        FCRA-compliant soft-pull prequalification that ranks lender offers and refers the consumer to
        a financing partner. We never lend our own balance sheet — we connect consumers with lenders,
        and earn referral economics plus ISO residuals."
      />

      <div className="ov-isgrid">
        <div className="ov-iscard">
          <div className="ov-iscard-tag">A · Acquiring</div>
          <h3 className="ov-iscard-h">Card-processing ISO</h3>
          <p className="ov-iscard-p">
            A registered ISO under MiCamp. Card data is tokenized at the processor — no PAN or CVV
            ever touches EazePay — which keeps us inside the PCI <strong>SAQ A</strong> boundary. We
            hold only opaque tokens, and money settles processor-direct.
          </p>
        </div>
        <div className="ov-iscard">
          <div className="ov-iscard-tag ov-iscard-tag-b">B · Financing</div>
          <h3 className="ov-iscard-h">Soft-pull lender marketplace</h3>
          <p className="ov-iscard-p">
            A consented FCRA soft-pull prequalifies the consumer, a decision engine ranks the lender
            panel by lowest total cost, and the consumer picks from real pre-qualified offers.{' '}
            <strong>EazePay is not a lender</strong> — we refer consented, compliant applicants to
            financing partners.
          </p>
        </div>
      </div>

      <div className="ov-problem">
        <div className="ov-problem-bar" aria-hidden />
        <div>
          <div className="ov-problem-h">The problem it solves</div>
          <p className="ov-problem-p">
            High-ticket purchases stall at the moment of payment. The merchant loses the sale, the
            consumer fears a hard credit hit, and the lender never sees a clean, consented
            applicant. EazePay drops financing into the merchant&apos;s own flow: one soft-pull,
            multiple ranked offers, zero score impact to shop — turning &quot;I can&apos;t afford
            that today&quot; into a closed sale.
          </p>
        </div>
      </div>

      <h3 className="ov-subh">Three verticals, one engine</h3>
      <div className="ov-vgrid">
        {verticals.map((v) => (
          <div key={v.code} className="ov-vcard" style={{ ['--vac' as string]: v.accent }}>
            <div className="ov-vcard-ico">
              <Glyph d={v.d} />
            </div>
            <div className="ov-vcard-code">{v.code}</div>
            <div className="ov-vcard-who">{v.who}</div>
            <p className="ov-vcard-copy">{v.copy}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ════════ 2 · HOW IT WORKS ════════ */
function Section2HowItWorks(): JSX.Element {
  const steps = [
    {
      d: ICON.apply,
      t: 'Consumer applies',
      s: 'Lands on /apply/<brand> from the merchant’s SMS, email or QR — a branded, single-page intake.',
      tag: 'consumer',
    },
    {
      d: ICON.consent,
      t: 'Soft-pull consent',
      s: 'FCRA soft-pull consent is captured and written to an immutable, append-only receipt before any bureau call.',
      tag: 'gate',
    },
    {
      d: ICON.engine,
      t: 'Decision engine',
      s: 'A propensity / decision engine fires the consented profile across the configured lender panel in parallel.',
      tag: 'eaze',
    },
    {
      d: ICON.rank,
      t: 'Marketplace ranked',
      s: 'Offers return in seconds and are ranked by lowest total cost — cheapest-first into the offer stack.',
      tag: 'eaze',
    },
    {
      d: ICON.offer,
      t: 'Pre-qualified offers',
      s: 'The consumer sees real pre-qualified offers (e.g. U.S. Bank · Avvance) and selects one — no score impact to shop.',
      tag: 'consumer',
    },
    {
      d: ICON.webhook,
      t: 'Lender drives status',
      s: 'The chosen lender underwrites and POSTs an HMAC-verified webhook; status flows back idempotently.',
      tag: 'lender',
    },
    {
      d: ICON.settle,
      t: 'Settlement & payout',
      s: 'Funds settle lender-direct to the merchant; processing settles via MiCamp. EazePay never touches consumer money.',
      tag: 'eaze',
    },
  ];
  return (
    <section className="ov-section ov-sec-ink">
      <SectionHead
        id="s2"
        num="02"
        kicker="How it works"
        title="Apply → consent → decision → ranked offers → selection → settlement."
        intro="The whole journey is a consented, auditable pipeline. Every step writes an event; the consent
        gate and HMAC webhook verification are fail-closed, so nothing advances without proof."
      />
      <ol className="ov-steps">
        {steps.map((st, i) => (
          <li key={st.t} className={`ov-step ov-tag-${st.tag}`}>
            <div className="ov-step-rail" aria-hidden>
              <span className="ov-step-num">{i + 1}</span>
              {i < steps.length - 1 && <span className="ov-step-line" />}
            </div>
            <div className="ov-step-body">
              <div className="ov-step-ico">
                <Glyph d={st.d} />
              </div>
              <div>
                <div className="ov-step-t">{st.t}</div>
                <p className="ov-step-s">{st.s}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ════════ 3 · WHAT'S INVOLVED ════════ */
function Section3WhatsInvolved(): JSX.Element {
  const surfaces = [
    {
      t: 'Consumer apply flow',
      u: '/apply/<brand>',
      d: 'The branded, single-page intake + offer stack the consumer sees. Soft-pull consent lives here.',
      d2: ICON.apply,
    },
    {
      t: 'Per-brand partner portals',
      u: '/v/<brand>',
      d: 'Each operator’s own portal — send links, watch applications, see settlements + billing in real time.',
      d2: ICON.merchant,
    },
    {
      t: 'Master command center',
      u: '/control-panel',
      d: 'The operator’s mission-control: every application, lender, webhook, queue and audit row across all brands.',
      d2: ICON.operator,
    },
  ];
  const rails = [
    {
      t: '17 backend services',
      d: 'NestJS services on Prisma — auth, PII vault, risk, decision, settlement, audit and more.',
    },
    {
      t: 'Postgres',
      d: 'Multi-tenant system of record with Row-Level Security and an append-only audit chain.',
    },
    {
      t: 'BullMQ · Redis',
      d: 'Durable job queues with dead-letter handling for webhooks, notifications and settlement work.',
    },
    {
      t: 'Transactional outbox',
      d: 'Side-effects committed in the same TX as the write, then drained once — exactly-once.',
    },
    {
      t: 'Settlement rail',
      d: 'Lender-direct payout to the merchant; MiCamp for card processing. EazePay never custodies funds.',
    },
    {
      t: 'OTel tracing',
      d: 'Distributed traces across the BFF and every service for end-to-end observability.',
    },
  ];
  return (
    <section className="ov-section ov-sec-light">
      <SectionHead
        id="s3"
        num="03"
        kicker="What's involved"
        title="The surfaces customers touch — and the rails underneath."
        intro="Three product surfaces sit on top of seventeen backend services and a set of data + money rails
        engineered for correctness: multi-tenant Postgres, durable queues, a transactional outbox and
        a settlement path that never custodies consumer funds."
      />
      <h3 className="ov-subh">Surfaces</h3>
      <div className="ov-surfgrid">
        {surfaces.map((s) => (
          <div key={s.t} className="ov-surfcard">
            <div className="ov-surf-ico">
              <Glyph d={s.d2} />
            </div>
            <div className="ov-surf-u">{s.u}</div>
            <div className="ov-surf-t">{s.t}</div>
            <p className="ov-surf-d">{s.d}</p>
          </div>
        ))}
      </div>

      <h3 className="ov-subh">Data &amp; money rails</h3>
      <div className="ov-railgrid">
        {rails.map((r) => (
          <div key={r.t} className="ov-railcard">
            <div className="ov-rail-t">{r.t}</div>
            <p className="ov-rail-d">{r.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ════════ 4 · THE OUTCOME ════════ */
function Section4Outcome(): JSX.Element {
  const cards = [
    {
      who: 'The merchant',
      d: ICON.merchant,
      accent: '#1F4FE0',
      head: 'More closed sales',
      points: [
        'Financing inside their own branded flow — at the point of sale',
        'High-ticket quotes stop stalling on price',
        'Lender wires the funds direct; no balance-sheet risk to the merchant',
      ],
    },
    {
      who: 'The consumer',
      d: ICON.consumer,
      accent: '#0FB5A6',
      head: 'Shop with no credit hit',
      points: [
        'A single soft-pull — no impact to their credit score to browse',
        'Multiple ranked offers, cheapest total cost first',
        'Clear consent + an immutable receipt of what they agreed to',
      ],
    },
    {
      who: 'EazePay (operator)',
      d: ICON.operator,
      accent: '#8B5CF6',
      head: 'Two revenue streams',
      points: [
        'Referral economics on every funded financing match',
        'ISO residuals on card-processing volume',
        'Asset-light — no lending capital, no fund custody',
      ],
    },
    {
      who: 'The lender',
      d: ICON.lender,
      accent: '#F59E0B',
      head: 'Clean, consented demand',
      points: [
        'Qualified, pre-screened applicants — not cold traffic',
        'Consent + decision trace attached to every referral',
        'Compliant hand-off: FCRA-gated, ECOA-aware adverse-action ready',
      ],
    },
  ];
  return (
    <section className="ov-section ov-sec-ink">
      <SectionHead
        id="s4"
        num="04"
        kicker="The outcome"
        title="Concrete value for every side of the marketplace."
        intro="A two-sided marketplace only works if all four parties win at once. They do — and EazePay’s own
        economics are asset-light, with no lending capital and no custody of consumer funds."
      />
      <div className="ov-outgrid">
        {cards.map((c) => (
          <div key={c.who} className="ov-outcard" style={{ ['--oac' as string]: c.accent }}>
            <div className="ov-out-top">
              <div className="ov-out-ico">
                <Glyph d={c.d} />
              </div>
              <div>
                <div className="ov-out-who">{c.who}</div>
                <div className="ov-out-head">{c.head}</div>
              </div>
            </div>
            <ul className="ov-out-list">
              {c.points.map((p) => (
                <li key={p}>
                  <span className="ov-out-check" aria-hidden>
                    <svg viewBox="0 0 24 24">
                      <path
                        d="M5 13l4 4L19 7"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ════════ 5 · THE AGENT FLEET ════════ */
function Section5Fleet(): JSX.Element {
  return (
    <section className="ov-section ov-sec-light">
      <SectionHead
        id="s5"
        num="05"
        kicker="The agent fleet"
        title="Built and operated by a council of ~62 AI agents — the Hive."
        intro="This is the part that is genuinely different. EazePay is designed, hardened and run by a fleet of
        specialist agents grouped into departments. Each owns a narrow remit — from migrations to
        BSA/AML to settlement reconciliation — and every high-stakes output passes a governance and
        constitutional-critique pass before it ships. Below is a representative subset across the groups."
      />
      <div className="ov-fleet">
        {FLEET.map((dep) => (
          <div key={dep.key} className="ov-fleetcol">
            <div className="ov-fleethead">
              <div className="ov-fleet-label">{dep.label}</div>
              <div className="ov-fleet-blurb">{dep.blurb}</div>
            </div>
            <div className="ov-agentgrid">
              {dep.agents.map((a) => (
                <div key={a.name} className="ov-agent">
                  <div className="ov-agent-dot" aria-hidden />
                  <div className="ov-agent-name">{a.name}</div>
                  <div className="ov-agent-role">{a.role}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="ov-fleetnote">
        Showing {FLEET.reduce((n, d) => n + d.agents.length, 0)} of ~{FLEET_TOTAL} agents. Every
        regulated decision still routes to a human for the items that legally require sign-off — the
        fleet covers the function and produces the evidence; it does not replace the auditor, the
        lawyer or the pentest.
      </div>
    </section>
  );
}

/* ════════ 6 · ARCHITECTURE ════════ */
function Section6Architecture(): JSX.Element {
  return (
    <section className="ov-section ov-sec-ink">
      <SectionHead
        id="s6"
        num="06"
        kicker="Full architecture"
        title="Edge BFF → 17 services → multi-tenant data → external rails."
        intro="A layered, defense-in-depth architecture. A Next.js 14 App Router BFF on Drizzle sits at the
        edge; NestJS services on Prisma own the domains; Postgres holds the system of record behind
        Row-Level Security and an append-only audit chain; Redis + BullMQ move durable work; and a
        transactional outbox guarantees exactly-once side-effects out to MiCamp and the lender panel."
      />

      <ArchDiagram />

      <div className="ov-arch-detailgrid">
        <div className="ov-arch-detail">
          <h4 className="ov-arch-dh">Edge · BFF</h4>
          <p className="ov-arch-dp">
            <code>apps/partner-portal</code> — Next.js 14 App Router on Drizzle ORM. Renders the
            consumer apply flow, the per-brand portals and the command center; enforces security
            headers (HSTS, frame-deny, nosniff) on every route.
          </p>
        </div>
        <div className="ov-arch-detail">
          <h4 className="ov-arch-dh">Services · domain</h4>
          <p className="ov-arch-dp">
            17 NestJS services on Prisma: auth, user (PII vault), merchant (KYB), risk, decision /
            orchestration, payment, settlement, lender, compliance-doc (adverse-action), audit,
            notification, webhook, events, billing, admin, application, email.
          </p>
        </div>
        <div className="ov-arch-detail">
          <h4 className="ov-arch-dh">Data · state</h4>
          <p className="ov-arch-dp">
            Postgres (multi-tenant, <strong>Row-Level Security</strong>, append-only audit via
            REVOKE + triggers), Redis + <strong>BullMQ</strong> (queues + DLQ), a{' '}
            <strong>transactional outbox</strong> for exactly-once side-effects, OTel tracing
            throughout.
          </p>
        </div>
        <div className="ov-arch-detail">
          <h4 className="ov-arch-dh">Integrations · rails</h4>
          <p className="ov-arch-dp">
            MiCamp (card processing), HighSale (sub-accounts), versioned lender adapters, and
            financing partners such as U.S. Bank · Avvance — each behind an idempotent,
            HMAC-verified contract.
          </p>
        </div>
      </div>

      <div className="ov-seclayer">
        <div className="ov-seclayer-h">
          <span className="ov-lock" aria-hidden>
            <svg viewBox="0 0 24 24">
              <path
                d="M6 11V8a6 6 0 1112 0v3M5 11h14v9H5z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          Security model
        </div>
        <div className="ov-secgrid">
          {[
            {
              t: 'Per-row envelope encryption',
              d: 'AES-256-GCM with a KEK/DEK hierarchy. PII is encrypted at rest per row, masked by default on read; unmask needs a reason code + a per-read audit entry.',
            },
            {
              t: 'Fail-closed HMAC webhooks',
              d: 'Inbound lender webhooks are HMAC-verified and idempotent via an inbox; an unsigned or replayed event is rejected, never processed.',
            },
            {
              t: 'KMS adapter + S3 WORM sink',
              d: 'A KMS port wraps the data keys and a WORM (write-once) S3 audit sink is wired — built for the AWS cutover without changing the app.',
            },
            {
              t: 'Append-only audit chain',
              d: 'Every regulated mutation writes a hash-chained audit row in the same transaction; the table is REVOKE-locked against UPDATE/DELETE.',
            },
          ].map((s) => (
            <div key={s.t} className="ov-seccard">
              <div className="ov-sec-t">{s.t}</div>
              <p className="ov-sec-d">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ArchDiagram(): JSX.Element {
  return (
    <div className="ov-arch">
      {/* EDGE */}
      <div className="ov-layer ov-layer-edge">
        <div className="ov-layer-tag">Edge · BFF</div>
        <div className="ov-layer-row">
          <div className="ov-node ov-node-edge">
            <span className="ov-node-k">Next.js 14 App Router</span>
            <span className="ov-node-s">Drizzle ORM · security headers</span>
          </div>
          <div className="ov-node ov-node-edge">
            <span className="ov-node-k">/apply · /v/&lt;brand&gt; · /control-panel</span>
            <span className="ov-node-s">consumer · partner · operator surfaces</span>
          </div>
        </div>
      </div>

      <LayerConnector label="HTTPS · authN · RLS tenant context set per request" />

      {/* SERVICES */}
      <div className="ov-layer ov-layer-svc">
        <div className="ov-layer-tag">17 NestJS services · Prisma</div>
        <div className="ov-svcwrap">
          {SERVICES_17.map((s) => (
            <span key={s} className="ov-svc">
              {s}
            </span>
          ))}
        </div>
      </div>

      <LayerConnector label="same-TX writes + transactional outbox · BullMQ jobs" />

      {/* DATA */}
      <div className="ov-layer ov-layer-data">
        <div className="ov-layer-tag">Data &amp; state</div>
        <div className="ov-layer-row">
          <div className="ov-node ov-node-data">
            <span className="ov-node-k">Postgres</span>
            <span className="ov-node-s">multi-tenant · RLS · append-only audit</span>
          </div>
          <div className="ov-node ov-node-data">
            <span className="ov-node-k">Redis · BullMQ</span>
            <span className="ov-node-s">queues · DLQ · idempotency</span>
          </div>
          <div className="ov-node ov-node-data">
            <span className="ov-node-k">Outbox</span>
            <span className="ov-node-s">exactly-once side-effects</span>
          </div>
          <div className="ov-node ov-node-data">
            <span className="ov-node-k">KMS · S3 WORM</span>
            <span className="ov-node-s">key-wrap · immutable audit sink</span>
          </div>
        </div>
      </div>

      <LayerConnector label="idempotent · HMAC-signed adapter contracts" />

      {/* INTEGRATIONS */}
      <div className="ov-layer ov-layer-int">
        <div className="ov-layer-tag">External rails</div>
        <div className="ov-layer-row">
          <div className="ov-node ov-node-int">
            <span className="ov-node-k">MiCamp</span>
            <span className="ov-node-s">card processing · settlement</span>
          </div>
          <div className="ov-node ov-node-int">
            <span className="ov-node-k">HighSale</span>
            <span className="ov-node-s">sub-accounts</span>
          </div>
          <div className="ov-node ov-node-int">
            <span className="ov-node-k">Lender adapters</span>
            <span className="ov-node-s">U.S. Bank · Avvance · panel</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function LayerConnector({ label }: { label: string }): JSX.Element {
  return (
    <div className="ov-connector" aria-hidden>
      <svg viewBox="0 0 40 48" className="ov-connector-svg">
        <defs>
          <marker
            id={`ov-arrow-${label.length}`}
            viewBox="0 0 10 10"
            refX="5"
            refY="9"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M0,0 L5,10 L10,0 z" fill="currentColor" />
          </marker>
        </defs>
        <line
          x1="20"
          y1="2"
          x2="20"
          y2="42"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="3 4"
          markerEnd={`url(#ov-arrow-${label.length})`}
        />
      </svg>
      <span className="ov-connector-label">{label}</span>
    </div>
  );
}

/* ════════ 7 · THE FLOW ════════ */
type LaneKind = 'consumer' | 'eaze' | 'lender';
interface SeqLane {
  actor: string;
  kind: LaneKind;
}
interface SeqEvent {
  lane: 0 | 1 | 2;
  t: string;
  sub: string;
  check: string | null;
}

function Section7Flow(): JSX.Element {
  const lane: readonly [SeqLane, SeqLane, SeqLane] = [
    { actor: 'Consumer', kind: 'consumer' },
    { actor: 'EazePay platform', kind: 'eaze' },
    { actor: 'Lender', kind: 'lender' },
  ];
  // Each event: which lane, label, optional checkpoint badge.
  const events: readonly SeqEvent[] = [
    { lane: 0, t: 'POST /apply/<brand>', sub: 'intake submitted', check: null },
    {
      lane: 1,
      t: 'Consent gate',
      sub: 'FCRA soft-pull consent',
      check: 'CONSENT GATE · fail-closed',
    },
    { lane: 1, t: 'OFAC / sanctions screen', sub: 'BSA/AML check', check: 'OFAC SCREEN' },
    { lane: 1, t: 'Decision engine', sub: 'parallel lender quote', check: 'RLS BOUNDARY' },
    { lane: 1, t: 'Marketplace ranked', sub: 'lowest total cost first', check: null },
    { lane: 0, t: 'Offer selected', sub: 'consumer picks', check: null },
    { lane: 2, t: 'Lender underwrites', sub: 'approve · decline · fund', check: null },
    { lane: 2, t: 'Webhook → EazePay', sub: 'HMAC-verified · inbox', check: 'IDEMPOTENT · HMAC' },
    { lane: 1, t: 'Outbox event', sub: 'same-TX, drained once', check: 'EXACTLY-ONCE' },
    { lane: 2, t: 'Settlement → merchant', sub: 'lender-direct payout', check: null },
    {
      lane: 1,
      t: 'Audit row written',
      sub: 'hash-chained, append-only',
      check: 'APPEND-ONLY AUDIT',
    },
  ];
  return (
    <section className="ov-section ov-sec-light">
      <SectionHead
        id="s7"
        num="07"
        kicker="The flow"
        title="One request, traced end-to-end — with the compliance checkpoints inline."
        intro="This is the same journey as section 2, drawn as a request / event / money sequence across three
        lanes. The amber badges are the trust + compliance checkpoints that gate the flow: nothing
        proceeds past the consent gate, the OFAC screen or the HMAC check unless it passes."
      />
      <div className="ov-seq">
        <div className="ov-seq-lanes" aria-hidden>
          {lane.map((l) => (
            <div key={l.actor} className={`ov-seqlane ov-seqlane-${l.kind}`}>
              <span className="ov-seqlane-dot" />
              {l.actor}
            </div>
          ))}
        </div>
        <div className="ov-seq-track">
          {events.map((e, i) => (
            <div key={i} className="ov-seqstep">
              <div className={`ov-seqrow ov-seqrow-${lane[e.lane].kind} ov-pos-${e.lane}`}>
                <div className="ov-seqcard">
                  <div className="ov-seqcard-t">{e.t}</div>
                  <div className="ov-seqcard-s">{e.sub}</div>
                  {e.check && <div className="ov-seqcheck">{e.check}</div>}
                </div>
              </div>
              {i < events.length - 1 && (
                <div className="ov-seqarrow" aria-hidden>
                  <svg viewBox="0 0 24 28">
                    <path
                      d="M12 2v20M6 16l6 6 6-6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ════════ 8 · DEPARTMENTS + POSITIONS ════════ */
function Section8Departments(): JSX.Element {
  return (
    <section className="ov-section ov-sec-ink">
      <SectionHead
        id="s8"
        num="08"
        kicker="Departments & positions covered"
        title="The org chart the agent fleet stands in for."
        intro="Mapped honestly: the fleet covers the function and accelerates the role, producing the evidence
        and the artifacts. The right-hand column is what stays with a human — the items that legally
        require sign-off, which is exactly the SOC 2 readiness punch-list."
      />
      <div className="ov-tablewrap">
        <table className="ov-table">
          <thead>
            <tr>
              <th>Department</th>
              <th>Positions covered</th>
              <th>Lead agents</th>
              <th>Human sign-off</th>
            </tr>
          </thead>
          <tbody>
            {DEPT_TABLE.map((r) => (
              <tr key={r.dept}>
                <td className="ov-td-dept">{r.dept}</td>
                <td>{r.positions}</td>
                <td className="ov-td-agents">{r.agents}</td>
                <td className="ov-td-human">{r.human}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ov-compliance">
        <div className="ov-compliance-h">Where we actually stand — stated plainly</div>
        <div className="ov-compgrid">
          {[
            {
              k: 'PCI DSS',
              v: 'Out of scope — SAQ A. No PAN/CVV touches the platform; opaque tokens only.',
              tone: 'ok',
            },
            {
              k: 'FCRA consent',
              v: 'Enforced at every decision boundary, with an append-only consent receipt.',
              tone: 'ok',
            },
            {
              k: 'Reg B (ECOA)',
              v: 'Adverse-action codes mapped to CFPB model-form taxonomy from the decision trace.',
              tone: 'ok',
            },
            {
              k: 'Encryption',
              v: 'Bank-grade per-row AES-256-GCM envelope encryption; masked by default on read.',
              tone: 'ok',
            },
            {
              k: 'Audit',
              v: 'Immutable, hash-chained, append-only — REVOKE-locked against mutation.',
              tone: 'ok',
            },
            {
              k: 'Multi-tenancy',
              v: 'Postgres Row-Level Security enforces per-tenant isolation at the database.',
              tone: 'ok',
            },
            {
              k: 'CI',
              v: 'Green pipeline — typecheck, tests and security scans gate every merge.',
              tone: 'ok',
            },
            {
              k: 'SOC 2',
              v: 'Readiness program in progress — Type I targeted. Not yet certified. External pentest + counsel review pending.',
              tone: 'wip',
            },
          ].map((c) => (
            <div key={c.k} className={`ov-comprow ov-comp-${c.tone}`}>
              <div className="ov-comp-k">
                <span className="ov-comp-badge" aria-hidden>
                  {c.tone === 'ok' ? '✓' : '◷'}
                </span>
                {c.k}
              </div>
              <div className="ov-comp-v">{c.v}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────── Closing ─────────────────────────── */
function ClosingBand(): JSX.Element {
  return (
    <footer className="ov-closing">
      <div className="ov-closing-glow" aria-hidden />
      <div className="ov-closing-inner">
        <div className="ov-closing-mark">
          <span className="ov-mark ov-mark-lg">E</span>
        </div>
        <h2 className="ov-closing-h">
          One platform. Two regulated businesses. A council that runs it.
        </h2>
        <p className="ov-closing-p">
          A card-processing ISO and an FCRA soft-pull lender marketplace — asset-light,
          multi-tenant, audited end-to-end, and operated by ~{FLEET_TOTAL} AI agents with humans on
          the controls that matter.
        </p>
        <div className="ov-closing-actions">
          <a className="ov-cta ov-cta-primary" href={`${PORTAL}/platform/flow`}>
            See the full flow
          </a>
          <a className="ov-cta ov-cta-ghost" href={`${PORTAL}/security-overview`}>
            Security &amp; compliance
          </a>
        </div>
        <div className="ov-closing-fine">
          EazePay is not a lender. We connect consumers with financing partners. Compliance posture
          stated as of today; SOC 2 readiness in progress, not certified.
        </div>
      </div>
    </footer>
  );
}

/* ════════════════════════════════════════════════════════════════════
 * STYLES
 * ════════════════════════════════════════════════════════════════════ */
function OvStyles(): JSX.Element {
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />;
}

const CSS = `
.ov-root {
  --ink: #0B0E14;
  --ink-2: #11151F;
  --ink-3: #161B27;
  --paper: #FFFFFF;
  --paper-2: #F6F8FC;
  --line: #E4E9F2;
  --line-ink: rgba(255,255,255,0.10);
  --fg: #0E1116;
  --fg-2: #45506A;
  --fg-3: #6B7793;
  --on-ink: #EAF0FB;
  --on-ink-2: #A9B6D2;
  --on-ink-3: #6E7C9C;

  --brand: #1F4FE0;
  --brand-2: #3D6BFF;
  --brand-soft: #E9EFFF;
  --teal: #0FB5A6;
  --violet: #8B5CF6;
  --amber: #F59E0B;

  --con: #0FB5A6;   /* consumer */
  --eaze: #3D6BFF;  /* eaze */
  --len: #F59E0B;   /* lender */
  --gate: #F59E0B;  /* checkpoint */

  background: var(--paper);
  color: var(--fg);
  font-family: var(--font-inter), Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  overflow-x: hidden;
}
.ov-root *, .ov-root *::before, .ov-root *::after { box-sizing: border-box; }
.ov-root a { color: inherit; text-decoration: none; }
.ov-glyph { width: 100%; height: 100%; display: block; }
.ov-mark {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border-radius: 8px;
  background: linear-gradient(135deg, var(--brand) 0%, var(--violet) 120%);
  color: #fff; font-weight: 800; font-size: 15px; letter-spacing: -0.04em;
  box-shadow: 0 4px 14px -4px rgba(31,79,224,0.7);
}

/* ───────────── BACK BAR ───────────── */
.ov-backbar {
  position: sticky; top: 0; z-index: 50;
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 22px;
  background: rgba(11,14,20,0.82);
  backdrop-filter: saturate(140%) blur(12px);
  border-bottom: 1px solid var(--line-ink);
}
.ov-back {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 14px 8px 11px; border-radius: 999px;
  font-size: 13px; font-weight: 650; color: var(--on-ink);
  border: 1px solid rgba(255,255,255,0.14);
  background: rgba(255,255,255,0.04);
  transition: background .18s ease, border-color .18s ease, transform .18s ease;
}
.ov-back:hover { background: rgba(255,255,255,0.10); border-color: rgba(255,255,255,0.28); transform: translateX(-2px); }
.ov-back-ico { width: 16px; height: 16px; }
.ov-backbrand {
  display: inline-flex; align-items: center; gap: 9px;
  font-size: 14px; font-weight: 750; letter-spacing: -0.01em; color: var(--on-ink);
}

/* ───────────── HERO ───────────── */
.ov-hero {
  position: relative; overflow: hidden;
  background: radial-gradient(120% 90% at 50% -10%, #16203A 0%, var(--ink) 46%, #070A10 100%);
  color: var(--on-ink);
  padding: 88px 24px 100px;
}
.ov-hero-grid {
  position: absolute; inset: 0; opacity: 0.5;
  background-image:
    linear-gradient(rgba(120,150,230,0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(120,150,230,0.08) 1px, transparent 1px);
  background-size: 46px 46px;
  mask-image: radial-gradient(120% 80% at 50% 0%, #000 30%, transparent 78%);
  -webkit-mask-image: radial-gradient(120% 80% at 50% 0%, #000 30%, transparent 78%);
}
.ov-hero-glow {
  position: absolute; inset: 0; pointer-events: none;
  background:
    radial-gradient(40% 50% at 18% 8%, rgba(31,79,224,0.30) 0%, transparent 62%),
    radial-gradient(42% 48% at 86% 18%, rgba(139,92,246,0.26) 0%, transparent 64%),
    radial-gradient(30% 38% at 70% 96%, rgba(15,181,166,0.16) 0%, transparent 66%);
}
.ov-hero-inner { position: relative; z-index: 1; max-width: 1080px; margin: 0 auto; text-align: center; }
.ov-eyebrow {
  display: inline-flex; align-items: center; gap: 9px;
  padding: 7px 15px; border-radius: 999px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.14);
  font-size: 11.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
  color: #BBC8EA;
}
.ov-eyebrow-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--teal); box-shadow: 0 0 0 4px rgba(15,181,166,0.22); }
.ov-h1 {
  margin: 26px auto 20px; max-width: 940px;
  font-size: clamp(34px, 5.4vw, 60px); font-weight: 820;
  line-height: 1.04; letter-spacing: -0.03em;
}
.ov-h1-grad {
  display: block; margin-top: 6px;
  font-size: clamp(19px, 2.6vw, 30px); font-weight: 600; letter-spacing: -0.015em;
  line-height: 1.22;
  background: linear-gradient(100deg, #8FB0FF 0%, #C6A6FF 52%, #6FE6DA 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.ov-lede {
  max-width: 760px; margin: 0 auto 28px;
  font-size: 16.5px; line-height: 1.62; color: var(--on-ink-2);
}
.ov-hero-pills { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-bottom: 40px; }
.ov-hpill {
  padding: 7px 14px; border-radius: 999px;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12);
  font-size: 12.5px; font-weight: 600; color: #CFD9F2;
}
.ov-hero-stats {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px;
  max-width: 820px; margin: 0 auto 40px;
}
.ov-hstat {
  padding: 18px 14px; border-radius: 16px;
  background: rgba(255,255,255,0.045);
  border: 1px solid rgba(255,255,255,0.10);
}
.ov-hstat-k {
  font-size: clamp(18px, 2.4vw, 26px); font-weight: 800; letter-spacing: -0.02em;
  background: linear-gradient(120deg, #fff 0%, #9DB4EC 130%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.ov-hstat-v { margin-top: 5px; font-size: 11.5px; font-weight: 600; color: var(--on-ink-3); line-height: 1.3; }
.ov-toc { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
.ov-toc-link {
  padding: 8px 14px; border-radius: 999px;
  font-size: 12.5px; font-weight: 650; color: #C2CEEC;
  border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.03);
  transition: background .16s ease, color .16s ease, border-color .16s ease;
}
.ov-toc-link:hover { background: var(--brand); color: #fff; border-color: var(--brand); }

/* ───────────── SECTION SHELL ───────────── */
.ov-section { padding: 84px 24px; }
.ov-sec-light { background: var(--paper); }
.ov-sec-light:nth-of-type(even) { background: var(--paper-2); }
.ov-sec-ink {
  background:
    radial-gradient(60% 60% at 12% 0%, rgba(31,79,224,0.16) 0%, transparent 60%),
    radial-gradient(50% 50% at 92% 8%, rgba(139,92,246,0.14) 0%, transparent 62%),
    var(--ink);
  color: var(--on-ink);
}
.ov-shead { max-width: 880px; margin: 0 auto 48px; }
.ov-skicker {
  display: inline-flex; align-items: center; gap: 11px;
  font-size: 12px; font-weight: 750; letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--brand-2);
}
.ov-sec-ink .ov-skicker { color: #93AAF2; }
.ov-snum {
  display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border-radius: 9px;
  background: var(--brand-soft); color: var(--brand);
  font-size: 12px; font-weight: 800; letter-spacing: 0;
}
.ov-sec-ink .ov-snum { background: rgba(31,79,224,0.22); color: #B9CBFF; }
.ov-stitle {
  margin: 18px 0 14px; font-size: clamp(26px, 3.6vw, 38px);
  font-weight: 800; line-height: 1.12; letter-spacing: -0.026em;
}
.ov-sintro { margin: 0; font-size: 16px; line-height: 1.62; color: var(--fg-2); max-width: 800px; }
.ov-sec-ink .ov-sintro { color: var(--on-ink-2); }
.ov-subh {
  margin: 48px 0 20px; font-size: 13px; font-weight: 750;
  letter-spacing: 0.12em; text-transform: uppercase; color: var(--fg-3);
}
.ov-sec-ink .ov-subh { color: var(--on-ink-3); }

/* ───────────── 1 · WHAT IT IS ───────────── */
.ov-isgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
.ov-iscard {
  position: relative; padding: 28px; border-radius: 20px;
  background: var(--paper); border: 1px solid var(--line);
  box-shadow: 0 18px 44px -28px rgba(15,23,42,0.20);
  overflow: hidden;
}
.ov-iscard::before {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 5px;
  background: linear-gradient(180deg, var(--brand), var(--brand-2));
}
.ov-iscard-tag {
  display: inline-block; padding: 5px 11px; border-radius: 999px;
  font-size: 11px; font-weight: 750; letter-spacing: 0.06em;
  background: var(--brand-soft); color: var(--brand); margin-bottom: 14px;
}
.ov-iscard-tag-b { background: #EFE9FF; color: var(--violet); }
.ov-iscard:nth-child(2)::before { background: linear-gradient(180deg, var(--violet), #A98BFF); }
.ov-iscard-h { margin: 0 0 10px; font-size: 21px; font-weight: 780; letter-spacing: -0.02em; }
.ov-iscard-p { margin: 0; font-size: 14.5px; line-height: 1.6; color: var(--fg-2); }
.ov-iscard-p strong { color: var(--fg); font-weight: 700; }

.ov-problem {
  display: flex; gap: 20px; align-items: flex-start;
  margin-top: 24px; padding: 26px 28px; border-radius: 20px;
  background: linear-gradient(120deg, #0E1116 0%, #182238 100%);
  color: var(--on-ink);
}
.ov-problem-bar { flex-shrink: 0; width: 4px; align-self: stretch; border-radius: 4px;
  background: linear-gradient(180deg, var(--teal), var(--brand-2)); }
.ov-problem-h { font-size: 12px; font-weight: 750; letter-spacing: 0.14em; text-transform: uppercase; color: #6FE6DA; margin-bottom: 9px; }
.ov-problem-p { margin: 0; font-size: 15.5px; line-height: 1.62; color: var(--on-ink-2); }

.ov-vgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.ov-vcard {
  position: relative; padding: 26px 24px; border-radius: 18px;
  background: var(--paper); border: 1px solid var(--line);
  transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
}
.ov-vcard:hover { transform: translateY(-4px); border-color: var(--vac); box-shadow: 0 22px 44px -26px color-mix(in srgb, var(--vac) 60%, transparent); }
.ov-vcard-ico {
  width: 46px; height: 46px; padding: 11px; border-radius: 13px; margin-bottom: 16px;
  color: var(--vac); background: color-mix(in srgb, var(--vac) 12%, white);
}
.ov-vcard-code { font-size: 19px; font-weight: 800; letter-spacing: -0.02em; color: var(--fg); }
.ov-vcard-who { font-size: 12.5px; font-weight: 700; color: var(--vac); margin: 3px 0 12px; letter-spacing: 0.01em; }
.ov-vcard-copy { margin: 0; font-size: 14px; line-height: 1.55; color: var(--fg-2); }

/* ───────────── 2 · HOW IT WORKS (steps) ───────────── */
.ov-steps { list-style: none; margin: 0; padding: 0; max-width: 880px; }
.ov-step { display: flex; gap: 20px; }
.ov-step-rail { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
.ov-step-num {
  display: inline-flex; align-items: center; justify-content: center;
  width: 38px; height: 38px; border-radius: 12px; flex-shrink: 0;
  font-size: 15px; font-weight: 800;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14); color: #fff;
}
.ov-step-line { width: 2px; flex: 1; min-height: 26px; margin: 6px 0;
  background: linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.04)); }
.ov-step-body { display: flex; gap: 16px; padding-bottom: 26px; align-items: flex-start; }
.ov-step-ico {
  width: 44px; height: 44px; padding: 11px; border-radius: 12px; flex-shrink: 0;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.10); color: #B9CBFF;
}
.ov-tag-consumer .ov-step-num, .ov-tag-consumer .ov-step-ico { color: #6FE6DA; border-color: rgba(15,181,166,0.45); }
.ov-tag-eaze .ov-step-num, .ov-tag-eaze .ov-step-ico { color: #9DB4FF; border-color: rgba(61,107,255,0.45); }
.ov-tag-lender .ov-step-num, .ov-tag-lender .ov-step-ico { color: #FBD38D; border-color: rgba(245,158,11,0.45); }
.ov-tag-gate .ov-step-num, .ov-tag-gate .ov-step-ico { color: #FBD38D; border-color: rgba(245,158,11,0.55); background: rgba(245,158,11,0.10); }
.ov-step-t { font-size: 17px; font-weight: 750; letter-spacing: -0.015em; margin-bottom: 4px; color: #fff; }
.ov-step-s { margin: 0; font-size: 14.5px; line-height: 1.55; color: var(--on-ink-2); }

/* ───────────── 3 · SURFACES + RAILS ───────────── */
.ov-surfgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.ov-surfcard {
  padding: 26px 24px; border-radius: 18px;
  background: var(--paper); border: 1px solid var(--line);
  transition: transform .2s ease, box-shadow .2s ease;
}
.ov-surfcard:hover { transform: translateY(-3px); box-shadow: 0 20px 40px -28px rgba(31,79,224,0.5); }
.ov-surf-ico { width: 44px; height: 44px; padding: 11px; border-radius: 12px; margin-bottom: 16px; color: var(--brand); background: var(--brand-soft); }
.ov-surf-u {
  display: inline-block; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px; font-weight: 600; color: var(--brand);
  background: var(--brand-soft); padding: 3px 9px; border-radius: 7px; margin-bottom: 10px;
}
.ov-surf-t { font-size: 17px; font-weight: 750; letter-spacing: -0.015em; margin-bottom: 8px; }
.ov-surf-d { margin: 0; font-size: 14px; line-height: 1.55; color: var(--fg-2); }
.ov-railgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.ov-railcard { padding: 20px; border-radius: 14px; background: var(--paper); border: 1px solid var(--line); }
.ov-rail-t { font-size: 14.5px; font-weight: 750; margin-bottom: 6px; color: var(--fg); }
.ov-rail-d { margin: 0; font-size: 13.5px; line-height: 1.5; color: var(--fg-2); }

/* ───────────── 4 · OUTCOME ───────────── */
.ov-outgrid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 22px; }
.ov-outcard {
  position: relative; padding: 28px; border-radius: 20px;
  background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.10);
  overflow: hidden;
}
.ov-outcard::before {
  content: ''; position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(60% 80% at 0% 0%, color-mix(in srgb, var(--oac) 16%, transparent) 0%, transparent 60%);
}
.ov-out-top { display: flex; gap: 15px; align-items: center; margin-bottom: 18px; position: relative; }
.ov-out-ico {
  width: 48px; height: 48px; padding: 12px; border-radius: 13px; flex-shrink: 0;
  color: var(--oac); background: color-mix(in srgb, var(--oac) 18%, transparent);
  border: 1px solid color-mix(in srgb, var(--oac) 40%, transparent);
}
.ov-out-who { font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--on-ink-3); }
.ov-out-head { font-size: 20px; font-weight: 800; letter-spacing: -0.02em; color: #fff; margin-top: 3px; }
.ov-out-list { list-style: none; margin: 0; padding: 0; position: relative; }
.ov-out-list li { display: flex; gap: 11px; align-items: flex-start; padding: 8px 0;
  font-size: 14.5px; line-height: 1.5; color: var(--on-ink-2); border-top: 1px solid rgba(255,255,255,0.07); }
.ov-out-list li:first-child { border-top: none; }
.ov-out-check { flex-shrink: 0; width: 19px; height: 19px; margin-top: 1px; color: var(--oac); }
.ov-out-check svg { width: 100%; height: 100%; }

/* ───────────── 5 · FLEET ───────────── */
.ov-fleet { display: flex; flex-direction: column; gap: 30px; }
.ov-fleetcol {
  padding: 26px; border-radius: 20px;
  background: var(--paper); border: 1px solid var(--line);
  box-shadow: 0 16px 40px -30px rgba(15,23,42,0.22);
}
.ov-fleethead { margin-bottom: 18px; padding-bottom: 16px; border-bottom: 1px dashed var(--line); }
.ov-fleet-label { font-size: 17px; font-weight: 800; letter-spacing: -0.015em; color: var(--fg); }
.ov-fleet-blurb { font-size: 13.5px; color: var(--fg-2); margin-top: 4px; line-height: 1.45; }
.ov-agentgrid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.ov-agent {
  position: relative; padding: 14px 14px 14px 16px; border-radius: 13px;
  background: var(--paper-2); border: 1px solid var(--line);
  transition: transform .16s ease, border-color .16s ease, background .16s ease;
}
.ov-agent:hover { transform: translateY(-2px); border-color: var(--brand); background: #fff; }
.ov-agent-dot { position: absolute; left: 14px; top: 18px; width: 7px; height: 7px; border-radius: 50%;
  background: var(--brand); box-shadow: 0 0 0 3px var(--brand-soft); }
.ov-agent-name {
  padding-left: 16px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12.5px; font-weight: 650; color: var(--fg); letter-spacing: -0.01em;
}
.ov-agent-role { margin-top: 5px; font-size: 12px; line-height: 1.4; color: var(--fg-2); }
.ov-fleetnote {
  margin-top: 26px; padding: 18px 22px; border-radius: 14px;
  background: var(--brand-soft); border: 1px solid #CFDCFF;
  font-size: 13.5px; line-height: 1.55; color: #1B3A8A;
}

/* ───────────── 6 · ARCHITECTURE ───────────── */
.ov-arch { max-width: 1000px; margin: 0 auto; }
.ov-layer {
  position: relative; padding: 22px; border-radius: 18px;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(255,255,255,0.035);
}
.ov-layer-tag {
  display: inline-block; margin-bottom: 16px; padding: 5px 12px; border-radius: 999px;
  font-size: 11px; font-weight: 750; letter-spacing: 0.1em; text-transform: uppercase;
}
.ov-layer-edge { background: rgba(31,79,224,0.10); border-color: rgba(31,79,224,0.32); }
.ov-layer-edge .ov-layer-tag { background: rgba(61,107,255,0.22); color: #BACBFF; }
.ov-layer-svc { background: rgba(139,92,246,0.08); border-color: rgba(139,92,246,0.28); }
.ov-layer-svc .ov-layer-tag { background: rgba(139,92,246,0.22); color: #D6C6FF; }
.ov-layer-data { background: rgba(15,181,166,0.08); border-color: rgba(15,181,166,0.28); }
.ov-layer-data .ov-layer-tag { background: rgba(15,181,166,0.20); color: #8FECDF; }
.ov-layer-int { background: rgba(245,158,11,0.08); border-color: rgba(245,158,11,0.28); }
.ov-layer-int .ov-layer-tag { background: rgba(245,158,11,0.20); color: #FBD89B; }
.ov-layer-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; }
.ov-node {
  display: flex; flex-direction: column; gap: 3px;
  padding: 15px 16px; border-radius: 12px;
  background: rgba(8,11,18,0.55); border: 1px solid rgba(255,255,255,0.10);
}
.ov-node-k { font-size: 14px; font-weight: 720; color: #fff; letter-spacing: -0.01em; }
.ov-node-s { font-size: 11.5px; color: var(--on-ink-3); line-height: 1.35; }
.ov-node-edge .ov-node-k { color: #CDD9FF; }
.ov-node-data .ov-node-k { color: #B6F0E7; }
.ov-node-int .ov-node-k { color: #FCE3B4; }
.ov-svcwrap { display: flex; flex-wrap: wrap; gap: 9px; }
.ov-svc {
  padding: 8px 13px; border-radius: 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12.5px; font-weight: 600; color: #E2D9FF;
  background: rgba(139,92,246,0.14); border: 1px solid rgba(139,92,246,0.30);
}
.ov-connector { display: flex; flex-direction: column; align-items: center; padding: 4px 0; color: rgba(180,196,236,0.7); }
.ov-connector-svg { width: 40px; height: 44px; }
.ov-connector-label { margin-top: 2px; font-size: 11.5px; font-style: italic; color: var(--on-ink-3); text-align: center; max-width: 460px; }

.ov-arch-detailgrid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; max-width: 1000px; margin: 36px auto 0; }
.ov-arch-detail { padding: 20px 22px; border-radius: 14px; background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.10); }
.ov-arch-dh { margin: 0 0 8px; font-size: 12px; font-weight: 750; letter-spacing: 0.1em; text-transform: uppercase; color: #93AAF2; }
.ov-arch-dp { margin: 0; font-size: 13.5px; line-height: 1.58; color: var(--on-ink-2); }
.ov-arch-dp code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: #B6F0E7; background: rgba(15,181,166,0.12); padding: 1px 6px; border-radius: 6px; }
.ov-arch-dp strong { color: #fff; font-weight: 700; }

.ov-seclayer { max-width: 1000px; margin: 36px auto 0; padding: 28px; border-radius: 20px;
  background: rgba(8,11,18,0.5); border: 1px solid rgba(255,255,255,0.10); }
.ov-seclayer-h { display: flex; align-items: center; gap: 11px; font-size: 16px; font-weight: 800; letter-spacing: -0.01em; margin-bottom: 20px; color: #fff; }
.ov-lock { width: 28px; height: 28px; padding: 4px; border-radius: 9px; color: #6FE6DA; background: rgba(15,181,166,0.14); }
.ov-lock svg { width: 100%; height: 100%; }
.ov-secgrid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
.ov-seccard { padding: 18px 20px; border-radius: 13px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); }
.ov-sec-t { font-size: 14px; font-weight: 720; color: #fff; margin-bottom: 6px; }
.ov-sec-d { margin: 0; font-size: 13px; line-height: 1.55; color: var(--on-ink-2); }

/* ───────────── 7 · SEQUENCE FLOW ───────────── */
.ov-seq { max-width: 920px; margin: 0 auto; }
.ov-seq-lanes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 8px; position: sticky; top: 56px; z-index: 5; }
.ov-seqlane {
  display: flex; align-items: center; gap: 8px; justify-content: center;
  padding: 11px; border-radius: 12px; font-size: 13px; font-weight: 750;
  background: var(--paper); border: 1px solid var(--line);
}
.ov-seqlane-dot { width: 9px; height: 9px; border-radius: 50%; }
.ov-seqlane-consumer { color: #0A857A; } .ov-seqlane-consumer .ov-seqlane-dot { background: var(--con); }
.ov-seqlane-eaze { color: var(--brand); } .ov-seqlane-eaze .ov-seqlane-dot { background: var(--eaze); }
.ov-seqlane-lender { color: #B45309; } .ov-seqlane-lender .ov-seqlane-dot { background: var(--len); }
.ov-seq-track { position: relative; }
.ov-seqstep { display: flex; flex-direction: column; align-items: center; }
.ov-seqrow { display: grid; grid-template-columns: repeat(3, 1fr); width: 100%; }
.ov-pos-0 .ov-seqcard { grid-column: 1; }
.ov-pos-1 .ov-seqcard { grid-column: 2; }
.ov-pos-2 .ov-seqcard { grid-column: 3; }
.ov-seqcard {
  padding: 14px 16px; border-radius: 13px;
  background: var(--paper); border: 1px solid var(--line);
  box-shadow: 0 10px 26px -20px rgba(15,23,42,0.25);
}
.ov-seqrow-consumer .ov-seqcard { border-left: 4px solid var(--con); }
.ov-seqrow-eaze .ov-seqcard { border-left: 4px solid var(--eaze); }
.ov-seqrow-lender .ov-seqcard { border-left: 4px solid var(--len); }
.ov-seqcard-t { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; font-weight: 680; color: var(--fg); letter-spacing: -0.01em; }
.ov-seqcard-s { font-size: 12.5px; color: var(--fg-2); margin-top: 3px; }
.ov-seqcheck {
  display: inline-block; margin-top: 9px; padding: 4px 9px; border-radius: 7px;
  font-size: 10px; font-weight: 750; letter-spacing: 0.06em;
  background: #FFF4DE; color: #92400E; border: 1px solid #F6D58A;
}
.ov-seqarrow { color: var(--brand-2); opacity: 0.65; padding: 1px 0; }
.ov-seqarrow svg { width: 22px; height: 26px; }

/* ───────────── 8 · DEPARTMENTS TABLE ───────────── */
.ov-tablewrap { overflow-x: auto; border-radius: 18px; border: 1px solid rgba(255,255,255,0.10); }
.ov-table { width: 100%; border-collapse: collapse; min-width: 720px; }
.ov-table thead th {
  text-align: left; padding: 16px 18px; font-size: 11px; font-weight: 750;
  letter-spacing: 0.1em; text-transform: uppercase; color: #93AAF2;
  background: rgba(31,79,224,0.10); border-bottom: 1px solid rgba(255,255,255,0.12);
}
.ov-table tbody td { padding: 16px 18px; font-size: 13.5px; line-height: 1.5; color: var(--on-ink-2); border-bottom: 1px solid rgba(255,255,255,0.07); vertical-align: top; }
.ov-table tbody tr:last-child td { border-bottom: none; }
.ov-table tbody tr:nth-child(even) td { background: rgba(255,255,255,0.02); }
.ov-td-dept { font-weight: 750; color: #fff; white-space: nowrap; }
.ov-td-agents { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: #C6D2F2; }
.ov-td-human { color: #FBD89B; }

.ov-compliance { margin-top: 40px; }
.ov-compliance-h { font-size: 13px; font-weight: 750; letter-spacing: 0.12em; text-transform: uppercase; color: var(--on-ink-3); margin-bottom: 18px; }
.ov-compgrid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.ov-comprow { display: flex; gap: 16px; align-items: flex-start; padding: 16px 18px; border-radius: 13px; background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.09); }
.ov-comp-k { display: flex; align-items: center; gap: 9px; flex-shrink: 0; width: 130px; font-size: 13.5px; font-weight: 750; color: #fff; }
.ov-comp-badge { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 6px; font-size: 12px; font-weight: 800; }
.ov-comp-ok .ov-comp-badge { background: rgba(15,181,166,0.20); color: #6FE6DA; }
.ov-comp-wip .ov-comp-badge { background: rgba(245,158,11,0.20); color: #FBD38D; }
.ov-comp-v { font-size: 13px; line-height: 1.5; color: var(--on-ink-2); }
.ov-comp-wip { border-color: rgba(245,158,11,0.32); background: rgba(245,158,11,0.06); }

/* ───────────── CLOSING ───────────── */
.ov-closing { position: relative; overflow: hidden; padding: 96px 24px;
  background: radial-gradient(120% 100% at 50% 120%, #16203A 0%, var(--ink) 50%, #070A10 100%);
  color: var(--on-ink); text-align: center; }
.ov-closing-glow { position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(40% 50% at 50% 110%, rgba(31,79,224,0.34) 0%, transparent 64%); }
.ov-closing-inner { position: relative; z-index: 1; max-width: 760px; margin: 0 auto; }
.ov-closing-mark { margin-bottom: 22px; }
.ov-mark-lg { width: 56px; height: 56px; border-radius: 16px; font-size: 30px; }
.ov-closing-h { margin: 0 0 16px; font-size: clamp(26px, 4vw, 40px); font-weight: 820; letter-spacing: -0.028em; line-height: 1.12; }
.ov-closing-p { margin: 0 auto 30px; max-width: 620px; font-size: 16.5px; line-height: 1.62; color: var(--on-ink-2); }
.ov-closing-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-bottom: 28px; }
.ov-cta { display: inline-flex; align-items: center; padding: 13px 24px; border-radius: 12px; font-size: 14.5px; font-weight: 700; transition: transform .16s ease, box-shadow .16s ease, background .16s ease; }
.ov-cta-primary { background: linear-gradient(135deg, var(--brand) 0%, var(--brand-2) 100%); color: #fff; box-shadow: 0 14px 34px -12px rgba(31,79,224,0.7); }
.ov-cta-primary:hover { transform: translateY(-2px); box-shadow: 0 20px 40px -12px rgba(31,79,224,0.85); }
.ov-cta-ghost { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.16); color: #fff; }
.ov-cta-ghost:hover { background: rgba(255,255,255,0.12); transform: translateY(-2px); }
.ov-closing-fine { font-size: 12px; line-height: 1.55; color: var(--on-ink-3); max-width: 560px; margin: 0 auto; }

/* ───────────── FOCUS / A11Y ───────────── */
.ov-root a:focus-visible, .ov-toc-link:focus-visible, .ov-cta:focus-visible, .ov-back:focus-visible {
  outline: 3px solid #7AA2FF; outline-offset: 3px; border-radius: 10px;
}

/* ───────────── RESPONSIVE ───────────── */
@media (max-width: 940px) {
  .ov-hero-stats { grid-template-columns: repeat(2, 1fr); }
  .ov-isgrid, .ov-outgrid, .ov-arch-detailgrid, .ov-secgrid, .ov-compgrid { grid-template-columns: 1fr; }
  .ov-vgrid, .ov-surfgrid, .ov-railgrid { grid-template-columns: 1fr 1fr; }
  .ov-agentgrid { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 680px) {
  .ov-section { padding: 60px 18px; }
  .ov-hero { padding: 64px 18px 76px; }
  .ov-hero-stats { grid-template-columns: 1fr 1fr; }
  .ov-vgrid, .ov-surfgrid, .ov-railgrid, .ov-agentgrid { grid-template-columns: 1fr; }
  .ov-problem { flex-direction: column; }
  .ov-seqrow { grid-template-columns: 1fr; }
  .ov-pos-0 .ov-seqcard, .ov-pos-1 .ov-seqcard, .ov-pos-2 .ov-seqcard { grid-column: 1; }
  .ov-seq-lanes { position: static; }
  .ov-comp-k { width: auto; }
  .ov-comprow { flex-direction: column; gap: 6px; }
}
`;
