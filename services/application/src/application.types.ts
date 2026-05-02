import type {
  ApplicationStatus as PrismaApplicationStatus,
  LoanCategory as PrismaLoanCategory,
  OriginationChannel as PrismaOriginationChannel,
} from '@prisma/client';

export type ApplicationStatus = PrismaApplicationStatus;
export type LoanCategory = PrismaLoanCategory;
export type OriginationChannel = PrismaOriginationChannel;

/** Events accepted by the application state machine. */
export type ApplicationEvent =
  | { type: 'SUBMIT' }
  | { type: 'BEGIN_UNDERWRITING' }
  | { type: 'PRESENT_OFFERS' }
  | { type: 'ACCEPT_OFFER'; offerId: string }
  | { type: 'CONTRACT_SIGNED' }
  | { type: 'FUND' }
  | { type: 'ACTIVATE' }
  | { type: 'DECLINE'; reasonCodes: string[] }
  | { type: 'CANCEL' }
  | { type: 'EXPIRE' };

export interface ApplicationSnapshot {
  id: string;
  userId: string;
  merchantId: string | null;
  channel: OriginationChannel;
  category: LoanCategory;
  requestedAmountCents: bigint;
  termMonths: number;
  purposeDetail: string | null;
  status: ApplicationStatus;
  riskScore: number | null;
  affordabilityPasses: boolean | null;
  declineReasonCodes: string[];
  policyVersion: string | null;
  submittedAt: string | null;
  decisionAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}
