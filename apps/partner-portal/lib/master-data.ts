// NO REAL CREDENTIAL STRINGS. CI grep enforces this at build time.
//
// UDAAP / CFPA §§1031, 1036 — synthetic NMLS numbers, state-count
// claims, CFL license numbers, or any other lender-credential string
// rendered into the operator UI is a deceptive representation the
// moment a screenshot leaks or a fixture gets accidentally promoted
// to a production-shaped environment. Until real credentials are
// issued AND a separate licensing service owns them, every credential
// field in this fixture must be a `*_PENDING` placeholder.
//
// The CI step `master-data-no-credentials` in .github/workflows/ci.yml
// greps this file for NMLS / CFL / state-count regressions and fails
// the build. Do not edit-around the grep; the grep is the control.

/**
 * Master-tier mock data for the EazePay Partner Portal admin pages.
 * Real data lands when the /v1/admin/* BFF routes are wired. Until
 * then, this file is the single source of truth so every Master page
 * stays consistent.
 *
 * All names + values here are synthetic — they exist only to render a
 * realistic-looking dashboard during development.
 */

export type Niche = 'coaching' | 'medical' | 'trades' | 'dental' | 'consumer';
// Aligned with the canonical BRANDS source-of-truth in @eazepay/shared-types.
// No spaces (MedPay, not "Med Pay") and vertical merchants get their vertical
// brand, not the parent label — coaching merchants are CoachPay, not "EAZE Pay".
export type ProductBrand = 'MedPay' | 'TradePay' | 'CoachPay' | 'Multi-brand';
export type ApprovalStatus = 'approved' | 'pending' | 'declined';

export interface PartnerSummary {
  id: string;
  initials: string;
  legalName: string;
  email: string;
  phone?: string;
  niche: Niche;
  product: ProductBrand;
  status: ApprovalStatus;
  approvedOn?: string;
  fundedCount: number;
  netCents: number;
}

export const partners: PartnerSummary[] = [
  {
    id: 'p_atlas',
    initials: 'AT',
    legalName: 'Atlas Executive Coaching',
    email: 'team@atlascoach.io',
    phone: '(212) 555-0144',
    niche: 'coaching',
    product: 'CoachPay',
    status: 'approved',
    approvedOn: '2026-04-02',
    fundedCount: 9,
    netCents: 312_400_00,
  },
  {
    id: 'p_helio',
    initials: 'HE',
    legalName: 'Helio Dental Group',
    email: 'finance@heliodental.com',
    phone: '(415) 555-0188',
    niche: 'dental',
    product: 'MedPay',
    status: 'approved',
    approvedOn: '2026-03-18',
    fundedCount: 7,
    netCents: 261_950_00,
  },
  {
    id: 'p_orion',
    initials: 'OR',
    legalName: 'Orion Roof & Solar',
    email: 'partners@orionroof.com',
    phone: '(602) 555-0202',
    niche: 'trades',
    product: 'TradePay',
    status: 'approved',
    approvedOn: '2026-03-12',
    fundedCount: 5,
    netCents: 198_700_00,
  },
  {
    id: 'p_brio',
    initials: 'BR',
    legalName: 'Brio Wellness Clinics',
    email: 'ar@briowellness.com',
    phone: '(310) 555-0301',
    niche: 'medical',
    product: 'MedPay',
    status: 'approved',
    approvedOn: '2026-03-05',
    fundedCount: 6,
    netCents: 184_220_00,
  },
  {
    id: 'p_kindred',
    initials: 'KI',
    legalName: 'Kindred Career Lab',
    email: 'hello@kindredcareer.com',
    phone: '(206) 555-0411',
    niche: 'coaching',
    product: 'CoachPay',
    status: 'approved',
    approvedOn: '2026-02-22',
    fundedCount: 4,
    netCents: 76_500_00,
  },
  {
    id: 'p_summit',
    initials: 'SU',
    legalName: 'Summit HVAC Pros',
    email: 'office@summithvacpros.com',
    phone: '(720) 555-0150',
    niche: 'trades',
    product: 'TradePay',
    status: 'approved',
    approvedOn: '2026-02-14',
    fundedCount: 3,
    netCents: 64_200_00,
  },
  {
    id: 'p_meridian',
    initials: 'ME',
    legalName: 'Meridian Vision Care',
    email: 'billing@meridianvision.com',
    phone: '(617) 555-0233',
    niche: 'medical',
    product: 'MedPay',
    status: 'approved',
    approvedOn: '2026-01-30',
    fundedCount: 3,
    netCents: 47_100_00,
  },
  {
    id: 'p_riverside',
    initials: 'RI',
    legalName: 'Riverside Renovation Co.',
    email: 'ops@riversidereno.com',
    phone: '(503) 555-0177',
    niche: 'trades',
    product: 'TradePay',
    status: 'approved',
    approvedOn: '2026-01-12',
    fundedCount: 2,
    netCents: 39_800_00,
  },
  {
    id: 'p_demo',
    initials: 'DE',
    legalName: 'EazePay Demo Workspace',
    email: 'demo@eazepay.test',
    phone: '555-1004',
    niche: 'consumer',
    product: 'Multi-brand',
    status: 'approved',
    approvedOn: '2025-12-04',
    fundedCount: 14,
    netCents: 218_950_00,
  },
];

