import { z } from 'zod';

/**
 * Branded money types.
 *
 * Two parallel brand hierarchies live in this file:
 *
 *   1. Number-branded `Cents` + `BasisPoints` — the working types used
 *      across the partner-portal app, drizzle schema, decision engine,
 *      invoicing, and the public /api/v1 surface. Schema columns
 *      backed by Postgres `bigint(mode: 'number')` or `integer` flow
 *      through `Cents` / `BasisPoints` so the type system catches:
 *        • a `Cents` value sneaking into a `BasisPoints` slot
 *          (the kickback × loan-amount arithmetic bug, ADR-0012)
 *        • a raw `number` written into a money column with no
 *          bounds check (must round-trip through `toCents` / `toBps`)
 *        • bps arithmetic in dollar space, dollar arithmetic in bps
 *          space (the two brands have NO subtype relationship)
 *
 *      Constructors `toCents` / `toBps` enforce the invariants at the
 *      boundary: `Cents` must be a finite integer ≥ 0, `BasisPoints`
 *      must be a finite integer in `[0, 10000]` (0% – 100%). Anything
 *      else throws — the only way to mint a branded value is through
 *      the constructor.
 *
 *   2. BigInt-branded `CentsBig` + `Money` — the multi-currency money
 *      vector used by the NestJS services (`services/lender/*`,
 *      `services/webhook/*`). Kept on bigint to match the upstream
 *      lender adapters whose contract is already integer-cents-as-bigint.
 *      `addMoney` / `subMoney` / `usd()` live in this hierarchy and
 *      do NOT interoperate with the number-branded `Cents` — callers
 *      that need to cross the boundary go through `centsToBig` /
 *      `centsFromBig` which are explicit, bounds-checked, and easy to
 *      grep for at review time.
 *
 * Anti-pattern flagged: code that mixed `cents` and `bps` in the same
 * `* number` expression (because both were structural `number`) is the
 * exact class of bug this branding closes. See lender-economics.ts
 * kickback math + decision-engine APR math for the prior bugs fixed
 * during this rollout.
 */

declare const moneyBrand: unique symbol;

/* ──────────────────────────────────────────────────────────────────
 *  Number-branded `Cents` — the partner-portal / drizzle working type
 * ────────────────────────────────────────────────────────────────── */

export type Cents = number & { readonly [moneyBrand]: 'Cents' };

/**
 * Mint a `Cents` value from a raw number. Enforces:
 *   • finite (no NaN / ±Infinity)
 *   • integer (Math.trunc === n) — fractional cents are a bug
 *   • non-negative (the schema columns never store credits as
 *     negative cents — refunds live in their own table)
 *
 * Throws RangeError on violation. The only sanctioned path from
 * `number` → `Cents`.
 */
export function toCents(n: number): Cents {
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    throw new RangeError(`toCents: expected finite number, got ${n}`);
  }
  if (!Number.isInteger(n)) {
    throw new RangeError(`toCents: expected integer cents, got ${n}`);
  }
  if (n < 0) {
    throw new RangeError(`toCents: expected non-negative cents, got ${n}`);
  }
  return n as Cents;
}

/**
 * Lenient mint — for places (legacy localStorage rehydration, untrusted
 * JSON) that round non-integer cents before branding. Still rejects
 * non-finite + negative values. Prefer `toCents` everywhere else.
 */
export function toCentsRound(n: number): Cents {
  return toCents(Math.round(n));
}

/** Type-safe arithmetic. Result is still `Cents`. */
export function addCents(a: Cents, b: Cents): Cents {
  return toCents(a + b);
}
export function subCents(a: Cents, b: Cents): Cents {
  // Allow zero floor — invoicing balance math hits zero often.
  const r = a - b;
  return toCents(r < 0 ? 0 : r);
}

/* ──────────────────────────────────────────────────────────────────
 *  Number-branded `BasisPoints` — APR + fee rates
 * ────────────────────────────────────────────────────────────────── */

export type BasisPoints = number & { readonly [moneyBrand]: 'BasisPoints' };

/** Maximum sensible BasisPoints value — 100% expressed in bps. */
export const BPS_MAX = 10_000;

/**
 * Mint a `BasisPoints` value. Enforces:
 *   • finite integer
 *   • range [0, 10_000] (0% – 100%)
 *
 * Throws RangeError on violation. Anything above 100% is a bug — an
 * APR of 250% is real but should be expressed in a different unit
 * (and that unit doesn't exist in this codebase, so the upper bound
 * here is a deliberate fence).
 */
export function toBps(n: number): BasisPoints {
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    throw new RangeError(`toBps: expected finite number, got ${n}`);
  }
  if (!Number.isInteger(n)) {
    throw new RangeError(`toBps: expected integer basis points, got ${n}`);
  }
  if (n < 0 || n > BPS_MAX) {
    throw new RangeError(`toBps: expected 0..${BPS_MAX}, got ${n}`);
  }
  return n as BasisPoints;
}

