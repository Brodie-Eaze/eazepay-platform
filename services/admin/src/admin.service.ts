import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import {
  type ApplicationStatus,
  type PiiUnmaskReasonCode,
  type RiskFlagSeverity,
} from '@prisma/client';
import { BadRequest, Conflict, Forbidden, NotFound } from '@eazepay/shared-utils';
import type { UserId } from '@eazepay/shared-types';
import { NOTIFY_PORT, type NotifyPort } from '@eazepay/service-notification';
import type { ComplianceDocService } from '@eazepay/service-compliance-doc';
import type { PiiVaultService } from '@eazepay/service-user';
import { type PiiV1 } from '@eazepay/service-user';
import { PRISMA } from './internal/tokens.js';
import { isValidReasonCode } from './reason-codes.js';

/** Whitelisted PII fields an unmask request may target. Everything not
 *  in this list is rejected at request time — adding a field here is a
 *  deliberate compliance decision, not a casual code change. */
const ALLOWED_UNMASK_FIELDS = new Set<string>([
  'legalName.first',
  'legalName.middle',
  'legalName.last',
  'dateOfBirth',
  'ssnLast4',
  'address.line1',
  'address.line2',
  'address.city',
  'address.state',
  'address.zip',
]);

/** Default TTL for an approved unmask. Cap (1 hour) is enforced on the
 *  request input so admins can't request indefinite access. */
