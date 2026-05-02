import { z } from 'zod';

declare const moneyBrand: unique symbol;

export type Cents = bigint & { readonly [moneyBrand]: 'Cents' };

export const ISO4217 = ['USD'] as const;
export type Currency = (typeof ISO4217)[number];

export interface Money {
  readonly amount: Cents;
  readonly currency: Currency;
}

export const cents = (n: bigint | number | string): Cents => {
  const v = typeof n === 'bigint' ? n : BigInt(n);
  return v as Cents;
};

export const usd = (amount: bigint | number | string): Money => ({
  amount: cents(amount),
  currency: 'USD',
});

export const addMoney = (a: Money, b: Money): Money => {
  if (a.currency !== b.currency) {
    throw new Error(`currency mismatch: ${a.currency} vs ${b.currency}`);
  }
  return { amount: cents(a.amount + b.amount), currency: a.currency };
};

export const subMoney = (a: Money, b: Money): Money => {
  if (a.currency !== b.currency) {
    throw new Error(`currency mismatch: ${a.currency} vs ${b.currency}`);
  }
  return { amount: cents(a.amount - b.amount), currency: a.currency };
};

export const isNegative = (m: Money): boolean => m.amount < 0n;
export const isZero = (m: Money): boolean => m.amount === 0n;

const bigintFromInput = z
  .union([z.bigint(), z.string().regex(/^-?\d+$/), z.number().int()])
  .transform((v): bigint => (typeof v === 'bigint' ? v : BigInt(v)));

export const CurrencySchema = z.enum(ISO4217);

export const CentsSchema = bigintFromInput.transform((v): Cents => v as Cents);

export const MoneySchema = z.object({
  amount: CentsSchema,
  currency: CurrencySchema,
});
