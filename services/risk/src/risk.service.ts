import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PRISMA } from './internal/tokens.js';
import {
  DEVICE_RISK_PROVIDER,
  type DeviceRiskProvider,
} from './ports/device-risk.port.js';
import {
  IDENTITY_RISK_PROVIDER,
  type IdentityRiskProvider,
} from './ports/identity-risk.port.js';
import {
  RISK_DECLINE_THRESHOLD,
  RISK_MANUAL_REVIEW_THRESHOLD,
  RISK_POLICY_VERSION,
  RISK_REASON_CODES,
} from './policy.js';
import type {
  RiskAssessInput,
  RiskAssessment,
  RiskRecommendation,
} from './risk.types.js';

const VELOCITY_WINDOW_HOURS = 24;
const VELOCITY_USER_THRESHOLD = 3; // ≥3 apps in 24h is suspicious
const VELOCITY_IP_THRESHOLD = 5;

/**
 * Composite risk assessment. Pulls signals from device + identity
 * providers and from local velocity counters, weighs them, persists a
 * RiskAssessment row, and emits RiskFlag rows for severe contributors.
 *
 * Recommendation policy (see policy.ts):
 *   score >= 80     → decline
 *   50 <= score <80 → manual_review
 *   score < 50      → accept
 *
 * Hard rules (regardless of score):
 *   - Any contributor that produces a `critical` flag forces decline.
 *   - Any prior charge_off on this user forces manual_review (or decline
 *     if the score is already medium+).
 */
@Injectable()
export class RiskService {
  private readonly logger = new Logger(RiskService.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(DEVICE_RISK_PROVIDER) private readonly device: DeviceRiskProvider,
    @Inject(IDENTITY_RISK_PROVIDER) private readonly identity: IdentityRiskProvider,
  ) {}

