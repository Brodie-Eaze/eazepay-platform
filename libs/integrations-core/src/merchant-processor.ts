/**
 * MerchantProcessor — port interface for any vendor that can stand up
 * a merchant identifier (MID), run a charge, report a balance, and
 * surface a settlement report.
 *
 * Today this is implemented by MiCamp. Tomorrow it must be implementable
 * by Trutopia (US payfac #2) without touching a single call site — the
 * registry picks the adapter per partner, the call site only sees the
 * interface.
 *
 * The shape deliberately keeps the request/response payloads parameterised
 * — they are owned by the adapter package, plugged in via the type
 * parameters below. Two reasons:
 *
 *   1. Provider-specific fields (rate card structure, settlement
 *      cadence semantics) differ subtly between vendors. Forcing a
 *      lowest-common-denominator type here would silently drop fields
 *      we may need later.
 *   2. The platform's existing types in `lib/micamp/client.ts`
 *      (ProvisionMidResponse, ChargeResponse, SettlementReport) are
 *      already wired through downstream code; redefining them here
 *      would force a moving-target migration.
 *
 * `getBalance` is the only NEW method (not on the current MiCamp module)
 * because the canary plan requires comparing stub-vs-real balances
 * side-by-side per merchant without dispatching a real settlement run.
 * Adapters that cannot implement it yet MUST throw an
 * IntegrationErrorException with kind: 'NotImplemented' so the gap is
 * surfaced explicitly instead of falling back to silently wrong data.
 */

import type { IntegrationProvider } from './errors.js';

export interface BalanceSnapshot {
  /** The MID this balance is scoped to. */
  midId: string;
  /** Funds available to settle, in cents (NOT dollars). */
  availableCents: number;
  /** Funds in flight (authorised but not yet settled), in cents. */
  pendingCents: number;
  /** Currency. Today every merchant is USD; future expansion will need
   *  per-merchant currency configuration before this becomes a union. */
  currency: 'USD';
  /** When the upstream computed this snapshot. ISO-8601 UTC. */
  asOf: string;
}

export interface MerchantProcessor<
  TProvisionRequest = unknown,
  TProvisionResponse = unknown,
  TChargeRequest = unknown,
  TChargeResponse = unknown,
  TSettlementReport = unknown,
> {
  /** Which vendor is behind this adapter. Used for metrics + log scope. */
  readonly provider: IntegrationProvider;

  /**
   * Stand up a new MID. Pre-underwriting completes synchronously; post-
   * underwriting is volume-gated and handled by the orchestrator's
   * volume tracker (NOT by the adapter).
   */
  provisionMid(req: TProvisionRequest): Promise<TProvisionResponse>;

  /**
   * Run a charge through an existing MID. Money path — adapters MUST
   * fail fast on timeout so a hung partner cannot pin a worker.
   */
  charge(req: TChargeRequest): Promise<TChargeResponse>;

  /**
   * Snapshot of the MID's current available + pending balance. NEW on
   * this interface vs. the original module; required by the canary
   * plan so stub + real can run side-by-side per merchant.
   */
  getBalance(midId: string): Promise<BalanceSnapshot>;

  /**
   * Pull a settlement report for a MID over an ISO YYYY-MM-DD window.
   * Drives the partner payouts page + the accounting rev-share close.
   */
  settlementReport(
    midId: string,
    period: { start: string; end: string },
  ): Promise<TSettlementReport>;
}
