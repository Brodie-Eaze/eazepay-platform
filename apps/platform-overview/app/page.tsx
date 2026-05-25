/**
 * EazePay platform overview — standalone Next.js app.
 *
 * One long top-to-bottom narrative scroll. Each phase is its own
 * full-bleed section showing exactly what an operator + consumer
 * experience, with the matching technical detail for engineers
 * (HTTP endpoints, Pusher channels, DB tables, payload examples).
 *
 * Deployed as its own Railway service so it has its own URL,
 * separate from the partner-portal.
 *
 * Re-capture screenshots:
 *   node apps/partner-portal/scripts/capture-flow-screenshots.mjs
 *   cp apps/partner-portal/public/flow-screenshots/*.png \
 *      apps/platform-overview/public/screenshots/
 */
import Image from 'next/image';

const PARTNER_PORTAL = 'https://eazepay-platform-production.up.railway.app';

interface Screen {
  file: string;
  caption: string;
  url: string;
  external?: boolean;
}
interface Spec {
  k: string;
  v: string;
}
interface Payload {
  title: string;
  body: string;
}
interface Phase {
  num: string;
  actor: 'Operator' | 'Consumer' | 'EazePay' | 'Lender';
  title: string;
  subtitle: string;
  body: string;
  hero: Screen;
  supporting?: Screen[];
  endpoints?: Spec[];
  pusher?: Spec[];
  tables?: Spec[];
  payloads?: Payload[];
}

