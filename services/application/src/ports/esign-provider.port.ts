/**
 * ESignProvider — abstraction over E-SIGN/UETA-compliant signature
 * services (DocuSign, Dropbox Sign, etc).
 *
 * Production flow is webhook-driven: draftAndSend returns immediately
 * with `pending`, the consumer signs in the provider's UI/redirect, and
 * the provider POSTs to /v1/webhooks/esign/:provider with the final
 * status. The webhook handler then invokes ApplicationService to
 * complete the contracted transition.
 *
 * Mock dev flow auto-signs synchronously so engineers can complete the
 * happy path without an external provider.
 */
export interface ESignDraftInput {
  applicationId: string;
  offerId: string;
  userId: string;
  /** Identifier of the user's verified email/phone where the envelope is sent. */
  signerContact: string;
  /** Stable hash of the rendered document. Audit anchor. */
  documentSha256: string;
  /** Free-form metadata to round-trip through the provider. */
  metadata?: Record<string, string>;
}

export type ESignStatus = 'drafted' | 'sent' | 'signed' | 'declined' | 'expired' | 'voided';

export interface ESignDraftResult {
  envelopeId: string;
  status: ESignStatus;
  /** ISO datetime when the envelope expires if not signed. */
  expiresAt: string;
  /** Identifier of the provider for audit logging — must match the value
   *  recorded on Contract.signatureProvider. */
  provider: string;
}

export interface ESignProvider {
  draftAndSend(input: ESignDraftInput): Promise<ESignDraftResult>;
  getStatus(envelopeId: string): Promise<ESignStatus>;
}

export const ESIGN_PROVIDER = Symbol('ESIGN_PROVIDER');
