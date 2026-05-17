import type { UserId } from '@eazepay/shared-types';
import type { PiiV1 } from '../pii.types.js';

export type KycOutcome = 'pending' | 'approved' | 'manual_review' | 'rejected' | 'expired';

export interface KycInitiateInput {
  userId: UserId;
  pii: PiiV1;
  /** IP + UA for risk signals + audit trail. */
  ipAddress?: string;
  userAgent?: string;
}

export interface KycInitiateResult {
  /** Provider-side reference (Alloy entity_token, Persona inquiry-id, etc.) */
  providerRef: string;
  /** Outcome at the moment of initiation; usually `pending` until webhook. */
  outcome: KycOutcome;
}

export interface KycStatusResult {
  outcome: KycOutcome;
  reasonCodes: string[];
  pep: 'unknown' | 'cleared' | 'match';
  sanctions: 'unknown' | 'cleared' | 'match';
  raw?: unknown;
}

export interface KycProvider {
  initiate(input: KycInitiateInput): Promise<KycInitiateResult>;
  status(providerRef: string): Promise<KycStatusResult>;
}

export const KYC_PROVIDER = Symbol('KYC_PROVIDER');