const PHASES: Phase[] = [
  {
    num: '01',
    actor: 'Operator',
    title: 'Discover the platform',
    subtitle: 'Per-vertical brand landings · rep-led sales decks',
    body: 'Each vertical has its own brand identity (MedPay for healthcare, TradePay for trades + home services, CoachPay for coaching + education). The landing pages are the self-serve marketing site; the sales decks are the rep-led pitch. Both are public — no auth — so reps can drop the link into cold outreach.',
    hero: {
      file: '04-medpay-sales-deck.png',
      caption: 'MedPay sales deck',
      url: `${PARTNER_PORTAL}/sales/medpay`,
    },
    supporting: [
      {
        file: '01-medpay-landing.png',
        caption: 'MedPay landing',
        url: `${PARTNER_PORTAL}/landing/medpay`,
      },
      {
        file: '02-tradepay-landing.png',
        caption: 'TradePay landing',
        url: `${PARTNER_PORTAL}/landing/tradepay`,
      },
      {
        file: '03-coachpay-landing.png',
        caption: 'CoachPay landing',
        url: `${PARTNER_PORTAL}/landing/coachpay`,
      },
      {
        file: '05-tradepay-sales-deck.png',
        caption: 'TradePay deck',
        url: `${PARTNER_PORTAL}/sales/tradepay`,
      },
      {
        file: '06-coachpay-sales-deck.png',
        caption: 'CoachPay deck',
        url: `${PARTNER_PORTAL}/sales/coachpay`,
      },
    ],
    endpoints: [
      { k: 'GET /landing/[brand]', v: 'Public marketing landing · server-rendered' },
      { k: 'GET /sales/[brand]', v: 'Rep-led sales deck · 28 slides · scroll-snap' },
    ],
    tables: [
      { k: 'partners', v: 'one row per operator post-signup (KYB + Stripe customer)' },
      { k: 'leads', v: 'inbound deck-view + contact tracking for rep follow-up' },
    ],
  },

  {
    num: '02',
    actor: 'Operator',
    title: 'Check out',
    subtitle: 'Plan-aware Stripe checkout · three setup tiers',
    body: "One checkout page, three plan variants driven by ?plan=5k|10k|10k-guarantee. The Stripe price id is selected per plan. On successful checkout, Stripe redirects to /welcome/[brand] with a session id that exchanges for the operator's account + onboarding token.",
    hero: {
      file: '08-checkout-10k-tier.png',
      caption: 'Checkout · $10k tier',
      url: `${PARTNER_PORTAL}/medpay/checkout?plan=10k`,
    },
    supporting: [
      {
        file: '07-checkout-5k-tier.png',
        caption: '$5k tier',
        url: `${PARTNER_PORTAL}/medpay/checkout?plan=5k`,
      },
      {
        file: '09-checkout-10k-guarantee.png',
        caption: '$10k + 10× guarantee',
        url: `${PARTNER_PORTAL}/medpay/checkout?plan=10k-guarantee`,
      },
      {
        file: '10-welcome-success.png',
        caption: 'Welcome',
        url: `${PARTNER_PORTAL}/welcome/medpay`,
      },
    ],
    endpoints: [
      { k: 'GET /[brand]/checkout?plan=', v: '5k | 10k | 10k-guarantee — plan-aware page' },
      { k: 'POST /api/checkout/session', v: 'Mints Stripe Checkout session, returns redirect URL' },
      {
        k: 'POST /api/webhooks/stripe',
        v: 'checkout.session.completed — provisions partner + onboarding token',
      },
      {
        k: 'GET /welcome/[brand]?session_id=',
        v: 'Onboarding handoff, sets eazepay_at account cookie',
      },
    ],
    tables: [
      { k: 'partners', v: 'INSERT with stripe_customer_id, plan, brand, contact_email' },
      { k: 'onboarding_tokens', v: 'one-time-use, 7d TTL, bound to partner_id' },
    ],
    payloads: [
      {
        title: 'Stripe webhook · checkout.session.completed',
        body: `{
  "type": "checkout.session.completed",
  "data": { "object": {
    "id": "cs_live_...",
    "customer": "cus_...",
    "amount_total": 1000000,
    "metadata": { "brand": "medpay", "plan": "10k" }
  }}
}`,
      },
    ],
  },

  {
    num: '03',
    actor: 'Operator',
    title: 'Onboarding · configure 4 modules',
    subtitle: 'HighSale (Pixie smart form) · Partner portal · Lender marketplace · MyCamp',
    body: 'The onboarding hub gates four module configurations. Operator wires up HighSale (which contains Pixie — the smart-form + smart-routing engine the consumer intake is built on), their Partner Portal branding + team, the Lender Marketplace (picks which lenders to enable + per-tier routing rules), and MyCamp for payment processing. When all four are complete, the partner portal unlocks.',
    hero: {
      file: '11-onboarding-hub.png',
      caption: 'Onboarding hub · 4 module status',
      url: `${PARTNER_PORTAL}/medpay/onboarding`,
    },
    supporting: [
      {
        file: '12-partner-portal-signup-config.png',
        caption: 'Partner portal config',
        url: `${PARTNER_PORTAL}/medpay/signup`,
      },
      {
        file: '13-highsale-pixie-external.png',
        caption: 'HighSale + Pixie',
        url: 'https://highsale.com/',
        external: true,
      },
      {
        file: '14-lender-marketplace-setup.png',
        caption: 'Lender marketplace setup',
        url: `${PARTNER_PORTAL}/medpay/onboarding/lender-marketplace`,
      },
      {
        file: '15-mycamp-processor-external.png',
        caption: 'MyCamp processor',
        url: 'https://micamp.com/',
        external: true,
      },
    ],
    endpoints: [
      { k: 'GET /[brand]/onboarding', v: 'Hub showing 4 module status + CTAs' },
      { k: 'GET /api/onboarding/state', v: 'Per-module status for current partner' },
      { k: 'POST /api/onboarding/[module]/complete', v: 'Marks a module complete (idempotent)' },
      { k: 'POST /api/lenders/enable', v: 'Toggles a lender for this partner' },
      {
        k: 'POST /api/integrations/highsale/connect',
        v: 'OAuth handoff → HighSale, returns api_key',
      },
      {
        k: 'POST /api/integrations/mycamp/connect',
        v: 'OAuth handoff → MyCamp, returns merchant_id',
      },
    ],
    tables: [
      { k: 'onboarding_steps', v: 'partner_id, module, status, completed_at, payload (jsonb)' },
      { k: 'integrations', v: 'partner_id, provider (highsale/mycamp), credentials (encrypted)' },
      { k: 'partner_lenders', v: 'partner_id × lender_id with tier rules + priority' },
    ],
  },

  {
    num: '04',
    actor: 'Operator',
    title: 'Enter the Partner Portal',
    subtitle: 'Per-brand workspace at /v/[brand]/* · namespaced + isolated',
    body: "Once onboarding is green, the operator lands in /v/[brand]/*. The portal is namespaced by brand so a MedPay operator and a TradePay operator never see each other's pipeline. From the home dashboard they can view live pipeline, send a branded application link to a client (SMS / email / QR code), manage their team + roles, rotate API keys for direct programmatic integration, and tune settings.",
    hero: {
      file: '16-portal-home-dashboard.png',
      caption: 'Portal home dashboard',
      url: `${PARTNER_PORTAL}/v/medpay`,
    },
    supporting: [
      {
        file: '17-portal-send-link-to-client.png',
        caption: 'Send link to client',
        url: `${PARTNER_PORTAL}/v/medpay/send-link`,
      },
      {
        file: '18-portal-submit-application.png',
        caption: 'Submit application directly',
        url: `${PARTNER_PORTAL}/v/medpay/submit`,
      },
      {
        file: '19-portal-team-management.png',
        caption: 'Team + roles',
        url: `${PARTNER_PORTAL}/v/medpay/team`,
      },
      {
        file: '20-portal-api-keys.png',
        caption: 'API keys',
        url: `${PARTNER_PORTAL}/v/medpay/api-keys`,
      },
      {
        file: '21-portal-settings.png',
        caption: 'Settings',
        url: `${PARTNER_PORTAL}/v/medpay/settings`,
      },
    ],
    endpoints: [
      { k: 'GET /v/[brand]', v: 'Portal home — pipeline cards + recent activity' },
      {
        k: 'POST /api/applications/send-link',
        v: 'Generates branded apply URL + dispatches SMS/email',
      },
      { k: 'POST /api/applications', v: 'Direct create from operator (bypass send-link)' },
      { k: 'GET /api/team', v: 'List of team members + roles' },
      { k: 'POST /api/api-keys', v: 'Mint new API key · prefix + scope' },
    ],
    tables: [
      { k: 'application_links', v: 'short_code, partner_id, brand, client_handle, expires_at' },
      { k: 'team_members', v: 'partner_id × user_id with role (admin/operator/viewer)' },
      { k: 'api_keys', v: 'prefix, hashed_secret, scope[], last_used_at' },
    ],
  },

  {
    num: '05',
    actor: 'Consumer',
    title: 'Client opens the intake form',
    subtitle: 'Pixie smart form on the front · HighSale API on the back',
    body: "The client clicks the link and lands on /apply/[brand]/[partnerId]. The visible form is Pixie — adapts on partial answers, routes by intent. Behind the scenes the HighSale API is plugged into the back of the form. As fields complete, HighSale runs the financial data (soft-pull credit, income verification, DTI calculation) and assembles the full pre-approval profile. That profile is then pushed to EazePay's decision engine in the cloud via POST /api/applications/[id]/decision.",
    hero: {
      file: '22-client-intake-pixie-smart-form.png',
      caption: 'Client intake · Pixie smart form',
      url: `${PARTNER_PORTAL}/apply/medpay`,
    },
    endpoints: [
      { k: 'GET /apply/[brand]/[partnerId?]', v: 'Public consumer intake page — no auth required' },
      { k: 'POST /api/applications', v: 'Creates application row in pending state' },
      {
        k: 'POST /api/applications/[id]/profile',
        v: 'Pixie pushes partial-form snapshots as user types',
      },
      {
        k: 'POST /api/applications/[id]/decision',
        v: 'Triggers decision engine fan-out (~200ms sync)',
      },
      { k: 'GET /api/integrations/highsale/score', v: 'Server-to-server pull of HighSale verdict' },
    ],
    tables: [
      { k: 'applications', v: 'id, partner_id, brand, consumer_first/last, amount_cents, status' },
      {
        k: 'application_events',
        v: 'append-only ledger · every state transition with payload (jsonb)',
      },
    ],
    payloads: [
      {
        title: 'POST /api/applications/[id]/decision · request',
        body: `{
  "applicationId": "app_8f7a2c",
  "profile": {
    "ssnLast4": "1234",
    "dob": "1985-03-12",
    "incomeAnnual": 95000,
    "scoreBureau": "experian",
    "creditScore": 742,
    "availableCredit": 28400,
    "dtiPct": 18
  }
}`,
      },
    ],
  },

  {
    num: '06',
    actor: 'EazePay',
    title: 'Decision engine + lender marketplace',
    subtitle: 'Parallel quote fan-out · propensity scoring · cheapest-first ranking',
    body: "The decision engine receives the pre-approval profile and fans it out to the operator's configured lender panel in parallel. Each lender exposes a /quote endpoint over HTTPS — we send the same canonical profile shape to all of them and wait for quotes (8s timeout). Quotes come back with: approved (y/n), amount range, APR, term, monthly payment estimate, and a quote_id. The engine propensity-scores each approved quote (likelihood the lender will fund through underwriting given this buyer profile) and ranks them cheapest-first by total cost.",
    hero: {
      file: '23-lenders-panel-admin-view.png',
      caption: 'Lender panel · admin view',
      url: `${PARTNER_PORTAL}/lenders`,
    },
    supporting: [
      {
        file: '24-marketplaces-panel-admin.png',
        caption: 'Marketplaces panel',
        url: `${PARTNER_PORTAL}/marketplaces`,
      },
      {
        file: '25-lender-marketplace-public-dev-hub.png',
        caption: 'Public lender dev hub',
        url: `${PARTNER_PORTAL}/lender-marketplace`,
      },
    ],
    endpoints: [
      { k: 'GET /lenders', v: 'Internal — list of all lenders in panel + status' },
      { k: 'GET /marketplaces', v: 'Multi-lender groups (medical, home services, etc.)' },
      { k: 'POST [LENDER]/api/quote', v: 'Outbound — fired in parallel to every enabled lender' },
      { k: 'POST /api/decision/score', v: 'Propensity model · returns 0–100 score per quote' },
    ],
    tables: [
      { k: 'lenders', v: 'id, name, quote_endpoint, webhook_secret, api_credentials (encrypted)' },
      { k: 'marketplaces', v: 'lender grouping for vertical-specific panels' },
      {
        k: 'offers',
        v: 'application_id × lender_id with amount/apr/term/score (one row per quote)',
      },
    ],
    payloads: [
      {
        title: 'Outbound quote request → lender',
        body: `POST https://lender.example.com/api/quote
{
  "applicationId": "app_8f7a2c",
  "partnerId": "ptn_medpay_42",
  "brand": "medpay",
  "buyer": {
    "incomeAnnual": 95000,
    "creditScore": 742,
    "availableCredit": 28400,
    "dtiPct": 18,
    "amountRequested": 12000
  }
}`,
      },
      {
        title: 'Lender quote response',
        body: `{
  "quoteId": "q_lender1_a7b3",
  "status": "approved",
  "amountApproved": 12000,
  "aprBps": 1499,
  "termMonths": 48,
  "monthlyPaymentCents": 31200,
  "expiresAtIso": "2026-05-26T07:00:00Z"
}`,
      },
    ],
  },

  {
    num: '07',
    actor: 'EazePay',
    title: 'Offers land in three places · simultaneously',
    subtitle:
      'Pusher fires on channel app-[applicationId] · client, operator, command centre all update live',
    body: "The decision engine finishes assembling the ranked offer stack, writes to the offers table, then fires a single Pusher event on channel app-[applicationId] that THREE open clients are subscribed to: the buyer's offer-stack page (so they pick), the operator's open application-detail page (so they can coach the close), and EazePay's command-centre applications view (so we see every application across every operator in real time). If a client has the page closed, they get the update via Pusher's connection-state recovery when they re-open.",
    hero: {
      file: '26-client-sees-ranked-offers.png',
      caption: 'Client sees ranked offers',
      url: `${PARTNER_PORTAL}/apply/medpay#offers`,
    },
    supporting: [
      {
        file: '27-portal-applications-list.png',
        caption: 'Operator applications list',
        url: `${PARTNER_PORTAL}/v/medpay/applications`,
      },
      {
        file: '28-command-centre-all-applications.png',
        caption: 'Command centre · all apps',
        url: `${PARTNER_PORTAL}/applications`,
      },
      {
        file: '29-admin-marketplace-dashboard.png',
        caption: 'Admin marketplace',
        url: `${PARTNER_PORTAL}/admin/marketplace`,
      },
    ],
    pusher: [
      { k: 'channel', v: 'app-[applicationId] (private)' },
      {
        k: 'event: offers-received',
        v: 'fires when offers table updates · payload = full offer stack',
      },
      { k: 'event: status-changed', v: 'fires on any application.status transition' },
      { k: 'channel: ops-all-apps', v: 'EazePay-only firehose across all operators' },
    ],
    endpoints: [
      { k: 'GET /api/applications/[id]', v: 'Source of truth read — app + offers + events' },
      { k: 'POST /api/realtime/publish', v: 'Internal — server-side Pusher publish wrapper' },
    ],
    payloads: [
      {
        title: 'Pusher event · offers-received',
        body: `{
  "channel": "app-app_8f7a2c",
  "event": "offers-received",
  "data": {
    "applicationId": "app_8f7a2c",
    "offers": [
      { "id": "off_a1", "lender": "Lender One", "amountCents": 1200000, "aprBps": 1499, "termMonths": 48, "monthlyPaymentCents": 31200, "propensity": 87, "rank": 1 },
      { "id": "off_a2", "lender": "Lender Two", "amountCents": 1200000, "aprBps": 1799, "termMonths": 60, "monthlyPaymentCents": 25800, "propensity": 72, "rank": 2 },
      { "id": "off_a3", "lender": "Lender Three", "amountCents": 1000000, "aprBps": 1999, "termMonths": 36, "monthlyPaymentCents": 37100, "propensity": 64, "rank": 3 }
    ]
  }
}`,
      },
    ],
  },

  {
    num: '08',
    actor: 'Lender',
    title: 'Underwriting + outcome',
    subtitle: 'Client picks · lender does UW · webhook back · realtime push to portal + centre',
    body: "Client picks an offer (UI is propensity-sorted but they can pick any approved one). We POST /api/offers/[id]/accept which marks the offer bound and hands the buyer over to the lender's signing flow. Lender does underwriting in their own system. When the lender resolves the loan, they POST our webhook at /api/v1/webhooks/lenders/[lenderSlug]. We HMAC-verify the signature, persist to applications + application_events + offers, fire the realtime push back to portal + centre, and (for high-signal events like decisioned / funded / defaulted) dispatch the outcome email + SMS to the operator.",
    hero: {
      file: '30-application-detail-live-status.png',
      caption: 'Application detail · live status',
      url: `${PARTNER_PORTAL}/v/medpay/applications/demo`,
    },
    supporting: [
      {
        file: '31-webhooks-inbound-from-lenders.png',
        caption: 'Inbound webhooks log',
        url: `${PARTNER_PORTAL}/webhooks`,
      },
      {
        file: '32-events-log-audit-trail.png',
        caption: 'Events log · audit trail',
        url: `${PARTNER_PORTAL}/events`,
      },
      {
        file: '33-dead-letter-queue.png',
        caption: 'Dead-letter queue',
        url: `${PARTNER_PORTAL}/dead-letter`,
      },
    ],
    endpoints: [
      {
        k: 'POST /api/offers/[id]/accept',
        v: 'Client-side accept — marks offer bound, returns lender redirect',
      },
      {
        k: 'POST /api/v1/webhooks/lenders/[lender]',
        v: 'Lender inbound · HMAC-verified · idempotent persist',
      },
      {
        k: 'GET /api/v/[brand]/applications/[id]/status',
        v: 'Real DB read · portal status refresh',
      },
    ],
    pusher: [
      { k: 'event: status-changed', v: 'application.status flipped (e.g. bound → funded)' },
      { k: 'event: funded', v: 'loan.funded received · operator portal flips badge + plays chime' },
    ],
    tables: [
      { k: 'applications', v: 'status: pending → quoted → bound → funded | declined | defaulted' },
      { k: 'offers', v: 'updated with accepted_at, bound_at, declined_reason on lifecycle events' },
      {
        k: 'application_events',
        v: 'append-only · webhook_type, body, signature_valid, persisted_at',
      },
    ],
    payloads: [
      {
        title: 'Lender inbound webhook · loan.funded',
        body: `POST /api/v1/webhooks/lenders/lender_one
X-Lender-Signature: t=1716700800,v1=abc123def456...

{
  "eventType": "loan.funded",
  "applicationId": "app_8f7a2c",
  "loanId": "loan_lender1_xyz",
  "amountCents": 1200000,
  "fundedAtIso": "2026-05-26T14:32:11Z",
  "disbursementBank": { "lastFour": "4567", "ach": true }
}`,
      },
    ],
  },

  {
    num: '09',
    actor: 'EazePay',
    title: 'Money flows · settlements · payouts · billing',
    subtitle: 'Lender wires direct to operator · EazePay invoices the origination fee monthly',
    body: "The lender wires the loan amount direct to the operator's bank account within 48–72 hours of funding (no marketplace intermediary skim). EazePay does NOT touch the consumer money. Separately, EazePay invoices the operator monthly for: per-smart-form-lead fee ($3/lead through Pixie intake) and 4% origination fee on every loan that actually settled. The settlement flows into MyCamp processor and out of the operator's bank by ACH.",
    hero: {
      file: '35-portal-settlements-payouts.png',
      caption: 'Portal · settlements / payouts',
      url: `${PARTNER_PORTAL}/v/medpay/settlements`,
    },
    supporting: [
      {
        file: '34-portal-billing.png',
        caption: 'Portal billing',
        url: `${PARTNER_PORTAL}/v/medpay/billing`,
      },
      {
        file: '36-portal-insights-pipeline.png',
        caption: 'Portal insights',
        url: `${PARTNER_PORTAL}/v/medpay/insights`,
      },
      {
        file: '37-admin-invoices.png',
        caption: 'Admin invoices',
        url: `${PARTNER_PORTAL}/invoices`,
      },
      { file: '38-admin-payouts.png', caption: 'Admin payouts', url: `${PARTNER_PORTAL}/payouts` },
      {
        file: '39-admin-settlements.png',
        caption: 'Admin settlements',
        url: `${PARTNER_PORTAL}/settlements`,
      },
      { file: '40-admin-reports.png', caption: 'Admin reports', url: `${PARTNER_PORTAL}/reports` },
    ],
    endpoints: [
      { k: 'GET /v/[brand]/billing', v: 'Per-operator invoice + line-item history' },
      { k: 'GET /api/invoices/[partnerId]', v: 'Rolling 12-month invoice history' },
      { k: 'POST /api/invoices/[id]/charge', v: 'MyCamp ACH pull on the due-date cron' },
    ],
    tables: [
      { k: 'invoices', v: 'partner_id, period_start/end, line_items (jsonb), total_cents, status' },
      { k: 'settlements', v: 'one row per loan that settled · drives origination revenue' },
      { k: 'payouts', v: 'lender wires (informational · the lender owns the rail)' },
    ],
  },

  {
    num: '10',
    actor: 'EazePay',
    title: 'Ops · observability · platform-wide',
    subtitle: 'Command centre · audit · queues · approvals · sandbox',
    body: 'Internal-only views the EazePay ops team uses to run the platform. Control panel is the home base. Approvals queue surfaces partners pending KYB + lenders pending panel admission. Activity is a real-time firehose; audit is the immutable compliance trail. Queues + dead-letter expose async workers (BullMQ). Sandbox is the API playground reps + integration partners use to demo + debug.',
    hero: {
      file: '41-command-centre-control-panel.png',
      caption: 'Command centre · control panel',
      url: `${PARTNER_PORTAL}/control-panel`,
    },
    supporting: [
      { file: '42-partners-list.png', caption: 'Partners list', url: `${PARTNER_PORTAL}/partners` },
      {
        file: '43-approvals-queue.png',
        caption: 'Approvals queue',
        url: `${PARTNER_PORTAL}/approvals`,
      },
      {
        file: '44-activity-feed.png',
        caption: 'Activity firehose',
        url: `${PARTNER_PORTAL}/activity`,
      },
      { file: '45-audit-log.png', caption: 'Audit log', url: `${PARTNER_PORTAL}/audit` },
      {
        file: '46-queues-async-ops.png',
        caption: 'Queues · async ops',
        url: `${PARTNER_PORTAL}/queues`,
      },
      {
        file: '47-insights-platform-wide.png',
        caption: 'Insights · platform-wide',
        url: `${PARTNER_PORTAL}/insights`,
      },
      { file: '48-security.png', caption: 'Security', url: `${PARTNER_PORTAL}/security` },
      {
        file: '49-sandbox-api-playground.png',
        caption: 'Sandbox · API playground',
        url: `${PARTNER_PORTAL}/sandbox`,
      },
    ],
    endpoints: [
      { k: 'GET /control-panel', v: 'Ops home · platform health + active alerts' },
      { k: 'GET /events', v: 'Realtime firehose of every application_event' },
      { k: 'GET /audit', v: 'Compliance audit · immutable, query by actor/action/target' },
      { k: 'GET /queues', v: 'BullMQ worker status · job counts per queue' },
      { k: 'GET /dead-letter', v: 'Failed-job inspector · replay or discard' },
      { k: 'GET /sandbox', v: 'Live API playground with sample requests' },
    ],
    tables: [
      { k: 'audit_log', v: 'actor_id, action, target_type, target_id, payload, ip, ts' },
      { k: 'approvals', v: 'subject_type (partner/lender), subject_id, requested_by, status' },
      { k: 'activity', v: 'denormalised feed for the firehose UI' },
    ],
  },
];

