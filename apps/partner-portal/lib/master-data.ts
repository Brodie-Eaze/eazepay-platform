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
  { id: 'p_atlas', initials: 'AT', legalName: 'Atlas Executive Coaching', email: 'team@atlascoach.io', phone: '(212) 555-0144', niche: 'coaching', product: 'CoachPay', status: 'approved', approvedOn: '2026-04-02', fundedCount: 9, netCents: 312_400_00 },
  { id: 'p_helio', initials: 'HE', legalName: 'Helio Dental Group', email: 'finance@heliodental.com', phone: '(415) 555-0188', niche: 'dental', product: 'MedPay', status: 'approved', approvedOn: '2026-03-18', fundedCount: 7, netCents: 261_950_00 },
  { id: 'p_orion', initials: 'OR', legalName: 'Orion Roof & Solar', email: 'partners@orionroof.com', phone: '(602) 555-0202', niche: 'trades', product: 'TradePay', status: 'approved', approvedOn: '2026-03-12', fundedCount: 5, netCents: 198_700_00 },
  { id: 'p_brio', initials: 'BR', legalName: 'Brio Wellness Clinics', email: 'ar@briowellness.com', phone: '(310) 555-0301', niche: 'medical', product: 'MedPay', status: 'approved', approvedOn: '2026-03-05', fundedCount: 6, netCents: 184_220_00 },
  { id: 'p_kindred', initials: 'KI', legalName: 'Kindred Career Lab', email: 'hello@kindredcareer.com', phone: '(206) 555-0411', niche: 'coaching', product: 'CoachPay', status: 'approved', approvedOn: '2026-02-22', fundedCount: 4, netCents: 76_500_00 },
  { id: 'p_summit', initials: 'SU', legalName: 'Summit HVAC Pros', email: 'office@summithvacpros.com', phone: '(720) 555-0150', niche: 'trades', product: 'TradePay', status: 'approved', approvedOn: '2026-02-14', fundedCount: 3, netCents: 64_200_00 },
  { id: 'p_meridian', initials: 'ME', legalName: 'Meridian Vision Care', email: 'billing@meridianvision.com', phone: '(617) 555-0233', niche: 'medical', product: 'MedPay', status: 'approved', approvedOn: '2026-01-30', fundedCount: 3, netCents: 47_100_00 },
  { id: 'p_riverside', initials: 'RI', legalName: 'Riverside Renovation Co.', email: 'ops@riversidereno.com', phone: '(503) 555-0177', niche: 'trades', product: 'TradePay', status: 'approved', approvedOn: '2026-01-12', fundedCount: 2, netCents: 39_800_00 },
  { id: 'p_demo', initials: 'DE', legalName: 'EazePay Demo Workspace', email: 'demo@eazepay.test', phone: '555-1004', niche: 'consumer', product: 'Multi-brand', status: 'approved', approvedOn: '2025-12-04', fundedCount: 14, netCents: 218_950_00 },
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
  { id: 'a_001', customer: 'Cassidy Wren',    customerEmail: 'cassidy.w@inbox.test',    partner: 'Helio Dental Group',          product: 'med-pay',   amountCents: 7_400_00,  fico: 612, lender: 'CapitalOne', status: 'submitted', date: '2026-05-04' },
  { id: 'a_002', customer: 'Tomas Ibarra',     customerEmail: 'tomas.i@inbox.test',     partner: 'Orion Roof & Solar',          product: 'trade-pay', amountCents: 19_500_00, fico: 698, lender: 'CrossRiver', status: 'funded',    date: '2026-05-04' },
  { id: 'a_003', customer: 'Priya Anand',      customerEmail: 'priya.a@inbox.test',     partner: 'EAZE Demo Workspace',         product: 'trade-pay', amountCents: 32_750_00, fico: 742, lender: 'WebBank',    status: 'approved',  date: '2026-05-03' },
  { id: 'a_004', customer: 'Markus Hale',      customerEmail: 'markus.h@inbox.test',    partner: 'EAZE Demo Workspace',         product: 'trade-pay', amountCents: 58_200_00, fico: 681, lender: 'LeadBank',   status: 'submitted', date: '2026-05-03' },
  { id: 'a_005', customer: 'Avery Cho',        customerEmail: 'avery.c@inbox.test',     partner: 'Atlas Executive Coaching',    product: 'coach-pay', amountCents: 12_400_00, fico: 664, lender: 'CapitalOne', status: 'submitted', date: '2026-05-02' },
  { id: 'a_006', customer: 'Rosa Delgado',     customerEmail: 'rosa.d@inbox.test',      partner: 'Brio Wellness Clinics',       product: 'med-pay',   amountCents: 22_900_00, fico: 715, lender: 'FinWise',    status: 'approved',  date: '2026-05-01' },
  { id: 'a_007', customer: 'Niall Becker',     customerEmail: 'niall.b@inbox.test',     partner: 'Helio Dental Group',          product: 'med-pay',   amountCents: 39_600_00, fico: 672, lender: 'LendFi',     status: 'submitted', date: '2026-04-30' },
  { id: 'a_008', customer: 'Imani Holloway',   customerEmail: 'imani.h@inbox.test',     partner: 'Summit HVAC Pros',            product: 'trade-pay', amountCents: 14_750_00, fico: 658, lender: 'BlueVine',   status: 'submitted', date: '2026-04-29' },
  { id: 'a_009', customer: 'Tobias Renner',    customerEmail: 'tobias.r@inbox.test',    partner: 'Kindred Career Lab',          product: 'coach-pay', amountCents: 8_900_00,  fico: 702, lender: 'Affirm',     status: 'funded',    date: '2026-04-28' },
  { id: 'a_010', customer: 'Sage McCallister', customerEmail: 'sage.m@inbox.test',      partner: 'Riverside Renovation Co.',    product: 'trade-pay', amountCents: 27_500_00, fico: 691, lender: 'CrossRiver', status: 'funded',    date: '2026-04-27' },
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
  { name: 'Prime',         range: '700–850', pct: 22 },
  { name: 'NearPrime',     range: '640–699', pct: 18 },
  { name: 'Subprime',      range: '580–639', pct: 7 },
  { name: 'DeepSubprime',  range: '300–579', pct: 3 },
];
