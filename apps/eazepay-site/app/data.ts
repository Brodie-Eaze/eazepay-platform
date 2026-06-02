/* ============================================================================
   EazePay site — copy + config.
   Strings carried over from the in-platform parent landing page (the copy
   source of truth at apps/partner-portal/app/landing/eazepay) so the
   standalone marketing site stays consistent with the product surface.

   NOTE FOR THE OPERATOR: the headline metrics below ($240M+, 99.8% uptime,
   NMLS, "1,000+ practices") are carried over for consistency with
   the existing pages but are NOT yet backed by an in-repo source of truth.
   Treat them as illustrative until verified; do not add new unverified
   numbers. Lender names + rates are representative of the marketplace, not
   a published panel.
   ========================================================================== */

export const NAV_LINKS = [
  { href: '#platform', label: 'Platform' },
  { href: '#flow', label: 'Lead flow' },
  { href: '#agents', label: 'Agents' },
  { href: '#marketplace', label: 'Marketplace' },
  { href: '#industries', label: 'Industries' },
  { href: '#faq', label: 'FAQ' },
] as const;

export const TICKER: Array<{ value: string; label: string; delta: string }> = [
  { value: '$240M+', label: 'Orchestrated', delta: 'lifetime GMV · processing + financing' },
  { value: 'Curated', label: 'Lender marketplace', delta: 'prime → near-prime · soft pull' },
  { value: '<2s', label: 'Avg decision', delta: 'parallel waterfall · p95' },
  { value: '99.8%', label: 'Uptime SLA', delta: 'rolling 12mo · audited' },
];

/* ---- parent ↔ vertical orchestration story (stitched vs one platform) ---- */

export const STITCHED: Array<{ stat: string; label: string }> = [
  {
    stat: '4–6 vendors',
    label: 'Processor, lender, AI, attribution, KYB and ledger stitched together by hand',
  },
  { stat: 'Manual', label: 'Lender routing — single-lender failover or human triage' },
  { stat: 'Broken', label: 'Attribution between ad spend, applications and funded loans' },
  { stat: '5–10 days', label: 'Settlement + reconciliation lag — funds held by an intermediary' },
];

export const UNIFIED: Array<{ stat: string; label: string }> = [
  { stat: 'One API', label: 'Processor + financing marketplace + agentic layer on a single rail' },
  {
    stat: 'Parallel',
    label: 'Every lender in the marketplace quotes at once — best offer wins by total cost',
  },
  { stat: 'Agentic', label: 'Seven autonomous agents on intake, scoring, routing and attribution' },
  {
    stat: '48–72hr',
    label: 'Lender disburses merchant-direct — closed-loop attribution to ad spend',
  },
];

/* --------------------------------- lead flow ------------------------------ */

export type LeadIntent = 'hot' | 'warm' | 'cold';

export const LIVE_LEADS: Array<{
  id: string;
  intent: LeadIntent;
  amount: string;
  delay: string;
}> = [
  { id: 'L-8421', intent: 'hot', amount: '$48,000', delay: '0s' },
  { id: 'L-8419', intent: 'hot', amount: '$72,400', delay: '2.4s' },
  { id: 'L-8418', intent: 'warm', amount: '$12,400', delay: '4.8s' },
  { id: 'L-8417', intent: 'warm', amount: '$5,800', delay: '7.2s' },
  { id: 'L-8416', intent: 'cold', amount: '$1,200', delay: '9.6s' },
];

export type FlowIcon = 'form' | 'score' | 'route' | 'waterfall' | 'settle';

export const FLOW_NODES: Array<{
  code: string;
  live: string;
  title: string;
  sub: string;
  icon: FlowIcon;
}> = [
  {
    code: 'SMART FORM',
    live: 'capturing',
    title: 'Capture',
    sub: 'any funnel · any source',
    icon: 'form',
  },
  {
    code: 'SMART CHECK',
    live: 'qualifying',
    title: 'Qualify',
    sub: 'credit · income · avail credit',
    icon: 'score',
  },
  {
    code: 'SMART ROUTING',
    live: 'routing',
    title: 'Route',
    sub: 'ticket size + intent',
    icon: 'route',
  },
  {
    code: 'SMART MATCH',
    live: 'matching',
    title: 'Match',
    sub: 'right VSL · right offer',
    icon: 'waterfall',
  },
  {
    code: 'SMART CONNECT',
    live: 'connecting',
    title: 'Connect',
    sub: "closer's calendar or nurture",
    icon: 'settle',
  },
];

