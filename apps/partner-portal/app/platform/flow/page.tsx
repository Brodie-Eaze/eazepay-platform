/**
 * /platform/flow — full engineering walkthrough of the EazePay
 * platform. Real screenshots from production + the technical detail
 * an engineer needs to understand how the whole system fits together:
 * API endpoints, webhook events, Pusher channels, DB tables, and the
 * payload shape at each step.
 *
 * Audience: EazePay engineers, integration partners, technical
 * stakeholders. Public route (no auth) so it can be linked into Slack /
 * Notion / partner-onboarding docs.
 *
 * Re-capture screenshots:
 *   node apps/partner-portal/scripts/capture-flow-screenshots.mjs
 */
import type { Metadata } from 'next';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'EazePay platform · full engineering walkthrough',
  description: 'Every screen, every API endpoint, every webhook, end-to-end. Built for engineers.',
};

const BASE = 'https://eazepay-platform-production.up.railway.app';

interface Shot {
  file: string;
  caption: string;
  href: string;
  external?: boolean;
}
interface TechSpec {
  label: string;
  value: string;
}
interface Payload {
  title: string;
  body: string;
}
interface Phase {
  num: string;
  title: string;
  subtitle: string;
  actor: 'Operator' | 'Consumer' | 'EazePay' | 'Lender';
  narrative: string;
  shots: Shot[];
  endpoints?: TechSpec[];
  pusher?: TechSpec[];
  tables?: TechSpec[];
  payloads?: Payload[];
}

