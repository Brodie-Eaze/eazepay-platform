/**
 * Mock ActivitySource — returns the merchant's seeded `netCents`
 * proxy until the settlements ledger is queryable. Dev/staging
 * use only; the BillingModule throws if this is wired outside
 * `NODE_ENV=development`.
 *
 * The "period" is ignored in the mock since the seed numbers aren't
 * period-aware; treat the same number as belonging to the current
 * period. The real adapter will window-query by date.
 */
import type { PrismaClient } from '@prisma/client';
import type { ActivitySource } from '../ports/activity-source.port.js';

export class MockActivitySource implements ActivitySource {
  constructor(private readonly prisma: PrismaClient) {}

  async grossFundedCentsForPeriod(
    merchantId: string,
    _periodStart: Date,
    _periodEnd: Date,
  ): Promise<bigint> {
    // Use a deterministic per-merchant figure: hash the id to a
    // stable cents value in [10_000_00, 1_000_000_00]. Means the
    // mock is reproducible across restarts without needing a seed.
    let h = 0;
    for (const c of merchantId) h = (h * 31 + c.charCodeAt(0)) | 0;
    const cents = 10_000_00 + (Math.abs(h) % 990_000_00);
    void this.prisma; // adapter shape stays consistent with the real one
    return BigInt(cents);
  }
}
