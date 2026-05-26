/**
 * Seeded, deterministic application fixture generator.
 *
 * WHY:
 *   The hand-typed `applications` array in master-data.ts only carries ~70
 *   rows clustered in a 2-week window — too sparse for any time-range
 *   selector or month-over-month chart to feel real. This file extends
 *   that base set with ~400 additional rows distributed across the last
 *   12 months with a normal-ish distribution biased toward recent.
 *
 *   The generator is fully deterministic: same seed → same data. We use
 *   mulberry32 (tiny, fast, MIT) so the demo is stable across reloads and
 *   doesn't pull in a faker dependency.
 *
 *   Dashboards (/v/[brand], /admin, /reports) read `expandedApplications`.
 *   Per-partner detail pages still read `applications` from master-data so
 *   no existing partner page changes its on-screen counts.
 */
import { applications, type ApplicationRow, partners } from './master-data';

/* ─── PRNG ──────────────────────────────────────────────────────────── */

/** mulberry32 — 32-bit seeded PRNG. Public-domain reference impl. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller transform → roughly-normal random in (-inf, inf). */
function gaussian(rng: () => number, mean = 0, stddev = 1): number {
  const u1 = Math.max(1e-9, rng());
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stddev;
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)] as T;
}

function intBetween(rng: () => number, lo: number, hi: number): number {
  return Math.floor(lo + rng() * (hi - lo + 1));
}

/* ─── Name pools — small, hand-curated, no PII ──────────────────────── */

const FIRST_NAMES = [
  'Avery',
  'Sasha',
  'Jordan',
  'Mateo',
  'Priya',
  'Connor',
  'Leah',
  'Owen',
  'Nia',
  'Eli',
  'Hana',
  'Theo',
  'Yuki',
  'Rafael',
  'Aaliyah',
  'Beatriz',
  'Diego',
  'Esme',
  'Felix',
  'Gabriela',
  'Hugo',
  'Inez',
  'Jade',
  'Kai',
  'Luna',
  'Marco',
  'Nora',
  'Otto',
  'Phoebe',
  'Quincy',
  'Rosa',
  'Soren',
  'Tessa',
  'Ulises',
  'Vera',
  'Wren',
  'Xavi',
  'Yara',
  'Zane',
  'Amira',
  'Benji',
  'Cleo',
  'Dante',
  'Elena',
  'Fernando',
  'Greta',
  'Hiro',
  'Isla',
] as const;

const LAST_NAMES = [
  'Chen',
  'Patel',
  'Garcia',
  'Nguyen',
  'Kim',
  'Singh',
  'O’Brien',
  'Müller',
  'Rossi',
  'Costa',
  'Tanaka',
  'Park',
  'Volkov',
  'Esposito',
  'Maldonado',
  'Sutton',
  'Reilly',
  'Bergeron',
  'Castellanos',
  'Zhao',
  'Fernandez',
  'Holloway',
  'Larsen',
  'Ng',
  'Okafor',
  'Pereira',
  'Quintero',
  'Rahimi',
  'Sokolov',
  'Thorne',
  'Underwood',
  'Vasquez',
  'Walsh',
  'Yamamoto',
] as const;

const EMAIL_DOMAINS = [
  'gmail.com',
  'outlook.com',
  'icloud.com',
  'proton.me',
  'fastmail.com',
] as const;

/* Per-brand lender pools — kept aligned with the lender names that appear
 * in the hand-typed fixture so the marketplace + applications list don't
 * mention strangers. */
const LENDERS_BY_BRAND: Record<'med-pay' | 'trade-pay' | 'coach-pay', readonly string[]> = {
  'med-pay': ['CrossRiver', 'WebBank', 'LeadBank', 'FinWise', 'CapitalOne'],
  'trade-pay': ['LeadBank', 'CrossRiver', 'BlueVine', 'WebBank', 'FinWise'],
  'coach-pay': ['Affirm', 'CrossRiver', 'CapitalOne', 'LendFi', 'WebBank'],
};

/* Per-brand amount ranges in cents — keeps med-spa small, trades big. */
const AMOUNT_RANGE_BY_BRAND: Record<
  'med-pay' | 'trade-pay' | 'coach-pay',
  { lo: number; hi: number; mean: number; stddev: number }
> = {
  'med-pay': { lo: 200_000, hi: 1_500_000, mean: 650_000, stddev: 300_000 },
  'trade-pay': { lo: 500_000, hi: 4_500_000, mean: 1_800_000, stddev: 1_000_000 },
  'coach-pay': { lo: 100_000, hi: 800_000, mean: 320_000, stddev: 180_000 },
};

const STATUS_DISTRIBUTION: Array<{
  status: ApplicationRow['status'];
  weight: number;
}> = [
  { status: 'submitted', weight: 22 },
  { status: 'in_review', weight: 16 },
  { status: 'approved', weight: 18 },
  { status: 'funded', weight: 32 },
  { status: 'declined', weight: 12 },
];