const PHASES: Phase[] = [
  {
    num: '01',
    title: 'Operator discovers the platform',
    subtitle: 'Per-vertical brand landing pages funnel by industry · sales rep walks the deck',
    actor: 'Operator',
    narrative:
      'Each vertical has its own brand (MedPay / TradePay / CoachPay) with a dedicated landing page and sales deck. The deck is the rep-led pitch; the landing page is the self-serve marketing site. Both are public — no auth — so reps can drop the link in cold outreach.',
    shots: [
      { file: '01-medpay-landing.png', caption: 'MedPay landing', href: `${BASE}/landing/medpay` },
      {
        file: '02-tradepay-landing.png',
        caption: 'TradePay landing',
        href: `${BASE}/landing/tradepay`,
      },
      {
        file: '03-coachpay-landing.png',
        caption: 'CoachPay landing',
        href: `${BASE}/landing/coachpay`,
      },
      {
        file: '04-medpay-sales-deck.png',
        caption: 'MedPay sales deck',
        href: `${BASE}/sales/medpay`,
      },
      {
        file: '05-tradepay-sales-deck.png',
        caption: 'TradePay sales deck',
        href: `${BASE}/sales/tradepay`,
      },
      {
        file: '06-coachpay-sales-deck.png',
        caption: 'CoachPay sales deck',
        href: `${BASE}/sales/coachpay`,
      },
    ],
    endpoints: [
      { label: 'GET /landing/[brand]', value: 'Public marketing landing page · server-rendered' },
      { label: 'GET /sales/[brand]', value: 'Rep-led sales deck · 28 slides · scroll-snap' },
    ],
    tables: [
      {
        label: 'partners',
        value: 'one row per operator after they sign up (KYB + Stripe customer id)',
      },
      { label: 'leads', value: 'inbound contact-form / deck-view tracking (rep follow-up)' },
    ],
  },

  {
    num: '02',
    title: 'Operator checks out',
    subtitle: 'Plan-aware Stripe checkout · 3 setup tiers',
    actor: 'Operator',
    narrative:
      "Checkout is a single page with three plan variants driven by ?plan=. The Stripe price id is selected per plan. On successful checkout, Stripe redirects to /welcome/[brand] with a session id that the welcome page exchanges for the operator's account record + onboarding link.",
    shots: [
      {
        file: '07-checkout-5k-tier.png',
        caption: '$5k tier',
        href: `${BASE}/medpay/checkout?plan=5k`,
      },
      {
        file: '08-checkout-10k-tier.png',
        caption: '$10k tier',
        href: `${BASE}/medpay/checkout?plan=10k`,
      },
      {
        file: '09-checkout-10k-guarantee.png',
        caption: '$10k + 10× guarantee',
        href: `${BASE}/medpay/checkout?plan=10k-guarantee`,
      },
      {
        file: '10-welcome-success.png',
        caption: 'Welcome / success',
        href: `${BASE}/welcome/medpay`,
      },
    ],
    endpoints: [
      { label: 'GET /[brand]/checkout?plan=', value: '5k | 10k | 10k-guarantee · plan-aware page' },
      {
        label: 'POST /api/checkout/session',
        value: 'Mints Stripe Checkout Session, returns redirect URL',
      },
      {
        label: 'POST /api/webhooks/stripe',
        value: 'checkout.session.completed · provisions partner + onboarding token',
      },
      {
        label: 'GET /welcome/[brand]?session_id=',
        value: 'Onboarding handoff · sets eazepay_at account cookie',
      },
    ],
    tables: [
      { label: 'partners', value: 'INSERT with stripe_customer_id, plan, brand, contact_email' },
      { label: 'onboarding_tokens', value: 'one-time-use token, 7d TTL, bound to partner_id' },
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
    title: 'Onboarding · configure 4 modules',
    subtitle: 'HighSale (with Pixie) · Partner portal config · Lender marketplace · MyCamp',
    actor: 'Operator',
    narrative:
      "The onboarding hub gates 4 module configurations. Operator wires up:\n\n• HighSale account — contains Pixie, the smart-form + smart-routing engine. The intake form they'll embed is configured here. External SaaS, called over HTTPS API from our edge.\n• Partner portal config — branding, team members, default routing tiers (signup wizard).\n• Lender marketplace setup — picks which lenders to enable from our panel, sets per-tier rules (credit band → which lender first).\n• MyCamp — payment processor configuration for receiving setup fees + per-loan origination fees.\n\nWhen all 4 modules are 'complete', the partner portal unlocks. Each module's state is persisted to onboarding_steps.",
    shots: [
      {
        file: '11-onboarding-hub.png',
        caption: 'Onboarding hub · 4 module status',
        href: `${BASE}/medpay/onboarding`,
      },
      {
        file: '12-partner-portal-signup-config.png',
        caption: 'Partner portal config',
        href: `${BASE}/medpay/signup`,
      },
      {
        file: '13-highsale-pixie-external.png',
        caption: 'HighSale + Pixie · smart form',
        href: 'https://highsale.com/',
        external: true,
      },
      {
        file: '14-lender-marketplace-setup.png',
        caption: 'Lender marketplace setup',
        href: `${BASE}/medpay/onboarding/lender-marketplace`,
      },
      {
        file: '15-mycamp-processor-external.png',
        caption: 'MyCamp · payment processor',
        href: 'https://micamp.com/',
        external: true,
      },
    ],
    endpoints: [
      { label: 'GET /[brand]/onboarding', value: 'Hub showing 4 module status + CTAs' },
      {
        label: 'GET /api/onboarding/state',
        value: 'Returns per-module status for the current partner',
      },
      {
        label: 'POST /api/onboarding/[module]/complete',
        value: 'Marks a module complete (idempotent)',
      },
      { label: 'POST /api/lenders/enable', value: 'Toggles a lender for this partner' },
      {
        label: 'POST /api/integrations/highsale/connect',
        value: 'OAuth handoff to HighSale; returns api_key',
      },
      {
        label: 'POST /api/integrations/mycamp/connect',
        value: 'OAuth handoff to MyCamp; returns merchant_id',
      },
    ],
    tables: [
      {
        label: 'onboarding_steps',
        value: 'partner_id, module, status, completed_at, payload (jsonb)',
      },
      {
        label: 'integrations',
        value: 'partner_id, provider (highsale/mycamp), credentials (encrypted)',
      },
      { label: 'partner_lenders', value: 'partner_id × lender_id with tier rules + priority' },
    ],
  },

  {
    num: '04',
    title: 'Operator enters the partner portal',
    subtitle: 'Per-brand workspace · /v/[brand]/* · team + API keys + send-link',
    actor: 'Operator',
    narrative:
      "Once onboarding is green, the operator lands in /v/[brand]/*. The portal is namespaced by brand so a MedPay operator and a TradePay operator never see each other's pipeline. Inside they can: view live pipeline, send a branded application link to a client (SMS / email / QR), manage their team + roles, rotate API keys for direct programmatic integration, and tune their settings.",
    shots: [
      { file: '16-portal-home-dashboard.png', caption: 'Portal home', href: `${BASE}/v/medpay` },
      {
        file: '17-portal-send-link-to-client.png',
        caption: 'Send link to client',
        href: `${BASE}/v/medpay/send-link`,
      },
      {
        file: '18-portal-submit-application.png',
        caption: 'Submit application directly',
        href: `${BASE}/v/medpay/submit`,
      },
      {
        file: '19-portal-team-management.png',
        caption: 'Team + roles',
        href: `${BASE}/v/medpay/team`,
      },
      { file: '20-portal-api-keys.png', caption: 'API keys', href: `${BASE}/v/medpay/api-keys` },
      { file: '21-portal-settings.png', caption: 'Settings', href: `${BASE}/v/medpay/settings` },
    ],
    endpoints: [
      { label: 'GET /v/[brand]', value: 'Portal home — pipeline cards + recent activity' },
      {
        label: 'POST /api/applications/send-link',
        value: 'Generates branded apply URL + dispatches SMS/email',
      },
      { label: 'POST /api/applications', value: 'Direct create from operator (bypass send-link)' },
      { label: 'GET /api/team', value: 'List of team members + roles' },
      { label: 'POST /api/api-keys', value: 'Mint new API key · prefix + scope' },
    ],
    tables: [
      {
        label: 'application_links',
        value: 'short-code, partner_id, brand, client_handle, expires_at',
      },
      { label: 'team_members', value: 'partner_id × user_id with role (admin/operator/viewer)' },
      { label: 'api_keys', value: 'prefix, hashed_secret, scope[], last_used_at' },
    ],
  },

  {
    num: '05',
    title: 'Client opens intake form',
    subtitle: 'Pixie smart-form on the front · HighSale API on the back',
    actor: 'Consumer',
    narrative:
      "Client clicks the link, lands on /apply/[brand]/[partnerId]. The visible form is Pixie — adapts on partial answers, routes by intent. Behind the scenes HighSale API is plugged into the back of the form. As fields complete, HighSale runs the financial data (soft-pull credit, income verification, DTI calculation) and assembles the full pre-approval profile.\n\nThis profile is then pushed to EazePay's decision engine in the cloud via POST /api/applications/[id]/decision. The decision engine fans the profile out to the configured lender panel in parallel.",
    shots: [
      {
        file: '22-client-intake-pixie-smart-form.png',
        caption: 'Pixie smart form · branded intake',
        href: `${BASE}/apply/medpay`,
      },
    ],
    endpoints: [
      {
        label: 'GET /apply/[brand]/[partnerId?]',
        value: 'Public consumer intake page · no auth required',
      },
      { label: 'POST /api/applications', value: 'Creates application row in pending state' },
      {
        label: 'POST /api/applications/[id]/profile',
        value: 'Pixie pushes partial-form snapshots as user types',
      },
      {
        label: 'POST /api/applications/[id]/decision',
        value: 'Triggers decision engine fan-out (sync ~200ms response)',
      },
      {
        label: 'GET /api/integrations/highsale/score',
        value: 'Server-to-server pull of HighSale verdict',
      },
    ],
    tables: [
      {
        label: 'applications',
        value: 'id, partner_id, brand, consumer_first/last, amount_cents, status, created_at',
      },
      {
        label: 'application_events',
        value: 'append-only ledger · every state transition with payload (jsonb)',
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
    title: 'Decision engine + lender marketplace',
    subtitle: 'Fan-out to configured lender panel · parallel quote · propensity scoring',
    actor: 'EazePay',
    narrative:
      "The decision engine receives the pre-approval profile and fans it out across the operator's configured lender panel in parallel. Each lender exposes a /quote endpoint over HTTPS — we send the same canonical profile shape to all of them and wait for quotes to return (timeout: 8s).\n\nQuotes come back with: approved (yes/no), amount range, APR, term, monthly payment estimate, and a quote_id. The engine propensity-scores each approved quote (likelihood the lender will fund through underwriting given this buyer profile) and ranks them cheapest-first by total cost.",
    shots: [
      {
        file: '23-lenders-panel-admin-view.png',
        caption: 'Lender panel · admin view',
        href: `${BASE}/lenders`,
      },
      {
        file: '24-marketplaces-panel-admin.png',
        caption: 'Marketplaces panel · admin',
        href: `${BASE}/marketplaces`,
      },
      {
        file: '25-lender-marketplace-public-dev-hub.png',
        caption: 'Public lender dev hub',
        href: `${BASE}/lender-marketplace`,
      },
    ],
    endpoints: [
      { label: 'GET /lenders', value: 'Internal — list of all lenders in panel + status' },
      { label: 'GET /marketplaces', value: 'Multi-lender groups (e.g. medical, home services)' },
      {
        label: 'POST [LENDER]/api/quote',
        value: 'Outbound — fired in parallel to every enabled lender',
      },
      {
        label: 'POST /api/decision/score',
        value: 'Internal propensity model · returns 0–100 score per quote',
      },
    ],
    tables: [
      {
        label: 'lenders',
        value: 'id, name, quote_endpoint, webhook_secret, api_credentials (encrypted)',
      },
      { label: 'marketplaces', value: 'lender grouping for vertical-specific panels' },
      {
        label: 'offers',
        value: 'application_id × lender_id with amount/apr/term/score (one row per quote)',
      },
    ],
    payloads: [
      {
        title: 'Outbound quote request to a lender',
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
    title: 'Offers land · 3 places at once',
    subtitle:
      "Real-time Pusher push · client's screen + operator's portal + EazePay command centre",
    actor: 'EazePay',
    narrative:
      "Decision engine finishes assembling the ranked offer stack and writes to the offers table. Then it fires a single Pusher event on channel app-[applicationId] that all three open clients are subscribed to:\n\n  • The buyer's offer-stack page (so they pick)\n  • The operator's open application-detail page (so they coach the close)\n  • EazePay's command-centre applications view (so we see every application across every operator in real time)\n\nIf any of those clients has the page closed, they get the next update via Pusher's connection-state recovery when they re-open. The offers table is the source of truth.",
    shots: [
      {
        file: '26-client-sees-ranked-offers.png',
        caption: 'Client offer stack (consumer)',
        href: `${BASE}/apply/medpay#offers`,
      },
      {
        file: '27-portal-applications-list.png',
        caption: 'Operator applications list',
        href: `${BASE}/v/medpay/applications`,
      },
      {
        file: '28-command-centre-all-applications.png',
        caption: 'Command centre · all applications',
        href: `${BASE}/applications`,
      },
      {
        file: '29-admin-marketplace-dashboard.png',
        caption: 'Admin marketplace dashboard',
        href: `${BASE}/admin/marketplace`,
      },
    ],
    pusher: [
      { label: 'channel', value: 'app-[applicationId]  (private)' },
      {
        label: 'event: offers-received',
        value: 'fires when offers table updates · payload = full offer stack',
      },
      { label: 'event: status-changed', value: 'fires on any application.status transition' },
      {
        label: 'channel: ops-all-apps',
        value: 'EazePay-only · firehose of every application across the platform',
      },
    ],
    endpoints: [
      {
        label: 'GET /api/applications/[id]',
        value: 'Source of truth read · returns app + offers + events',
      },
      {
        label: 'POST /api/realtime/publish',
        value: 'Internal · server-side Pusher publish wrapper',
      },
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
    title: 'Underwriting + outcome (webhook back)',
    subtitle:
      "Client picks offer · routed to lender · lender's webhook updates us · realtime push to portal + centre",
    actor: 'Lender',
    narrative:
      "Client picks an offer (UI is propensity-sorted but they can pick any approved one). We POST /api/offers/[id]/accept which marks the offer bound and hands the buyer over to the lender's signing flow. Lender does underwriting in their own system.\n\nWhen the lender resolves the loan, they POST our webhook at /api/v1/webhooks/lenders/[lenderSlug]. We HMAC-verify the signature, persist the event to applications + application_events + offers, fire the realtime push back to portal + centre, and (for high-signal events like decisioned/funded/defaulted) dispatch the outcome email + SMS to the operator.",
    shots: [
      {
        file: '30-application-detail-live-status.png',
        caption: 'App detail · live status',
        href: `${BASE}/v/medpay/applications/demo`,
      },
      {
        file: '31-webhooks-inbound-from-lenders.png',
        caption: 'Inbound webhooks log',
        href: `${BASE}/webhooks`,
      },
      {
        file: '32-events-log-audit-trail.png',
        caption: 'Events log · audit trail',
        href: `${BASE}/events`,
      },
      {
        file: '33-dead-letter-queue.png',
        caption: 'Dead-letter queue',
        href: `${BASE}/dead-letter`,
      },
    ],
    endpoints: [
      {
        label: 'POST /api/offers/[id]/accept',
        value: 'Client-side accept · marks offer bound · returns lender redirect',
      },
      {
        label: 'POST /api/v1/webhooks/lenders/[lender]',
        value: 'Lender inbound · HMAC-verified · idempotent persist',
      },
      {
        label: 'GET /api/v/[brand]/applications/[id]/status',
        value: 'Real DB read · portal status refresh',
      },
    ],
    pusher: [
      { label: 'event: status-changed', value: 'application.status flipped (e.g. bound → funded)' },
      {
        label: 'event: funded',
        value: 'loan.funded received · operator portal flips badge + plays chime',
      },
    ],
    tables: [
      {
        label: 'applications',
        value: 'status: pending → quoted → bound → funded | declined | defaulted',
      },
      {
        label: 'offers',
        value: 'updated with accepted_at, bound_at, declined_reason on lifecycle events',
      },
      {
        label: 'application_events',
        value: 'append-only · webhook_type, body, signature_valid, persisted_at',
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
    title: 'Money flows · billing · settlements · payouts',
    subtitle: 'Lender wires direct to operator · EazePay invoices the origination fee monthly',
    actor: 'EazePay',
    narrative:
      "The lender wires the loan amount direct to the operator's bank account within 48–72 hours of funding (no marketplace intermediary skim). EazePay does NOT touch the consumer money.\n\nSeparately, EazePay invoices the operator monthly for: (a) per-smart-form-lead fee ($3/lead through the Pixie intake) and (b) 4% origination fee on every loan that actually settled. The settlement is what flows into MyCamp processor and out of the operator's bank by ACH.",
    shots: [
      {
        file: '34-portal-billing.png',
        caption: 'Portal · billing',
        href: `${BASE}/v/medpay/billing`,
      },
      {
        file: '35-portal-settlements-payouts.png',
        caption: 'Portal · settlements / payouts',
        href: `${BASE}/v/medpay/settlements`,
      },
      {
        file: '36-portal-insights-pipeline.png',
        caption: 'Portal · insights / pipeline',
        href: `${BASE}/v/medpay/insights`,
      },
      {
        file: '37-admin-invoices.png',
        caption: 'Admin · invoices (all partners)',
        href: `${BASE}/invoices`,
      },
      { file: '38-admin-payouts.png', caption: 'Admin · payouts', href: `${BASE}/payouts` },
      {
        file: '39-admin-settlements.png',
        caption: 'Admin · settlements ledger',
        href: `${BASE}/settlements`,
      },
      {
        file: '40-admin-reports.png',
        caption: 'Admin · reports / exports',
        href: `${BASE}/reports`,
      },
    ],
    endpoints: [
      { label: 'GET /v/[brand]/billing', value: 'Per-operator invoice + line-item history' },
      { label: 'GET /api/invoices/[partnerId]', value: 'Returns rolling 12-month invoice history' },
      { label: 'POST /api/invoices/[id]/charge', value: 'MyCamp ACH pull on the due-date cron' },
      {
        label: 'POST /api/v1/webhooks/lenders/[lender]',
        value: 'loan.funded event drives the 4% origination accrual',
      },
    ],
    tables: [
      {
        label: 'invoices',
        value: 'partner_id, period_start/end, line_items (jsonb), total_cents, status',
      },
      { label: 'settlements', value: 'one row per loan that settled · drives origination revenue' },
      { label: 'payouts', value: 'lender wires (informational · the lender owns the rail)' },
    ],
  },

  {
    num: '10',
    title: 'Ops · observability · platform-wide',
    subtitle: 'Command centre · audit · queues · approvals · sandbox',
    actor: 'EazePay',
    narrative:
      'Internal-only views the EazePay ops team uses to run the platform. Control panel is the home base. Approvals queue surfaces partners pending KYB / lenders pending panel admission. Activity is a real-time firehose; audit is the immutable compliance trail. Queues + dead-letter expose async workers (Bull). Sandbox is the API playground.',
    shots: [
      {
        file: '41-command-centre-control-panel.png',
        caption: 'Command centre · control panel',
        href: `${BASE}/control-panel`,
      },
      { file: '42-partners-list.png', caption: 'Partners list', href: `${BASE}/partners` },
      { file: '43-approvals-queue.png', caption: 'Approvals queue', href: `${BASE}/approvals` },
      { file: '44-activity-feed.png', caption: 'Activity firehose', href: `${BASE}/activity` },
      { file: '45-audit-log.png', caption: 'Audit log', href: `${BASE}/audit` },
      { file: '46-queues-async-ops.png', caption: 'Queues · async ops', href: `${BASE}/queues` },
      {
        file: '47-insights-platform-wide.png',
        caption: 'Insights · platform-wide',
        href: `${BASE}/insights`,
      },
      { file: '48-security.png', caption: 'Security · keys + sessions', href: `${BASE}/security` },
      {
        file: '49-sandbox-api-playground.png',
        caption: 'Sandbox · API playground',
        href: `${BASE}/sandbox`,
      },
    ],
    endpoints: [
      { label: 'GET /control-panel', value: 'Ops home · platform health + active alerts' },
      { label: 'GET /events', value: 'Realtime firehose of every application_event' },
      { label: 'GET /audit', value: 'Compliance audit · immutable, query by actor/action/target' },
      { label: 'GET /queues', value: 'BullMQ worker status · job counts per queue' },
      { label: 'GET /dead-letter', value: 'Failed-job inspector · replay or discard' },
      { label: 'GET /sandbox', value: 'Live API playground with sample requests' },
    ],
    tables: [
      { label: 'audit_log', value: 'actor_id, action, target_type, target_id, payload, ip, ts' },
      {
        label: 'approvals',
        value: 'subject_type (partner/lender), subject_id, requested_by, status',
      },
      { label: 'activity', value: 'denormalised feed for the firehose UI' },
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
          EazePay platform · engineering walkthrough
        </div>
        <h1 className="pf-h1">
          <span className="pf-grad-deep">The full platform,</span>{' '}
          <span className="pf-grad">end to end.</span>
        </h1>
        <p className="pf-sub">
          Every screen, every API endpoint, every webhook event, every Pusher channel, every DB
          table — in the order a buyer + operator actually experience them.{' '}
          <strong>
            {PHASES.length} phases &middot; {totalShots} real screenshots
          </strong>{' '}
          from the live platform. Built for engineers.
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
          <PhaseBlock key={phase.num} phase={phase} />
        ))}
      </main>

      <footer className="pf-footer">
        <div className="pf-footer-row">
          <div>
            <div className="pf-footer-h">Every card is a live link.</div>
            <div className="pf-footer-s">
              Click any screenshot to open the exact URL on the live platform. External integrations
              (HighSale, MyCamp) open in a new tab.
            </div>
          </div>
          <a href="/sales/medpay" className="pf-cta">
            Sales deck →
          </a>
        </div>
        <div className="pf-footer-meta">
          {totalShots} shots · {PHASES.length} phases · base ={' '}
          <span className="pf-mono">eazepay-platform-production.up.railway.app</span> · re-capture
          with{' '}
          <span className="pf-mono">
            node apps/partner-portal/scripts/capture-flow-screenshots.mjs
          </span>
        </div>
      </footer>
    </div>
  );
}

function PhaseBlock({ phase }: { phase: Phase }): JSX.Element {
  return (
    <section id={`phase-${phase.num}`} className="pf-phase">
      <div className="pf-phase-head">
        <div className="pf-phase-num">{phase.num}</div>
        <div className="pf-phase-meta">
          <div className="pf-phase-actor">{phase.actor}</div>
          <h2 className="pf-phase-title">{phase.title}</h2>
          <p className="pf-phase-subtitle">{phase.subtitle}</p>
          <p className="pf-phase-intro">{phase.narrative}</p>
        </div>
      </div>

      <div className="pf-grid" data-count={phase.shots.length}>
        {phase.shots.map((shot, i) => (
          <ShotCard key={i} shot={shot} />
        ))}
      </div>

      {(phase.endpoints || phase.pusher || phase.tables || phase.payloads) && (
        <div className="pf-tech">
          <div className="pf-tech-head">For engineers</div>
          <div className="pf-tech-grid">
            {phase.endpoints && (
              <TechBlock title="HTTP endpoints" items={phase.endpoints} accent="blue" />
            )}
            {phase.pusher && (
              <TechBlock title="Pusher channels + events" items={phase.pusher} accent="violet" />
            )}
            {phase.tables && (
              <TechBlock title="Database tables touched" items={phase.tables} accent="indigo" />
            )}
          </div>
          {phase.payloads && (
            <div className="pf-payloads">
              {phase.payloads.map((p, i) => (
                <PayloadBlock key={i} payload={p} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ShotCard({ shot }: { shot: Shot }): JSX.Element {
  return (
    <a href={shot.href} target="_blank" rel="noopener noreferrer" className="pf-card">
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
        <div className="pf-card-hint">{shot.href.replace(BASE, '')}</div>
      </div>
    </a>
  );
}

function TechBlock({
  title,
  items,
  accent,
}: {
  title: string;
  items: TechSpec[];
  accent: 'blue' | 'violet' | 'indigo';
}): JSX.Element {
  return (
    <div className={`pf-tech-block pf-tech-${accent}`}>
      <div className="pf-tech-block-h">{title}</div>
      <ul className="pf-tech-list">
        {items.map((it, i) => (
          <li key={i} className="pf-tech-row">
            <code className="pf-tech-label">{it.label}</code>
            <span className="pf-tech-value">{it.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PayloadBlock({ payload }: { payload: Payload }): JSX.Element {
  return (
    <div className="pf-payload">
      <div className="pf-payload-h">{payload.title}</div>
      <pre className="pf-payload-body">{payload.body}</pre>
    </div>
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
  --pf-indigo: #6366F1;
  --pf-deep: #0B1224;
  --pf-ink: #0F172A;
  --pf-mute: #475569;
  --pf-line: rgba(59, 130, 246, 0.12);
  --pf-line-strong: rgba(59, 130, 246, 0.22);
  --pf-code-bg: #0B1224;
  --pf-code-fg: #E0E7FF;

  position: relative; min-height: 100vh;
  background: linear-gradient(180deg, #EEF2FF 0%, #FFFFFF 30%, #F5F3FF 65%, #FFFFFF 100%);
  color: var(--pf-ink);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}
.pf-root * { box-sizing: border-box; }
.pf-root a { color: inherit; text-decoration: none; }
.pf-mono { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.95em; }

.pf-mesh {
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
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
  padding: 6px 14px; border-radius: 999px;
  background: rgba(139, 92, 246, 0.12); border: 1px solid rgba(139, 92, 246, 0.24);
  font-size: 11.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--pf-violet);
}
.pf-eyebrow-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--pf-violet); }
.pf-h1 {
  margin: 24px 0 18px;
  font-size: clamp(40px, 6vw, 72px); font-weight: 800;
  line-height: 1.05; letter-spacing: -0.025em;
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
  max-width: 780px; margin: 0 auto 28px;
  font-size: 17px; line-height: 1.55; color: var(--pf-mute);
}
.pf-sub strong { color: var(--pf-ink); font-weight: 700; }
.pf-toc {
  display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 8px;
}
.pf-toc-link {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 14px 8px 8px; border-radius: 999px;
  background: rgba(255, 255, 255, 0.92); border: 1px solid var(--pf-line);
  font-size: 13px; font-weight: 600;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}
.pf-toc-link:hover {
  transform: translateY(-1px); border-color: var(--pf-line-strong);
  box-shadow: 0 6px 18px -10px rgba(59, 130, 246, 0.4);
}
.pf-toc-n {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 50%;
  background: var(--pf-blue); color: #fff;
  font-size: 11px; font-weight: 700;
}

/* ===== MAIN ===== */
.pf-main {
  position: relative; z-index: 1;
  max-width: 1320px; margin: 0 auto;
  padding: 40px 32px 80px;
}
.pf-phase {
  margin-bottom: 88px; scroll-margin-top: 32px;
}
.pf-phase-head {
  display: grid; grid-template-columns: 80px 1fr; gap: 24px;
  align-items: start; margin-bottom: 32px;
}
.pf-phase-num {
  display: flex; align-items: center; justify-content: center;
  width: 72px; height: 72px; border-radius: 20px;
  background: linear-gradient(135deg, var(--pf-blue) 0%, var(--pf-violet) 100%);
  color: #fff; font-size: 26px; font-weight: 800; letter-spacing: -0.01em;
  box-shadow:
    0 14px 32px -16px rgba(59, 130, 246, 0.6),
    0 8px 16px -8px rgba(139, 92, 246, 0.4);
}
.pf-phase-meta { padding-top: 4px; }
.pf-phase-actor {
  display: inline-block; margin-bottom: 8px;
  padding: 2px 10px; border-radius: 999px;
  background: rgba(99, 102, 241, 0.12); border: 1px solid rgba(99, 102, 241, 0.25);
  font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--pf-indigo);
}
.pf-phase-title {
  margin: 0 0 6px;
  font-size: 30px; font-weight: 800;
  letter-spacing: -0.024em; color: var(--pf-ink);
}
.pf-phase-subtitle {
  margin: 0 0 14px;
  font-size: 15px; font-weight: 600;
  color: var(--pf-blue); letter-spacing: -0.005em;
}
.pf-phase-intro {
  margin: 0;
  font-size: 15px; line-height: 1.6;
  color: var(--pf-mute); max-width: 880px;
  white-space: pre-wrap;
}

/* ===== GRID ===== */
.pf-grid {
  display: grid; gap: 18px;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  margin-bottom: 28px;
}
.pf-grid[data-count="1"] { grid-template-columns: minmax(0, 640px); justify-content: center; }
.pf-grid[data-count="2"] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.pf-grid[data-count="3"] { grid-template-columns: repeat(3, minmax(0, 1fr)); }
@media (max-width: 800px) {
  .pf-grid, .pf-grid[data-count="2"], .pf-grid[data-count="3"], .pf-grid[data-count="1"] {
    grid-template-columns: 1fr;
  }
}

/* ===== CARD ===== */
.pf-card {
  display: block; border-radius: 14px;
  background: #fff; border: 1px solid var(--pf-line);
  overflow: hidden;
  transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
}
.pf-card:hover {
  transform: translateY(-3px); border-color: var(--pf-line-strong);
  box-shadow:
    0 20px 40px -20px rgba(59, 130, 246, 0.35),
    0 10px 20px -10px rgba(139, 92, 246, 0.22);
}
.pf-card-img {
  position: relative; aspect-ratio: 16 / 10;
  background: linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 100%);
  overflow: hidden;
}
.pf-card-img-el {
  display: block; width: 100%; height: 100%;
  object-fit: cover; object-position: top center;
  transition: transform 0.5s ease;
}
.pf-card:hover .pf-card-img-el { transform: scale(1.02); }
.pf-card-overlay {
  position: absolute; inset: 0;
  display: flex; align-items: flex-end; justify-content: flex-end;
  padding: 12px;
  background: linear-gradient(180deg, transparent 60%, rgba(11, 18, 36, 0.55) 100%);
  opacity: 0; transition: opacity 0.25s ease;
}
.pf-card:hover .pf-card-overlay { opacity: 1; }
.pf-card-overlay-arrow {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: 50%;
  background: rgba(255, 255, 255, 0.95); color: var(--pf-blue);
  font-size: 16px; font-weight: 700;
}
.pf-card-meta {
  padding: 12px 14px 14px; border-top: 1px solid var(--pf-line);
}
.pf-card-caption {
  display: flex; align-items: center; gap: 8px;
  font-size: 13.5px; font-weight: 700;
  color: var(--pf-ink); letter-spacing: -0.01em;
}
.pf-card-ext {
  display: inline-flex; align-items: center;
  padding: 2px 6px; border-radius: 4px;
  background: rgba(139, 92, 246, 0.12); color: var(--pf-violet);
  font-size: 9.5px; font-weight: 700; letter-spacing: 0.1em;
}
.pf-card-hint {
  margin-top: 3px;
  font-size: 11px; font-weight: 500; color: var(--pf-mute);
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  letter-spacing: -0.005em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* ===== TECH SECTION ===== */
.pf-tech {
  margin-top: 8px;
  padding: 24px 28px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--pf-line-strong);
}
.pf-tech-head {
  display: inline-block;
  margin-bottom: 18px;
  padding: 4px 12px; border-radius: 999px;
  background: rgba(59, 130, 246, 0.12); border: 1px solid rgba(59, 130, 246, 0.24);
  font-size: 10.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--pf-blue);
}
.pf-tech-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px;
}
.pf-tech-block {
  padding: 16px 18px;
  border-radius: 12px;
  border: 1px solid var(--pf-line);
  background: #FAFBFF;
}
.pf-tech-blue { border-left: 3px solid var(--pf-blue); }
.pf-tech-violet { border-left: 3px solid var(--pf-violet); }
.pf-tech-indigo { border-left: 3px solid var(--pf-indigo); }
.pf-tech-block-h {
  margin-bottom: 12px;
  font-size: 12px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.1em;
  color: var(--pf-mute);
}
.pf-tech-list {
  list-style: none; padding: 0; margin: 0;
  display: flex; flex-direction: column; gap: 10px;
}
.pf-tech-row {
  display: flex; flex-direction: column; gap: 3px;
  font-size: 13px; line-height: 1.5;
}
.pf-tech-label {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 12px; font-weight: 600;
  color: var(--pf-deep); letter-spacing: -0.01em;
  padding: 2px 6px; border-radius: 4px;
  background: rgba(59, 130, 246, 0.08);
  align-self: flex-start;
}
.pf-tech-value { color: var(--pf-mute); }

/* ===== PAYLOAD ===== */
.pf-payloads {
  margin-top: 20px;
  display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: 14px;
}
.pf-payload {
  border-radius: 12px; overflow: hidden;
  border: 1px solid rgba(11, 18, 36, 0.08);
}
.pf-payload-h {
  padding: 10px 16px;
  background: var(--pf-deep); color: var(--pf-blue-2);
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 11.5px; font-weight: 700;
  letter-spacing: 0.04em;
}
.pf-payload-body {
  margin: 0; padding: 16px 18px;
  background: var(--pf-code-bg); color: var(--pf-code-fg);
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 12px; line-height: 1.55;
  white-space: pre-wrap; overflow-x: auto;
}

/* ===== FOOTER ===== */
.pf-footer {
  position: relative; z-index: 1;
  max-width: 1200px; margin: 0 auto;
  padding: 40px 32px 80px;
}
.pf-footer-row {
  display: grid; grid-template-columns: 1fr auto; gap: 24px;
  align-items: center;
  padding: 28px 32px; border-radius: 20px;
  background:
    radial-gradient(ellipse 60% 100% at 0% 50%, rgba(59, 130, 246, 0.18), transparent 60%),
    rgba(255, 255, 255, 0.92);
  border: 1px solid var(--pf-line-strong);
  box-shadow: 0 16px 40px -20px rgba(59, 130, 246, 0.3);
}
.pf-footer-h { font-size: 18px; font-weight: 700; color: var(--pf-ink); letter-spacing: -0.018em; }
.pf-footer-s { margin-top: 4px; font-size: 14px; color: var(--pf-mute); }
.pf-cta {
  display: inline-flex; align-items: center;
  padding: 12px 22px; border-radius: 999px;
  background: linear-gradient(120deg, var(--pf-blue) 0%, var(--pf-violet) 100%);
  color: #fff; font-size: 14px; font-weight: 700;
  box-shadow: 0 12px 28px -12px rgba(59, 130, 246, 0.55);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.pf-cta:hover { transform: translateY(-1px); box-shadow: 0 18px 36px -14px rgba(59, 130, 246, 0.65); }
.pf-footer-meta {
  margin-top: 18px; text-align: center;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 11px; color: var(--pf-mute); letter-spacing: 0.04em;
}

@media (max-width: 720px) {
  .pf-phase-head { grid-template-columns: 1fr; gap: 12px; }
  .pf-phase-num { width: 56px; height: 56px; font-size: 22px; }
  .pf-footer-row { grid-template-columns: 1fr; }
  .pf-tech { padding: 20px; }
}
`;