export interface ApplicationRow {
  id: string;
  customer: string;
  customerEmail: string;
  partner: string;
  product: 'med-pay' | 'trade-pay' | 'coach-pay';
  amountCents: number;
  fico: number;
  lender: string;
  status: 'submitted' | 'in_review' | 'approved' | 'funded' | 'declined';
  date: string;
}

export const applications: ApplicationRow[] = [
  {
    id: 'a_001',
    customer: 'Cassidy Wren',
    customerEmail: 'cassidy.w@inbox.test',
    partner: 'Helio Dental Group',
    product: 'med-pay',
    amountCents: 7_400_00,
    fico: 612,
    lender: 'CapitalOne',
    status: 'submitted',
    date: '2026-05-04',
  },
  {
    id: 'a_002',
    customer: 'Tomas Ibarra',
    customerEmail: 'tomas.i@inbox.test',
    partner: 'Orion Roof & Solar',
    product: 'trade-pay',
    amountCents: 19_500_00,
    fico: 698,
    lender: 'CrossRiver',
    status: 'funded',
    date: '2026-05-04',
  },
  {
    id: 'a_003',
    customer: 'Priya Anand',
    customerEmail: 'priya.a@inbox.test',
    partner: 'EAZE Demo Workspace',
    product: 'trade-pay',
    amountCents: 32_750_00,
    fico: 742,
    lender: 'WebBank',
    status: 'approved',
    date: '2026-05-03',
  },
  {
    id: 'a_004',
    customer: 'Markus Hale',
    customerEmail: 'markus.h@inbox.test',
    partner: 'EAZE Demo Workspace',
    product: 'trade-pay',
    amountCents: 58_200_00,
    fico: 681,
    lender: 'LeadBank',
    status: 'submitted',
    date: '2026-05-03',
  },
  {
    id: 'a_005',
    customer: 'Avery Cho',
    customerEmail: 'avery.c@inbox.test',
    partner: 'Atlas Executive Coaching',
    product: 'coach-pay',
    amountCents: 12_400_00,
    fico: 664,
    lender: 'CapitalOne',
    status: 'submitted',
    date: '2026-05-02',
  },
  {
    id: 'a_006',
    customer: 'Rosa Delgado',
    customerEmail: 'rosa.d@inbox.test',
    partner: 'Brio Wellness Clinics',
    product: 'med-pay',
    amountCents: 22_900_00,
    fico: 715,
    lender: 'FinWise',
    status: 'approved',
    date: '2026-05-01',
  },
  {
    id: 'a_007',
    customer: 'Niall Becker',
    customerEmail: 'niall.b@inbox.test',
    partner: 'Helio Dental Group',
    product: 'med-pay',
    amountCents: 39_600_00,
    fico: 672,
    lender: 'LendFi',
    status: 'submitted',
    date: '2026-04-30',
  },
  {
    id: 'a_008',
    customer: 'Imani Holloway',
    customerEmail: 'imani.h@inbox.test',
    partner: 'Summit HVAC Pros',
    product: 'trade-pay',
    amountCents: 14_750_00,
    fico: 658,
    lender: 'BlueVine',
    status: 'submitted',
    date: '2026-04-29',
  },
  {
    id: 'a_009',
    customer: 'Tobias Renner',
    customerEmail: 'tobias.r@inbox.test',
    partner: 'Kindred Career Lab',
    product: 'coach-pay',
    amountCents: 8_900_00,
    fico: 702,
    lender: 'Affirm',
    status: 'funded',
    date: '2026-04-28',
  },
  {
    id: 'a_010',
    customer: 'Sage McCallister',
    customerEmail: 'sage.m@inbox.test',
    partner: 'Riverside Renovation Co.',
    product: 'trade-pay',
    amountCents: 27_500_00,
    fico: 691,
    lender: 'CrossRiver',
    status: 'funded',
    date: '2026-04-27',
  },
  // Seed rows added so each demo partner's per-brand portal feels
  // populated when an operator clicks through. Five more rows per
  // demo partner (Helio / Orion / Atlas) gives the Applications tab,
  // status filters, and dashboard "recent" panels enough variety to
  // demo every state (submitted / in_review / approved / funded /
  // declined). Same shape as a_001..a_010 — partner name matches
  // master-data partners[].legalName so applicationsForPartner +
  // detail-page lookup hit immediately.
  {
    id: 'a_011',
    customer: 'Renata Pereira',
    customerEmail: 'renata.p@inbox.test',
    partner: 'Helio Dental Group',
    product: 'med-pay',
    amountCents: 12_400_00,
    fico: 689,
    lender: 'CrossRiver',
    status: 'approved',
    date: '2026-05-08',
  },
  {
    id: 'a_012',
    customer: 'Jamal Carter',
    customerEmail: 'jamal.c@inbox.test',
    partner: 'Helio Dental Group',
    product: 'med-pay',
    amountCents: 5_900_00,
    fico: 642,
    lender: 'CapitalOne',
    status: 'in_review',
    date: '2026-05-07',
  },
  {
    id: 'a_013',
    customer: 'Sienna Holt',
    customerEmail: 'sienna.h@inbox.test',
    partner: 'Helio Dental Group',
    product: 'med-pay',
    amountCents: 21_800_00,
    fico: 731,
    lender: 'FinWise',
    status: 'funded',
    date: '2026-05-06',
  },
  {
    id: 'a_014',
    customer: 'Marcus Chen',
    customerEmail: 'marcus.c@inbox.test',
    partner: 'Helio Dental Group',
    product: 'med-pay',
    amountCents: 8_750_00,
    fico: 605,
    lender: 'LendFi',
    status: 'declined',
    date: '2026-05-05',
  },
  {
    id: 'a_015',
    customer: 'Iris Okafor',
    customerEmail: 'iris.o@inbox.test',
    partner: 'Helio Dental Group',
    product: 'med-pay',
    amountCents: 16_200_00,
    fico: 698,
    lender: 'WebBank',
    status: 'submitted',
    date: '2026-05-09',
  },
  {
    id: 'a_016',
    customer: 'Diego Salazar',
    customerEmail: 'diego.s@inbox.test',
    partner: 'Orion Roof & Solar',
    product: 'trade-pay',
    amountCents: 48_900_00,
    fico: 712,
    lender: 'WebBank',
    status: 'approved',
    date: '2026-05-09',
  },
  {
    id: 'a_017',
    customer: 'Hannah Wu',
    customerEmail: 'hannah.w@inbox.test',
    partner: 'Orion Roof & Solar',
    product: 'trade-pay',
    amountCents: 22_500_00,
    fico: 685,
    lender: 'CrossRiver',
    status: 'in_review',
    date: '2026-05-08',
  },
  {
    id: 'a_018',
    customer: 'Beau Kennedy',
    customerEmail: 'beau.k@inbox.test',
    partner: 'Orion Roof & Solar',
    product: 'trade-pay',
    amountCents: 67_300_00,
    fico: 728,
    lender: 'LeadBank',
    status: 'funded',
    date: '2026-05-07',
  },
  {
    id: 'a_019',
    customer: 'Lily Andersson',
    customerEmail: 'lily.a@inbox.test',
    partner: 'Orion Roof & Solar',
    product: 'trade-pay',
    amountCents: 18_750_00,
    fico: 624,
    lender: 'BlueVine',
    status: 'submitted',
    date: '2026-05-06',
  },
  {
    id: 'a_020',
    customer: 'Tariq Bashir',
    customerEmail: 'tariq.b@inbox.test',
    partner: 'Orion Roof & Solar',
    product: 'trade-pay',
    amountCents: 35_100_00,
    fico: 671,
    lender: 'CapitalOne',
    status: 'declined',
    date: '2026-05-05',
  },
  {
    id: 'a_021',
    customer: 'Mira Sokolova',
    customerEmail: 'mira.s@inbox.test',
    partner: 'Atlas Executive Coaching',
    product: 'coach-pay',
    amountCents: 14_900_00,
    fico: 718,
    lender: 'Affirm',
    status: 'approved',
    date: '2026-05-09',
  },
  {
    id: 'a_022',
    customer: 'Owen Brennan',
    customerEmail: 'owen.b@inbox.test',
    partner: 'Atlas Executive Coaching',
    product: 'coach-pay',
    amountCents: 6_500_00,
    fico: 651,
    lender: 'CapitalOne',
    status: 'in_review',
    date: '2026-05-08',
  },
  {
    id: 'a_023',
    customer: 'Zara Khan',
    customerEmail: 'zara.k@inbox.test',
    partner: 'Atlas Executive Coaching',
    product: 'coach-pay',
    amountCents: 19_800_00,
    fico: 705,
    lender: 'CrossRiver',
    status: 'funded',
    date: '2026-05-07',
  },
  {
    id: 'a_024',
    customer: 'Eli Rosenberg',
    customerEmail: 'eli.r@inbox.test',
    partner: 'Atlas Executive Coaching',
    product: 'coach-pay',
    amountCents: 11_250_00,
    fico: 633,
    lender: 'LendFi',
    status: 'submitted',
    date: '2026-05-06',
  },
  {
    id: 'a_025',
    customer: 'Nadia Soliman',
    customerEmail: 'nadia.s@inbox.test',
    partner: 'Atlas Executive Coaching',
    product: 'coach-pay',
    amountCents: 9_400_00,
    fico: 612,
    lender: 'BlueVine',
    status: 'declined',
    date: '2026-05-05',
  },
];

