import type { BoPiiV1 } from '../bo-pii.types.js';

export type KybOutcome =
  | 'pending'
  | 'approved'
  | 'manual_review'
  | 'rejected';

export interface KybInitiateInput {
  merchantId: string;
  legalName: string;
  ein?: string;
  formationState?: string;
  naicsCode?: string;
  beneficialOwners: Array<{
    pii: BoPiiV1;
    ownershipPct: number;
    isControlling: boolean;
  }>;
}

export interface KybInitiateResult {
  providerRef: string;
  outcome: KybOutcome;
}

export interface KybStatusResult {
  outcome: KybOutcome;
  reasonCodes: string[];
  ofac: 'unknown' | 'cleared' | 'match';
  ein: 'unknown' | 'verified' | 'mismatch';
}

export interface KybProvider {
  initiate(input: KybInitiateInput): Promise<KybInitiateResult>;
  status(providerRef: string): Promise<KybStatusResult>;
}

export const KYB_PROVIDER = Symbol('KYB_PROVIDER');