function pickStatus(rng: () => number): ApplicationRow['status'] {
  const total = STATUS_DISTRIBUTION.reduce((s, x) => s + x.weight, 0);
  let pickN = rng() * total;
  for (const { status, weight } of STATUS_DISTRIBUTION) {
    pickN -= weight;
    if (pickN <= 0) return status;
  }
  return 'submitted';
}

/**
 * FICO: long-tail distribution peaked at 680–720. We sample a gaussian
 * centred on 700 with stddev 60, then clamp to [520, 820].
 */
function pickFico(rng: () => number): number {
  const raw = Math.round(gaussian(rng, 700, 60));
  return Math.max(520, Math.min(820, raw));
}

/**
 * Date within the last N days, biased toward recent. We sample
 * |gaussian(0, days/3)|, clamp to [0, days-1], then subtract from today.
 * That puts ~68% of activity in the last `days/3` days, which matches the
 * real funnel shape (most lender activity is recent).
 */
function pickDate(rng: () => number, today: Date, days: number): string {
  const raw = Math.abs(gaussian(rng, 0, days / 3));
  const offset = Math.min(days - 1, Math.floor(raw));
  const d = new Date(today.getTime() - offset * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function pickAmountCents(rng: () => number, brand: keyof typeof AMOUNT_RANGE_BY_BRAND): number {
  const { lo, hi, mean, stddev } = AMOUNT_RANGE_BY_BRAND[brand];
  const raw = Math.round(gaussian(rng, mean, stddev) / 100) * 100;
  return Math.max(lo, Math.min(hi, raw));
}

/* ─── Generator ─────────────────────────────────────────────────────── */

export interface SeededFixtureOptions {
  /** Deterministic seed. Default 0x4a4a — same demo every reload. */
  seed?: number;
  /** Total extra rows to synthesise on top of the hand-typed set. */
  count?: number;
  /** Days back to spread the rows across. Default 365. */
  days?: number;
  /** "Today" for the generator — defaults to a fixed date so dev + CI
   *  produce identical fixtures regardless of when the test runs. */
  today?: Date;
}

/**
 * Generate a deterministic synthetic set of ApplicationRow.
 *
 * The output is stable for a given (seed, count, days, today) tuple, so
 * snapshot tests and visual baselines remain reliable.
 */
export function generateSeededApplications(opts: SeededFixtureOptions = {}): ApplicationRow[] {
  const seed = opts.seed ?? 0x4a4a;
  const count = opts.count ?? 420;
  const days = opts.days ?? 365;
  /* Fixed date so CI + dev produce identical rows. The portal otherwise
   * sees real `Date.now()` and the time-window math handles "today"
   * relative to that — only the fixture generation is frozen. */
  const today = opts.today ?? new Date('2026-05-27T00:00:00Z');
  const rng = mulberry32(seed);

  const productBrandPartners = partners.filter(
    (p) => p.product === 'MedPay' || p.product === 'TradePay' || p.product === 'CoachPay',
  );
  if (productBrandPartners.length === 0) return [];

  const brandFor: Record<
    'MedPay' | 'TradePay' | 'CoachPay',
    'med-pay' | 'trade-pay' | 'coach-pay'
  > = {
    MedPay: 'med-pay',
    TradePay: 'trade-pay',
    CoachPay: 'coach-pay',
  };

  const rows: ApplicationRow[] = [];
  for (let i = 0; i < count; i++) {
    const partner = pick(rng, productBrandPartners);
    if (partner.product === 'Multi-brand') continue;
    const productCode = brandFor[partner.product];
    const first = pick(rng, FIRST_NAMES);
    const last = pick(rng, LAST_NAMES);
    const domain = pick(rng, EMAIL_DOMAINS);
    const status = pickStatus(rng);
    const lender = pick(rng, LENDERS_BY_BRAND[productCode]);
    rows.push({
      id: `a_s${seed.toString(16)}_${String(i).padStart(4, '0')}`,
      customer: `${first} ${last}`,
      customerEmail: `${first}.${last[0]}${i}@${domain}`.toLowerCase().replace(/[’']/g, ''),
      partner: partner.legalName,
      product: productCode,
      amountCents: pickAmountCents(rng, productCode),
      fico: pickFico(rng),
      lender,
      status,
      date: pickDate(rng, today, days),
    });
  }
  return rows;
}

/**
 * The canonical extended set: hand-typed seed rows + ~420 synthetic rows
 * spread across the last 12 months. This is what dashboards consume.
 *
 * Existing per-partner detail pages keep reading `applications` from
 * master-data.ts (the smaller, hand-curated set) so individual partner
 * totals don't shift under the rewrite.
 */
export const expandedApplications: ApplicationRow[] = [
  ...applications,
  ...generateSeededApplications(),
];
