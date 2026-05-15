import { Injectable, Logger } from '@nestjs/common';
import type { LenderAdapter } from '../ports/lender-adapter.port.js';
import type {
  LenderEligibility,
  LenderEvaluationContext,
  LenderQuoteResult,
} from '../lender.types.js';

/**
 * U.S. Bank lender adapter.
 *
 * Status: SCAFFOLD. API documentation has been received; live credentials
 * pending. Until ENV is configured the adapter throws `not_configured`
 * from quote() at call time so the orchestration engine catches it as a
 * per-lender failure (see services/orchestration/src/orchestration.service.ts:
 * the Promise.all wrap converts adapter exceptions to LenderRoute rows
 * with outcome='error' and reasonCodes=['adapter_exception']).
 *
 * To complete the integration once credentials arrive, an engineer must
 * fill in the following sections (search for "TODO us_bank"):
 *
 *  1. Authentication: U.S. Bank uses an `X-API-Key` header on the
 *     business-lending sandbox. The key is rotated quarterly via their
 *     partner portal — store the live value in `US_BANK_API_KEY` and the
 *     base URL (sandbox vs prod) in `US_BANK_BASE_URL`. Inbound webhooks
 *     are HMAC-SHA256 signed using `US_BANK_WEBHOOK_SECRET` over the raw
 *     request body; the `X-USBank-Signature` header is `t=<unix>,v1=<hex>`.
 *
 *  2. Quote endpoint: `POST {US_BANK_BASE_URL}/v1/personal-loans/quote`
 *     with the canonical applicant payload (see API spec §4.2). The
 *     response includes an `offerId`, `aprBps`, `feesCents`,
 *     `totalRepayableCents`, and `expiresAt` — map 1:1 to LenderQuote.
 *
 *  3. Retry policy: U.S. Bank guarantees idempotency on `Idempotency-Key`
 *     header for 24h. Set the key to `applicationId` and let the
 *     orchestrator's 5s hard timeout govern retries. Do NOT retry inside
 *     this adapter — the orchestrator handles per-lender failure.
 *
 *  4. Status mapping: U.S. Bank returns `approved` | `declined` |
 *     `requires_review`. Map `requires_review` to outcome='declined'
 *     with reasonCode='requires_manual_review' so the consumer gets a
 *     consistent surface; a side-channel notification to ops handles the
 *     review queue.
 *
 *  5. Marketplace placement: prime+ and prime tier; min $5,000 max
 *     $100,000; terms 24 to 84 months. Update LenderRegistry SEEDS in
 *     lender-registry.service.ts when activating.
 *
 * IMPORTANT: do NOT throw `not_configured` from the constructor or
 * isEligible(); the orchestration engine evaluates eligibility BEFORE
 * quote(). Throwing pre-quote would either crash module init or
 * pollute the LenderRoute audit trail with spurious eligibility-fail
 * rows before the operator wires credentials.
 */
@Injectable()
export class UsBankLenderAdapter implements LenderAdapter {
  private readonly logger = new Logger(UsBankLenderAdapter.name);
  readonly adapterKey = 'us_bank';

  async isEligible(_ctx: LenderEvaluationContext): Promise<LenderEligibility> {
    // Returns eligible:true so the orchestrator proceeds to quote(),
    // where the not_configured exception is raised and caught. This
    // keeps the per-lender failure surface uniform regardless of
    // whether the lender is mid-integration or briefly returning errors.
    return { eligible: true };
  }

  async quote(
    _ctx: LenderEvaluationContext,
    _opts: { signal: AbortSignal },
  ): Promise<LenderQuoteResult> {
    const baseUrl = process.env.US_BANK_BASE_URL;
    const apiKey = process.env.US_BANK_API_KEY;
    if (!baseUrl || !apiKey) {
      // Per-lender failure rather than a process-wide crash. The
      // orchestrator records this as a LenderRoute(outcome='error')
      // and continues with offers from configured lenders.
      this.logger.warn('us_bank adapter invoked but credentials missing — returning error');
      throw new Error('us_bank_adapter_pending_api_credentials');
    }

    // TODO us_bank: replace the throw above with a real fetch() call
    // to `${baseUrl}/v1/personal-loans/quote` once API credentials are
    // available. See module docstring §1-§5.
    throw new Error('us_bank_adapter_not_implemented');
  }
}
