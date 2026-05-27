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

  /** Deterministic per-merchant cents value — kept identical to the
   *  prior single-call shape so both code paths agree. */
  private deterministicGross(merchantId: string): bigint {
    let h = 0;
    for (const c of merchantId) h = (h * 31 + c.charCodeAt(0)) | 0;
    const cents = 10_000_00 + (Math.abs(h) % 990_000_00);
    return BigInt(cents);
  }

  async grossFundedCentsForPeriod(
    merchantId: string,
    _periodStart: Date,
    _periodEnd: Date,
  ): Promise<bigint> {
    void this.prisma; // adapter shape stays consistent with the real one
    return this.deterministicGross(merchantId);
  }

  /** Bulk shape — single Prisma round-trip to enumerate merchants, then
   *  derive the deterministic gross per id. The real adapter will be a
   *  single grouped SQL query against `payment_activity`. */
  async grossFundedCentsForPeriodBulk(
    _periodStart: Date,
    _periodEnd: Date,
  ): Promise<Map<string, bigint>> {
    const merchants = await this.prisma.merchant.findMany({ select: { id: true } });
    const out = new Map<string, bigint>();
    for (const m of merchants) {
      out.set(m.id, this.deterministicGross(m.id));
    }
    return out;
  }
}
