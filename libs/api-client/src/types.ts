/**
 * Shared response shapes used by every consumer of the EazePay API.
 *
 * Production swap: these types are generated from the OpenAPI spec
 * exported by apps/api (NestJS + zod-to-openapi). For MVP they are
 * hand-keyed in lockstep with the controllers — the production
 * generator drops in without breaking imports because the wire shapes
 * are stable.
 */

export interface Problem {
  type: string;
  title: string;
  status: number;
  code: string;
  detail?: string;
  instance?: string;
  errors?: Array<{ path: string; message: string; code?: string }>;
}

// ---- Auth ----
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
}
export interface AuthChallenge {
  challengeId: string;
  channel: 'sms' | 'email' | 'totp';
  expiresAt: string;
}

// ---- Application + Offer ----
export type ApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'underwriting'
  | 'offers_presented'
  | 'accepted'
  | 'contracted'
  | 'funding'
  | 'active'
  | 'declined'
  | 'cancelled'
  | 'expired';

export type LoanCategory =
  | 'auto'
  | 'home_improvement'
  | 'medical'
  | 'retail'
  | 'personal'
  | 'consolidation';

export interface ApplicationSnapshot {
  id: string;
  userId: string;
  merchantId: string | null;
  channel: 'consumer_direct' | 'merchant_link' | 'merchant_widget';
  category: LoanCategory;
  /** Money — always an integer-string of cents. */
  requestedAmountCents: string;
  termMonths: number;
  purposeDetail: string | null;
  status: ApplicationStatus;
  submittedAt: string | null;
  decisionAt: string | null;
  declineReasonCodes: string[];
  createdAt: string;
}

export interface Offer {
  id: string;
  lenderProductId: string;
  lenderOfRecord: string;
  amountCents: string;
  termMonths: number;
  aprBps: number;
  comparisonRateBps: number | null;
  feesCents: string;
  totalRepayableCents: string;
  rank: number;
  status: 'presented' | 'accepted' | 'expired' | 'withdrawn';
  expiresAt: string;
}

// ---- Repayment ----
export interface Repayment {
  id: string;
  sequence: number;
  dueDate: string;
  amountDueCents: string;
  amountPaidCents: string;
  status:
    | 'scheduled'
    | 'due'
    | 'paid'
    | 'partial'
    | 'late'
    | 'charged_off'
    | 'waived';
  paidAt: string | null;
}

// ---- Notification ----
export interface NotificationItem {
  id: string;
  channel: 'push' | 'email' | 'sms' | 'in_app';
  templateKey: string;
  payload: unknown;
  status: string;
  readAt: string | null;
  createdAt: string;
}
