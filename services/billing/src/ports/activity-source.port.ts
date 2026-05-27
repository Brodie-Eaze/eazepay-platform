/**
 * The "activity source" is whatever produces the funded-volume number
 * that a merchant's invoice is built from for a given period. In
 * production this is the settlements ledger; for the demo + early
 * pilot it can be a mock that returns the merchant's seeded netCents.
 *
 * Keeping it behind a port means the BillingService can be tested
 * without standing up the entire settlement pipeline and means
 * swapping to the real source later is mechanical.
 */
export interface ActivitySource {
  /**
   * Sum of funded volume for `merchantId` within the inclusive period
   * window. Returns 0 if no activity is found (the service treats
   * that as "skip this merchant when generating").
   */
  grossFundedCentsForPeriod(
    merchantId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<bigint>;

  /**
   * Bulk variant — sum of funded volume for ALL merchants in the
   * inclusive period window, returned as a Map keyed by merchantId.
   *
   * This is the hot-path call used by `previewGenerate` and
   * `runGenerate`. The naive loop-over-merchants-then-call-singular
   * approach is N+1 (one round-trip per merchant); with 500 merchants
   * that's 500 sequential SQL queries. The bulk shape collapses to a
   * single grouped query:
   *
   *   SELECT merchant_id, SUM(amount_cents)
   *     FROM payment_activity
   *    WHERE period_start >= $1 AND period_end <= $2
   *    GROUP BY merchant_id;
   *
   * Merchants with no activity are simply absent from the Map; callers
   * MUST treat `map.get(id) ?? 0n` as the gross.
   */
  grossFundedCentsForPeriodBulk(periodStart: Date, periodEnd: Date): Promise<Map<string, bigint>>;
}