  async assess(input: RiskAssessInput): Promise<RiskAssessment> {
    const reasonCodes = new Set<string>();
    const signals: Record<string, unknown> = {};
    let score = 0;
    let criticalFlag = false;

    // 1. Device + IP signals.
    let deviceResult: Awaited<ReturnType<DeviceRiskProvider['evaluate']>> | null = null;
    try {
      deviceResult = await this.device.evaluate({
        deviceFingerprint: input.deviceFingerprint,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        userId: input.userId,
      });
      signals['device'] = deviceResult;
      if (deviceResult.score !== null) {
        score = Math.max(score, deviceResult.score);
        if (deviceResult.score >= 80) reasonCodes.add(RISK_REASON_CODES.deviceProviderHigh);
        for (const c of deviceResult.reasonCodes) reasonCodes.add(c);
      }
    } catch (err) {
      this.logger.warn({ err }, 'device risk provider error — degraded mode');
    }

    // 2. Email + phone risk.
    try {
      const idResult = await this.identity.evaluate({
        email: input.email ?? null,
        phone: input.phone ?? null,
      });
      signals['identity'] = idResult;
      if (idResult.emailScore !== null && idResult.emailScore >= 80) {
        reasonCodes.add(RISK_REASON_CODES.emailProviderHigh);
      }
      if (idResult.phoneScore !== null && idResult.phoneScore >= 80) {
        reasonCodes.add(RISK_REASON_CODES.phoneProviderHigh);
      }
      const max = Math.max(
        idResult.emailScore ?? 0,
        idResult.phoneScore ?? 0,
      );
      score = Math.max(score, max);
      for (const c of idResult.reasonCodes) reasonCodes.add(c);
    } catch (err) {
      this.logger.warn({ err }, 'identity risk provider error — degraded mode');
    }

    // 3. Velocity — local SQL counts. Cheap, deterministic, audit-safe.
    const since = new Date(Date.now() - VELOCITY_WINDOW_HOURS * 60 * 60 * 1000);
    const [userCount, ipCount] = await Promise.all([
      this.prisma.application.count({
        where: { userId: input.userId, createdAt: { gte: since } },
      }),
      input.ipAddress
        ? this.prisma.auditOutbox.count({
            where: {
              action: 'application.created',
              after: { path: ['ipAddress'], equals: input.ipAddress } as never,
              occurredAt: { gte: since },
            },
          })
        : Promise.resolve(0),
    ]);
    signals['velocity'] = { userCount, ipCount };
    if (userCount >= VELOCITY_USER_THRESHOLD) {
      reasonCodes.add(RISK_REASON_CODES.velocityUser24h);
      score = Math.max(score, 60);
    }
    if (ipCount >= VELOCITY_IP_THRESHOLD) {
      reasonCodes.add(RISK_REASON_CODES.velocityIp24h);
      score = Math.max(score, 70);
    }

    // 4. Prior history — charge_off forces manual_review at minimum.
    const priorChargeOff = await this.prisma.loan.count({
      where: { userId: input.userId, status: 'charged_off' },
    });
    if (priorChargeOff > 0) {
      reasonCodes.add(RISK_REASON_CODES.priorChargeOff);
      score = Math.max(score, 60);
      // Critical: if already at decline threshold from other factors,
      // a prior charge-off pins it there.
      if (score >= RISK_DECLINE_THRESHOLD - 10) criticalFlag = true;
    }
    signals['priorChargeOff'] = priorChargeOff;

    // Decision.
    let recommendation: RiskRecommendation;
    if (criticalFlag || score >= RISK_DECLINE_THRESHOLD) {
      recommendation = 'decline';
    } else if (score >= RISK_MANUAL_REVIEW_THRESHOLD) {
      recommendation = 'manual_review';
    } else {
      recommendation = 'accept';
    }

    const reasonCodeArray = [...reasonCodes];

    // Persist + write flags atomically.
    await this.prisma.$transaction(async (tx) => {
      await tx.riskAssessment.upsert({
        where: { applicationId: input.applicationId },
        create: {
          applicationId: input.applicationId,
          score,
          recommendation,
          reasonCodes: reasonCodeArray,
          signals: signals as object,
          policyVersion: RISK_POLICY_VERSION,
        },
        update: {
          score,
          recommendation,
          reasonCodes: reasonCodeArray,
          signals: signals as object,
          policyVersion: RISK_POLICY_VERSION,
        },
      });

      // Severity ladder: provider 'high' codes raise medium flags;
      // velocity codes raise high; criticalFlag raises critical.
      if (deviceResult?.score !== null && (deviceResult?.score ?? 0) >= 80) {
        await tx.riskFlag.create({
          data: {
            subjectType: 'Application',
            subjectId: input.applicationId,
            flagType: RISK_REASON_CODES.deviceProviderHigh,
            severity: 'medium',
            evidence: { deviceScore: deviceResult?.score },
          },
        });
      }
      if (reasonCodes.has(RISK_REASON_CODES.velocityUser24h)) {
        await tx.riskFlag.create({
          data: {
            subjectType: 'User',
            subjectId: input.userId,
            flagType: RISK_REASON_CODES.velocityUser24h,
            severity: 'high',
            evidence: { userCount, windowHours: VELOCITY_WINDOW_HOURS },
          },
        });
      }
      if (criticalFlag) {
        await tx.riskFlag.create({
          data: {
            subjectType: 'Application',
            subjectId: input.applicationId,
            flagType: 'critical_composite',
            severity: 'critical',
            evidence: { score, reasonCodes: reasonCodeArray },
          },
        });
      }

      await tx.auditOutbox.create({
        data: {
          actorType: 'service',
          actorId: null,
          action: 'risk.assessed',
          targetType: 'Application',
          targetId: input.applicationId,
          after: {
            score,
            recommendation,
            reasonCodes: reasonCodeArray,
            policyVersion: RISK_POLICY_VERSION,
          },
        },
      });
    });

    return {
      applicationId: input.applicationId,
      score,
      recommendation,
      reasonCodes: reasonCodeArray,
      signals,
      policyVersion: RISK_POLICY_VERSION,
    };
  }

  /**
   * Manually raise a flag — used by support/admin or by other services
   * detecting a signal outside the assess() flow (e.g. failed payment
   * spikes triggering a velocity flag on the loan).
   */
  async raiseFlag(input: {
    subjectType: string;
    subjectId: string;
    flagType: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    evidence?: Record<string, unknown>;
  }): Promise<{ id: string }> {
    const f = await this.prisma.riskFlag.create({
      data: {
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        flagType: input.flagType,
        severity: input.severity,
        evidence: (input.evidence ?? {}) as object,
      },
      select: { id: true },
    });
    return f;
  }
}
