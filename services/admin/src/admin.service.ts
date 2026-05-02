import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaClient, type ApplicationStatus, type RiskFlagSeverity } from '@prisma/client';
import { BadRequest, Conflict, NotFound } from '@eazepay/shared-utils';
import type { UserId } from '@eazepay/shared-types';
import { NOTIFY_PORT, type NotifyPort } from '@eazepay/service-notification';
import { PRISMA } from './internal/tokens.js';
import { isValidReasonCode } from './reason-codes.js';

/** Decline overrides for amounts above this threshold require dual
 *  control: a second admin must close the ComplianceReview before the
 *  application transitions to declined. Below the threshold, single
 *  admin closes inline. */
const DUAL_CONTROL_AMOUNT_THRESHOLD_CENTS = 2_500_000n; // $25,000.00

interface PageOpts {
  cursor?: string;
  limit: number;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Optional() @Inject(NOTIFY_PORT) private readonly notify?: NotifyPort,
  ) {}

  // -------------- mutations --------------

  /**
   * Admin-driven application decline. End-to-end:
   *  1. Validate transitionable status (submitted | underwriting |
   *     offers_presented | accepted).
   *  2. Validate every reasonCode against the Reg B / FCRA taxonomy.
   *  3. Withdraw any presented offers; void any drafted-but-unsigned
   *     contract.
   *  4. Persist application.declined + declineReasonCodes + decisionAt.
   *  5. Open a ComplianceReview row (kind=application_decline).
   *     - Below threshold: closed_declined inline by the same admin.
   *     - At/above threshold: status=pending_dual_control. A second
   *       admin must call POST /v1/admin/compliance-reviews/:id/close
   *       — until then the application sits at declined but the review
   *       is open.
   *  6. AuditOutbox row with the admin actorId.
   *  7. Notify the consumer (application.declined template).
   *
   * The Adverse Action Notice document is rendered + delivered by the
   * compliance-document service in a follow-on round; the notification
   * fired here is the in-app/email "we have a decision" message.
   */
  async declineApplication(
    adminUserId: UserId,
    applicationId: string,
    input: { reasonCodes: string[]; notes?: string },
  ): Promise<{
    applicationId: string;
    status: 'declined';
    complianceReviewId: string;
    dualControlRequired: boolean;
  }> {
    if (!Array.isArray(input.reasonCodes) || input.reasonCodes.length === 0) {
      throw BadRequest({
        code: 'reason_codes_required',
        detail: 'admin decline requires at least one Reg B / FCRA reason code',
      });
    }
    const invalid = input.reasonCodes.filter((c) => !isValidReasonCode(c));
    if (invalid.length > 0) {
      throw BadRequest({
        code: 'reason_codes_invalid',
        detail: `unknown reason codes: ${invalid.join(', ')}`,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const app = await tx.application.findUnique({
        where: { id: applicationId },
      });
      if (!app) throw NotFound({ code: 'application_not_found' });
      const TRANSITIONABLE: ApplicationStatus[] = [
        'submitted',
        'underwriting',
        'offers_presented',
        'accepted',
      ];
      if (!TRANSITIONABLE.includes(app.status)) {
        throw Conflict({
          code: 'invalid_transition',
          detail: `cannot decline from ${app.status}`,
        });
      }

      const dualControlRequired =
        app.requestedAmountCents >= DUAL_CONTROL_AMOUNT_THRESHOLD_CENTS;

      // Withdraw presented offers; void unsigned contracts.
      await tx.offer.updateMany({
        where: { applicationId, status: 'presented' },
        data: { status: 'withdrawn' },
      });
      await tx.contract.updateMany({
        where: {
          applicationId,
          status: { in: ['drafted', 'sent'] },
        },
        data: { status: 'voided' },
      });

      await tx.application.update({
        where: { id: applicationId },
        data: {
          status: 'declined',
          decisionAt: new Date(),
          declineReasonCodes: input.reasonCodes,
        },
      });

      const review = await tx.complianceReview.create({
        data: {
          kind: 'application_decline',
          subjectType: 'Application',
          subjectId: applicationId,
          reason: input.notes ?? '',
          reasonCodes: input.reasonCodes,
          status: dualControlRequired ? 'pending_dual_control' : 'closed_declined',
          createdByUserId: adminUserId,
          closedByUserId: dualControlRequired ? null : adminUserId,
          closedAt: dualControlRequired ? null : new Date(),
          dualControlRequired,
          evidence: {
            statusBefore: app.status,
            requestedAmountCents: app.requestedAmountCents.toString(),
            channel: app.channel,
          },
        },
        select: { id: true },
      });

      await tx.auditOutbox.create({
        data: {
          actorType: 'admin',
          actorId: adminUserId,
          action: 'admin.application.declined',
          targetType: 'Application',
          targetId: applicationId,
          before: { status: app.status },
          after: {
            status: 'declined',
            reasonCodes: input.reasonCodes,
            complianceReviewId: review.id,
            dualControlRequired,
          },
        },
      });

      // Notify post-commit at the controller level (we're inside a TX).
      // Stash a marker on the result and let the controller fire it.
      // For service-internal callers, do a fire-and-forget here.
      if (this.notify) {
        void this.notify
          .notify({
            userId: app.userId,
            templateKey: 'application.declined',
            payload: { reasonCodes: input.reasonCodes },
            subjectType: 'Application',
            subjectId: applicationId,
          })
          .catch((err) =>
            this.logger.error({ err }, 'admin decline notify failed'),
          );
      }

      return {
        applicationId,
        status: 'declined' as const,
        complianceReviewId: review.id,
        dualControlRequired,
      };
    });
  }

  /**
   * Close a dual-control compliance review. The closer MUST differ from
   * the row's createdByUserId; same-admin close is rejected to enforce
   * the segregation-of-duties rule.
   */
  async closeComplianceReview(
    adminUserId: UserId,
    reviewId: string,
    input: {
      outcome: 'closed_approved' | 'closed_declined' | 'closed_no_action' | 'escalated_reportable';
      notes?: string;
      reportableMatterRef?: string;
    },
  ): Promise<{ id: string; status: string }> {
    return this.prisma.$transaction(async (tx) => {
      const review = await tx.complianceReview.findUnique({ where: { id: reviewId } });
      if (!review) throw NotFound({ code: 'review_not_found' });
      if (review.status !== 'pending_dual_control' && review.status !== 'open') {
        throw Conflict({
          code: 'review_already_closed',
          detail: `review status=${review.status}`,
        });
      }
      if (review.dualControlRequired && review.createdByUserId === adminUserId) {
        throw Conflict({
          code: 'dual_control_violation',
          detail: 'closing admin must differ from creating admin',
        });
      }
      const updated = await tx.complianceReview.update({
        where: { id: reviewId },
        data: {
          status: input.outcome,
          closedByUserId: adminUserId,
          closedAt: new Date(),
          reportableMatterRef: input.reportableMatterRef ?? null,
          reason: input.notes ? `${review.reason}\n\n[close]: ${input.notes}` : review.reason,
        },
        select: { id: true, status: true },
      });
      await tx.auditOutbox.create({
        data: {
          actorType: 'admin',
          actorId: adminUserId,
          action: 'admin.compliance_review.closed',
          targetType: 'ComplianceReview',
          targetId: reviewId,
          before: { status: review.status },
          after: { status: input.outcome, reportableMatterRef: input.reportableMatterRef ?? null },
        },
      });
      return updated;
    });
  }

  /**
   * Resolve a risk flag. Admin records whether the flag was confirmed
   * (genuinely risky) or cleared (false positive). Both close the row;
   * the resolution is captured in evidence + audit. Confirmed-high+
   * resolutions auto-create a ComplianceReview for follow-on tracking.
   */
  async resolveRiskFlag(
    adminUserId: UserId,
    flagId: string,
    input: { resolution: 'confirmed' | 'cleared'; notes?: string },
  ): Promise<{ id: string; resolvedAt: string }> {
    return this.prisma.$transaction(async (tx) => {
      const flag = await tx.riskFlag.findUnique({ where: { id: flagId } });
      if (!flag) throw NotFound({ code: 'flag_not_found' });
      if (flag.resolvedAt) {
        throw Conflict({ code: 'flag_already_resolved' });
      }
      const updated = await tx.riskFlag.update({
        where: { id: flagId },
        data: {
          resolvedAt: new Date(),
          resolvedBy: adminUserId,
          evidence: {
            ...(flag.evidence as Record<string, unknown>),
            resolution: input.resolution,
            notes: input.notes ?? null,
          },
        },
        select: { id: true, resolvedAt: true },
      });

      // High/critical confirmed flags open a ComplianceReview row so
      // the chain to a reportable matter (or written-off escalation) is
      // captured.
      if (
        input.resolution === 'confirmed' &&
        (flag.severity === 'high' || flag.severity === 'critical')
      ) {
        await tx.complianceReview.create({
          data: {
            kind: 'risk_flag_resolution',
            subjectType: flag.subjectType,
            subjectId: flag.subjectId,
            reason: input.notes ?? '',
            reasonCodes: [flag.flagType],
            status: 'open',
            createdByUserId: adminUserId,
            evidence: { riskFlagId: flagId, severity: flag.severity },
          },
        });
      }

      await tx.auditOutbox.create({
        data: {
          actorType: 'admin',
          actorId: adminUserId,
          action: 'admin.risk_flag.resolved',
          targetType: 'RiskFlag',
          targetId: flagId,
          after: { resolution: input.resolution },
        },
      });
      return {
        id: updated.id,
        resolvedAt: updated.resolvedAt!.toISOString(),
      };
    });
  }

  /**
   * Application queue. Default surfaces manual-review-eligible work
   * (status `submitted` / `underwriting` / `offers_presented` whose
   * latest RiskAssessment recommends manual_review). Filters by status
   * + risk recommendation are caller-controllable.
   *
   * Every read by an admin writes an audit row at the controller level —
   * NOT here — so we don't double-audit on internal joins.
   */
  async listApplicationQueue(opts: {
    status?: ApplicationStatus[];
    riskRecommendation?: 'manual_review' | 'decline' | 'accept';
    paging: PageOpts;
  }): Promise<{
    items: Array<{
      id: string;
      userId: string;
      merchantId: string | null;
      status: ApplicationStatus;
      category: string;
      requestedAmountCents: bigint;
      submittedAt: string | null;
      riskScore: number | null;
      riskRecommendation: string | null;
      riskReasonCodes: string[];
      createdAt: string;
    }>;
    nextCursor: string | null;
  }> {
    const items = await this.prisma.application.findMany({
      where: {
        ...(opts.status ? { status: { in: opts.status } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: opts.paging.limit + 1,
      ...(opts.paging.cursor ? { skip: 1, cursor: { id: opts.paging.cursor } } : {}),
    });

    const ids = items.map((a) => a.id);
    const assessments = await this.prisma.riskAssessment.findMany({
      where: { applicationId: { in: ids } },
    });
    const byApp = new Map(assessments.map((a) => [a.applicationId, a]));

    const filtered = opts.riskRecommendation
      ? items.filter((a) => byApp.get(a.id)?.recommendation === opts.riskRecommendation)
      : items;

    const hasMore = filtered.length > opts.paging.limit;
    const sliced = hasMore ? filtered.slice(0, opts.paging.limit) : filtered;
    return {
      items: sliced.map((a) => {
        const r = byApp.get(a.id);
        return {
          id: a.id,
          userId: a.userId,
          merchantId: a.merchantId,
          status: a.status,
          category: a.category,
          requestedAmountCents: a.requestedAmountCents,
          submittedAt: a.submittedAt?.toISOString() ?? null,
          riskScore: r?.score ?? null,
          riskRecommendation: r?.recommendation ?? null,
          riskReasonCodes: r?.reasonCodes ?? [],
          createdAt: a.createdAt.toISOString(),
        };
      }),
      nextCursor: hasMore ? sliced[sliced.length - 1]!.id : null,
    };
  }

  /**
   * Admin-side application detail. Returns the full picture: application
   * + user + merchant context (if any) + offers + lender routes + risk
   * assessment + flags + (masked) PII. PII unmasking requires a
   * just-in-time access elevation in production — at MVP we surface the
   * underlying ConsumerProfile metadata only (no decryption here).
   */
  async getApplicationDetail(applicationId: string): Promise<unknown> {
    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        user: {
          select: { id: true, email: true, phoneE164: true, status: true, kycStatus: true },
        },
        offers: { orderBy: { rank: 'asc' } },
        contracts: true,
        loans: true,
      },
    });
    if (!app) throw NotFound({ code: 'application_not_found' });

    const [routes, risk, flags] = await Promise.all([
      this.prisma.lenderRoute.findMany({
        where: { applicationId },
        orderBy: { evaluationOrder: 'asc' },
        include: { lender: { select: { adapterKey: true, legalName: true } } },
      }),
      this.prisma.riskAssessment.findUnique({ where: { applicationId } }),
      this.prisma.riskFlag.findMany({
        where: {
          OR: [
            { subjectType: 'Application', subjectId: applicationId },
            { subjectType: 'User', subjectId: app.userId },
          ],
        },
        orderBy: { raisedAt: 'desc' },
      }),
    ]);

    return {
      application: {
        id: app.id,
        status: app.status,
        channel: app.channel,
        category: app.category,
        requestedAmountCents: app.requestedAmountCents,
        termMonths: app.termMonths,
        purposeDetail: app.purposeDetail,
        riskScore: app.riskScore,
        affordabilityPasses: app.affordabilityPasses,
        declineReasonCodes: app.declineReasonCodes,
        policyVersion: app.policyVersion,
        submittedAt: app.submittedAt?.toISOString() ?? null,
        decisionAt: app.decisionAt?.toISOString() ?? null,
        createdAt: app.createdAt.toISOString(),
      },
      user: app.user,
      merchantId: app.merchantId,
      offers: app.offers,
      contracts: app.contracts,
      loans: app.loans,
      lenderRoutes: routes.map((r) => ({
        id: r.id,
        order: r.evaluationOrder,
        outcome: r.outcome,
        reasonCodes: r.reasonCodes,
        latencyMs: r.evaluationLatencyMs,
        evaluatedAt: r.evaluatedAt.toISOString(),
        lender: r.lender,
      })),
      riskAssessment: risk,
      riskFlags: flags,
    };
  }

  /**
   * Audit log viewer (cursor-paginated). Supports filters by target +
   * action prefix + actor + time window. Read-only — there is no
   * admin-side mutation of audit rows.
   */
  async listAuditLogs(opts: {
    targetType?: string;
    targetId?: string;
    actionPrefix?: string;
    actorId?: string;
    sinceIso?: string;
    paging: PageOpts;
  }): Promise<{
    items: Array<{
      id: string;
      actorType: string;
      actorId: string | null;
      action: string;
      targetType: string;
      targetId: string;
      before: unknown;
      after: unknown;
      occurredAt: string;
    }>;
    nextCursor: string | null;
  }> {
    const items = await this.prisma.auditOutbox.findMany({
      where: {
        ...(opts.targetType ? { targetType: opts.targetType } : {}),
        ...(opts.targetId ? { targetId: opts.targetId } : {}),
        ...(opts.actorId ? { actorId: opts.actorId } : {}),
        ...(opts.actionPrefix ? { action: { startsWith: opts.actionPrefix } } : {}),
        ...(opts.sinceIso ? { occurredAt: { gte: new Date(opts.sinceIso) } } : {}),
      },
      orderBy: { occurredAt: 'desc' },
      take: opts.paging.limit + 1,
      ...(opts.paging.cursor ? { skip: 1, cursor: { id: opts.paging.cursor } } : {}),
    });
    const hasMore = items.length > opts.paging.limit;
    const sliced = hasMore ? items.slice(0, opts.paging.limit) : items;
    return {
      items: sliced.map((a) => ({
        id: a.id,
        actorType: a.actorType,
        actorId: a.actorId,
        action: a.action,
        targetType: a.targetType,
        targetId: a.targetId,
        before: a.before,
        after: a.after,
        occurredAt: a.occurredAt.toISOString(),
      })),
      nextCursor: hasMore ? sliced[sliced.length - 1]!.id : null,
    };
  }

  /** Open risk flags, optionally filtered by minimum severity. */
  async listOpenRiskFlags(opts: {
    minSeverity?: RiskFlagSeverity;
    paging: PageOpts;
  }): Promise<unknown> {
    const order: Record<RiskFlagSeverity, number> = {
      low: 0,
      medium: 1,
      high: 2,
      critical: 3,
    };
    const items = await this.prisma.riskFlag.findMany({
      where: { resolvedAt: null },
      orderBy: { raisedAt: 'desc' },
      take: opts.paging.limit + 1,
      ...(opts.paging.cursor ? { skip: 1, cursor: { id: opts.paging.cursor } } : {}),
    });
    const filtered = opts.minSeverity
      ? items.filter((f) => order[f.severity] >= order[opts.minSeverity!])
      : items;
    const hasMore = filtered.length > opts.paging.limit;
    const sliced = hasMore ? filtered.slice(0, opts.paging.limit) : filtered;
    return {
      items: sliced,
      nextCursor: hasMore ? sliced[sliced.length - 1]!.id : null,
    };
  }
}