export const masterKpis = {
  totalSubmitted: 512,
  approved: 81,
  funded: 74,
  totalFundedCents: 9_240_000_00,
  declined: 14,
  inReview: 11,
};

export const monthlySubmissionsSeries = [
  { label: 'Dec', value: 218 },
  { label: 'Jan', value: 754 },
  { label: 'Feb', value: 941 },
  { label: 'Mar', value: 643 },
  { label: 'Apr', value: 412 },
  { label: 'May', value: 512 },
];

export const fundedVolumeSeries = [
  { label: 'Dec', value: 3_700 },
  { label: 'Jan', value: 13_200 },
  { label: 'Feb', value: 19_800 },
  { label: 'Mar', value: 14_400 },
  { label: 'Apr', value: 7_100 },
  { label: 'May', value: 9_240 },
];

export const creditBands = [
  { name: 'Prime', range: '700–850', pct: 22 },
  { name: 'NearPrime', range: '640–699', pct: 18 },
  { name: 'Subprime', range: '580–639', pct: 7 },
  { name: 'DeepSubprime', range: '300–579', pct: 3 },
];

/* ----------------------------------------------------------------------- */
/*  Partner lookup helpers — DRY source-of-truth across pages              */
/* ----------------------------------------------------------------------- */

/**
 * Lookup a partner by id OR by short-slug (premier / medfirst /
 * tradeforce / dental). Reports + control-panel use the master ID
 * (p_atlas), but the legacy applications/[partnerId] + payouts/[partnerId]
 * routes used short slugs. This bridges both naming schemes so any cross
 * link lands on the right partner.
 */
