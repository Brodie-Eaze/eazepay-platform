import { Injectable, Logger } from '@nestjs/common';
import type { LenderAdapter } from '../ports/lender-adapter.port.js';
import type {
  LenderEligibility,
  LenderEvaluationContext,
  LenderQuoteResult,
} from '../lender.types.js';

/**
 * Engine.Tech lender adapter (card-stacking marketplace).
 *
 * Status: SCAFFOLD. Engine.Tech API outreach is in progress; sandbox
 * keys have not yet been issued. Until ENV is configured the adapter
 * throws `not_configured` from quote() at call time so the
 * orchestration engine catches it as a per-lender failure.
 *
 * Engine.Tech distinctive: this lender is "card-stacking friendly" —
 * it can return MULTIPLE offers for a single applicant (e.g. a prime
 * loan plus a sub-prime overflow tranche). When the real integration
 * lands, the quote() implementation will need to either (a) return the
 * cheapest single offer to keep the current LenderAdapter contract, or
 * (b) extend the port to return LenderQuoteResult[] and update
 * orchestration.service.ts persistResults() to iterate. Option (b)
 * is preferred but is a port-shape change — coordinate with the
 * orchestration engineer before shipping.
 *
 * To complete the integration once credentials arrive, an engineer
 * must fill in the following sections (search for "TODO engine_tech"):
 *
 *  1. Authentication: OAuth2 client-credentials. Issue a token via
 *     `POST {ENGINE_TECH_BASE_URL}/oauth/token` with
 *     `ENGINE_TECH_CLIENT_ID` + `ENGINE_TECH_CLIENT_SECRET` in the
 *     form body (grant_type=client_credentials). Tokens TTL 1h —
 *     cache in-memory with a 5-min safety margin. Webhooks are HMAC
 *     signed using `ENGINE_TECH_WEBHOOK_SECRET` (header
 *     `X-EngineTech-Signature` = base64(hmac-sha256)).
 *
 *  2. Quote endpoint: `POST {ENGINE_TECH_BASE_URL}/v2/applications`
 *     returning `{ offers: [{ lenderName, aprBps, feesCents, ... }] }`.
 *     Each entry in the offers array is a separate underlying lender
 *     in the Engine.Tech pool. Pick lowest totalRepayableCents (or
 *     extend the port — see header note).
 *
 *  3. Retry policy: Engine.Tech does NOT guarantee idempotency on
 *     application creation. Pass an `applicationRef` query param
 *     equal to `applicationId` and tolerate duplicate writes — they
 *     will return the same application_id on repeat calls within 24h.
 *
 *  4. Status mapping: Engine.Tech returns per-offer
 *     `decision: 'offer' | 'decline' | 'pending'`. Filter to 'offer'
 *     only; surface 'pending' as outcome='declined' with reasonCode
 *     'pending_manual_review'.
 *
 *  5. Marketplace placement: near-prime and sub-prime tiers; min
 *     $1,000 max $50,000; terms 6 to 60 months. Card-stacking friendly.
 *     Update LenderRegistry SEEDS in lender-registry.service.ts when
 *     activating.
 */
@Injectable()
export class EngineTechLenderAdapter implements LenderAdapter {
  private readonly logger = new Logger(EngineTechLenderAdapter.name);
  readonly adapterKey = 'engine_tech';

  async isEligible(_ctx: LenderEvaluationContext): Promise<LenderEligibility> {
    return { eligible: true };
  }

  async quote(
    _ctx: LenderEvaluationContext,
    _opts: { signal: AbortSignal },
  ): Promise<LenderQuoteResult> {
    const baseUrl = process.env.ENGINE_TECH_BASE_URL;
    const clientId = process.env.ENGINE_TECH_CLIENT_ID;
    const clientSecret = process.env.ENGINE_TECH_CLIENT_SECRET;
    if (!baseUrl || !clientId || !clientSecret) {
      this.logger.warn(
        'engine_tech adapter invoked but credentials missing — returning error',
      );
      throw new Error('engine_tech_adapter_pending_api_credentials');
    }

    // TODO engine_tech: replace the throw with the OAuth-then-quote
    // flow described in §1-§5 of the file header.
    throw new Error('engine_tech_adapter_not_implemented');
  }
}
