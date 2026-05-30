/**
 * Integration registry — the single entry point route handlers use to
 * obtain a per-partner adapter for either side of the integration tree.
 *
 * Why this exists:
 *
 *   1. Per-merchant routing. Today MiCamp serves every partner. When
 *      Trutopia onboards (US payfac #2) we will need to route SOME
 *      merchants to Trutopia and the rest to MiCamp without rewriting
 *      every consumer. The decision is keyed on partnerId; the registry
 *      is where that lookup lives.
 *
 *   2. Canary harness. The canary plan calls for running a stub adapter
 *      alongside the real adapter for a specific merchant and comparing
 *      outputs. The registry is the seam where the harness injects the
 *      stub (e.g. via createMicampClient({ charge: stubCharge })) without
 *      touching the call site.
 *
 *   3. Provider-blind consumers. Route handlers + workers depend on the
 *      MerchantProcessor / SoftPullProvider port from
 *      @eazepay/integrations-core. Adding a third payment processor or
 *      a second bureau agency does NOT require touching those handlers
 *      — only this registry and the new adapter module.
 *
 * Current behaviour:
 *   - getMerchantProcessor(partnerId) ALWAYS returns the MiCamp client.
 *     The partnerId argument is the future seam; today it is unused
 *     beyond locking the call-site contract. The interface IS the point.
 *   - getSoftPullProvider(partnerId) ALWAYS returns the HighSale client.
 *
 * What this module deliberately does NOT do:
 *   - Read DB to look up "which provider was assigned to this partner".
 *     That table doesn't exist yet; introducing it before the second
 *     provider lands is premature. When it does land, the lookup goes
 *     here, behind an in-memory cache keyed on partnerId.
 *   - Wrap each call with metrics / logging. Adapters already do that;
 *     duplicating it here would double-count + obscure the call site.
 */

import { createHighsaleClient, type HighsaleSoftPullProvider } from '../highsale/client';
import { createMicampClient, type MicampMerchantProcessor } from '../micamp/client';

/**
 * Module-scoped default instances. Adapters are stateless beyond the
 * env-derived configuration captured at import time, so a single shared
 * instance per provider is safe + cheap. The factory pattern remains
 * available for tests / canary harnesses that want a per-call override.
 */
const defaultMicampClient: MicampMerchantProcessor = createMicampClient();
const defaultHighsaleClient: HighsaleSoftPullProvider = createHighsaleClient();

/**
 * Return the `MerchantProcessor` adapter for a given partner.
 *
 * @param partnerId — Today this is informational only; tomorrow it keys
 *                    the per-merchant routing table (MiCamp vs Trutopia
 *                    vs canary-stub).
 */
export function getMerchantProcessor(partnerId: string): MicampMerchantProcessor {
  // Single-provider phase. The argument exists to lock the contract:
  // every consumer is forced to pass partnerId NOW so adding the
  // multi-provider lookup later is a pure registry change.
  void partnerId;
  return defaultMicampClient;
}

/**
 * Return the `SoftPullProvider` adapter for a given partner.
 *
 * @param partnerId — See `getMerchantProcessor` — single-provider phase
 *                    today, routing seam tomorrow.
 */
export function getSoftPullProvider(partnerId: string): HighsaleSoftPullProvider {
  void partnerId;
  return defaultHighsaleClient;
}
