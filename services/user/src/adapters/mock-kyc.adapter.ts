import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  KycInitiateInput,
  KycInitiateResult,
  KycProvider,
  KycStatusResult,
} from '../ports/kyc-provider.port.js';

/**
 * DEV ONLY KYC stub. Approves anyone whose legal last name doesn't start
 * with "X" (use last names beginning with X to test the manual-review +
 * rejected paths). Mimics Alloy/Persona/Socure response shape but returns
 * synchronously — production will be webhook-driven.
 */
@Injectable()
export class MockKycAdapter implements KycProvider {
  private readonly logger = new Logger(MockKycAdapter.name);
  private readonly results = new Map<string, KycStatusResult>();

  async initiate(input: KycInitiateInput): Promise<KycInitiateResult> {
    const ref = randomUUID();
    const last = input.pii.legalName.last.toUpperCase();
    const result: KycStatusResult = last.startsWith('XR')
      ? { outcome: 'rejected', reasonCodes: ['mock_reject'], pep: 'cleared', sanctions: 'cleared' }
      : last.startsWith('X')
        ? {
            outcome: 'manual_review',
            reasonCodes: ['mock_review_low_confidence'],
            pep: 'cleared',
            sanctions: 'cleared',
          }
        : {
            outcome: 'approved',
            reasonCodes: [],
            pep: 'cleared',
            sanctions: 'cleared',
          };
    this.results.set(ref, result);
    this.logger.warn(`[DEV-ONLY] KYC mock initiate ref=${ref} outcome=${result.outcome}`);
    return { providerRef: ref, outcome: result.outcome };
  }

  async status(providerRef: string): Promise<KycStatusResult> {
    const r = this.results.get(providerRef);
    if (!r)
      return {
        outcome: 'expired',
        reasonCodes: ['mock_unknown_ref'],
        pep: 'unknown',
        sanctions: 'unknown',
      };
    return r;
  }
}
