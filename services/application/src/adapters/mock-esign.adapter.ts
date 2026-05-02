import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  ESignDraftInput,
  ESignDraftResult,
  ESignProvider,
  ESignStatus,
} from '../ports/esign-provider.port.js';

/**
 * DEV ONLY. Returns `signed` immediately so the happy path completes in
 * one round-trip. Production must implement a real DocuSign / Dropbox
 * Sign adapter and a webhook receiver — at which point this module
 * refuses to register the mock outside development.
 */
@Injectable()
export class MockESignAdapter implements ESignProvider {
  private readonly logger = new Logger(MockESignAdapter.name);

  async draftAndSend(input: ESignDraftInput): Promise<ESignDraftResult> {
    const envelopeId = `mock-${randomUUID()}`;
    this.logger.warn(
      `[DEV-ONLY] Mock e-sign envelope ${envelopeId} auto-signed for application=${input.applicationId} offer=${input.offerId}`,
    );
    return {
      envelopeId,
      status: 'signed',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      provider: 'mock',
    };
  }

  async getStatus(_envelopeId: string): Promise<ESignStatus> {
    return 'signed';
  }
}
