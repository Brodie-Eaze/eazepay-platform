import type { CatalogProductFingerprint } from './snapshot.js';

/**
 * The seam between the decision engine and wherever the lender catalog
 * lives (ADR-0031). The engine reasons over CatalogProductFingerprint
 * rows ONLY — it never calls a live LenderAdapter at prequal time.
 *
 *   • Production binds this to the lender registry's listEnabled(),
 *     mapped to CatalogProductFingerprint.
 *   • Shadow binds it to the legacy static catalogue, so the shadow
 *     comparator (P7) reasons over the same catalog as the legacy path.
 *
 * The port is intentionally the only catalog dependency, so a future
 * live-quote projection can be added behind it without changing the wire
 * contract (ADR-0031 "revisit when").
 */
export const CATALOG_SOURCE_PORT = Symbol.for('eazepay.decision.catalogSource');

export interface CatalogSourcePort {
  /**
   * The enabled catalog products to evaluate. The AbortSignal guards this
   * fetch (the only IO in a catalog-only decision); the engine's scoring
   * is pure CPU and has nothing to time out.
   */
  listEnabled(opts?: { signal?: AbortSignal }): Promise<readonly CatalogProductFingerprint[]>;
}

/**
 * A dumb in-memory source for tests and shadow runs. It may be constructed
 * with a mixed list; listEnabled() returns only the enabled rows, honouring
 * its name. (runDecision also filters defensively, so the pure path is
 * robust regardless of source.)
 */
export class InMemoryCatalogSource implements CatalogSourcePort {
  private readonly products: readonly CatalogProductFingerprint[];

  constructor(products: readonly CatalogProductFingerprint[]) {
    this.products = Object.freeze([...products]);
  }

  listEnabled(): Promise<readonly CatalogProductFingerprint[]> {
    return Promise.resolve(this.products.filter((p) => p.enabled));
  }
}