/**
 * Apply a `BasisPoints` rate to a `Cents` principal and return the
 * resulting `Cents`. This is the ONLY sanctioned multiplication of
 * cents and bps in the codebase — every other call site must use it.
 *
 *   cents = round(principalCents × bps / 10_000)
 *
 * Centralising the math here means:
 *   • The bps/10_000 divisor cannot be forgotten (the prior bug:
 *     `principal * kickbackBps` produced a value 10_000× too large)
 *   • The rounding rule is consistent (banker's rounding is NOT used —
 *     the platform rounds half-away-from-zero via Math.round to match
 *     the lender contracts that specify the same rule)
 */
export function applyBps(principal: Cents, rate: BasisPoints): Cents {
  return toCents(Math.round((principal * rate) / BPS_MAX));
}

/* ──────────────────────────────────────────────────────────────────
 *  BigInt-branded `CentsBig` + `Money` — services / multi-currency
 * ────────────────────────────────────────────────────────────────── */

export type CentsBig = bigint & { readonly [moneyBrand]: 'CentsBig' };

export const ISO4217 = ['USD'] as const;
export type Currency = (typeof ISO4217)[number];

export interface Money {
  readonly amount: CentsBig;
  readonly currency: Currency;
}

export const centsBig = (n: bigint | number | string): CentsBig => {
  const v = typeof n === 'bigint' ? n : BigInt(n);
  return v as CentsBig;
};

/**
 * Bridge: `Cents` (number) → `CentsBig` (bigint). Explicit, easy to
 * grep at review time. Don't use this to "escape" the type system —
 * the only legitimate call site is the services boundary.
 */
export function centsToBig(c: Cents): CentsBig {
  return BigInt(c) as CentsBig;
}

/**
 * Bridge: `CentsBig` → `Cents`. Throws if the bigint exceeds
 * `Number.MAX_SAFE_INTEGER` — at that point a number-typed cents
 * value would silently lose precision and the caller must stay in
 * bigint land.
 */
export function centsFromBig(c: CentsBig): Cents {
  if (c > BigInt(Number.MAX_SAFE_INTEGER) || c < 0n) {
    throw new RangeError(`centsFromBig: ${c} outside safe-integer range`);
  }
  return toCents(Number(c));
}

export const usd = (amount: bigint | number | string): Money => ({
  amount: centsBig(amount),
  currency: 'USD',
});

export const addMoney = (a: Money, b: Money): Money => {
  if (a.currency !== b.currency) {
    throw new Error(`currency mismatch: ${a.currency} vs ${b.currency}`);
  }
  return { amount: centsBig(a.amount + b.amount), currency: a.currency };
};

export const subMoney = (a: Money, b: Money): Money => {
  if (a.currency !== b.currency) {
    throw new Error(`currency mismatch: ${a.currency} vs ${b.currency}`);
  }
  return { amount: centsBig(a.amount - b.amount), currency: a.currency };
};

export const isNegative = (m: Money): boolean => m.amount < 0n;
export const isZero = (m: Money): boolean => m.amount === 0n;

/* ──────────────────────────────────────────────────────────────────
 *  Zod schemas — boundary validation
 * ────────────────────────────────────────────────────────────────── */

const bigintFromInput = z
  .union([z.bigint(), z.string().regex(/^-?\d+$/), z.number().int()])
  .transform((v): bigint => (typeof v === 'bigint' ? v : BigInt(v)));

export const CurrencySchema = z.enum(ISO4217);

/** Parses a value into the bigint-branded `CentsBig`. */
export const CentsBigSchema = bigintFromInput.transform((v): CentsBig => v as CentsBig);

/** Parses a value into the number-branded `Cents`. Bounds-checked. */
export const CentsSchema = z
  .number()
  .int()
  .nonnegative()
  .transform((v): Cents => v as Cents);

/** Parses a value into `BasisPoints`. Bounds-checked. */
export const BasisPointsSchema = z
  .number()
  .int()
  .min(0)
  .max(BPS_MAX)
  .transform((v): BasisPoints => v as BasisPoints);

export const MoneySchema = z.object({
  amount: CentsBigSchema,
  currency: CurrencySchema,
});

/* ──────────────────────────────────────────────────────────────────
 *  Backwards-compatible alias
 * ────────────────────────────────────────────────────────────────── */

/**
 * Legacy alias used by older `services/*` code that wrote
 * `cents(...)` directly. Prefer `centsBig` in new code so the bigint
 * vs number distinction is obvious at the call site.
 */
export const cents = centsBig;
