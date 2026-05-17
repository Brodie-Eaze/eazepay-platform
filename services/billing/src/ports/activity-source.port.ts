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
}
