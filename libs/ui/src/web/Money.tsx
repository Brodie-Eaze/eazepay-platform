import type { FC } from 'react';
import { formatCurrencyCents } from '@eazepay/shared-utils/format-currency';
import { cn } from './cn';

/**
 * Render integer-cents as USD. Always tabular nums; signs explicit.
 * Backend money is BigInt cents — accept number for view-model
 * convenience but accept string for big values.
 *
 * `compact` short-circuits to Intl compact notation ("$5K"); otherwise
 * delegates to the canonical `formatCurrencyCents` utility so call
 * sites stay in sync with non-React surfaces.
 */
export const Money: FC<{
  cents: number | string;
  className?: string;
  showSign?: boolean;
  compact?: boolean;
  /** Force render without fractional cents even if non-whole. */
  noFractions?: boolean;
}> = ({ cents, className, showSign, compact, noFractions }) => {
  const n = typeof cents === 'string' ? Number(cents) : cents;
  const sign = n < 0 ? '-' : showSign ? '+' : '';
  const abs = Math.abs(n);

  let body: string;
  if (compact) {
    body = `$${Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1,
      minimumFractionDigits: 0,
    }).format(abs / 100)}`;
  } else if (noFractions) {
    // Strip cents portion before formatting so `$5,000.50 noFractions` → `$5,000`.
    body = formatCurrencyCents(Math.trunc(abs / 100) * 100);
  } else {
    body = formatCurrencyCents(abs);
  }

  return (
    <span className={cn('tabular-nums', className)}>
      {sign}
      {body}
    </span>
  );
};

/** Render APR / bps as percentage. e.g. 1875 bps → 18.75 % */
export const Apr: FC<{ bps: number; decimals?: number; className?: string }> = ({
  bps,
  decimals = 2,
  className,
}) => <span className={cn('tabular-nums', className)}>{(bps / 100).toFixed(decimals)}%</span>;
