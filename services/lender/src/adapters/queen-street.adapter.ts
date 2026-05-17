import { Injectable, Logger } from '@nestjs/common';
import type { LenderAdapter } from '../ports/lender-adapter.port.js';
import type {
  LenderEligibility,
  LenderEvaluationContext,
  LenderQuoteResult,
} from '../lender.types.js';

/**
 * Queen Street Capital lender adapter (prime+ tier).
 *
 * Status: SCAFFOLD. Queen Street API outreach is in progress;
 * credentials pending. Until ENV is configured the adapter throws
 * `not_configured` from quote() at call time so the orchestration
 * engine catches it as a per-lender failure.
 *
 * Queen Street distinctive: positioned for prime+ tier offers
 * ($10k-$250k, 12-120 months). They underwrite manually for amounts
 * above $100k, which means quote() may return outcome='error' with
 * reasonCode='requires_manual_underwriting' rather than a synchronous
 * offer — orchestration treats this as a per-lender failure and the
 * application proceeds with offers from other configured lenders.
 *
 * To complete the integration once credentials arrive, an engineer
 * must fill in the following sections (search for "TODO queen_street"):
 *
 *  1. Authentication: bearer token in `Authorization: Bearer ${token}`.
 *     The token is a long-lived signed JWT issued by Queen Street ops;
 *     store the live value in `QUEEN_STREET_API_TOKEN`. Base URL in
 *     `QUEEN_STREET_BASE_URL`. Webhooks signed with
 *     `QUEEN_STREET_WEBHOOK_SECRET` (Ed25519, header
 *     `X-QS-Signature` = base64(ed25519 over body)).
 *
 *  2. Quote endpoint: `POST {QUEEN_STREET_BASE_URL}/v1/quote` with the
 *     canonical applicant payload. Response is asynchronous for
 *     amounts > $100k; the synchronous path returns
 *     `{ status: 'preapproved'|'pending'|'declined', offerId, ... }`.
 *
 *  3. Retry policy: Queen Street is rate-limited at 10 req/sec per
 *     API token. The orchestrator's 5s hard timeout governs retries;
 *     do NOT retry inside this adapter. If rate-limited (HTTP 429),
 *     surface as outcome='error' with reasonCode='rate_limited'.
 *
 *  4. Status mapping: 'preapproved' -> approved; 'pending' ->
 *     outcome='error' reasonCode='requires_manual_underwriting' so
 *     orchestration moves on while ops works the manual queue.
 *
 *  5. Marketplace placement: prime+ tier ONLY; min $10,000 max
 *     $250,000; terms 12 to 120 months. Update LenderRegistry SEEDS
 *     in lender-registry.service.ts when activating.
 */
@Injectable()
export class QueenStreetLenderAdapter implements LenderAdapter {
  private readonly logger = new Logger(QueenStreetLenderAdapter.name);
  readonly adapterKey = 'queen_street';

  async isEligible(_ctx: LenderEvaluationContext): Promise<LenderEligibility> {
    return { eligible: true };
  }

  async quote(
    _ctx: LenderEvaluationContext,
    _opts: { signal: AbortSignal },
  ): Promise<LenderQuoteResult> {
    const baseUrl = process.env.QUEEN_STREET_BASE_URL;
    const token = process.env.QUEEN_STREET_API_TOKEN;
    if (!baseUrl || !token) {
      this.logger.warn('queen_street adapter invoked but credentials missing — returning error');
      throw new Error('queen_street_adapter_pending_api_credentials');
    }

    // TODO queen_street: replace the throw with the bearer-token
    // quote flow described in §1-§5 of the file header.
    throw new Error('queen_street_adapter_not_implemented');
  }
}