export function findPartner(idOrSlug: string): PartnerSummary | undefined {
  const direct = partners.find((p) => p.id === idOrSlug);
  if (direct) return direct;
  const slugMap: Record<string, string> = {
    premier: 'p_atlas',
    medfirst: 'p_helio',
    tradeforce: 'p_orion',
    dental: 'p_meridian',
    elite: 'p_kindred',
    summit: 'p_summit',
    riverside: 'p_riverside',
    brio: 'p_brio',
    demo: 'p_demo',
  };
  const target = slugMap[idOrSlug.toLowerCase()];
  return target ? partners.find((p) => p.id === target) : undefined;
}

/**
 * Filter the canonical master applications by partner. Used by reports,
 * v/[brand]/insights, control-panel [partnerId], applications [partnerId]
 * — all surfaces must see the SAME application set for a given partner.
 */
export function applicationsForPartner(partnerId: string): ApplicationRow[] {
  const partner = findPartner(partnerId);
  if (!partner) return [];
  /* SEC-104: match exactly on the partner's legal name. Previously we
   * did a first-word substring `includes()` match which could collide
   * for partners whose legal-name first word is a common word
   * ("National X", "United X", "Pacific X"): two distinct partners
   * with the same opening word would share an application pool. Switch
   * to exact-string equality (case-insensitive) so the matcher is
   * unambiguous and never bleeds rows across partners. */
  const legal = partner.legalName.toLowerCase();
  return applications.filter((a) => a.partner.toLowerCase() === legal);
}

