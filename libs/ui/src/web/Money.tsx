import type { FC } from 'react';
import { cn } from './cn';

/**
 * Render integer-cents as USD. Always tabular nums; signs explicit.
 * Backend money is BigInt cents — accept number for view-model
 * convenience but accept string for big values.
 */
export const Money: FC<{
  cents: number | string;
  className?: string;
  showSign?: boolean;
  compact?: boolean;
  /** Render as 4,750 (no decimals) if integer dollars */
  noFractions?: boolean;
}> = ({ cents, className, showSign, compact, noFractions }) => {
  const n = typeof cents === 'string' ? Number(cents) : cents;
  const sign = n < 0 ? '-' : showSign ? '+' : '';
  const abs = Math.abs(n) / 100;
  const formatted = compact
    ? Intl.NumberFormat('en-US', {
        notation: 'compact',
        maximumFractionDigits: 1,
        minimumFractionDigits: 0,
      }).format(abs)
    : Intl.NumberFormat('en-US', {
        minimumFractionDigits: noFractions ? 0 : 2,
        maximumFractionDigits: 2,
      }).format(abs);
  return (
    <span className={cn('tabular-nums', className)}>
      {sign}${formatted}
    </span>
  );
};

/** Render APR / bps as percentage. e.g. 1875 bps → 18.75 % */
export const Apr: FC<{ bps: number; decimals?: number; className?: string }> = ({
  bps,
  decimals = 2,
  className,
}) => (
  <span className={cn('tabular-nums', className)}>
    {(bps / 100).toFixed(decimals)}%
  </span>
);
