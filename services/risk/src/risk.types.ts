import type { RiskRecommendation as PrismaRecommendation } from '@prisma/client';

export type RiskRecommendation = PrismaRecommendation;

export interface RiskAssessInput {
  applicationId: string;
  userId: string;
  /** IP captured at submit time. */
  ipAddress?: string;
  userAgent?: string;
  /** Optional device fingerprint from the SDK (Sift / Castle / SEON). */
  deviceFingerprint?: string;
  /** Identity contact for provider-side lookups. */
  email?: string | null;
  phone?: string | null;
}

export interface RiskAssessment {
  applicationId: string;
  score: number;
  recommendation: RiskRecommendation;
  reasonCodes: string[];
  signals: Record<string, unknown>;
  policyVersion: string;
}