/** Standard payout schedule string used across payout pages. */
export const PAYOUT_SCHEDULE = {
  cadence: 'Twice monthly — 1st & 15th',
  nextDates: ['2026-05-15', '2026-06-01'] as const,
  rail: 'RTP via Cross River (same-day ACH fallback)',
};

/* ----------------------------------------------------------------------- */
/*  Audit log seed — used by /audit and partner-detail Activity tab        */
/* ----------------------------------------------------------------------- */

export interface AuditEntry {
  id: string;
  ts: string; // ISO
  actor: string;
  actorEmail: string;
  action: string;
  target: string;
  ip: string;
  outcome: 'success' | 'failed' | 'warning';
}

export const auditLog: AuditEntry[] = [
  {
    id: 'au_001',
    ts: '2026-05-14T22:18:00Z',
    actor: 'Brodie (Master)',
    actorEmail: 'brodie@amalafinance.com.au',
    action: 'partner.suspend',
    target: 'p_riverside',
    ip: '203.0.113.41',
    outcome: 'success',
  },
  {
    id: 'au_002',
    ts: '2026-05-14T21:54:00Z',
    actor: 'System',
    actorEmail: 'system@eazepay',
    action: 'webhook.delivery_failed',
    target: 'evergreen-prime',
    ip: '10.0.0.1',
    outcome: 'failed',
  },
  {
    id: 'au_003',
    ts: '2026-05-14T21:01:00Z',
    actor: 'Brodie (Master)',
    actorEmail: 'brodie@amalafinance.com.au',
    action: 'lender.override.toggle',
    target: 'SageHeal · p_helio',
    ip: '203.0.113.41',
    outcome: 'success',
  },
  {
    id: 'au_004',
    ts: '2026-05-14T19:33:00Z',
    actor: 'Sarah Park',
    actorEmail: 'sarah.park@partner.test',
    action: 'application.submit',
    target: 'a_034',
    ip: '73.2.18.4',
    outcome: 'success',
  },
  {
    id: 'au_005',
    ts: '2026-05-14T18:42:00Z',
    actor: 'Risk Bot',
    actorEmail: 'risk@eaze.internal',
    action: 'application.decisioned',
    target: 'a_034 to approved',
    ip: '10.0.0.7',
    outcome: 'success',
  },
  {
    id: 'au_006',
    ts: '2026-05-14T17:11:00Z',
    actor: 'Brodie (Master)',
    actorEmail: 'brodie@amalafinance.com.au',
    action: 'team.member.invite',
    target: 'casey.reed@partner',
    ip: '203.0.113.41',
    outcome: 'success',
  },
  {
    id: 'au_007',
    ts: '2026-05-14T16:00:00Z',
    actor: 'Brodie (Master)',
    actorEmail: 'brodie@amalafinance.com.au',
    action: 'pii.view',
    target: 'a_023 SSN field',
    ip: '203.0.113.41',
    outcome: 'warning',
  },
  {
    id: 'au_008',
    ts: '2026-05-14T14:48:00Z',
    actor: 'System',
    actorEmail: 'system@eazepay',
    action: 'payout.scheduled',
    target: '$258,300 to p_atlas',
    ip: '10.0.0.1',
    outcome: 'success',
  },
  {
    id: 'au_009',
    ts: '2026-05-14T13:09:00Z',
    actor: 'James Park',
    actorEmail: 'james@medfirst.com',
    action: 'user.login',
    target: 'partner-portal',
    ip: '64.207.4.12',
    outcome: 'success',
  },
  {
    id: 'au_010',
    ts: '2026-05-14T11:21:00Z',
    actor: 'Compliance Bot',
    actorEmail: 'compliance@eaze.internal',
    action: 'kyb.reverify',
    target: 'p_orion',
    ip: '10.0.0.9',
    outcome: 'success',
  },
  {
    id: 'au_011',
    ts: '2026-05-13T22:08:00Z',
    actor: 'Mike Henderson',
    actorEmail: 'mike@tradeforce.com',
    action: 'application.submit',
    target: 'a_031',
    ip: '108.171.130.45',
    outcome: 'success',
  },
  {
    id: 'au_012',
    ts: '2026-05-13T19:55:00Z',
    actor: 'Risk Bot',
    actorEmail: 'risk@eaze.internal',
    action: 'application.decisioned',
    target: 'a_031 to declined',
    ip: '10.0.0.7',
    outcome: 'success',
  },
  {
    id: 'au_013',
    ts: '2026-05-13T18:22:00Z',
    actor: 'Brodie (Master)',
    actorEmail: 'brodie@amalafinance.com.au',
    action: 'partner.commission.update',
    target: 'p_helio 1.4 to 1.6',
    ip: '203.0.113.41',
    outcome: 'success',
  },
  {
    id: 'au_014',
    ts: '2026-05-13T16:04:00Z',
    actor: 'System',
    actorEmail: 'system@eazepay',
    action: 'marketplace.sync',
    target: '36 lenders',
    ip: '10.0.0.1',
    outcome: 'success',
  },
  {
    id: 'au_015',
    ts: '2026-05-13T14:12:00Z',
    actor: 'Brodie (Master)',
    actorEmail: 'brodie@amalafinance.com.au',
    action: 'key.create',
    target: 'ep_live (production)',
    ip: '203.0.113.41',
    outcome: 'success',
  },
];