/* the binary fork + four leaf outcomes (shown beneath the live rail) */
export const FLOW_FORK: Array<{ code: string; label: string }> = [
  { code: 'HIGH-TICKET VSL', label: 'premium video sales letter' },
  { code: 'LOW-TICKET VSL', label: 'fast video sales letter' },
];

export const FLOW_OUTCOMES: Array<{ label: string; sub: string }> = [
  { label: 'BOOK A CALL · PREMIUM', sub: 'high-intent · sales team' },
  { label: 'SLO', sub: 'self-liquidating offer' },
  { label: 'LOW-TICKET OFFER', sub: 'instant checkout · $97–$497' },
  { label: 'BOOK A CALL · STANDARD', sub: 'warm pipeline · group call' },
];

/* --------------------------------- agents --------------------------------- */

export type AgentStatus = 'ONLINE' | 'LEARNING';

export const AGENTS: Array<{
  n: string;
  code: string;
  role: string;
  status: AgentStatus;
  description: string;
  stats: Array<{ k: string; v: string }>;
  lastAction: string;
  wide?: boolean;
}> = [
  {
    n: '01',
    code: 'PRISM',
    role: 'Intake Agent',
    status: 'ONLINE',
    description:
      'Watches every apply-form session in real time. Reshapes question order on partial answers, strips friction for high-intent applicants and adds verification when it detects junk. Learns which sequences convert per merchant, per source.',
    stats: [
      { k: 'Sessions/hr', v: '4,820' },
      { k: 'Form drop-off', v: '−41%' },
    ],
    lastAction: 'reordered branch on traffic_source=meta to ask ticket_size first · 14s ago',
  },
  {
    n: '02',
    code: 'VEGA',
    role: 'Enrichment Agent',
    status: 'ONLINE',
    description:
      'Orchestrates 12 enrichment providers in parallel. Picks the cheapest source likely to match, falls back automatically on failure and dedupes identity collisions across vendors.',
    stats: [
      { k: 'Avg cost/lead', v: '$0.41' },
      { k: 'Identity match', v: '94%' },
    ],
    lastAction: 'fell back to provider_03 after timeout · saved $0.18 · 2s ago',
  },
  {
    n: '03',
    code: 'ORACLE',
    role: 'Scoring Agent',
    status: 'LEARNING',
    description:
      'Runs a calibrated propensity model trained on closed-won outcomes per merchant — not a generic lookalike. Retrains nightly on every disposition and surfaces drift before it touches revenue.',
    stats: [
      { k: 'Model AUC', v: '0.89' },
      { k: 'Last retrain', v: '4h ago' },
    ],
    lastAction: 'flagged feature drift on ticket_value · recalibrated thresholds · 4h ago',
  },
  {
    n: '04',
    code: 'HELIX',
    role: 'Routing Agent',
    status: 'ONLINE',
    description:
      'Matches every qualified applicant to the right rep — not just the next available one. Learns which reps close which tiers, accounts for capacity in real time and routes around breaks and underperformance.',
    stats: [
      { k: 'Avg route', v: '320ms' },
      { k: 'Match lift', v: '+31%' },
    ],
    lastAction: 'rerouted T1 applicant from rep at 98% capacity → next best rep · 1s ago',
  },
  {
    n: '05',
    code: 'NEXUS',
    role: 'Lender Marketplace Agent',
    status: 'ONLINE',
    description:
      'Routes every qualified applicant through a curated lender marketplace, prime to near-prime. Soft pull only. Learns which lenders approve which profiles and reroutes around lenders that tighten overnight.',
    stats: [
      { k: 'Decision', v: '<2s' },
      { k: 'Pull type', v: 'Soft only' },
    ],
    lastAction: 'matched profile (V4=712, DTI=0.34, ask=$12k) → lender_07 + 2 backups · 12s ago',
  },
  {
    n: '06',
    code: 'FLUX',
    role: 'Payment Agent',
    status: 'ONLINE',
    description:
      'Handles the money movement. Presents BNPL, POS finance, ACH and card based on the lender approval, retries failed payments intelligently and reconciles every settled cent to the originating campaign.',
    stats: [
      { k: 'Auth success', v: '96.3%' },
      { k: 'Recovery', v: '+18%' },
    ],
    lastAction: 'retried failed ACH via card_on_file · captured $4,200 · 8s ago',
  },
  {
    n: '07',
    code: 'ECHO',
    role: 'Attribution Agent',
    status: 'ONLINE',
    wide: true,
    description:
      'Closes the loop. Holds pixel events until an applicant clears qualification, then fires weighted conversions back to Meta and Google via server-side CAPI and uploads closed-won deals as offline conversions — the cleanest training signal your ad account will ever see.',
    stats: [
      { k: 'Match quality', v: 'server-side' },
      { k: 'Loop', v: 'closed' },
    ],
    lastAction: 'uploaded 47 closed-won deals to Meta CAPI, weighted by ticket_value · 6m ago',
  },
];

