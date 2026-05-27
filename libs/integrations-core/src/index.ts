/**
 * @eazepay/integrations-core — vendor-agnostic port definitions for
 * every external integration the platform consumes.
 *
 * Adapters live in `apps/partner-portal/lib/<vendor>/client.ts` and are
 * routed per-partner by `apps/partner-portal/lib/integrations/registry.ts`.
 * Consumers (route handlers, workers, the orchestrator) MUST depend on
 * this package — NOT on a specific adapter module — so a new vendor
 * (Trutopia, the next bureau agency, etc.) drops in without touching a
 * single call site.
 *
 * What lives here:
 *   - MerchantProcessor    (MiCamp today, Trutopia next)
 *   - SoftPullProvider     (HighSale today)
 *   - WebhookVerifier      (one HMAC implementation shared by all)
 *   - IntegrationError     (closed discriminated union of failure modes)
 *
 * What does NOT live here:
 *   - Env wiring, secret loading, fail-loud module-load guards. Those
 *     stay in the adapter so adapter tests can isolate them.
 *   - HTTP client, retry / backoff policy. The adapter owns this; the
 *     interface only describes the result shape.
 *   - DB schema / drizzle. This lib has zero runtime deps beyond node.
 */

export * from './errors.js';
export * from './merchant-processor.js';
export * from './soft-pull-provider.js';
export * from './webhook-verification-result.js';
export * from './webhook-verifier.js';