export default function PlatformOverviewPage(): JSX.Element {
  return (
    <main className="po-root">
      <PoStyles />

      <header className="po-hero">
        <div className="po-hero-bg" aria-hidden />
        <div className="po-hero-content">
          <div className="po-eyebrow">
            <span className="po-eyebrow-dot" />
            EazePay platform · engineering walkthrough
          </div>
          <h1 className="po-h1">
            <span className="po-grad-1">How the entire</span>
            <br />
            <span className="po-grad-2">EazePay platform</span>
            <br />
            <span className="po-grad-1">actually works.</span>
          </h1>
          <p className="po-hero-sub">
            Ten phases. Forty-nine real screenshots from the live platform.
            <br />
            Every API endpoint, every webhook event, every database table.
            <br />
            Top to bottom — landing page to funded loan.
          </p>
          <div className="po-stats">
            <div className="po-stat">
              <div className="po-stat-v">10</div>
              <div className="po-stat-k">phases</div>
            </div>
            <div className="po-stat">
              <div className="po-stat-v">49</div>
              <div className="po-stat-k">screens</div>
            </div>
            <div className="po-stat">
              <div className="po-stat-v">40+</div>
              <div className="po-stat-k">endpoints</div>
            </div>
            <div className="po-stat">
              <div className="po-stat-v">6</div>
              <div className="po-stat-k">payload specs</div>
            </div>
          </div>
          <div className="po-scroll-cue">
            <div className="po-scroll-cue-text">Scroll to begin</div>
            <div className="po-scroll-cue-arrow">↓</div>
          </div>
        </div>
      </header>

      {PHASES.map((p, i) => (
        <PhaseSection key={p.num} phase={p} alt={i % 2 === 1} />
      ))}

      <footer className="po-footer">
        <div className="po-footer-inner">
          <div className="po-footer-eyebrow">End of walkthrough</div>
          <h2 className="po-footer-h">
            <span className="po-grad-1">Every card above</span>{' '}
            <span className="po-grad-2">opens the live URL.</span>
          </h2>
          <p className="po-footer-p">
            Real product, real data, captured at{' '}
            <span className="po-mono">eazepay-platform-production.up.railway.app</span>. Send this
            URL to your engineers and they can click through to any screen they need to dig into.
          </p>
          <a href={`${PARTNER_PORTAL}/sales/medpay`} className="po-cta">
            See the MedPay sales deck →
          </a>
        </div>
      </footer>
    </main>
  );
}