const UNMASK_DEFAULT_TTL_SECONDS = 30 * 60;
const UNMASK_MAX_TTL_SECONDS = 60 * 60;

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
    @Optional() private readonly complianceDoc?: ComplianceDocService,
    @Optional() private readonly vault?: PiiVaultService,
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

      const dualControlRequired = app.requestedAmountCents >= DUAL_CONTROL_AMOUNT_THRESHOLD_CENTS;

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

      // Render + persist the formal Adverse Action Notice document
      // (FCRA + ECOA-shaped PDF). Best-effort — failures here log but
      // never block the decline transaction since the application
      // status has already been recorded.
      if (this.complianceDoc) {
        void this.complianceDoc
          .generateAdverseActionNoticeForApplication(applicationId)
          .catch((err) =>
            this.logger.error({ err, applicationId }, 'admin decline AAN generation failed'),
          );
      }

      // Notify post-commit. ComplianceDocService also fires a
      // notification when it generates the AAN (with documentId on the
      // payload); that one is sent the moment the PDF is ready, so this
      // call is the immediate "we received your decision" message.
      if (this.notify) {
        void this.notify
          .notify({
            userId: app.userId,
            templateKey: 'application.declined',
            payload: { reasonCodes: input.reasonCodes },
            subjectType: 'Application',
            subjectId: applicationId,
          })
          .catch((err) => this.logger.error({ err }, 'admin decline notify failed'));
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

  // ----------------- JIT PII unmask -----------------

  /**
   * Admin requests JIT unmask of specific PII fields on a User. Status
   * starts at pending_approval; a different admin must approve before
   * any plaintext is yielded. Field allowlist enforced.
   *
   * Pairs with a ComplianceReview row of kind=pii_unmask_request so
   * the chain (request → approval → reads) is one regulator query.
   */
  async requestPiiUnmask(
    requesterUserId: UserId,
    input: {
      subjectType: 'User' | 'BeneficialOwner';
      subjectId: string;
      fields: string[];
      reasonCode: PiiUnmaskReasonCode;
      reasonNotes: string;
      ttlSeconds?: number;
    },
  ): Promise<{ id: string; status: 'pending_approval'; complianceReviewId: string }> {
    if (!input.fields || input.fields.length === 0) {
      throw BadRequest({ code: 'unmask_fields_required' });
    }
    const invalid = input.fields.filter((f) => !ALLOWED_UNMASK_FIELDS.has(f));
    if (invalid.length > 0) {
      throw BadRequest({
        code: 'unmask_fields_not_allowed',
        detail: `not in allowlist: ${invalid.join(', ')}`,
      });
    }
    if (input.reasonNotes.trim().length < 10) {
      throw BadRequest({
        code: 'unmask_reason_notes_too_short',
        detail: 'reasonNotes must be ≥ 10 chars to satisfy audit narrative',
      });
    }
    const ttl = Math.min(
      UNMASK_MAX_TTL_SECONDS,
      Math.max(60, input.ttlSeconds ?? UNMASK_DEFAULT_TTL_SECONDS),
    );

    return this.prisma.$transaction(async (tx) => {
      // Confirm the subject exists.
      if (input.subjectType === 'User') {
        const u = await tx.user.findUnique({
          where: { id: input.subjectId },
          select: { id: true },
        });
        if (!u) throw NotFound({ code: 'subject_not_found' });
      } else {
        const bo = await tx.beneficialOwner.findUnique({
          where: { id: input.subjectId },
          select: { id: true },
        });
        if (!bo) throw NotFound({ code: 'subject_not_found' });
      }

      const review = await tx.complianceReview.create({
        data: {
          kind: 'pii_unmask_request',
          subjectType: input.subjectType,
          subjectId: input.subjectId,
          reason: input.reasonNotes,
          reasonCodes: [input.reasonCode],
          status: 'pending_dual_control',
          createdByUserId: requesterUserId,
          dualControlRequired: true,
          evidence: { fields: input.fields, ttlSeconds: ttl },
        },
        select: { id: true },
      });
      const req = await tx.piiUnmaskRequest.create({
        data: {
          subjectType: input.subjectType,
          subjectId: input.subjectId,
          fields: input.fields,
          reasonCode: input.reasonCode,
          reasonNotes: input.reasonNotes,
          requestedByUserId: requesterUserId,
          complianceReviewId: review.id,
        },
        select: { id: true },
      });
      await tx.auditOutbox.create({
        data: {
          actorType: 'admin',
          actorId: requesterUserId,
          action: 'admin.pii.unmask.requested',
          targetType: input.subjectType,
          targetId: input.subjectId,
          after: {
            requestId: req.id,
            fields: input.fields,
            reasonCode: input.reasonCode,
            ttlSeconds: ttl,
            complianceReviewId: review.id,
          },
        },
      });
      return {
        id: req.id,
        status: 'pending_approval' as const,
        complianceReviewId: review.id,
      };
    });
  }

  /**
   * Second admin approves. Hard rule: approver != requester.
   * Sets status=approved + approvedAt + expiresAt.
   */
  async approvePiiUnmask(
    approverUserId: UserId,
    requestId: string,
    input: { ttlSeconds?: number },
  ): Promise<{ id: string; status: 'approved'; expiresAt: string }> {
    return this.prisma.$transaction(async (tx) => {
      const req = await tx.piiUnmaskRequest.findUnique({ where: { id: requestId } });
      if (!req) throw NotFound({ code: 'unmask_request_not_found' });
      if (req.status !== 'pending_approval') {
        throw Conflict({
          code: 'unmask_request_not_pending',
          detail: `status=${req.status}`,
        });
      }
      if (req.requestedByUserId === approverUserId) {
        throw Conflict({
          code: 'dual_control_violation',
          detail: 'unmask approver must differ from requester',
        });
      }
      const ttl = Math.min(
        UNMASK_MAX_TTL_SECONDS,
        Math.max(60, input.ttlSeconds ?? UNMASK_DEFAULT_TTL_SECONDS),
      );
      const expiresAt = new Date(Date.now() + ttl * 1000);
      const updated = await tx.piiUnmaskRequest.update({
        where: { id: requestId },
        data: {
          status: 'approved',
          approvedByUserId: approverUserId,
          approvedAt: new Date(),
          expiresAt,
        },
        select: { id: true, expiresAt: true },
      });
      // Move the parent ComplianceReview into a working state.
      if (req.complianceReviewId) {
        await tx.complianceReview.update({
          where: { id: req.complianceReviewId },
          data: { status: 'open', closedByUserId: approverUserId },
        });
      }
      await tx.auditOutbox.create({
        data: {
          actorType: 'admin',
          actorId: approverUserId,
          action: 'admin.pii.unmask.approved',
          targetType: req.subjectType,
          targetId: req.subjectId,
          after: { requestId: req.id, expiresAt: expiresAt.toISOString() },
        },
      });
      return {
        id: updated.id,
        status: 'approved' as const,
        expiresAt: updated.expiresAt!.toISOString(),
      };
    });
  }

  /** Voluntary or admin-driven revocation. Irreversible. */
  async revokePiiUnmask(
    actorUserId: UserId,
    requestId: string,
  ): Promise<{ id: string; status: 'revoked' }> {
    return this.prisma.$transaction(async (tx) => {
      const req = await tx.piiUnmaskRequest.findUnique({ where: { id: requestId } });
      if (!req) throw NotFound({ code: 'unmask_request_not_found' });
      if (req.status === 'revoked' || req.status === 'expired' || req.status === 'consumed') {
        throw Conflict({ code: 'unmask_already_terminal' });
      }
      const updated = await tx.piiUnmaskRequest.update({
        where: { id: requestId },
        data: {
          status: 'revoked',
          revokedAt: new Date(),
          revokedByUserId: actorUserId,
        },
        select: { id: true },
      });
      await tx.auditOutbox.create({
        data: {
          actorType: 'admin',
          actorId: actorUserId,
          action: 'admin.pii.unmask.revoked',
          targetType: req.subjectType,
          targetId: req.subjectId,
          after: { requestId: req.id },
        },
      });
      return { id: updated.id, status: 'revoked' as const };
    });
  }

  /**
   * Read decrypted ConsumerProfile fields under an approved unmask
   * request. Each call writes a separate AuditOutbox row with the
   * specific fields returned. Out-of-window or wrong-subject calls
   * raise (and DO NOT auto-flip status='expired' — a sweep job handles
   * the bulk transition; we return the right error here either way).
   */
  async readUnmaskedProfile(
    actorUserId: UserId,
    requestId: string,
  ): Promise<{
    requestId: string;
    subjectType: 'User' | 'BeneficialOwner';
    subjectId: string;
    fields: Record<string, unknown>;
  }> {
    if (!this.vault) {
      throw Conflict({
        code: 'vault_unavailable',
        detail: 'PiiVaultService not wired — refusing to yield plaintext',
      });
    }

    const req = await this.prisma.piiUnmaskRequest.findUnique({ where: { id: requestId } });
    if (!req) throw NotFound({ code: 'unmask_request_not_found' });
    if (req.status !== 'approved') {
      throw Forbidden({ code: 'unmask_not_approved', detail: `status=${req.status}` });
    }
    if (!req.expiresAt || req.expiresAt.getTime() < Date.now()) {
      throw Forbidden({ code: 'unmask_expired' });
    }
    if (req.requestedByUserId === actorUserId) {
      // The requester themselves can read; the approval gate is dual.
      // (No-op branch — kept explicit for the "who can read" contract.)
    }

    let fullPii: PiiV1;
    let subjectKey: UserId;
    if (req.subjectType === 'User') {
      const profile = await this.prisma.consumerProfile.findUnique({
        where: { userId: req.subjectId },
      });
      if (!profile) throw NotFound({ code: 'subject_profile_not_found' });
      subjectKey = req.subjectId as UserId;
      fullPii = await this.vault.open(subjectKey, {
        ciphertext: profile.piiCiphertext,
        nonce: profile.piiNonce,
        dataKeyCiphertext: profile.dataKeyCiphertext,
        kekId: profile.kekId,
        schemaVersion: profile.piiSchemaVersion,
      });
    } else {
      const bo = await this.prisma.beneficialOwner.findUnique({
        where: { id: req.subjectId },
      });
      if (!bo) throw NotFound({ code: 'subject_profile_not_found' });
      // SEC-019: BO PII now sealed with per-beneficial-owner AAD
      // (`pii:bo:<boId>:v2`). The vault.openForBo helper auto-routes
      // v1 (legacy merchant-bound AAD) and v2 (per-BO AAD) rows by
      // inspecting `schemaVersion`. This closes the ciphertext-swap
      // hole where one BO's blob could be transplanted onto another
      // BO row under the same merchant without the GCM tag check
      // catching it.
      subjectKey = bo.merchantId as unknown as UserId;
      fullPii = await this.vault.openForBo(bo.id, bo.merchantId, {
        ciphertext: bo.piiCiphertext,
        nonce: bo.piiNonce,
        dataKeyCiphertext: bo.dataKeyCiphertext,
        kekId: bo.kekId,
        schemaVersion: bo.piiSchemaVersion,
      });
    }

    // Project only the fields the request authorised.
    const projected = projectFields(fullPii, req.fields);

    await this.prisma.auditOutbox.create({
      data: {
        actorType: 'admin',
        actorId: actorUserId,
        action: 'admin.pii.unmask.read',
        targetType: req.subjectType,
        targetId: req.subjectId,
        after: { requestId: req.id, fields: req.fields },
      },
    });

    return {
      requestId: req.id,
      subjectType: req.subjectType as 'User' | 'BeneficialOwner',
      subjectId: req.subjectId,
      fields: projected,
    };
  }

  /**
   * Re-render an Adverse Action Notice with the recipient's actual
   * legal name + address, sourced via an approved JIT PII unmask
   * request. The prior anonymous (or earlier personalised) notice is
   * marked superseded; the new render becomes the active document.
   *
   * Hard rules:
   *  - The unmask request MUST be subjectType=User and subjectId equal
   *    to the application's userId — defends against unmask-laundering
   *    one user's PII into another user's notice.
   *  - The unmask request MUST include legalName.first AND .last; we
   *    refuse to render a partially-named notice. Address is optional
   *    (the email/phone fallback for delivery is fine).
   *  - The compliance-doc + admin services must both be wired or this
   *    method 409s.
   */
  async regenerateAdverseActionNoticeWithUnmask(
    actorUserId: UserId,
    applicationId: string,
    unmaskRequestId: string,
  ): Promise<{ documentId: string; supersededDocumentId: string | null; sha256: string }> {
    if (!this.complianceDoc) {
      throw Conflict({
        code: 'compliance_doc_unavailable',
        detail: 'ComplianceDocService not wired',
      });
    }

    // Resolve the application early to validate the unmask binds to its userId.
    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: { id: true, userId: true, status: true },
    });
    if (!app) throw NotFound({ code: 'application_not_found' });
    if (app.status !== 'declined') {
      throw Conflict({
        code: 'application_not_declined',
        detail: `application status=${app.status}`,
      });
    }

    // readUnmaskedProfile validates approval + expiry + writes the per-read audit row.
    const unmask = await this.readUnmaskedProfile(actorUserId, unmaskRequestId);
    if (unmask.subjectType !== 'User' || unmask.subjectId !== app.userId) {
      throw Forbidden({
        code: 'unmask_subject_mismatch',
        detail: 'unmask request does not bind to this application`s user',
      });
    }

    const first = unmask.fields['legalName.first'];
    const last = unmask.fields['legalName.last'];
    if (typeof first !== 'string' || typeof last !== 'string') {
      throw BadRequest({
        code: 'unmask_missing_legal_name',
        detail: 'unmask request must include legalName.first AND legalName.last',
      });
    }
    const middle = unmask.fields['legalName.middle'];
    const legalName = [first, typeof middle === 'string' ? middle : '', last]
      .filter(Boolean)
      .join(' ')
      .trim();

    let address:
      | { line1: string; line2?: string; city: string; state: string; zip: string }
      | undefined;
    const al1 = unmask.fields['address.line1'];
    const acity = unmask.fields['address.city'];
    const astate = unmask.fields['address.state'];
    const azip = unmask.fields['address.zip'];
    if (
      typeof al1 === 'string' &&
      typeof acity === 'string' &&
      typeof astate === 'string' &&
      typeof azip === 'string'
    ) {
      const al2 = unmask.fields['address.line2'];
      address = {
        line1: al1,
        ...(typeof al2 === 'string' && al2 ? { line2: al2 } : {}),
        city: acity,
        state: astate,
        zip: azip,
      };
    }

    const result = await this.complianceDoc.generateAdverseActionNoticeForApplication(
      applicationId,
      {
        recipientOverride: { legalName, ...(address ? { address } : {}) },
        supersedePrior: true,
      },
    );

    await this.prisma.auditOutbox.create({
      data: {
        actorType: 'admin',
        actorId: actorUserId,
        action: 'admin.adverse_action_notice.regenerated',
        targetType: 'Application',
        targetId: applicationId,
        after: {
          documentId: result.documentId,
          supersededDocumentId: result.supersededDocumentId,
          unmaskRequestId,
        },
      },
    });

    return {
      documentId: result.documentId,
      supersededDocumentId: result.supersededDocumentId,
      sha256: result.sha256,
    };
  }
}

/** Project a dotted-path subset of a nested object. Unknown paths are
 *  silently dropped. Returns a flat-key map for a simple JSON contract
 *  (e.g. { 'legalName.first': 'Alex' }). */
function projectFields(source: Record<string, unknown>, paths: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of paths) {
    const parts = p.split('.');
    let cur: unknown = source;
    for (const part of parts) {
      if (cur && typeof cur === 'object' && part in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[part];
      } else {
        cur = undefined;
        break;
      }
    }
    if (cur !== undefined) out[p] = cur;
  }
  return out;
}
