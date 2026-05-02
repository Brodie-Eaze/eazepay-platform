import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  KybInitiateInput,
  KybInitiateResult,
  KybProvider,
  KybStatusResult,
} from '../ports/kyb-provider.port.js';

/**
 * DEV ONLY KYB stub. Mirrors the shape of Alloy / Middesk responses.
 *
 * Outcome heuristics:
 *  - legal name starts with "XR" → rejected
 *  - legal name starts with "X"  → manual_review
 *  - any beneficial owner missing ssnLast4 → manual_review
 *  - else → approved
 */
@Injectable()
export class MockKybAdapter implements KybProvider {
  private readonly logger = new Logger(MockKybAdapter.name);
  private readonly results = new Map<string, KybStatusResult>();

  async initiate(input: KybInitiateInput): Promise<KybInitiateResult> {
    const ref = randomUUID();
    const upper = input.legalName.toUpperCase();
    const missingSsn = input.beneficialOwners.some((o) => !o.pii.ssnLast4);
    const result: KybStatusResult = upper.startsWith('XR')
      ? { outcome: 'rejected', reasonCodes: ['mock_reject_legal_name'], ofac: 'cleared', ein: 'verified' }
      : upper.startsWith('X')
        ? { outcome: 'manual_review', reasonCodes: ['mock_review_legal_name'], ofac: 'cleared', ein: 'verified' }
        : missingSsn
          ? { outcome: 'manual_review', reasonCodes: ['bo_missing_ssn_last4'], ofac: 'cleared', ein: 'verified' }
          : { outcome: 'approved', reasonCodes: [], ofac: 'cleared', ein: 'verified' };
    this.results.set(ref, result);
    this.logger.warn(
      `[DEV-ONLY] KYB mock initiate ref=${ref} merchant=${input.merchantId} outcome=${result.outcome}`,
    );
    return { providerRef: ref, outcome: result.outcome };
  }

  async status(providerRef: string): Promise<KybStatusResult> {
    return (
      this.results.get(providerRef) ?? {
        outcome: 'rejected',
        reasonCodes: ['mock_unknown_ref'],
        ofac: 'unknown',
        ein: 'unknown',
      }
    );
  }
}