/* ----------------------------------------------------------------------- */
/*  Legal & help seed                                                      */
/* ----------------------------------------------------------------------- */

export interface LegalDoc {
  slug: string;
  title: string;
  effectiveDate: string;
  version: string;
  summary: string;
  sections: Array<{ heading: string; body: string }>;
}

export const legalDocs: Record<string, LegalDoc> = {
  terms: {
    slug: 'terms',
    title: 'Terms of Service',
    effectiveDate: '2026-01-15',
    version: '4.2',
    summary:
      'Terms governing your use of the EazePay Partner Portal and the products surfaced through it (MedPay, TradePay, CoachPay, EAZE Processing, DialerPay, EZ Check).',
    sections: [
      {
        heading: '1. Acceptance of terms',
        body: 'By creating an account, submitting an application, or accessing the portal you agree to these terms. Material changes will be notified in-product and by email at least 14 days before they take effect.',
      },
      {
        heading: '2. Account eligibility',
        body: 'You must be a registered business entity in the United States with valid tax identification and a verified business bank account. Sole proprietors are accepted where applicable per program.',
      },
      {
        heading: '3. Partner responsibilities',
        body: 'You agree to (a) submit complete and accurate applicant information, (b) comply with Regulation B, Z, TILA, and FCRA disclosures, (c) maintain SOC 2-aligned data handling for any applicant PII you store outside EazePay.',
      },
      {
        heading: '4. Payouts & commissions',
        body: 'Commissions are paid twice monthly on the 1st and the 15th via RTP with same-day ACH fallback. Funds are net of platform fees, chargebacks, and any clawback for rescinded applications.',
      },
      {
        heading: '5. Termination',
        body: 'Either party may terminate with 30 days written notice. EazePay may suspend immediately for fraud, AML, or material breach. Live applications continue to settle.',
      },
    ],
  },
  privacy: {
    slug: 'privacy',
    title: 'Privacy Policy',
    effectiveDate: '2026-01-15',
    version: '3.8',
    summary:
      'How EazePay collects, uses, retains, and shares applicant and partner data across our consumer-direct and merchant-channel products.',
    sections: [
      {
        heading: '1. Data we collect',
        body: 'Applicant identity (name, SSN-last-4, DOB), employment and income, soft-pull credit (FCRA permissible purpose), device and browser fingerprint, partner referral tags.',
      },
      {
        heading: '2. How we use it',
        body: 'To underwrite applications, route to compatible lenders, deliver decisioning artefacts (Truth-in-Lending, Adverse Action Notices), prevent fraud, and meet AML / OFAC obligations.',
      },
      {
        heading: '3. Sharing',
        body: 'We share applicant data with lender partners only AFTER a hard inquiry consent. Service providers (Plaid, document storage, postal vendors) receive minimum-necessary data under DPA.',
      },
      {
        heading: '4. Retention',
        body: 'Applicant data is retained for 7 years per AU/US record-keeping rules; declined applications are purged at 25 months unless required for audit or litigation hold.',
      },
      {
        heading: '5. Your rights',
        body: 'You may request access, correction, or deletion at privacy@eazepay.com. We respond within 30 days. California, Virginia, and Colorado residents have additional rights under CCPA/CPRA, VCDPA, and CPA respectively.',
      },
    ],
  },
  disclosures: {
    slug: 'disclosures',
    title: 'Lending Disclosures',
    effectiveDate: '2026-02-01',
    version: '2.4',
    summary:
      'Standardised disclosures that apply to every loan originated through EazePay, including APR ranges, fee schedules, and pre-qualification soft-pull notices.',
    sections: [
      {
        heading: '1. APR range',
        body: 'APR varies by lender, term, and applicant credit profile. Typical range: 7.99% to 35.99% APR. Origination fees: 0% to 6%. Late fees: capped per state statute.',
      },
      {
        heading: '2. Soft-pull pre-qualification',
        body: 'Pre-qualification through EZ Check uses a soft credit pull which does NOT affect the applicant credit score. A hard inquiry is performed only after the applicant explicitly consents to a specific lender offer.',
      },
      {
        heading: '3. State licensing',
        body: 'EazePay originates loans through licensed lender partners. State availability varies by product; see /legal/licenses for the current state-by-state matrix.',
      },
      {
        heading: '4. Truth-in-Lending',
        body: 'Every approved offer ships with a TILA disclosure showing APR, finance charge, amount financed, total of payments, and payment schedule. Borrower must affirmatively accept before funding.',
      },
      {
        heading: '5. Adverse Action',
        body: 'Declined applicants receive an Adverse Action Notice within 30 days listing the principal reasons for the decline, FCRA rights, and the consumer-reporting agency contact.',
      },
    ],
  },
  licenses: {
    slug: 'licenses',
    title: 'State Licenses',
    effectiveDate: '2026-04-01',
    version: '5.1',
    summary:
      'EazePay-operated entities and the state licenses under which we (or our originating lender partners) extend credit.',
    sections: [
      {
        heading: '1. EazePay Finance LLC',
        body: 'NMLS: NMLS_PENDING. Consumer Lending licensure: STATES_PENDING. California Financing Law license: CFL_LICENSE_PENDING.',
      },
      {
        heading: '2. EazePay Servicing LLC',
        body: 'Loan servicer for partner-originated loans. Licensed in: STATES_PENDING.',
      },
      {
        heading: '3. Originating bank partners',
        body: 'Bank partners and FDIC certificates: BANK_PARTNERS_PENDING. State availability per-bank.',
      },
      {
        heading: '4. NMLS Consumer Access',
        body: 'Verify any licensee at https://nmlsconsumeraccess.org. EazePay Finance LLC entry: NMLS_PENDING.',
      },
    ],
  },
  compliance: {
    slug: 'compliance',
    title: 'Compliance Framework',
    effectiveDate: '2026-04-15',
    version: '3.0',
    summary:
      'The regulatory and audit framework EazePay operates under, including SOC 2, AML/KYC, fair-lending, and consumer-protection controls.',
    sections: [
      {
        heading: '1. SOC 2 Type II',
        body: 'Annual audit by Schellman. Latest report: 2026-03-31. Available under NDA at compliance@eazepay.com.',
      },
      {
        heading: '2. AML/BSA program',
        body: 'Risk-based CIP, OFAC screening on every applicant and lender, SAR filing per FinCEN, BSA officer reports quarterly to the board.',
      },
      {
        heading: '3. Fair lending',
        body: 'Annual disparate-impact analysis by protected class. Override-tracking dashboard ships in the Insights view. ECOA training mandatory for all decisioning operators.',
      },
      {
        heading: '4. Vendor management',
        body: 'All sub-processors under DPA + SOC 2 attestation. Annual vendor risk review; data-flow map at compliance@eazepay.com.',
      },
      {
        heading: '5. Audit trail',
        body: 'Every state-changing action is recorded in an append-only audit chain (visible at /audit) with 7-year retention.',
      },
    ],
  },
};