/* -------------------------------- pillars --------------------------------- */

export const PILLARS: Array<{
  n: string;
  tag: string;
  title: string;
  body: string;
  bullets: string[];
  metric: string;
}> = [
  {
    n: '01',
    tag: 'ORCHESTRATION',
    title: 'The rail every vertical runs on.',
    body: 'EazePay is the platform layer beneath MedPay, TradePay, CoachPay and every future vertical. One API for payments, financing, settlement and agents. Spin up a new vertical brand in days — the rail underneath is already live, audited and in production.',
    bullets: [
      'Single SDK · embed at POS, in-app or hosted page',
      'Processor + financing under one MID structure',
      'Unified webhook bus · idempotent retries · DLQ inspection',
      'One ledger across processing, financing, settlement and reconciliation',
      'New vertical brand on the same rail in days · one contract, one onboarding',
    ],
    metric: 'One platform · every vertical',
  },
  {
    n: '02',
    tag: 'MARKETPLACE',
    title: 'A lender marketplace. Soft pull. Merchant-direct.',
    body: 'Every application waterfalls through a curated lender marketplace, prime through near-prime, in parallel. The best offer wins by total cost of credit. The lender on the offer disburses merchant-direct in 48–72hr.',
    bullets: [
      'Soft-pull pre-qual · zero credit impact',
      'Three best-fit offers ranked by total cost of credit',
      'Merchant-direct disbursement · 48–72hr to your business account',
      'Lender carries the credit risk · no clawback on routine defaults',
    ],
    metric: 'Lender marketplace · parallel quoting',
  },
  {
    n: '03',
    tag: 'AGENTIC LAYER',
    title: 'Seven agents bundled. No separate AI stack to buy.',
    body: 'PRISM, VEGA, ORACLE, HELIX, NEXUS, FLUX and ECHO ship in the same signup as the financing marketplace. Every agent has a defined role, a defined scope and a measurable output. Every action is logged and FCRA-aware.',
    bullets: [
      'Defined role + scope + measurable output per agent',
      'Real-time intake, enrichment, scoring, routing and attribution',
      'Calibrated propensity trained on your outcomes — not a lookalike',
      'Every action logged to an immutable, exportable audit trail',
    ],
    metric: '7 agents · one platform',
  },
  {
    n: '04',
    tag: 'SETTLEMENT + RECON',
    title: 'Daily close. Multi-party split. Ledger truth.',
    body: 'One canonical ledger across processor, lender, merchant and platform fee. Daily close runs at 02:00 ET. Multi-party splits are computed and instructed; the merchant approves payouts in their own banking surface. Every cent reconciles to the originating application and campaign.',
    bullets: [
      'Daily reconciliation close · 02:00 ET · CSV + JSON export',
      'Multi-party split engine · platform fee, lender, merchant',
      'Per-deal ledger trace · application → approval → settlement',
      'PCI-DSS Level 1 scope minimisation · SOC 2 Type II audited controls',
    ],
    metric: 'Daily close · audited',
  },
];

/* ------------------------------ marketplace ------------------------------- */

export const LENDERS: Array<{ name: string; tier: string; rate: string; fill: number }> = [
  { name: 'Lender 1', tier: 'PRIME', rate: '5.9%', fill: 0.92 },
  { name: 'Lender 2', tier: 'PRIME', rate: '6.4%', fill: 0.84 },
  { name: 'Lender 3', tier: 'PRIME', rate: '6.9%', fill: 0.78 },
  { name: 'Lender 4', tier: 'PRIME', rate: '7.2%', fill: 0.71 },
  { name: 'Lender 5', tier: 'NEAR-PRIME', rate: '8.9%', fill: 0.6 },
  { name: 'Lender 6', tier: 'NEAR-PRIME', rate: '9.4%', fill: 0.52 },
  { name: 'Lender 7', tier: 'NEAR-PRIME', rate: '10.4%', fill: 0.44 },
];

