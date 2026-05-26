/**
 * Format basis points as a percentage string. APRs and fee rates are
 * stored as integer bps across the codebase; this is the canonical
 * presentation primitive.
 *
 *   formatBps(199)              → '1.99%'
 *   formatBps(2500)             → '25.00%'
 *   formatBps(0)                → '0.00%'
 *   formatBps(1875, { precision: 1 }) → '18.8%'
 */
export interface FormatBpsOptions {
  /** Number of digits after the decimal point. Default 2. */
  precision?: number;
}

export function formatBps(bps: number, opts: FormatBpsOptions = {}): string {
  const { precision = 2 } = opts;
  if (!Number.isFinite(bps)) {
    throw new TypeError(`formatBps: non-finite input ${String(bps)}`);
  }
  if (precision < 0 || !Number.isInteger(precision)) {
    throw new RangeError(`formatBps: precision must be a non-negative integer, got ${precision}`);
  }
  return `${(bps / 100).toFixed(precision)}%`;
}