/* ----------------------------------------------------------------------- */
/*  Help & support seed                                                    */
/* ----------------------------------------------------------------------- */

export interface HelpArticle {
  id: string;
  title: string;
  category: 'Getting started' | 'Applications' | 'Payouts' | 'Lenders' | 'Integrations' | 'Account';
  summary: string;
  readTime: string;
}

export const helpArticles: HelpArticle[] = [
  {
    id: 'hp_001',
    title: 'Submit your first application',
    category: 'Getting started',
    summary: 'Step-by-step walkthrough of submitting a finance application on behalf of a client.',
    readTime: '4 min',
  },
  {
    id: 'hp_002',
    title: 'Why payouts are processed twice a month',
    category: 'Payouts',
    summary: 'Settlement cadence, RTP rails, and how to read the payout reconciliation report.',
    readTime: '3 min',
  },
  {
    id: 'hp_003',
    title: 'Reading the decisioning waterfall',
    category: 'Applications',
    summary: 'Understand why an application was approved by lender X rather than lender Y.',
    readTime: '6 min',
  },
  {
    id: 'hp_004',
    title: 'Enabling lender overrides for a partner',
    category: 'Lenders',
    summary:
      'How to temporarily disable a specific lender for a single partner without affecting other partners.',
    readTime: '2 min',
  },
  {
    id: 'hp_005',
    title: 'Connecting EZ Check to your CRM',
    category: 'Integrations',
    summary: 'Drop the EZ Check widget into HubSpot, Salesforce, or a custom landing page.',
    readTime: '5 min',
  },
  {
    id: 'hp_006',
    title: 'Two-factor authentication setup',
    category: 'Account',
    summary:
      'Enable Authenticator-app 2FA on your operator account and recovery code best practice.',
    readTime: '3 min',
  },
  {
    id: 'hp_007',
    title: 'Adverse Action Notice delivery',
    category: 'Applications',
    summary:
      'When and how AANs are delivered to declined applicants, and what to tell a client who asks why.',
    readTime: '4 min',
  },
  {
    id: 'hp_008',
    title: 'Reconciling a payout cycle',
    category: 'Payouts',
    summary: 'How to match the line-by-line settlement export against your accounting ledger.',
    readTime: '7 min',
  },
];