export const INTEGRATIONS: string[] = [
  'CROSS RIVER BANK',
  'ENGINE.TECH',
  'FINWISE',
  'EXPERIAN',
  'TRANSUNION',
  'PLAID',
  'PERSONA',
  'SIFT',
  'STRIPE',
  'META CAPI',
  'GOOGLE ADS',
  'TWILIO',
  'SEGMENT',
  'SNOWFLAKE',
];

/* ------------------------------- industries ------------------------------- */

export const INDUSTRIES: Array<{
  name: string;
  desc: string;
  metric: string;
  examples: string;
}> = [
  {
    name: 'MedPay',
    desc: 'Patient financing for dental, med spa, derm, vet and vision practices.',
    metric: '$12k avg ticket',
    examples: 'Dental · Med spa · Dermatology · Vision · Vet',
  },
  {
    name: 'TradePay',
    desc: 'Homeowner financing for HVAC, solar, roofing and window contractors.',
    metric: '$18k avg ticket',
    examples: 'HVAC · Solar · Roofing · Windows · Remodel',
  },
  {
    name: 'CoachPay',
    desc: 'Tuition financing for coaching programs, certifications and bootcamps.',
    metric: '$8k avg ticket',
    examples: 'Coaching · Certification · Bootcamp · Masterminds',
  },
];

/* ---------------------------------- proof --------------------------------- */

export const PROOF: Array<{ value: string; unit: string; label: string; sub: string }> = [
  {
    value: '$240',
    unit: 'M+',
    label: 'Orchestrated through the platform',
    sub: 'Lifetime GMV across processing + financing rails',
  },
  {
    value: 'Parallel',
    unit: '',
    label: 'Lender marketplace',
    sub: 'Prime → near-prime · soft pull · parallel quoting',
  },
  {
    value: '<2',
    unit: 's',
    label: 'Average decision time',
    sub: 'p95 round-trip · soft-pull pre-qual · zero credit impact',
  },
  {
    value: '48–72',
    unit: 'hr',
    label: 'Merchant-direct settlement',
    sub: 'Lender disburses to the merchant account · no intermediary float',
  },
];

/* ----------------------------------- faq ---------------------------------- */

export const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'Are you a lender of record?',
    a: 'No. EazePay is the orchestration layer. The lender on the accepted offer is the lender of record and holds the loan. EazePay routes the application, computes the best offer by total cost and runs the merchant-direct settlement rail. The bank partner / lender carries the credit risk, the regulatory obligation and the consumer-facing loan agreement.',
  },
  {
    q: "What's the pricing model?",
    a: 'Percentage of funded volume only. No monthly platform fee, no annual minimum, no multi-year contract. The platform fee is taken at settlement against the lender disbursement — EazePay is only paid when the merchant is funded. Leave with 30 days notice and we help you migrate.',
  },
  {
    q: 'How does a vertical brand fit on top?',
    a: 'MedPay, TradePay and CoachPay are skinned go-to-market surfaces on the same rail. A new vertical reuses the processor, the lender marketplace, the seven agents, the ledger and the settlement engine — only the brand, copy and underwriting profile change. One contract, one onboarding, live in days.',
  },
  {
    q: 'How fast is integration?',
    a: 'Hosted page: a few hours. Standard SDK embed at POS or in-app: typically 1–3 weeks including UAT. Headless API + custom UI: 4–8 weeks. KYB (IRS TIN, Secretary of State, OFAC, PEP, FinCEN BOI) clears in 60 seconds for clean records. Sandbox is unlimited and free.',
  },
  {
    q: 'PCI / SOC 2 / FCRA?',
    a: 'PCI-DSS Level 1 scope-minimised — card data is tokenised at the edge and never traverses your servers. SOC 2 Type II audited annually. FCRA permissible-purpose enforced at the agent layer; every soft pull and every adverse-action notice is logged to an immutable audit trail and exportable on request.',
  },
];