function PhaseSection({ phase, alt }: { phase: Phase; alt: boolean }): JSX.Element {
  return (
    <section className={`po-phase ${alt ? 'po-phase-alt' : ''}`} id={`phase-${phase.num}`}>
      <div className="po-phase-inner">
        <div className="po-phase-head">
          <div className="po-phase-num">{phase.num}</div>
          <div className="po-phase-head-text">
            <div className="po-phase-actor">{phase.actor}</div>
            <h2 className="po-phase-title">{phase.title}</h2>
            <div className="po-phase-subtitle">{phase.subtitle}</div>
          </div>
        </div>

        <p className="po-phase-body">{phase.body}</p>

        <div className="po-hero-shot">
          <a
            href={phase.hero.url}
            target="_blank"
            rel="noopener noreferrer"
            className="po-hero-shot-link"
          >
            <div className="po-hero-shot-frame">
              <div className="po-browser-bar">
                <span className="po-browser-dot" />
                <span className="po-browser-dot" />
                <span className="po-browser-dot" />
                <span className="po-browser-url">{phase.hero.url.replace(PARTNER_PORTAL, '')}</span>
              </div>
              <div className="po-hero-shot-img">
                <Image
                  src={`/screenshots/${phase.hero.file}`}
                  alt={phase.hero.caption}
                  width={1440}
                  height={900}
                  sizes="(max-width: 900px) 100vw, 900px"
                  priority={phase.num === '01'}
                  className="po-img"
                />
              </div>
            </div>
            <div className="po-hero-shot-caption">{phase.hero.caption}</div>
          </a>
        </div>

        {phase.supporting && phase.supporting.length > 0 && (
          <div className="po-supporting">
            <div className="po-supporting-h">Related screens in this phase</div>
            <div className="po-supporting-grid">
              {phase.supporting.map((s, i) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="po-supporting-card"
                >
                  <div className="po-supporting-img">
                    <Image
                      src={`/screenshots/${s.file}`}
                      alt={s.caption}
                      width={720}
                      height={450}
                      sizes="(max-width: 720px) 100vw, (max-width: 1100px) 33vw, 280px"
                      loading="lazy"
                      className="po-img"
                    />
                  </div>
                  <div className="po-supporting-meta">
                    <div className="po-supporting-caption">
                      {s.caption}
                      {s.external && <span className="po-ext">EXT</span>}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {(phase.endpoints || phase.pusher || phase.tables || phase.payloads) && (
          <div className="po-tech">
            <div className="po-tech-h">For engineers</div>
            <div className="po-tech-grid">
              {phase.endpoints && (
                <TechBlock title="HTTP endpoints" items={phase.endpoints} tone="blue" />
              )}
              {phase.pusher && (
                <TechBlock title="Pusher channels + events" items={phase.pusher} tone="violet" />
              )}
              {phase.tables && (
                <TechBlock title="Database tables touched" items={phase.tables} tone="indigo" />
              )}
            </div>
            {phase.payloads && phase.payloads.length > 0 && (
              <div className="po-payloads">
                {phase.payloads.map((p, i) => (
                  <div key={i} className="po-payload">
                    <div className="po-payload-h">{p.title}</div>
                    <pre className="po-payload-body">{p.body}</pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Connecting line to the next phase */}
      <div className="po-connector" aria-hidden>
        <span className="po-connector-line" />
      </div>
    </section>
  );
}

function TechBlock({
  title,
  items,
  tone,
}: {
  title: string;
  items: Spec[];
  tone: 'blue' | 'violet' | 'indigo';
}): JSX.Element {
  return (
    <div className={`po-tech-block po-tone-${tone}`}>
      <div className="po-tech-block-h">{title}</div>
      <ul className="po-tech-list">
        {items.map((it, i) => (
          <li key={i} className="po-tech-row">
            <code className="po-tech-k">{it.k}</code>
            <span className="po-tech-v">{it.v}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PoStyles(): JSX.Element {
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />;
}

const CSS = `
.po-root {
  --po-bg: #0A0E1A;
  --po-bg-2: #0F1424;
  --po-bg-alt: #0C1020;
  --po-ink: #E2E8F0;
  --po-ink-dim: #94A3B8;
  --po-ink-faint: #475569;
  --po-blue: #60A5FA;
  --po-blue-2: #3B82F6;
  --po-violet: #A78BFA;
  --po-violet-2: #8B5CF6;
  --po-indigo: #818CF8;
  --po-line: rgba(148, 163, 184, 0.10);
  --po-line-strong: rgba(148, 163, 184, 0.22);
  --po-card: rgba(255, 255, 255, 0.03);
  --po-card-hover: rgba(255, 255, 255, 0.06);

  margin: 0; padding: 0;
  background: var(--po-bg);
  color: var(--po-ink);
  min-height: 100vh;
  font-family: var(--font-inter), Inter, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  scroll-behavior: smooth;
}
.po-root * { box-sizing: border-box; }
.po-root a { color: inherit; text-decoration: none; }
.po-mono { font-family: ui-monospace, "SF Mono", Menlo, monospace; }

/* ===== HERO ===== */
.po-hero {
  position: relative;
  min-height: 100vh;
  display: flex; align-items: center; justify-content: center;
  padding: 80px 32px;
  text-align: center;
  overflow: hidden;
}
.po-hero-bg {
  position: absolute; inset: 0;
  background:
    radial-gradient(ellipse 80% 60% at 20% 20%, rgba(139, 92, 246, 0.18) 0%, transparent 60%),
    radial-gradient(ellipse 70% 60% at 80% 30%, rgba(59, 130, 246, 0.16) 0%, transparent 60%),
    radial-gradient(ellipse 90% 50% at 50% 100%, rgba(139, 92, 246, 0.12) 0%, transparent 55%),
    linear-gradient(180deg, #0A0E1A 0%, #050811 100%);
}
.po-hero-content { position: relative; z-index: 1; max-width: 900px; }
.po-eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 7px 16px;
  border-radius: 999px;
  background: rgba(139, 92, 246, 0.10);
  border: 1px solid rgba(139, 92, 246, 0.28);
  font-size: 12px; font-weight: 700;
  letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--po-violet);
}
.po-eyebrow-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--po-violet);
  box-shadow: 0 0 12px var(--po-violet);
}
.po-h1 {
  margin: 36px 0 28px;
  font-size: clamp(48px, 7vw, 96px);
  font-weight: 800;
  line-height: 1.02;
  letter-spacing: -0.035em;
}
.po-grad-1 {
  background: linear-gradient(135deg, #fff 0%, #CBD5E1 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.po-grad-2 {
  background: linear-gradient(135deg, var(--po-blue) 0%, var(--po-violet) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.po-hero-sub {
  max-width: 700px; margin: 0 auto;
  font-size: clamp(16px, 1.4vw, 19px);
  line-height: 1.65;
  color: var(--po-ink-dim);
}
.po-stats {
  display: flex; justify-content: center; gap: 56px;
  margin: 48px auto 0;
  flex-wrap: wrap;
}
.po-stat { text-align: center; }
.po-stat-v {
  font-size: 44px; font-weight: 800;
  letter-spacing: -0.04em;
  background: linear-gradient(135deg, var(--po-blue) 0%, var(--po-violet) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.po-stat-k {
  margin-top: 4px;
  font-size: 11px; font-weight: 700;
  letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--po-ink-faint);
}
.po-scroll-cue {
  position: absolute; bottom: 32px; left: 50%; transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  color: var(--po-ink-faint);
  animation: poBob 2.4s ease-in-out infinite;
}
@keyframes poBob {
  0%, 100% { transform: translate(-50%, 0); }
  50% { transform: translate(-50%, 6px); }
}
.po-scroll-cue-text {
  font-size: 10px; font-weight: 700;
  letter-spacing: 0.2em; text-transform: uppercase;
}
.po-scroll-cue-arrow { font-size: 20px; opacity: 0.6; }

/* ===== PHASE ===== */
.po-phase {
  position: relative;
  padding: 96px 32px 32px;
  background: var(--po-bg);
}
.po-phase-alt {
  background: var(--po-bg-alt);
}
.po-phase-inner {
  max-width: 1100px;
  margin: 0 auto;
}
.po-phase-head {
  display: grid; grid-template-columns: 100px 1fr;
  gap: 28px;
  align-items: center;
  margin-bottom: 24px;
}
.po-phase-num {
  display: flex; align-items: center; justify-content: center;
  width: 88px; height: 88px;
  border-radius: 24px;
  background: linear-gradient(135deg, var(--po-blue-2) 0%, var(--po-violet-2) 100%);
  color: #fff;
  font-size: 32px; font-weight: 800;
  letter-spacing: -0.02em;
  box-shadow:
    0 24px 48px -20px rgba(59, 130, 246, 0.6),
    0 12px 24px -12px rgba(139, 92, 246, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}
.po-phase-actor {
  display: inline-block;
  margin-bottom: 8px;
  padding: 3px 12px; border-radius: 999px;
  background: rgba(129, 140, 248, 0.10);
  border: 1px solid rgba(129, 140, 248, 0.30);
  font-size: 10.5px; font-weight: 700;
  letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--po-indigo);
}
.po-phase-title {
  margin: 0 0 6px;
  font-size: clamp(28px, 3.6vw, 44px);
  font-weight: 800;
  letter-spacing: -0.028em;
  line-height: 1.1;
  background: linear-gradient(135deg, #fff 0%, #CBD5E1 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.po-phase-subtitle {
  font-size: 15px; font-weight: 600;
  color: var(--po-blue);
  letter-spacing: -0.005em;
}
.po-phase-body {
  margin: 0 0 40px;
  font-size: 16.5px; line-height: 1.65;
  color: var(--po-ink-dim);
  max-width: 820px;
}

/* ===== HERO SHOT ===== */
.po-hero-shot {
  margin: 40px auto 32px;
  max-width: 980px;
}
.po-hero-shot-link { display: block; }
.po-hero-shot-frame {
  border-radius: 16px;
  background: var(--po-bg-2);
  border: 1px solid var(--po-line-strong);
  overflow: hidden;
  box-shadow:
    0 40px 80px -32px rgba(59, 130, 246, 0.35),
    0 20px 40px -20px rgba(139, 92, 246, 0.25),
    0 0 0 1px rgba(255, 255, 255, 0.04) inset;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}
.po-hero-shot-link:hover .po-hero-shot-frame {
  transform: translateY(-4px);
  box-shadow:
    0 56px 100px -32px rgba(59, 130, 246, 0.5),
    0 28px 48px -20px rgba(139, 92, 246, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.08) inset;
}
.po-browser-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 14px 18px;
  background: var(--po-bg);
  border-bottom: 1px solid var(--po-line);
}
.po-browser-dot {
  width: 11px; height: 11px;
  border-radius: 50%;
  background: var(--po-line-strong);
}
.po-browser-dot:nth-child(1) { background: #FF5F57; }
.po-browser-dot:nth-child(2) { background: #FEBC2E; }
.po-browser-dot:nth-child(3) { background: #28C840; }
.po-browser-url {
  margin-left: 16px;
  padding: 4px 12px;
  border-radius: 6px;
  background: var(--po-bg-2);
  border: 1px solid var(--po-line);
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 12px;
  color: var(--po-ink-dim);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 540px;
}
.po-hero-shot-img {
  background: #F8FAFC;
  aspect-ratio: 16 / 10;
  overflow: hidden;
}
.po-img {
  display: block;
  width: 100%; height: 100%;
  object-fit: cover; object-position: top center;
}
.po-hero-shot-caption {
  margin-top: 14px;
  text-align: center;
  font-size: 13px; font-weight: 600;
  color: var(--po-ink-faint);
  letter-spacing: 0.04em; text-transform: uppercase;
}

/* ===== SUPPORTING ===== */
.po-supporting { margin-top: 56px; }
.po-supporting-h {
  margin-bottom: 16px;
  font-size: 11.5px; font-weight: 700;
  letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--po-ink-faint);
}
.po-supporting-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
}
.po-supporting-card {
  display: block;
  border-radius: 12px;
  background: var(--po-card);
  border: 1px solid var(--po-line);
  overflow: hidden;
  transition: transform 0.25s ease, border-color 0.25s ease, background 0.25s ease;
}
.po-supporting-card:hover {
  transform: translateY(-3px);
  border-color: var(--po-line-strong);
  background: var(--po-card-hover);
}
.po-supporting-img {
  aspect-ratio: 16 / 10;
  background: #F8FAFC;
  overflow: hidden;
}
.po-supporting-meta {
  padding: 12px 14px;
  border-top: 1px solid var(--po-line);
}
.po-supporting-caption {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; font-weight: 600;
  color: var(--po-ink);
  letter-spacing: -0.008em;
}
.po-ext {
  padding: 2px 6px; border-radius: 4px;
  background: rgba(139, 92, 246, 0.16);
  color: var(--po-violet);
  font-size: 9.5px; font-weight: 700; letter-spacing: 0.12em;
}

/* ===== TECH ===== */
.po-tech {
  margin-top: 56px;
  padding: 28px 32px;
  border-radius: 18px;
  background:
    radial-gradient(ellipse 60% 100% at 0% 0%, rgba(59, 130, 246, 0.10), transparent 60%),
    var(--po-card);
  border: 1px solid var(--po-line-strong);
}
.po-tech-h {
  display: inline-block;
  margin-bottom: 20px;
  padding: 5px 14px;
  border-radius: 999px;
  background: rgba(96, 165, 250, 0.10);
  border: 1px solid rgba(96, 165, 250, 0.30);
  font-size: 10.5px; font-weight: 700;
  letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--po-blue);
}
.po-tech-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
}
.po-tech-block {
  padding: 18px 20px;
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.20);
  border: 1px solid var(--po-line);
}
.po-tone-blue { border-left: 3px solid var(--po-blue); }
.po-tone-violet { border-left: 3px solid var(--po-violet); }
.po-tone-indigo { border-left: 3px solid var(--po-indigo); }
.po-tech-block-h {
  margin-bottom: 14px;
  font-size: 11px; font-weight: 700;
  letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--po-ink-faint);
}
.po-tech-list {
  list-style: none; padding: 0; margin: 0;
  display: flex; flex-direction: column; gap: 12px;
}
.po-tech-row {
  display: flex; flex-direction: column; gap: 4px;
}
.po-tech-k {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 12px; font-weight: 600;
  color: var(--po-ink);
  padding: 3px 7px;
  border-radius: 5px;
  background: rgba(96, 165, 250, 0.10);
  align-self: flex-start;
  letter-spacing: -0.01em;
}
.po-tech-v {
  font-size: 13px; line-height: 1.5;
  color: var(--po-ink-dim);
}

/* ===== PAYLOAD ===== */
.po-payloads {
  margin-top: 24px;
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
}
.po-payload {
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--po-line);
}
.po-payload-h {
  padding: 11px 18px;
  background: rgba(0, 0, 0, 0.40);
  color: var(--po-blue);
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 11.5px; font-weight: 700;
  letter-spacing: 0.04em;
}
.po-payload-body {
  margin: 0; padding: 16px 20px;
  background: rgba(0, 0, 0, 0.30);
  color: #CBD5E1;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 12px; line-height: 1.6;
  white-space: pre-wrap;
  overflow-x: auto;
}

/* ===== CONNECTOR BETWEEN PHASES ===== */
.po-connector {
  display: flex; justify-content: center;
  margin-top: 64px;
}
.po-connector-line {
  display: block;
  width: 2px; height: 96px;
  background: linear-gradient(180deg, var(--po-blue) 0%, var(--po-violet) 100%);
  opacity: 0.6;
  border-radius: 2px;
}
.po-phase:last-of-type .po-connector { display: none; }

/* ===== FOOTER ===== */
.po-footer {
  padding: 120px 32px 120px;
  text-align: center;
  background:
    radial-gradient(ellipse 80% 60% at 50% 0%, rgba(139, 92, 246, 0.16) 0%, transparent 60%),
    var(--po-bg);
}
.po-footer-inner { max-width: 800px; margin: 0 auto; }
.po-footer-eyebrow {
  margin-bottom: 18px;
  font-size: 11px; font-weight: 700;
  letter-spacing: 0.2em; text-transform: uppercase;
  color: var(--po-ink-faint);
}
.po-footer-h {
  margin: 0 0 24px;
  font-size: clamp(36px, 5vw, 60px);
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -0.03em;
}
.po-footer-p {
  font-size: 17px; line-height: 1.65;
  color: var(--po-ink-dim);
  margin-bottom: 36px;
}
.po-footer-p .po-mono {
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  font-size: 14.5px;
  color: var(--po-ink);
}
.po-cta {
  display: inline-flex; align-items: center;
  padding: 16px 32px;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--po-blue-2) 0%, var(--po-violet-2) 100%);
  color: #fff;
  font-size: 15px; font-weight: 700;
  letter-spacing: -0.008em;
  box-shadow:
    0 20px 40px -16px rgba(59, 130, 246, 0.6),
    0 10px 20px -8px rgba(139, 92, 246, 0.5);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.po-cta:hover {
  transform: translateY(-2px);
  box-shadow:
    0 28px 56px -16px rgba(59, 130, 246, 0.7),
    0 14px 28px -8px rgba(139, 92, 246, 0.6);
}

@media (max-width: 720px) {
  .po-phase { padding: 64px 20px 20px; }
  .po-phase-head { grid-template-columns: 1fr; gap: 16px; }
  .po-phase-num { width: 64px; height: 64px; font-size: 24px; }
  .po-browser-url { max-width: 200px; }
  .po-stats { gap: 32px; }
  .po-stat-v { font-size: 36px; }
  .po-connector-line { height: 64px; }
}
`;
