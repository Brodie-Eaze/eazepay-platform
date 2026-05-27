/**
 * SoftPullProvider — port interface for any vendor that can stand up a
 * sub-account for one of our clients, run a soft-pull pre-qualification
 * against a bureau, and return a frozen snapshot for audit replay.
 *
 * Today this is implemented by HighSale (with Milly handling billing on
 * the side). Tomorrow it must be implementable by a second bureau-agency
 * vendor without touching the consumer apply flow.
 *
 * `getSnapshot` is a new method on the interface (not present on the
 * current HighSale module) because the canary plan requires comparing
 * stub-vs-real bureau snapshots for a given pullId. Adapters that
 * cannot implement it yet MUST throw an IntegrationErrorException with
 * kind: 'NotImplemented'.
 *
 * As with MerchantProcessor, the request/response payloads are
 * parameterised — the existing HighSale request/response types stay in
 * the adapter so downstream code (decision engine, audit-log writer)
 * does not move during this refactor.
 */

import type { IntegrationProvider } from './errors.js';

export interface SoftPullSnapshot {
  pullId: string;
  /** Frozen bureau snapshot JSON. Opaque to this lib; the decision
   *  engine + regulator replay tooling parses it per-provider. */
  snapshotJson: string;
  /** When the bureau pull was executed. ISO-8601 UTC. */
  capturedAt: string;
}

export interface SoftPullProvider<
  TCreateSubAccountRequest = unknown,
  TCreateSubAccountResponse = unknown,
  TPrequalRequest = unknown,
  TPrequalResponse = unknown,
> {
  /** Which vendor is behind this adapter. Used for metrics + log scope. */
  readonly provider: IntegrationProvider;

  /**
   * Mint a sub-account for a partner. Allocates an upstream tenant +
   * (in HighSale's case) the Milly billing schedule. Expensive — the
   * routes guarding this MUST rate-limit per partner / per IP.
   */
  createSubAccount(req: TCreateSubAccountRequest): Promise<TCreateSubAccountResponse>;

  /**
   * Run a soft-pull pre-qualification. FCRA permissible-purpose
   * gating (SEC-006) is the route handler's responsibility — adapters
   * MUST NOT decide whether the pull is permitted.
   */
  runPrequal(req: TPrequalRequest): Promise<TPrequalResponse>;

  /**
   * Fetch the frozen bureau snapshot for a previously-issued pullId.
   * NEW on this interface; required by the canary plan + by regulator
   * replay tooling that needs to reconstruct a decision after the
   * fact without re-pulling (which would double-charge wholesale).
   */
  getSnapshot(pullId: string): Promise<SoftPullSnapshot>;
}
