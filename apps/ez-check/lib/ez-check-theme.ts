/**
 * EZ Check — light-blue / slate theme + product config.
 *
 * EZ Check is a SEPARATE product line from the MedPay / TradePay /
 * CoachPay lender marketplace family. It deliberately lives in its
 * own theme module rather than `brand-theme.ts`:
 *
 *   • Different product (pre-qualification engine, not a lender
 *     marketplace) — no industry mapping, no `INDUSTRY_TO_BRAND`.
 *   • Different commercial shape ($5,000 setup + $3 per data pull —
 *     no origination percentage, no monthly).
 *   • Different palette (sky-blue / slate) — not part of the
 *     teal-orange-purple brand family.
 *
 * What's intentionally NOT named here:
 *   The two SaaS systems EZ Check wires into for the onboarding
 *   handoff. Those are internal wiring details — the public-facing
 *   copy describes the capability ("pre-qualification engine,"
 *   "smart form," "smart routing") without naming the vendors.
 */

export type EzCheckPalette = {
  /** Primary accent — buttons, active states, focus rings. */
  accent: string;
  /** Lighter accent — hover gradient endpoints. */
  accentLight: string;
  /** Deep accent — used in dark gradients + headlines. */
  accentDeep: string;
  /** Secondary accent — purple. Used for the "alt category" (Tier C
   *  buyers, masterclass / nurture terminals, the animated buyer-dot
   *  in the routing tree). Locked to violet so the brand stays in the
   *  light-blue / navy-blue / purple / white / grey palette only. */
  purple: string;
  /** Lighter purple — hover, gradient lighter stop. */
  purpleLight: string;
  /** Deeper purple — dark gradients, text on light. */
  purpleDeep: string;
  /** Surface tint applied to light backgrounds. */
  surfaceTint: string;
  /** Ink — primary text on light. */
  ink: string;
  /** Secondary ink — body copy on light. */
  ink2: string;
  /** Muted text — labels, meta. */
  mute: string;
  /** Hairline border color. */
  line: string;
  /** Stronger hairline border color. */
  lineStrong: string;
};

/**
 * Brand palette — light-blue / navy-blue / purple / white / grey only.
 * Anything outside these five families is off-brand for EZ Check and
 * should not appear on any surface (landing, sales deck, checkout,
 * onboarding).
 */
export const EZ_CHECK_PALETTE: EzCheckPalette = {
  accent: '#3B82F6', // light blue — primary
  accentLight: '#60A5FA', // light blue — lighter
  accentDeep: '#1E3A8A', // navy blue — deep
  purple: '#8B5CF6', // violet-500
  purpleLight: '#A78BFA', // violet-400
  purpleDeep: '#5B21B6', // violet-800
  surfaceTint: '#F0F9FF', // near-white wash
  ink: '#0F172A', // slate-900 (acts as near-black)
  ink2: '#1E293B', // slate-800
  mute: '#64748B', // slate-500 (grey)
  line: 'rgba(59, 130, 246, 0.12)',
  lineStrong: 'rgba(59, 130, 246, 0.22)',
};

/**
 * Headline product copy that appears consistently across surfaces.
 * Defined once here so a change to the tagline doesn't drift between
 * the landing page, sales deck, and checkout.
 */
export const EZ_CHECK_COPY = {
  name: 'EZ Check',
  markPrimary: 'EZ',
  markSecondary: 'Check',
  tagline: 'Fill your calendar with buyers, not form fillers.',
  subTagline:
    'Pre-qualification agents, smart form, smart routing — drop a single widget into your funnel and ship qualified buyers straight to your sales calendar.',
  setupFee: 5_000,
  perPullFee: 3,
} as const;

/**
 * The three onboarding modules. Each module on `/ez-check/onboarding`
 * corresponds to one entry here. Defined as a const so the landing,
 * checkout, and onboarding surfaces all read the same labels and
 * descriptions.
 */
export type EzCheckModule = {
  id: 'core' | 'helix' | 'oracle';
  n: '01' | '02' | '03';
  agent: 'CORE' | 'HELIX' | 'ORACLE';
  title: string;
  body: string;
  items: string[];
  time: string;
};

export const EZ_CHECK_MODULES: readonly EzCheckModule[] = [
  {
    id: 'core',
    n: '01',
    agent: 'CORE',
    title: 'Account setup',
    body: 'Provision your EZ Check workspace, invite your sales team, and connect the funnel domains that will host the widget. The data-pull meter wires up automatically.',
    items: [
      'Workspace provisioned',
      'Sales team invites · admin + closer roles',
      'Funnel domains verified',
    ],
    time: '≈ 5 min',
  },
  {
    id: 'helix',
    n: '02',
    agent: 'HELIX',
    title: 'Smart form + smart routing',
    body: 'Configure the fields your buyers see, set up the routing rules that decide which calendar each qualified buyer lands on, and drop the embed snippet into your landing page or CRM. Routes to your existing CRM the same minute the buyer hits qualified.',
    items: [
      'Smart-form field configuration',
      'Smart routing rules (calendar + sales rep)',
      'Embed snippet · CRM webhook · pixel tracking',
    ],
    time: '≈ 15 min',
  },
  {
    id: 'oracle',
    n: '03',
    agent: 'ORACLE',
    title: 'Pre-qualification agents',
    body: 'Tune the qualification thresholds (budget, intent, fundability), connect the data sources you want pulled on form submit, and review the test traffic. ORACLE runs every submission through the qualification agents before it touches your calendar.',
    items: [
      'Qualification threshold tuning',
      'Data-pull source connections',
      'Test traffic + dry-run dashboard',
    ],
    time: '≈ 20 min',
  },
] as const;
